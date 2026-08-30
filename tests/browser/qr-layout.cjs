const { webkit } = require("playwright");
const AxeBuilder = require("@axe-core/playwright").default;
const assert = require("node:assert/strict");
const { setup, tripVisible, origin, trip } = require("./fixtures.cjs");
(async () => {
  const browser = await webkit.launch();
  const t = await setup(browser, { signedIn: true, member: true });
  await t.context.addInitScript(() => {
    window.shares = [];
    window.copies = [];
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data) => {
        window.shares.push(data);
        throw new DOMException("Cancelled", "AbortError");
      },
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (text) => window.copies.push(text) },
    });
  });
  await t.page.goto(origin);
  await tripVisible(t.page);
  await t.page
    .getByRole("button", { name: "Invite friends", exact: true })
    .filter({ visible: true })
    .click();
  const dialog = t.page.getByRole("dialog");
  for (const width of [320, 390, 430]) {
    await t.page.setViewportSize({ width, height: 844 });
    const qr = dialog.getByRole("img", {
      name: "Scan to join " + trip.name + " on Squared",
    });
    assert(await qr.isVisible());
    assert.equal(await dialog.locator("details, img").count(), 0);
    const q = await qr.boundingBox(),
      c = await dialog
        .getByRole("button", { name: "Copy", exact: true })
        .boundingBox(),
      s = await dialog
        .getByRole("button", { name: "Share invite link" })
        .boundingBox();
    assert(q.width >= 160 && q.width <= 201);
    assert(q.y + q.height < c.y);
    assert(c.y + c.height < s.y);
    assert(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1));
    const a = await new AxeBuilder({ page: t.page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    assert.equal(a.violations.length, 0, JSON.stringify(a.violations));
  }
  await t.page.setViewportSize({ width: 390, height: 844 });
  await t.page.screenshot({
    path: require("node:path").join(
      require("node:os").tmpdir(),
      "squared-qr-first.png",
    ),
    fullPage: true,
  });
  await dialog.getByRole("button", { name: "Copy", exact: true }).click();
  await dialog.getByRole("button", { name: "Share invite link" }).click();
  assert(await dialog.isVisible());
  const data = await t.page.evaluate(() => ({
    copies: window.copies,
    shares: window.shares,
  }));
  assert.equal(data.copies.length, 1);
  assert.deepEqual(data.shares, [{ url: data.copies[0] }]);
  assert.equal(new URL(data.copies[0]).searchParams.get("name"), trip.name);
  assert.deepEqual(t.db.errors, []);
  await t.context.close();
  const desktop = await setup(browser, { signedIn: true, member: true });
  await desktop.context.addInitScript(() =>
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
    }),
  );
  await desktop.page.goto(origin);
  await tripVisible(desktop.page);
  await desktop.page
    .getByRole("button", { name: "Invite friends", exact: true })
    .filter({ visible: true })
    .click();
  assert(
    await desktop.page
      .getByRole("dialog")
      .getByRole("button", { name: "Copy", exact: true })
      .isVisible(),
  );
  assert.equal(
    await desktop.page
      .getByRole("button", { name: "Share invite link" })
      .count(),
    0,
  );
  await desktop.context.close();
  await browser.close();
  console.log(
    "PASS large QR visible immediately, no artwork/accordion in dialog, copy above native share, mobile accessibility, link-only sharing and desktop copy",
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
