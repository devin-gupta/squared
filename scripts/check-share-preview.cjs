// Check the built site as a crawler, without executing JS or authenticating.
// Usage: node scripts/check-share-preview.cjs https://squared-omega.vercel.app
const assert = require("node:assert/strict");
const sharp = require("sharp");
const origin = process.argv[2] || "http://127.0.0.1:3000";

async function main() {
  const agents = [
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
    "facebookexternalhit/1.1",
    "Twitterbot/1.0",
  ];
  let expected;
  for (const agent of agents) {
    const response = await fetch(`${origin}/trip/INVITEAA`, {
      headers: { "User-Agent": agent },
    });
    assert.equal(response.status, 200);
    assert.equal(new URL(response.url).searchParams.get("code"), "INVITEAA");
    const html = await response.text();
    assert(
      Buffer.byteLength(html) < 1024 * 1024,
      "Preview HTML must fit Apple's resource budget",
    );
    const head = html.split("</head>")[0];
    const property = (name) => {
      const matches = [
        ...head.matchAll(
          new RegExp(
            `<meta (?:property|name)="${name}" content="([^"]*)"`,
            "g",
          ),
        ),
      ];
      assert.equal(
        matches.length,
        1,
        `${name} must occur exactly once in the initial head`,
      );
      return matches[0][1];
    };
    const metadata = {
      title: property("og:title"),
      url: property("og:url"),
      image: property("og:image"),
      width: property("og:image:width"),
      height: property("og:image:height"),
      card: property("twitter:card"),
    };
    assert.equal(metadata.title, "You’re invited. Join your people.");
    assert.equal(new URL(metadata.url).pathname, "/trip/INVITEAA");
    assert.equal(new URL(metadata.image).protocol, "https:");
    assert.equal(metadata.width, "1200");
    assert.equal(metadata.height, "630");
    assert.equal(metadata.card, "summary_large_image");
    assert(property("robots").includes("noindex"));
    assert(head.includes('rel="apple-touch-icon"'));
    assert(head.includes("/brand/icon-180-v2.png"));
    if (expected) assert.deepEqual(metadata, expected);
    expected = metadata;
  }
  for (const [path, width, height] of [
    ["/brand/share-card-v2.png", 1200, 630],
    ["/brand/icon-180-v2.png", 180, 180],
    ["/brand/icon-192-v2.png", 192, 192],
    ["/brand/icon-512-v2.png", 512, 512],
  ]) {
    const response = await fetch(origin + path);
    assert.equal(response.status, 200);
    assert(response.headers.get("content-type").startsWith("image/png"));
    const bytes = Buffer.from(await response.arrayBuffer());
    assert(bytes.length < 1024 * 1024);
    const image = sharp(bytes);
    const metadata = await image.metadata();
    assert.equal(metadata.width, width);
    assert.equal(metadata.height, height);
    assert(
      (await image.stats()).isOpaque,
      `${path} must have a solid background`,
    );
  }
  const manifestResponse = await fetch(origin + "/manifest.json?v=2");
  assert.equal(manifestResponse.status, 200);
  assert(
    !(manifestResponse.headers.get("cache-control") || "").includes(
      "immutable",
    ),
  );
  const manifest = await manifestResponse.json();
  assert.equal(manifest.id, "/");
  assert(
    manifest.icons.some(
      (icon) => icon.sizes === "512x512" && icon.purpose.includes("maskable"),
    ),
  );
  console.log(
    "PASS: identical initial-head invite metadata for Safari and crawlers; invite preserved; public, correctly sized opaque images; manifest can update.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
