const test = require("node:test");
const assert = require("node:assert/strict");
const moduleAt = require("./load-module.cjs");

function fixture(
  path = "/",
  {
    oauthError = false,
    noUrl = false,
    session = { user: { id: "me" } },
    sessionError = null,
    initializationError = null,
  } = {},
) {
  const values = new Map();
  const preferences = moduleAt(
    "lib/auth/preferences.ts",
    {},
    {
      localStorage: {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
        removeItem: (key) => values.delete(key),
      },
    },
  );
  let current = new URL(path, "https://squared.example.test");
  const calls = { oauth: [], navigation: [], sessions: 0 };
  const window = {
    location: {
      get href() {
        return current.href;
      },
      get origin() {
        return current.origin;
      },
      assign: (url) => calls.navigation.push(url),
    },
    history: {
      state: {},
      replaceState: (_state, _title, url) => {
        current = new URL(url, current);
      },
    },
  };
  const api = moduleAt(
    "lib/auth/google.ts",
    {
      "./preferences": preferences,
      "@/lib/supabase/client": {
        supabase: {
          auth: {
            initialize: async () => ({ error: initializationError }),
            signInWithOAuth: async (options) => {
              calls.oauth.push(options);
              return {
                data: {
                  url: noUrl ? null : "https://auth.example.test/authorize",
                },
                error: oauthError ? new Error("provider disabled") : null,
              };
            },
            getSession: async () => {
              calls.sessions++;
              return { data: { session }, error: sessionError };
            },
          },
        },
      },
    },
    { window, URLSearchParams },
  );
  return { api, preferences, calls, window };
}

test("Google sign-in saves the invite and requests identity without Google offline access", async () => {
  const { api, preferences, calls } = fixture("/?code=inviteaa");
  await api.signInWithGoogle();
  assert.equal(preferences.pendingInvite(), "INVITEAA");
  const { provider, options } = calls.oauth[0];
  assert.equal(provider, "google");
  assert.equal(
    options.redirectTo,
    "https://squared.example.test/auth/callback?invite=INVITEAA",
  );
  assert.equal(options.skipBrowserRedirect, true);
  assert.equal(options.queryParams.prompt, "select_account");
  assert.equal(options.queryParams.access_type, undefined);
  assert.deepEqual(calls.navigation, ["https://auth.example.test/authorize"]);
});

test("Google retries and fresh tabs carry validated invites in the callback", async () => {
  for (const path of ["/", "/auth/callback?invite=INVITEAA"]) {
    const { api, preferences, calls } = fixture(path);
    preferences.rememberInvite("INVITEAA");
    await api.signInWithGoogle();
    assert.equal(
      new URL(calls.oauth[0].options.redirectTo).searchParams.get("invite"),
      "INVITEAA",
    );
  }
  const { api, calls } = fixture();
  await api.signInWithGoogle();
  assert.equal(
    calls.oauth[0].options.redirectTo,
    "https://squared.example.test/auth/callback",
  );
});

test("Malformed invites and provider errors never navigate to Google", async () => {
  for (const [path, options] of [
    ["/?code=%2F%2Fattacker.example", {}],
    ["/", { oauthError: true }],
    ["/", { noUrl: true }],
  ]) {
    const { api, calls } = fixture(path, options);
    await assert.rejects(api.signInWithGoogle());
    assert.equal(calls.navigation.length, 0);
  }
});

test("A completed callback waits for the session, restores the invite, and ignores external next URLs", async () => {
  const { api, preferences, calls } = fixture(
    "/auth/callback?invite=inviteaa&next=https://attacker.example",
  );
  assert.equal(await api.completeGoogleSignIn(), "/?code=INVITEAA");
  assert.equal(calls.sessions, 1);
  assert.equal(preferences.pendingInvite(), "INVITEAA");
  const saved = fixture("/auth/callback?next=//attacker.example");
  saved.preferences.rememberInvite("INVITEBB");
  assert.equal(await saved.api.completeGoogleSignIn(), "/?code=INVITEBB");
  assert.equal(
    await fixture(
      "/auth/callback?next=https://attacker.example",
    ).api.completeGoogleSignIn(),
    "/",
  );
});

test("Cancellation or an unexpected auth code cannot succeed using an old session", async () => {
  for (const suffix of [
    "#error=access_denied&error_description=untrusted",
    "&error=server_error",
    "#error_description=untrusted",
    "&error_code=bad_oauth_state",
    "&code=oauth-code",
  ]) {
    const { api, calls, preferences, window } = fixture(
      "/auth/callback?invite=INVITEAA" + suffix,
    );
    await assert.rejects(api.completeGoogleSignIn(), (error) => {
      assert(!error.message.includes("untrusted"));
      return true;
    });
    assert.equal(calls.sessions, 0);
    assert.equal(preferences.pendingInvite(), "INVITEAA");
    assert.equal(
      window.location.href,
      "https://squared.example.test/auth/callback?invite=INVITEAA",
    );
  }
});

test("A failed OAuth token exchange cannot report success from an older saved session", async () => {
  const { api, calls, window } = fixture(
    "/auth/callback?invite=INVITEAA#access_token=invalid-token",
    { initializationError: new Error("Invalid JWT") },
  );
  await assert.rejects(api.completeGoogleSignIn(), /couldn’t complete/);
  assert.equal(calls.sessions, 0);
  assert.equal(new URL(window.location.href).hash, "");
});

test("Missing sessions, failed session recovery, and malformed callback invites fail safely", async () => {
  for (const options of [
    { session: null },
    { sessionError: new Error("failed") },
  ]) {
    await assert.rejects(
      fixture("/auth/callback", options).api.completeGoogleSignIn(),
    );
  }
  const { api, preferences, calls } = fixture("/auth/callback?invite=bad");
  preferences.rememberInvite("INVITEAA");
  await assert.rejects(api.completeGoogleSignIn(), /incomplete/);
  assert.equal(calls.sessions, 0);
});
