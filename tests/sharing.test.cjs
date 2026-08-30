const test = require("node:test");
const assert = require("node:assert/strict");
const moduleAt = require("./load-module.cjs");
const preferences = moduleAt("lib/auth/preferences.ts");
const { homeMetadata } = moduleAt("lib/metadata.ts", {
  "./auth/preferences": preferences,
});

test("invite previews keep their join URL without exposing trip information", () => {
  const data = homeMetadata(" inviteaa ");
  assert.equal(
    data.openGraph.url.href,
    "https://squared-omega.vercel.app/trip/INVITEAA",
  );
  assert.equal(data.openGraph.title, "You’re invited. Join your people.");
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
    assert.equal(data.openGraph.title, "Good trips. Clear tabs.");
    assert(!JSON.stringify(data).includes("attacker"));
  }
});

function sharing(share) {
  return moduleAt(
    "lib/trips/share.ts",
    { "../auth/preferences": preferences },
    {
      window: { location: { origin: "https://squared.example.test" } },
      navigator: { share },
    },
  );
}

test("native sharing sends one invite URL without duplicate invite text", async () => {
  const calls = [];
  const api = sharing(async (data) => calls.push(data));
  assert.equal(await api.shareTrip("inviteaa", "Yosemite weekend"), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://squared.example.test/trip/INVITEAA");
  assert.equal(calls[0].title, "Join Yosemite weekend on Squared");
  assert.equal(calls[0].text, undefined);
  assert.equal(
    api.generateShareUrl("INVITEAA&next=https://attacker.example"),
    "",
  );
  assert.equal(await api.shareTrip("bad", "Trip"), false);
  assert.equal(calls.length, 1);
});

test("cancelling native sharing does not report success or invoke another share", async () => {
  let calls = 0;
  const api = sharing(async () => {
    calls++;
    throw Object.assign(new Error("Cancelled"), { name: "AbortError" });
  });
  assert.equal(await api.shareTrip("INVITEAA", "Trip"), false);
  assert.equal(calls, 1);
  assert.equal(await sharing(undefined).shareTrip("INVITEAA", "Trip"), false);
});
