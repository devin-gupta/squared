const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

function moduleAt(file, dependencies = {}, globals = {}) {
  const context = {
    exports: {},
    URL,
    Date,
    ...globals,
    require: (name) => {
      if (!(name in dependencies))
        throw Error(`Unexpected dependency: ${name}`);
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
function preferences(blocked = false) {
  const values = new Map();
  const storage = {
    getItem: (key) => {
      if (blocked) throw Error("Storage blocked");
      return values.get(key) ?? null;
    },
    setItem: (key, value) => {
      if (blocked) throw Error("Storage blocked");
      values.set(key, value);
    },
    removeItem: (key) => {
      if (blocked) throw Error("Storage blocked");
      values.delete(key);
    },
  };
  return {
    values,
    api: moduleAt("lib/auth/preferences.ts", {}, { localStorage: storage }),
  };
}

test("invite continuation survives reload, expires, and rejects redirect-shaped input", () => {
  const { values, api } = preferences();
  api.rememberInvite(" inviteaa ");
  assert.equal(api.pendingInvite(), "INVITEAA");
  assert.equal(
    new URL(
      api.signInRedirect("https://squared.example", api.pendingInvite()),
    ).searchParams.get("code"),
    "INVITEAA",
  );
  assert.equal(
    api.signInRedirect("https://squared.example", "//attacker.example"),
    "https://squared.example/",
  );
  api.forgetInvite("OTHERAAA");
  assert.equal(
    api.pendingInvite(),
    "INVITEAA",
    "finishing an older tab must not erase a newer invite",
  );
  values.set(
    "squared:pendingInvite",
    JSON.stringify({ code: "INVITEAA", savedAt: Date.now() - 8 * 86400000 }),
  );
  assert.equal(api.pendingInvite(), null);
  values.set("squared:pendingInvite", "{malformed");
  assert.equal(api.pendingInvite(), null);
});

test("blocked browser storage does not prevent forming a working invite redirect", () => {
  const { api } = preferences(true);
  assert.doesNotThrow(() => {
    api.rememberInvite("INVITEAA");
    api.rememberEmail("user@example.test");
    api.rememberTrip("user", "trip", "User");
  });
  assert.equal(api.pendingInvite(), null);
  assert.equal(
    api.signInRedirect("https://squared.example", "INVITEAA"),
    "https://squared.example/?code=INVITEAA",
  );
});

test("remembered trips are account-specific; explicit sign-out clears shared screen preferences", () => {
  const { values, api } = preferences();
  api.rememberTrip("a", "a-trip", "A");
  api.rememberTrip("b", "b-trip", "B");
  assert.equal(api.preferredTrip("a"), "a-trip");
  assert.equal(api.preferredTrip("b"), "b-trip");
  api.rememberInvite("INVITEAA");
  api.rememberEmail("user@example.test");
  api.clearDevicePreferences();
  assert.equal(values.has("tripId"), false);
  assert.equal(api.pendingInvite(), null);
  assert.equal(api.rememberedEmail(), "");
});

function joinFixture({
  member = false,
  readError = false,
  invalid = false,
  collision = false,
} = {}) {
  const db = {
    inserts: [],
    members: member
      ? [{ id: "existing", user_id: "me", display_name: "Sam" }]
      : collision
        ? [{ id: "other", user_id: "other-user", display_name: "Sam" }]
        : [],
  };
  const client = {
    from: (table) => {
      const filters = {};
      let payload;
      const query = {
        select: () => query,
        eq: (key, value) => {
          filters[key] = value;
          return query;
        },
        limit: () => query,
        maybeSingle: () => run(true),
        insert: (value) => {
          payload = value;
          return run(false);
        },
        then: (resolve, reject) => run(false).then(resolve, reject),
      };
      async function run(single) {
        await Promise.resolve();
        if (table === "trips")
          return { data: invalid ? null : { id: "trip" }, error: null };
        if (readError)
          return { data: null, error: { message: "connection failed" } };
        if (payload) {
          db.inserts.push(payload);
          db.members.push({ id: "new", ...payload });
          return { error: null };
        }
        const members = db.members.filter(
          (m) => !filters.user_id || m.user_id === filters.user_id,
        );
        return { data: single ? members[0] || null : members, error: null };
      }
      return query;
    },
  };
  const { api } = preferences();
  return {
    db,
    join: moduleAt("lib/trips/join.ts", {
      "../supabase/client": { supabase: client },
      "../auth/preferences": api,
    }).joinTrip,
  };
}

test("concurrent invite joins make only one authenticated membership", async () => {
  const { db, join } = joinFixture();
  const ids = await Promise.all([
    join("INVITEAA", "Sam", "me"),
    join("inviteaa", "Sam", "me"),
  ]);
  assert.deepEqual(ids, ["trip", "trip"]);
  assert.equal(db.inserts.length, 1);
  assert.equal(db.inserts[0].user_id, "me");
});

test("existing membership is reused, and duplicate names never claim someone else’s identity", async () => {
  let fixture = joinFixture({ member: true });
  assert.equal(await fixture.join("INVITEAA", "Sam", "me"), "trip");
  assert.equal(fixture.db.inserts.length, 0);
  fixture = joinFixture({ collision: true });
  await fixture.join("INVITEAA", "Sam", "me");
  assert.equal(fixture.db.inserts[0].display_name, "Sam (2)");
  assert.equal(fixture.db.members[0].user_id, "other-user");
});

test("membership read failures and invalid invites cannot trigger member writes", async () => {
  for (const options of [{ readError: true }, { invalid: true }]) {
    const { db, join } = joinFixture(options);
    await assert.rejects(join("INVITEAA", "Sam", "me"));
    assert.equal(db.inserts.length, 0);
  }
  const { db, join } = joinFixture();
  await assert.rejects(join("INVITEAA", "Sam", ""));
  await assert.rejects(join("https://bad.example", "Sam", "me"));
  assert.equal(db.inserts.length, 0);
});
