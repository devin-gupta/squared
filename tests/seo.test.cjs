const test = require("node:test");
const assert = require("node:assert/strict");
const moduleAt = require("./load-module.cjs");

const preferences = moduleAt("lib/auth/preferences.ts");
const invite = moduleAt(
  "lib/trips/invite.ts",
  { "../auth/preferences": preferences },
  { URLSearchParams },
);
const metadata = moduleAt("lib/metadata.ts", {
  "./auth/preferences": preferences,
  "./trips/invite": invite,
});
const seo = moduleAt("lib/seo.ts", { "./metadata": metadata });

test("the sitemap contains only canonical public search pages", () => {
  const { default: sitemap } = moduleAt("app/sitemap.ts", {
    "@/lib/seo": seo,
  });
  assert.deepEqual(
    Array.from(sitemap(), (entry) => entry.url),
    [
      "https://squared-omega.vercel.app/",
      "https://squared-omega.vercel.app/ai-travel-expense-splitter",
      "https://squared-omega.vercel.app/splitwise-alternative",
    ],
  );
});

test("robots advertises the sitemap without blocking noindex app pages", () => {
  const { default: robots } = moduleAt("app/robots.ts", {
    "@/lib/seo": seo,
    "@/lib/metadata": metadata,
  });
  const policy = robots();
  assert.equal(
    policy.sitemap,
    "https://squared-omega.vercel.app/sitemap.xml",
  );
  assert.equal(policy.host, "https://squared-omega.vercel.app");
  assert.deepEqual(Array.from(policy.rules.disallow), ["/api/", "/preview/"]);
  assert(!policy.rules.disallow.includes("/feed"));
  assert(!policy.rules.disallow.includes("/settle"));
});

test("structured data describes the real product without invented ratings", () => {
  assert.equal(seo.softwareApplicationJsonLd["@type"], "WebApplication");
  assert.equal(seo.softwareApplicationJsonLd.applicationCategory, "FinanceApplication");
  assert.equal(seo.softwareApplicationJsonLd.offers.price, "0");
  assert.equal("aggregateRating" in seo.softwareApplicationJsonLd, false);
});
