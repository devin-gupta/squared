const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { database, as } = require("./sql-fixture.cjs");
const moduleAt = require("./load-module.cjs");
const alice = "11111111-1111-4111-8111-111111111111",
  bob = "22222222-2222-4222-8222-222222222222",
  cara = "33333333-3333-4333-8333-333333333333";
const pk = "B" + "a".repeat(86),
  auth = "a".repeat(22);
const call = async (db, sql, args = []) =>
  (await db.query(sql, args)).rows[0].result;
const device = (db, name) =>
  call(db, "SELECT register_push_subscription($1,$2,$3) result", [
    "https://web.push.apple.com/" + name,
    pk,
    auth,
  ]);
const create = (db, op, trip, payer) =>
  call(db, "SELECT commit_expense($1,$2,$3,NULL,$4,NULL,NULL) result", [
    op,
    "create",
    trip,
    JSON.stringify({
      description: "Dinner",
      total_amount: 50,
      payer_id: payer,
      split_type: "equal",
    }),
  ]);
const service = async (db) => {
  await db.exec("RESET ROLE; SET ROLE service_role");
};
test("push queue: only opted-in peers, no duplicates, private endpoints, exclusive leases, and membership checked at delivery", async () => {
  const db = await database();
  try {
    await as(db, alice);
    const trip = await call(db, "SELECT start_group_trip($1,$2,$3,$4) result", [
      "Iceland",
      "Alice",
      JSON.stringify(["Bob", "Cara"]),
      randomUUID(),
    ]);
    const ctx = await call(db, "SELECT invite_context($1) result", [
      trip.inviteCode,
    ]);
    await device(db, "alice");
    await as(db, bob);
    await call(db, "SELECT join_invited_trip($1,$2,NULL) result", [
      trip.inviteCode,
      ctx.members[0].id,
    ]);
    const bd = await device(db, "bob");
    await as(db, cara);
    await device(db, "cara"); // Opted in, but not in this trip.
    await as(db, alice);
    const op = randomUUID();
    await create(db, op, trip.tripId, ctx.memberId);
    await create(db, op, trip.tripId, ctx.memberId);
    assert.equal(
      (await db.query("SELECT * FROM push_subscriptions")).rows.length,
      1,
      "Other members cannot read Bob’s endpoint",
    );
    await assert.rejects(
      db.query("SELECT * FROM push_deliveries"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("SELECT * FROM claim_push_deliveries(20,NULL)"),
      /permission denied/,
    );
    await service(db);
    let jobs = (
      await db.query("SELECT * FROM claim_push_deliveries(20,$1)", [alice])
    ).rows;
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].device_id, bd);
    assert.equal(jobs[0].recipient, bob);
    assert.equal(jobs[0].attempt, 1);
    assert.equal(
      (await db.query("SELECT * FROM claim_push_deliveries(20,NULL)")).rows
        .length,
      0,
      "Concurrent worker cannot claim the same device",
    );
    await db.query(
      "UPDATE push_deliveries SET lease_until=now()-interval '1 minute'",
    );
    const retry = (
      await db.query("SELECT * FROM claim_push_deliveries(20,NULL)")
    ).rows;
    assert.equal(retry.length, 1);
    assert.notEqual(retry[0].token, jobs[0].token);
    assert.equal(retry[0].attempt, 2);
    assert.equal(
      (
        await db.query(
          "UPDATE push_deliveries SET state='sent' WHERE id=$1 AND lease_token=$2 RETURNING id",
          [jobs[0].job_id, jobs[0].token],
        )
      ).rows.length,
      0,
      "Stale worker cannot acknowledge a newer lease",
    );
    await db.query(
      "UPDATE push_deliveries SET state='sent' WHERE id=$1 AND lease_token=$2",
      [retry[0].job_id, retry[0].token],
    );
    await as(db, alice);
    await create(db, randomUUID(), trip.tripId, ctx.memberId);
    await db.exec("RESET ROLE");
    await db.query("DELETE FROM trip_members WHERE trip_id=$1 AND user_id=$2", [
      trip.tripId,
      bob,
    ]);
    await service(db);
    assert.equal(
      (await db.query("SELECT * FROM claim_push_deliveries(20,NULL)")).rows
        .length,
      0,
      "Removed member receives no queued expense",
    );
    assert.equal(
      (
        await db.query(
          "SELECT count(*)::int n FROM push_deliveries WHERE state='discarded'",
        )
      ).rows[0].n,
      1,
    );
  } finally {
    await db.close();
  }
});
test("subscription ownership transfer cannot leak old-account notifications; unsubscribe removes queued deliveries", async () => {
  const db = await database();
  try {
    await as(db, alice);
    const trip = await call(db, "SELECT start_group_trip($1,$2,$3,$4) result", [
      "Trip",
      "Alice",
      JSON.stringify(["Bob"]),
      randomUUID(),
    ]);
    const ctx = await call(db, "SELECT invite_context($1) result", [
      trip.inviteCode,
    ]);
    await as(db, bob);
    await call(db, "SELECT join_invited_trip($1,$2,NULL) result", [
      trip.inviteCode,
      ctx.members[0].id,
    ]);
    await device(db, "shared");
    await as(db, alice);
    await create(db, randomUUID(), trip.tripId, ctx.memberId);
    await as(db, cara);
    await assert.rejects(
      call(db, "SELECT register_push_subscription($1,$2,$3) result", [
        "https://web.push.apple.com/shared",
        pk,
        "b".repeat(22),
      ]),
      /Disable notifications/,
    );
    await device(db, "shared"); // Same physical browser, explicit opt-in by the new account.
    await service(db);
    assert.equal(
      (await db.query("SELECT * FROM claim_push_deliveries(20,NULL)")).rows
        .length,
      0,
    );
    await as(db, bob);
    await device(db, "shared");
    await as(db, alice);
    await create(db, randomUUID(), trip.tripId, ctx.memberId);
    await as(db, bob);
    await db.query("DELETE FROM push_subscriptions WHERE endpoint=$1", [
      "https://web.push.apple.com/shared",
    ]);
    await service(db);
    assert.equal(
      (await db.query("SELECT * FROM push_deliveries")).rows.length,
      0,
    );
    await as(db, null);
    await assert.rejects(device(db, "anonymous"), /Sign in/);
  } finally {
    await db.close();
  }
});
test("push destinations are limited to known HTTPS browser services, rejecting SSRF and redirect-shaped endpoints", () => {
  const { validPushEndpoint, validPushSubscription } = moduleAt(
    "lib/push/validation.ts",
  );
  for (const endpoint of [
    "https://web.push.apple.com/token",
    "https://fcm.googleapis.com/wp/token",
    "https://updates.push.services.mozilla.com/wpush/v2/token",
    "https://wns.notify.windows.com/token",
  ])
    assert(validPushEndpoint(endpoint));
  for (const endpoint of [
    "http://fcm.googleapis.com/token",
    "https://127.0.0.1/token",
    "https://169.254.169.254/latest",
    "https://fcm.googleapis.com.evil.test/token",
    "https://fcm.googleapis.com:444/token",
    "https://user:secret@fcm.googleapis.com/token",
    "https://fcm.googleapis.com/token#fragment",
    "https://evil.test/token",
  ])
    assert(!validPushEndpoint(endpoint), endpoint);
  assert(
    validPushSubscription({
      endpoint: "https://web.push.apple.com/token",
      keys: { p256dh: pk, auth },
    }),
  );
  assert(
    !validPushSubscription({
      endpoint: "https://web.push.apple.com/token",
      keys: { p256dh: "bad", auth },
    }),
  );
});

