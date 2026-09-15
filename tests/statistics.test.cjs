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
        NEXT_PUBLIC_SUPABASE_URL: "https://statistics.example.test",
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
const expenses = [
  {
    total_amount: "120.50",
    payer_id: "member-alice",
    status: "finalized",
    trip_id: tripId,
    line_items: [{ category: "Food", amount: "120.50" }],
    split_type: "equal",
  },
  {
    total_amount: 79.5,
    payer_id: "member-bob",
    status: "finalized",
    trip_id: tripId,
    split_type: "equal",
  },
  {
    total_amount: 900,
    payer_id: "member-alice",
    status: "pending",
    trip_id: tripId,
  },
  {
    total_amount: 500,
    payer_id: "member-alice",
    status: "finalized",
    trip_id: "another-trip",
  },
];

function fixture(options = {}) {
  const calls = [],
    clients = [];
  const allocation = require("./load-module.cjs")(
    "lib/transactions/allocation.ts",
  );
  const calculation = moduleAt("lib/statistics/calculate.ts", {
    "@/lib/transactions/allocation": allocation,
  });
  const route = moduleAt("app/api/trips/[id]/statistics/route.ts", {
    "next/server": {
      NextResponse: { json: (body, init) => Response.json(body, init) },
    },
    "@/lib/statistics/calculate": calculation,
    "@supabase/supabase-js": {
      createClient(url, key, config) {
        clients.push(config);
        return createClient(url, key, {
          ...config,
          global: {
            ...config.global,
            fetch: async (input, init) => {
              const request = new Request(input, init),
                url = new URL(request.url);
              const auth = request.headers.get("authorization");
              calls.push({ path: url.pathname, auth, method: request.method });
              const user = auth === "Bearer bob-session" ? "bob" : "alice";
              if (url.pathname === "/auth/v1/user") {
                return options.invalidAuth
                  ? Response.json(
                      { message: "Expired", code: "bad_jwt" },
                      { status: 401 },
                    )
                  : Response.json({ id: user });
              }
              assert.equal(
                request.method,
                "GET",
                "Statistics must never write data",
              );
              // Like RLS, an anonymous read returns no rows rather than an error.
              if (!/^Bearer (alice|bob)-session$/.test(auth))
                return Response.json([]);
              if (url.pathname === "/rest/v1/trip_members") {
                assert.equal(url.searchParams.get("trip_id"), "eq." + tripId);
                if (options.memberError)
                  return Response.json(
                    { message: "Unavailable" },
                    { status: 503 },
                  );
                if (url.searchParams.has("user_id")) {
                  assert.equal(url.searchParams.get("user_id"), "eq." + user);
                  assert.equal(url.searchParams.has("display_name"), false);
                  return Response.json(
                    options.nonmember ? [] : [{ id: "member-" + user }],
                  );
                }
                return Response.json([
                  { id: "member-alice", display_name: "Alice" },
                  { id: "member-bob", display_name: "Bob" },
                ]);
              }
              assert.equal(url.pathname, "/rest/v1/transactions");
              if (options.transactionError)
                return Response.json(
                  { message: "Unavailable" },
                  { status: 503 },
                );
              const rows = (options.empty ? [] : expenses).filter(
                (row) =>
                  (!url.searchParams.has("trip_id") ||
                    "eq." + row.trip_id === url.searchParams.get("trip_id")) &&
                  (!url.searchParams.has("status") ||
                    "eq." + row.status === url.searchParams.get("status")),
              );
              return Response.json(rows);
            },
          },
        });
      },
    },
  });
  return {
    calls,
    clients,
    async run({
      token = "alice-session",
      auth,
      id = tripId,
      userName = "Bob",
    } = {}) {
      const response = await route.GET(
        new Request(
          `https://squared.example/api/trips/${id}/statistics?userName=${userName}`,
          {
            headers:
              auth === null ? {} : { authorization: auth ?? "Bearer " + token },
          },
        ),
        { params: Promise.resolve({ id }) },
      );
      return {
        status: response.status,
        body: await response.json(),
        headers: response.headers,
      };
    },
  };
}

test("statistics carries the verified session through every query and totals only this trip's finalized expenses", async () => {
  const f = fixture(),
    result = await f.run();
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.statistics, {
    totalSpent: 200,
    transactionCount: 2,
    averagePerTransaction: 100,
    userPaid: 120.5,
    userSpent: 100,
    categoryBreakdown: [
      { category: "Food", amount: 120.5, percentage: 60.25 },
      { category: "Other", amount: 79.5, percentage: 39.75 },
    ],
  });
  assert(f.calls.every((call) => call.auth === "Bearer alice-session"));
  assert.equal(result.headers.get("cache-control"), "no-store");
  assert.equal(f.clients[0].auth.persistSession, false);
  assert.equal(f.clients[0].auth.autoRefreshToken, false);
});

test("personal paid and spent totals follow the verified account despite a conflicting display name", async () => {
  const f = fixture();
  const [alice, bob] = await Promise.all([
    f.run({ userName: "Bob" }),
    f.run({ token: "bob-session", userName: "Alice" }),
  ]);
  assert.equal(alice.body.statistics.userPaid, 120.5);
  assert.equal(alice.body.statistics.userSpent, 100);
  assert.equal(bob.body.statistics.userPaid, 79.5);
  assert.equal(bob.body.statistics.userSpent, 100);
  assert.equal(f.clients.length, 2);
});

test("only a successfully loaded empty trip returns zero statistics", async () => {
  const result = await fixture({ empty: true }).run();
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.statistics, {
    totalSpent: 0,
    transactionCount: 0,
    averagePerTransaction: 0,
    userPaid: 0,
    userSpent: 0,
    categoryBreakdown: [],
  });
});

test("missing, malformed, or expired authentication cannot return misleading zeros", async () => {
  for (const auth of [null, "Basic credentials", "Bearer "]) {
    const f = fixture(),
      result = await f.run({ auth });
    assert.equal(result.status, 401);
    assert.equal(result.body.statistics, undefined);
    assert.equal(f.calls.length, 0);
  }
  const f = fixture({ invalidAuth: true });
  assert.equal((await f.run()).status, 401);
  assert(f.calls.every((call) => call.path === "/auth/v1/user"));
});

test("invalid trips, nonmembers, and database failures return errors instead of zero totals", async () => {
  const invalid = fixture();
  assert.equal((await invalid.run({ id: "invalid" })).status, 400);
  assert.equal(invalid.calls.length, 0);
  for (const [options, status] of [
    [{ nonmember: true }, 403],
    [{ memberError: true }, 503],
    [{ transactionError: true }, 500],
  ]) {
    const f = fixture(options),
      result = await f.run();
    assert.equal(result.status, status);
    assert.equal(result.body.statistics, undefined);
    assert(result.body.error);
    if (!options.transactionError)
      assert(!f.calls.some((call) => call.path === "/rest/v1/transactions"));
  }
});
