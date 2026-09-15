const test = require("node:test");
const assert = require("node:assert/strict");
const moduleAt = require("./load-module.cjs");
const preferences = moduleAt("lib/auth/preferences.ts");
const invite = moduleAt(
  "lib/trips/invite.ts",
  { "../auth/preferences": preferences },
  { URLSearchParams },
);
const { homeMetadata } = moduleAt("lib/metadata.ts", {
  "./auth/preferences": preferences,
  "./trips/invite": invite,
});

test("invite previews keep their join URL without exposing trip information", () => {
  const data = homeMetadata(" inviteaa ");
  assert.equal(
    data.openGraph.url.href,
    "https://squared-omega.vercel.app/trip/INVITEAA",
  );
  assert.equal(
    data.openGraph.title,
    "You’re invited to a trip — split bills together",
  );
  assert.equal(data.openGraph.siteName, "Squared");
  assert.equal(data.openGraph.images[0].url, "/brand/share-card-v2.png");
  assert.equal(data.twitter.card, "summary_large_image");
  assert.equal(data.robots.index, false);
  assert(!JSON.stringify(data).includes("undefined"));
});

test("home and malformed invite previews never echo arbitrary query input", () => {
  for (const input of [
    undefined,
    "//attacker.example",
    "<script>alert(1)</script>",
    ["INVITEAA", "INVITEBB"],
  ]) {
    const data = homeMetadata(input);
    assert.equal(data.openGraph.url.href, "https://squared-omega.vercel.app/");
    assert.equal(data.openGraph.title, "Squared — AI Travel Expense Splitter");
    assert.equal(
      data.verification.google,
      "rPs0rHDOm2C3Pb8c2ZSsJ30zhjfdjKQ6uOpT9XgZ-Nc",
    );
    assert(!JSON.stringify(data).includes("attacker"));
  }
});

function sharing(share, writeText) {
  return moduleAt(
    "lib/trips/share.ts",
    { "./invite": invite },
    {
      window: { location: { origin: "https://squared.example.test" } },
      navigator: { share, clipboard: { writeText } },
    },
  );
}

test("native sharing sends one invite URL without duplicate invite text", async () => {
  const calls = [];
  const api = sharing(async (data) => calls.push(data));
  assert.equal(await api.shareTrip("inviteaa", "Yosemite weekend"), "shared");
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    "https://squared.example.test/trip/INVITEAA?name=Yosemite+weekend",
  );
  assert.equal(calls[0].title, undefined);
  assert.equal(calls[0].text, undefined);
  assert.deepEqual(
    Object.keys(calls[0]),
    ["url"],
    "only a link, never a separate message",
  );
  assert.equal(
    api.generateShareUrl("INVITEAA&next=https://attacker.example"),
    "",
  );
  assert.equal(await api.shareTrip("bad", "Trip"), "failed");
  assert.equal(calls.length, 1);
});

test("cancelling native sharing does not report success or invoke another share", async () => {
  let calls = 0;
  let copied = 0;
  const api = sharing(
    async () => {
      calls++;
      throw Object.assign(new Error("Cancelled"), { name: "AbortError" });
    },
    async () => {
      copied++;
    },
  );
  assert.equal(await api.shareTrip("INVITEAA", "Trip"), "cancelled");
  assert.equal(calls, 1);
  assert.equal(copied, 0);
});

test("trip names are encoded as display context, never redirect or membership input", () => {
  const name = "Café & beach / 2026 🏖️";
  const data = homeMetadata("INVITEAA", name);
  assert.equal(data.openGraph.url.pathname, "/trip/INVITEAA");
  assert.equal(data.openGraph.url.searchParams.get("name"), name);
  assert.equal(
    data.openGraph.title,
    `You’re invited to ${name} — split bills together`,
  );
  assert.equal(invite.inviteName(["one", "two"]), null);
  assert.equal(invite.inviteName(" Beach\n weekend\u202e "), "Beach weekend");
  assert.equal(Array.from(invite.inviteName("🌴".repeat(200))).length, 80);
  const hostile = new URL(
    sharing().generateShareUrl(
      "INVITEAA",
      "Trip&next=https://attacker.example",
    ),
  );
  assert.equal(hostile.searchParams.has("next"), false);
  assert.equal(hostile.origin, "https://squared.example.test");
});

test("desktop fallback copies just the contextual link and reports success accurately", async () => {
  const copies = [];
  const api = sharing(undefined, async (value) => copies.push(value));
  assert.equal(await api.shareTrip("INVITEAA", "Trip"), "copied");
  assert.deepEqual(copies, [
    "https://squared.example.test/trip/INVITEAA?name=Trip",
  ]);
  let copied = false;
  const denied = sharing(
    async () => {
      throw new Error("denied");
    },
    async () => {
      copied = true;
    },
  );
  assert.equal(await denied.shareTrip("INVITEAA", "Trip"), "failed");
  assert.equal(copied, false);
});