test("push sender bounds delivery, drops expired endpoints, retries transient failures, and never follows untrusted URLs", async () => {
  const sent = [],
    writes = [];
  let claimed = false;
  const job = (id, endpoint) => ({
    job_id: id,
    device_id: "device-" + id,
    recipient: bob,
    token: "lease-" + id,
    attempt: 1,
    endpoint,
    p256dh: pk,
    auth,
    trip_id: randomUUID(),
    change_id: randomUUID(),
    actor_name: "Alice",
    trip_name: "Iceland",
    total_amount: 123,
    description: "Private receipt",
  });
  const jobs = [
    job("ok", "https://web.push.apple.com/ok"),
    job("gone", "https://web.push.apple.com/gone"),
    job("busy", "https://web.push.apple.com/busy"),
    job("unsafe", "https://127.0.0.1/private"),
  ];
  const client = {
    rpc: async (name, args) => {
      assert.equal(name, "claim_push_deliveries");
      assert.equal(args.requested_actor, alice);
      if (claimed) return { data: [], error: null };
      claimed = true;
      return { data: jobs, error: null };
    },
    from: (table) => {
      let record = { table, where: [] };
      const q = {
        update: (patch) => {
          record.patch = patch;
          return q;
        },
        delete: () => {
          record.deleted = true;
          return q;
        },
        eq: (key, value) => {
          record.where.push([key, value]);
          return q;
        },
        then: (resolve) => {
          writes.push(record);
          return Promise.resolve({ error: null }).then(resolve);
        },
      };
      return q;
    },
  };
  const server = moduleAt(
    "lib/push/server.ts",
    {
      "server-only": {},
      "@supabase/supabase-js": {
        createClient: (url, key) => {
          assert.equal(key, "server-secret");
          return client;
        },
      },
      "web-push": {
        default: {
          sendNotification: async (s, p, options) => {
            sent.push({ s, p: JSON.parse(p), options });
            if (s.endpoint.endsWith("/gone")) throw { statusCode: 410 };
            if (s.endpoint.endsWith("/busy")) throw { statusCode: 503 };
          },
        },
      },
      "./validation": moduleAt("lib/push/validation.ts"),
    },
    {
      process: {
        env: {
          NEXT_PUBLIC_SUPABASE_URL: "https://example.test",
          SUPABASE_SERVICE_ROLE_KEY: "server-secret",
          VAPID_PUBLIC_KEY: "public",
          VAPID_PRIVATE_KEY: "private",
        },
      },
      console: { error() {}, warn() {} },
    },
  );
  await server.dispatchPush(alice);
  assert.equal(sent.length, 3);
  assert(!JSON.stringify(sent.map((s) => s.p)).includes("Private receipt"));
  assert(!JSON.stringify(sent.map((s) => s.p)).includes("123"));
  assert.equal(sent[0].options.timeout, 5000);
  assert.equal(sent[0].options.vapidDetails.privateKey, "private");
  assert(
    writes.some(
      (w) =>
        w.deleted &&
        w.table === "push_subscriptions" &&
        w.where.some(([k, v]) => k === "user_id" && v === bob),
    ),
  );
  assert(writes.some((w) => w.patch?.state === "pending"));
  assert(writes.some((w) => w.patch?.state === "failed"));
  assert(writes.some((w) => w.patch?.state === "sent"));
  assert(
    writes
      .filter((w) => w.patch)
      .every((w) => w.where.some(([k]) => k === "lease_token")),
  );
});

