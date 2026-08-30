const { webkit, devices } = require("playwright");
const AxeBuilder = require("@axe-core/playwright").default;
const assert = require("node:assert/strict");
const origin = process.env.APP_ORIGIN || "http://127.0.0.1:3000";
const host = new URL(
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "https://omuavzmycthzgwrxuzsc.supabase.co",
).host;
const storageKey = "sb-" + host.split(".")[0] + "-auth-token";
const user = {
  id: "11111111-1111-4111-8111-111111111111",
  aud: "authenticated",
  role: "authenticated",
  email: "sam@example.test",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  created_at: "2026-08-01T00:00:00Z",
};
function session(expired = false) {
  const exp = Math.floor(Date.now() / 1000) + (expired ? -120 : 3600);
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return {
    access_token:
      enc({ alg: "HS256", typ: "JWT" }) +
      "." +
      enc({ sub: user.id, aud: "authenticated", role: "authenticated", exp }) +
      ".test-signature",
    refresh_token: "synthetic-refresh-token",
    expires_at: exp,
    expires_in: 3600,
    token_type: "bearer",
    user,
  };
}
const trip = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Invited Yosemite Weekend",
  invite_code: "INVITEAA",
  created_by: "Alex",
  created_at: "2026-08-01T00:00:00Z",
};
async function setup(
  browser,
  {
    signedIn = false,
    expired = false,
    member = false,
    invalid = false,
    membershipError = false,
    storedTrip = null,
    state = null,
  } = {},
) {
  const context = await browser.newContext({
    ...devices["iPhone 13"],
    reducedMotion: "reduce",
    serviceWorkers: "block",
    ...(state ? { storageState: state } : {}),
  });
  const db = {
    members: [
      {
        id: "other",
        trip_id: trip.id,
        display_name: "Alex",
        user_id: "other-user",
      },
      ...(member
        ? [
            {
              id: "mine",
              trip_id: trip.id,
              display_name: "Sam",
              user_id: user.id,
            },
          ]
        : []),
    ],
    joins: 0,
    otp: [],
    refreshes: 0,
    errors: [],
    membershipError,
  };
  if (signedIn)
    await context.addInitScript(
      ({ key, value, storedTrip }) => {
        if (!localStorage.getItem("fixture-seeded")) {
          localStorage.setItem(key, JSON.stringify(value));
          if (storedTrip) localStorage.setItem("tripId", storedTrip);
          localStorage.setItem("fixture-seeded", "1");
        }
      },
      { key: storageKey, value: session(expired), storedTrip },
    );
  await context.routeWebSocket("**", (ws) => ws.close());
  await context.route("**/*", async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    const reply = (body, status = 200) =>
      route.fulfill({
        headers: {
          "access-control-allow-origin": origin,
          "access-control-allow-headers": "*",
        },
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    if (url.hostname === host) {
      if (req.method() === "OPTIONS")
        return route.fulfill({
          status: 204,
          headers: {
            "access-control-allow-origin": origin,
            "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
            "access-control-allow-headers":
              req.headers()["access-control-request-headers"] || "*",
          },
        });
      if (url.pathname === "/auth/v1/otp") {
        db.otp.push(url.searchParams.get("redirect_to"));
        return reply({});
      }
      if (url.pathname === "/auth/v1/user") return reply(user);
      if (url.pathname === "/auth/v1/token") {
        db.refreshes++;
        return reply({
          ...session(),
          refresh_token: "synthetic-refreshed-token",
        });
      }
      if (url.pathname === "/auth/v1/logout")
        return route.fulfill({ status: 204 });
      const single = req.headers()["accept"]?.includes("vnd.pgrst.object");
      if (url.pathname === "/rest/v1/trips") {
        const rows = invalid ? [] : [trip];
        return reply(single ? rows[0] || null : rows);
      }
      if (url.pathname === "/rest/v1/trip_members") {
        if (req.method() === "POST") {
          db.joins++;
          const row = JSON.parse(req.postData());
          db.members.push({ id: "mine", ...row });
          return reply(null, 201);
        }
        if (db.membershipError)
          return reply({ message: "Simulated network error" }, 503);
        let rows = db.members.filter(
          (m) =>
            !url.searchParams.get("user_id") ||
            m.user_id === url.searchParams.get("user_id").slice(3),
        );
        return reply(single ? rows[0] || null : rows);
      }
      if (url.pathname.startsWith("/rest/v1/")) return reply([]);
      return reply({});
    }
    if (url.origin === origin && url.pathname.startsWith("/api/"))
      return reply({
        statistics: {
          totalSpent: 0,
          transactionCount: 0,
          categoryBreakdown: [],
        },
        settlements: [],
      });
    if (url.origin === origin) return route.continue();
    return route.abort();
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => db.errors.push(e.message));
  return { context, page, db };
}
async function tripVisible(page) {
  await page.getByRole("heading", { name: trip.name, exact: true }).waitFor();
  assert.equal(
    await page.getByText("Create your first trip", { exact: true }).count(),
    0,
  );
}

module.exports = { setup, tripVisible, trip, host, origin };
