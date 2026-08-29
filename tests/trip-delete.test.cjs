const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const { createClient } = require("@supabase/supabase-js");

function moduleAt(file, dependencies) {
  const context = {
    exports: {},
    process: {
      env: {
        NEXT_PUBLIC_SUPABASE_URL: "https://trip-delete.example.test",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-public-key",
      },
    },
    console: { error() {} },
    require(name) {
      assert(name in dependencies, `Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  };
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
    }).outputText,
    context,
  );
  return context.exports;
}
const tripId = "22222222-2222-4222-8222-222222222222";
function fixture(options = {}) {
  const calls = [],
    clients = [];
  let exists = !options.missing;
  const deletion = moduleAt("lib/trips/delete.ts", { "server-only": {} });
  const route = moduleAt("app/api/trips/[id]/route.ts", {
    "next/server": {
      NextResponse: { json: (data, init) => Response.json(data, init) },
    },
    "@/lib/trips/delete": deletion,
    "@supabase/supabase-js": {
      createClient(url, key, config) {
        clients.push(config);
        // Exercise the real SDK, but keep every request in this synthetic transport.
        return createClient(url, key, {
          ...config,
          global: {
            ...config.global,
            fetch: async (input, init) => {
              const request = new Request(input, init),
                url = new URL(request.url);
              calls.push({
                path: url.pathname,
                query: url.searchParams,
                method: request.method,
                auth: request.headers.get("authorization"),
              });
              const userId =
                request.headers.get("authorization") === "Bearer other-session"
                  ? "other-user"
                  : "creator-user";
              const json = (data, status = 200) =>
                Response.json(data, { status });
              if (url.pathname === "/auth/v1/user") {
                return options.invalidAuth
                  ? json({ message: "Expired", code: "bad_jwt" }, 401)
                  : json({ id: userId, email: "creator@example.test" });
              }
              // Simulate RLS visibility: no user bearer means no rows.
              assert.match(
                request.headers.get("authorization"),
                /^Bearer (creator|other)-session$/,
              );
              const rows = (value) =>
                json(
                  request.headers.get("accept")?.includes("vnd.pgrst.object")
                    ? (value[0] ?? null)
                    : value,
                );
              if (
                request.method === "GET" &&
                url.pathname === "/rest/v1/trips"
              ) {
                assert.equal(url.searchParams.get("id"), "eq." + tripId);
                if (options.lookupError)
                  return json(
                    { message: "Unavailable", code: "TEST_ERROR" },
                    400,
                  );
                return rows(exists ? [{ created_by: "Creator" }] : []);
              }
              if (url.pathname === "/rest/v1/trip_members") {
                assert.equal(url.searchParams.get("trip_id"), "eq." + tripId);
                assert.equal(url.searchParams.get("user_id"), "eq." + userId);
                if (options.memberError)
                  return json(
                    { message: "Unavailable", code: "TEST_ERROR" },
                    400,
                  );
                return rows(
                  options.nonmember
                    ? []
                    : [
                        {
                          user_id: userId,
                          display_name:
                            options.noncreator || userId === "other-user"
                              ? "Someone else"
                              : "Creator",
                        },
                      ],
                );
              }
              assert.equal(
                url.pathname,
                "/rest/v1/trips",
                "Only a single trip deletion may be issued; no separate child deletes",
              );
              assert.equal(request.method, "DELETE");
              assert.equal(url.searchParams.get("id"), "eq." + tripId);
              if (options.conflict)
                return json(
                  { message: "Foreign key violation", code: "23503" },
                  409,
                );
              if (options.deleteError)
                return json(
                  { message: "Unavailable", code: "TEST_ERROR" },
                  400,
                );
              if (options.filtered) return rows([]);
              exists = false;
              return rows([{ id: tripId }]);
            },
          },
        });
      },
    },
  });
  return {
    calls,
    clients,
    async run({ token = "creator-session", id = tripId, auth } = {}) {
      const headers =
        auth === null ? {} : { authorization: auth ?? "Bearer " + token };
      const response = await route.DELETE(
        new Request("https://squared.example/api/trips/" + id, {
          method: "DELETE",
          headers,
        }),
        { params: Promise.resolve({ id }) },
      );
      return { status: response.status, body: await response.json() };
    },
  };
}

test("creator deletion carries the verified bearer through every real SDK query and confirms the deleted row", async () => {
  const f = fixture();
  const result = await f.run();
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { success: true });
  assert.equal(f.calls.filter((c) => c.method === "DELETE").length, 1);
  assert(f.calls.every((c) => c.auth === "Bearer creator-session"));
  assert.equal(f.clients[0].auth.persistSession, false);
  assert.equal(f.clients[0].auth.autoRefreshToken, false);
});

test("missing, malformed, and expired authentication never reaches a delete", async () => {
  for (const auth of [null, "Basic credentials", "Bearer "]) {
    const f = fixture();
    assert.equal((await f.run({ auth })).status, 401);
    assert.equal(f.calls.length, 0);
  }
  const f = fixture({ invalidAuth: true });
  assert.equal((await f.run()).status, 401);
  assert(f.calls.every((c) => c.path === "/auth/v1/user"));
});

test("bad trip IDs, unavailable trips, nonmembers, and noncreators never delete", async () => {
  let f = fixture();
  assert.equal((await f.run({ id: "invalid" })).status, 400);
  assert.equal(f.calls.length, 0);
  for (const [options, status] of [
    [{ missing: true }, 404],
    [{ nonmember: true }, 403],
    [{ noncreator: true }, 403],
    [{ lookupError: true }, 503],
    [{ memberError: true }, 503],
  ]) {
    f = fixture(options);
    assert.equal((await f.run()).status, status);
    assert(!f.calls.some((c) => c.method === "DELETE"));
  }
});

test("RLS-filtered deletes and failed writes cannot report success or perform partial cleanup", async () => {
  for (const [options, status] of [
    [{ filtered: true }, 403],
    [{ conflict: true }, 409],
    [{ deleteError: true }, 503],
  ]) {
    const f = fixture(options),
      result = await f.run();
    assert.equal(result.status, status);
    assert.equal(result.body.success, undefined);
    assert(result.body.error);
    assert.equal(f.calls.filter((c) => c.method === "DELETE").length, 1);
  }
});

test("concurrent users use separate clients, without sharing authorization", async () => {
  const f = fixture();
  const [creator, other] = await Promise.all([
    f.run(),
    f.run({ token: "other-session" }),
  ]);
  assert.equal(creator.status, 200);
  assert.equal(other.status, 403);
  assert.equal(f.clients.length, 2);
  assert.deepEqual(
    f.calls.filter((c) => c.method === "DELETE").map((c) => c.auth),
    ["Bearer creator-session"],
  );
});

test("retry after a completed deletion reports the trip as unavailable", async () => {
  const f = fixture();
  assert.equal((await f.run()).status, 200);
  assert.equal((await f.run()).status, 404);
  assert.equal(f.calls.filter((c) => c.method === "DELETE").length, 1);
});