test("service worker suppresses a previous account and notification clicks stay on the app origin", async () => {
  const fs = require("node:fs"),
    vm = require("node:vm");
  const { IDBFactory } = require("fake-indexeddb");
  const indexedDB = new IDBFactory();
  const storage = moduleAt("lib/push/device.ts", {}, { indexedDB });
  await storage.writePushOwner({
    userId: bob,
    endpoint: "https://web.push.apple.com/bob",
  });
  const handlers = {},
    shown = [],
    opened = [],
    navigated = [];
  const self = {
    location: { origin: "https://squared.test" },
    addEventListener: (name, fn) => (handlers[name] = fn),
    registration: {
      showNotification: async (title, options) =>
        shown.push({ title, options }),
    },
    clients: {
      matchAll: async () => [
        {
          url: "https://unrelated.test/",
          navigate: () => assert.fail("Never navigate unrelated pages"),
        },
        {
          url: "https://squared.test/",
          navigate: async (url) => {
            navigated.push(url);
            return { focus: async () => {} };
          },
        },
      ],
      openWindow: async (url) => opened.push(url),
    },
  };
  vm.runInNewContext(fs.readFileSync("public/push-worker.js", "utf8"), {
    self,
    indexedDB,
    URL,
  });
  async function push(data) {
    let work;
    handlers.push({ data: { json: () => data }, waitUntil: (p) => (work = p) });
    await work;
  }
  const tripId = randomUUID();
  await push({ recipientId: alice, body: "Other account", tripId });
  assert.equal(shown.length, 0);
  await push({
    recipientId: bob,
    body: "Alice added an expense in Iceland.",
    tripId,
    changeId: randomUUID(),
  });
  assert.equal(shown.length, 1);
  assert.equal(shown[0].options.icon, "/brand/icon-192-v2.png");
  async function click(data) {
    let work;
    handlers.notificationclick({
      notification: { close() {}, data },
      waitUntil: (p) => (work = p),
    });
    await work;
  }
  await click({ recipientId: bob, tripId });
  assert.equal(navigated[0], "https://squared.test/?trip=" + tripId);
  await click({ recipientId: bob, tripId: "https://evil.test/" });
  assert.equal(navigated[1], "https://squared.test/");
  await storage.writePushOwner(null);
  await push({ recipientId: bob, body: "After logout", tripId });
  assert.equal(shown.length, 1);
  await click({ recipientId: bob, tripId });
  assert.equal(navigated[2], "https://squared.test/");
  assert.equal(opened.length, 0);
});

