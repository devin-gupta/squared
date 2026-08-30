const test = require("node:test");
const assert = require("node:assert/strict");
const { createClient } = require("@supabase/supabase-js");
const moduleAt = require("./load-module.cjs");
const tripId = "22222222-2222-4222-8222-222222222222";
const creatorId = "33333333-3333-4333-8333-333333333333";
const memberId = "44444444-4444-4444-8444-444444444444";

function fixture(options = {}) {
  const calls = [];
  const removal = moduleAt("lib/trips/remove.ts", { "server-only": {} });
  const route = moduleAt("app/api/trips/[id]/members/route.ts", {
    "next/server": {
      NextResponse: { json: (body, init) => Response.json(body, init) },
    },
    "@/lib/trips/remove": removal,
    "@/lib/supabase/client": { supabase: {} },
    "@supabase/supabase-js": {
      createClient(url, key, config) {
        return createClient(url, key, {
          ...config,
          global: {
            ...config.global,
            fetch: async (input, init) => {
              const request = new Request(input, init),
                url = new URL(request.url);
              const auth = request.headers.get("authorization");
              calls.push({ method: request.method, path: url.pathname, auth });
              const userId =
                auth === "Bearer member-session"
                  ? "member-user"
                  : "creator-user";
              if (url.pathname === "/auth/v1/user")
                return options.invalidAuth
                  ? Response.json(
                      { message: "Expired", code: "bad_jwt" },
                      { status: 401 },
                    )
                  : Response.json({ id: userId });
              assert.match(auth, /^Bearer (creator|member)-session$/);
              const fail = () =>
                Response.json({ message: "Unavailable" }, { status: 503 });
              const rows = (value) =>
                Response.json(
                  request.headers.get("accept")?.includes("vnd.pgrst.object")
                    ? (value[0] ?? null)
                    : value,
                );
              if (url.pathname === "/rest/v1/trips")
                return options.tripError
                  ? fail()
                  : rows(
                      options.missingTrip ? [] : [{ created_by: "Creator" }],
                    );
              if (url.pathname === "/rest/v1/transactions") {
                assert.equal(request.method, "GET");
                assert.equal(url.searchParams.get("trip_id"), "eq." + tripId);
                return options.expenseError
                  ? fail()
                  : rows(
                      (options.transactions || []).slice(
                        Number(url.searchParams.get("offset") || 0),
                        Number(url.searchParams.get("offset") || 0) +
                          Number(url.searchParams.get("limit") || 500),
                      ),
                    );
              }
              assert.equal(url.pathname, "/rest/v1/trip_members");
              assert.equal(url.searchParams.get("trip_id"), "eq." + tripId);
              if (request.method === "GET")
                return options.memberError
                  ? fail()
                  : rows([
                      ...(options.nonmember
                        ? []
                        : [
                            {
                              id: creatorId,
                              display_name: "Creator",
                              user_id: "creator-user",
                            },
                          ]),
                      ...(options.missingTarget
                        ? []
                        : [
                            {
                              id: memberId,
                              display_name: "rgupta1",
                              user_id: "member-user",
                            },
                          ]),
                    ]);
              assert.equal(
                request.method,
                "DELETE",
                "Never rewrite expenses or shares during removal",
              );
              assert.equal(url.searchParams.get("id"), "eq." + memberId);
              if (options.conflict)
                return Response.json(
                  { message: "Foreign key violation", code: "23503" },
                  { status: 409 },
                );
              if (options.deleteError) return fail();
              return rows(options.filtered ? [] : [{ id: memberId }]);
            },
          },
        });
      },
    },
  });
  return {
    calls,
    async run({ token = "creator-session", auth, target = memberId } = {}) {
      const url = new URL(
        `https://squared.example/api/trips/${tripId}/members?memberId=${target}`,
      );
      const request = new Request(url, {
        method: "DELETE",
        headers:
          auth === null ? {} : { authorization: auth ?? `Bearer ${token}` },
      });
      request.nextUrl = url;
      const response = await route.DELETE(request, {
        params: Promise.resolve({ id: tripId }),
      });
      return { status: response.status, body: await response.json() };
    },
  };
}

test("creator removal and self-leave carry the caller's session and confirm the deleted row", async () => {
  for (const token of ["creator-session", "member-session"]) {
    const f = fixture();
    assert.deepEqual(await f.run({ token }), {
      status: 200,
      body: { success: true },
    });
    assert(f.calls.every((call) => call.auth === `Bearer ${token}`));
    assert.equal(f.calls.filter((call) => call.method === "DELETE").length, 1);
  }
});

test("missing/expired sessions, nonmembers, and removing the creator are rejected before deletion", async () => {
  for (const auth of [null, "Basic token", "Bearer "]) {
    const f = fixture();
    assert.equal((await f.run({ auth })).status, 401);
    assert.equal(f.calls.length, 0);
  }
  for (const [options, args, status] of [
    [{ invalidAuth: true }, {}, 401],
    [{ nonmember: true }, {}, 403],
    [{}, { target: creatorId, token: "member-session" }, 403],
    [{}, { target: creatorId }, 409],
    [{}, { target: "invalid" }, 400],
  ]) {
    const f = fixture(options);
    assert.equal((await f.run(args)).status, status);
    assert(!f.calls.some((call) => call.method === "DELETE"));
  }
});

test("linked payers, explicit shares, equal shares, and receipt allocations preserve all expense history", async () => {
  for (const transaction of [
    { payer_id: memberId, split_type: "custom" },
    { split_type: "custom", adjustments: [{ member_id: memberId }] },
    { split_type: "equal" },
    { line_items: [{ amount: 10, split_among: [] }] },
    { line_items: [{ amount: 10, split_among: [memberId] }] },
    { line_items: [{ amount: 10, split_among: ["RGUPTA1"] }] },
  ]) {
    const f = fixture({ transactions: [transaction] }),
      result = await f.run();
    assert.equal(result.status, 409);
    assert.match(result.body.error, /rgupta1/);
    assert(f.calls.every((call) => call.method === "GET"));
  }
  const f = fixture({
    transactions: [
      {
        payer_id: creatorId,
        split_type: "custom",
        line_items: [{ amount: 10, split_among: ["Creator"] }],
      },
    ],
  });
  assert.equal((await f.run()).status, 200);
});

test("read failures, foreign-key conflicts, and RLS-filtered deletes never claim successful removal", async () => {
  for (const [options, status] of [
    [{ tripError: true }, 503],
    [{ memberError: true }, 503],
    [{ expenseError: true }, 503],
    [{ missingTrip: true }, 404],
    [{ missingTarget: true }, 404],
    [{ conflict: true }, 409],
    [{ deleteError: true }, 503],
    [{ filtered: true }, 403],
  ]) {
    const f = fixture(options),
      result = await f.run();
    assert.equal(result.status, status);
    assert.equal(result.body.success, undefined);
    assert(result.body.error);
    assert(
      f.calls.every(
        (call) =>
          call.method === "GET" || call.path === "/rest/v1/trip_members",
      ),
    );
  }
});

test("removal checks expenses beyond the first database page", async () => {
  const f = fixture({
    transactions: [
      ...Array.from({ length: 500 }, () => ({
        payer_id: creatorId,
        split_type: "custom",
      })),
      { payer_id: memberId, split_type: "custom" },
    ],
  });
  assert.equal((await f.run()).status, 409);
  assert.equal(
    f.calls.filter((call) => call.path === "/rest/v1/transactions").length,
    2,
  );
  assert(!f.calls.some((call) => call.method === "DELETE"));
});
