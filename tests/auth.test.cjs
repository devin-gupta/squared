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
  const db = { calls: [], inserts: [] };
  const client = {
    rpc: async (name, args) => {
      db.calls.push({ name, args });
      await Promise.resolve();
      if (readError || invalid)
        return { error: { message: "Invite unavailable" } };
      if (name === "invite_context")
        return {
          data: {
            tripId: "trip",
            tripName: "Iceland",
            memberId: member ? "existing" : null,
            members: [{ id: "unclaimed", name: "Sam" }],
          },
        };
      if (collision)
        return { error: { message: "That name has already been claimed" } };
      if (!member) db.inserts.push(args);
      return { data: "trip" };
    },
  };
  const { api } = preferences();
  const mod = moduleAt("lib/trips/join.ts", {
    "../supabase/client": { supabase: client },
    "../auth/preferences": api,
  });
  return { db, join: mod.joinTrip, context: mod.getInviteContext };
}
test("concurrent explicit joins make one RPC and retain the selected placeholder identity", async () => {
  const { db, join } = joinFixture();
  const ids = await Promise.all([
    join("INVITEAA", "Sam", "me", "unclaimed"),
    join("inviteaa", "Sam", "me", "unclaimed"),
  ]);
  assert.deepEqual(ids, ["trip", "trip"]);
  assert.equal(db.calls.length, 1);
  assert.equal(db.inserts[0].selected_member, "unclaimed");
  assert.equal(db.inserts[0].new_name, null);
});
test("invite context is read-only and existing members bypass name selection", async () => {
  const f = joinFixture({ member: true });
  assert.equal((await f.context("INVITEAA")).memberId, "existing");
  assert.equal(f.db.inserts.length, 0);
  const collision = joinFixture({ collision: true });
  await assert.rejects(
    collision.join("INVITEAA", "Sam", "me", "claimed"),
    /already been claimed/,
  );
  assert.equal(collision.db.inserts.length, 0);
});
test("new names are explicit and invalid invites or failed RPCs never trigger fallback member writes", async () => {
  const f = joinFixture();
  await f.join("INVITEAA", "New person", "me");
  assert.equal(f.db.inserts[0].new_name, "New person");
  assert.equal(f.db.inserts[0].selected_member, null);
  for (const options of [{ readError: true }, { invalid: true }]) {
    const f = joinFixture(options);
    await assert.rejects(f.join("INVITEAA", "Sam", "me"));
    assert.equal(f.db.inserts.length, 0);
  }
  const bad = joinFixture();
  await assert.rejects(bad.join("INVITEAA", "Sam", ""));
  await assert.rejects(bad.join("https://bad.example", "Sam", "me"));
  assert.equal(bad.db.calls.length, 0);
});