test("subscription API enforces authentication and endpoint checks before writes; caller cannot select another owner", async () => {
  class RequestError extends Error {
    constructor(message, status) {
      super(message);
      this.status = status;
    }
  }
  const calls = [];
  let signedIn = true;
  const q = {
    select: () => q,
    eq: (key, value) => {
      calls.push([key, value]);
      return q;
    },
    maybeSingle: async () => ({ data: null, error: null }),
    delete: () => q,
    then: (resolve) => Promise.resolve({ error: null }).then(resolve),
  };
  const client = {
    from: () => q,
    rpc: async (name, args) => {
      calls.push({ name, args });
      return { data: "device", error: null };
    },
  };
  const route = moduleAt("app/api/push/subscriptions/route.ts", {
    "next/server": { NextResponse: Response },
    "@/lib/transactions/server": {
      ExpenseRequestError: RequestError,
      authenticatedExpenseClient: async () => {
        if (!signedIn) throw new RequestError("Sign in", 401);
        return { client, user: { id: alice } };
      },
    },
    "@/lib/push/validation": moduleAt("lib/push/validation.ts"),
    "@/lib/push/server": { pushConfigured: () => true },
  });
  const request = (body) =>
    new Request("https://squared.test/api/push/subscriptions", {
      method: "POST",
      body: JSON.stringify(body),
    });
  signedIn = false;
  assert.equal((await route.POST(request({}))).status, 401);
  assert.equal(calls.length, 0);
  signedIn = true;
  assert.equal(
    (
      await route.POST(
        request({
          action: "subscribe",
          subscription: {
            endpoint: "https://localhost/secret",
            keys: { p256dh: pk, auth },
          },
        }),
      )
    ).status,
    400,
  );
  assert.equal(calls.length, 0);
  const response = await route.POST(
    request({
      action: "subscribe",
      userId: bob,
      subscription: {
        endpoint: "https://web.push.apple.com/token",
        keys: { p256dh: pk, auth },
      },
    }),
  );
  assert.equal(response.status, 201);
  assert.equal(calls[0].name, "register_push_subscription");
  assert.deepEqual(Object.keys(calls[0].args).sort(), [
    "push_auth",
    "push_endpoint",
    "push_p256dh",
  ]);
  await route.POST(
    request({
      action: "status",
      endpoint: "https://web.push.apple.com/token",
      userId: bob,
    }),
  );
  assert(
    calls.some((c) => Array.isArray(c) && c[0] === "user_id" && c[1] === alice),
  );
});

test("cron rejects missing, incorrect and multibyte authorization without sending notifications", async () => {
  let calls = 0;
  const route = moduleAt(
    "app/api/push/cron/route.ts",
    {
      "next/server": { NextResponse: Response },
      "node:crypto": require("node:crypto"),
      "@/lib/push/server": { dispatchPush: async () => calls++ },
    },
    { Buffer, process: { env: { CRON_SECRET: "secret" } } },
  );
  for (const token of ["", "Bearer wrong!", "Bearer sécret"]) {
    const response = await route.GET(
      new Request("https://squared.test/api/push/cron", {
        headers: { Authorization: token },
      }),
    );
    assert.equal(response.status, 401);
  }
  assert.equal(calls, 0);
  assert.equal(
    (
      await route.GET(
        new Request("https://squared.test/api/push/cron", {
          headers: { Authorization: "Bearer secret" },
        }),
      )
    ).status,
    200,
  );
  assert.equal(calls, 1);
});
