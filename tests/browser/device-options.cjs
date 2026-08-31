const { webkit } = require("playwright");
const assert = require("node:assert/strict");
const AxeBuilder = require("@axe-core/playwright").default;
const { setup, origin } = require("./fixtures.cjs");
const key = "B" + "a".repeat(86);
async function fixture(
  browser,
  { standalone = false, desktop = false, denied = false, fail = false } = {},
) {
  const t = await setup(browser, { signedIn: true, member: true });
  const actions = [];
  let subscribed = false;
  await t.context.addInitScript(
    ({ standalone, desktop, denied, key }) => {
      window.pushTest = {
        permissionCalls: 0,
        subscribeCalls: 0,
        unsubscribeCalls: 0,
        installCalls: 0,
        active: null,
      };
      const state = window.pushTest;
      Object.defineProperty(navigator, "standalone", {
        configurable: true,
        value: standalone,
      });
      if (desktop) {
        Object.defineProperty(navigator, "userAgent", {
          configurable: true,
          value: "Desktop browser",
        });
        Object.defineProperty(navigator, "platform", {
          configurable: true,
          value: "Linux",
        });
      }
      const N = function () {};
      N.permission = "default";
      N.requestPermission = async () => {
        state.permissionCalls++;
        N.permission = denied ? "denied" : "granted";
        return N.permission;
      };
      Object.defineProperty(window, "Notification", {
        configurable: true,
        value: N,
      });
      Object.defineProperty(window, "PushManager", {
        configurable: true,
        value: function () {},
      });
      const reg = {
        pushManager: {
          getSubscription: async () => state.active,
          subscribe: async () => {
            state.subscribeCalls++;
            const data = {
              endpoint: "https://web.push.apple.com/synthetic-device",
              keys: { p256dh: key, auth: "a".repeat(22) },
            };
            state.active = {
              endpoint: data.endpoint,
              toJSON: () => data,
              unsubscribe: async () => {
                state.unsubscribeCalls++;
                state.active = null;
                return true;
              },
            };
            return state.active;
          },
        },
      };
      Object.defineProperty(navigator.serviceWorker, "ready", {
        configurable: true,
        value: Promise.resolve(reg),
      });
      Object.defineProperty(navigator.serviceWorker, "getRegistration", {
        configurable: true,
        value: async () => reg,
      });
      Object.defineProperty(navigator.serviceWorker, "register", {
        configurable: true,
        value: async () => reg,
      });
    },
    { standalone, desktop, denied, key },
  );
  await t.context.route(origin + "/api/push/config", (r) =>
    r.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ enabled: true, publicKey: key }),
    }),
  );
  await t.context.route(origin + "/api/push/subscriptions", (r) => {
    const b = r.request().postDataJSON();
    actions.push(b.action);
    assert.match(r.request().headers().authorization, /^Bearer /);
    if (fail && b.action === "subscribe")
      return r.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Couldn’t save this device." }),
      });
    if (b.action === "subscribe") subscribed = true;
    if (b.action === "unsubscribe") subscribed = false;
    return r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ enabled: subscribed }),
    });
  });
  await t.page.goto(origin);
  await t.page
    .getByRole("button", { name: "App & notifications", exact: true })
    .waitFor();
  await t.page.waitForLoadState("networkidle");
  assert.equal(await t.page.getByRole("dialog").count(), 0);
  assert.equal(await t.page.evaluate(() => pushTest.permissionCalls), 0);
  assert.deepEqual(actions, []);
  return { ...t, actions };
}
(async () => {
  const browser = await webkit.launch();
  let t;
  try {
    t = await fixture(browser);
    await t.page
      .getByRole("button", { name: "App & notifications", exact: true })
      .click();
    let d = t.page.getByRole("dialog");
    await d.getByText("Tap Share, then", { exact: false }).waitFor();
    assert.equal(
      await d
        .getByRole("button", { name: "Enable notifications", exact: true })
        .count(),
      0,
    );
    assert.equal(await t.page.evaluate(() => pushTest.permissionCalls), 0);
    await t.context.close();
    t = await fixture(browser, { standalone: true });
    await t.page
      .getByRole("button", { name: "App & notifications", exact: true })
      .click();
    d = t.page.getByRole("dialog");
    await d
      .getByText("You’re already using the installed app.", { exact: true })
      .waitFor();
    await d
      .getByRole("button", { name: "Enable notifications", exact: true })
      .click();
    await d.getByText("Enabled on this device", { exact: true }).waitFor();
    assert.equal(await t.page.evaluate(() => pushTest.permissionCalls), 1);
    assert.deepEqual(t.actions, ["subscribe"]);
    for (const width of [320, 390, 430]) {
      await t.page.setViewportSize({ width, height: 844 });
      assert(await d.evaluate((el) => el.scrollWidth <= el.clientWidth + 1));
    }
    const audit = await new AxeBuilder({ page: t.page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    assert.deepEqual(
      audit.violations.map((v) => v.id),
      [],
    );
    await t.page.screenshot({
      path: require("node:path").join(
        require("node:os").tmpdir(),
        "squared-device-options.png",
      ),
      fullPage: true,
    });
    await d
      .getByRole("button", { name: "Disable notifications", exact: true })
      .click();
    await d.getByText("Off on this device", { exact: true }).waitFor();
    assert.equal(await t.page.evaluate(() => pushTest.unsubscribeCalls), 1);
    assert.deepEqual(t.actions, ["subscribe", "unsubscribe"]);
    await d
      .getByRole("button", { name: "Enable notifications", exact: true })
      .click();
    await d.getByText("Enabled on this device", { exact: true }).waitFor();
    await d.getByRole("button", { name: "Close dialog", exact: true }).click();
    await t.page.getByRole("button", { name: "Sign out", exact: true }).click();
    await t.page
      .getByRole("button", { name: "Get started", exact: true })
      .waitFor();
    assert.equal(await t.page.evaluate(() => pushTest.unsubscribeCalls), 2);
    assert.equal(t.actions.at(-1), "unsubscribe");
    assert.deepEqual(t.db.errors, []);
    await t.context.close();
    t = await fixture(browser, { standalone: true, denied: true });
    await t.page
      .getByRole("button", { name: "App & notifications", exact: true })
      .click();
    d = t.page.getByRole("dialog");
    await d
      .getByRole("button", { name: "Enable notifications", exact: true })
      .click();
    await d.getByText("Notifications are blocked.", { exact: false }).waitFor();
    assert.equal(await t.page.evaluate(() => pushTest.subscribeCalls), 0);
    assert.deepEqual(t.actions, []);
    await t.context.close();
    t = await fixture(browser, { standalone: true, fail: true });
    await t.page
      .getByRole("button", { name: "App & notifications", exact: true })
      .click();
    d = t.page.getByRole("dialog");
    await d
      .getByRole("button", { name: "Enable notifications", exact: true })
      .click();
    await d.getByRole("alert").waitFor();
    assert.equal(await t.page.evaluate(() => pushTest.unsubscribeCalls), 1);
    assert.equal(
      await d.getByText("Enabled on this device", { exact: true }).count(),
      0,
    );
    await t.context.close();
    t = await fixture(browser, { desktop: true });
    await t.page.evaluate(() => {
      const e = new Event("beforeinstallprompt", { cancelable: true });
      e.prompt = async () => {
        pushTest.installCalls++;
      };
      e.userChoice = Promise.resolve({ outcome: "dismissed" });
      window.dispatchEvent(e);
      if (!e.defaultPrevented) throw Error("Install event was not deferred");
    });
    assert.equal(await t.page.evaluate(() => pushTest.installCalls), 0);
    assert.equal(await t.page.getByRole("dialog").count(), 0);
    await t.page
      .getByRole("button", { name: "App & notifications", exact: true })
      .click();
    d = t.page.getByRole("dialog");
    await d
      .getByRole("button", { name: "Add Squared to Home Screen", exact: true })
      .click();
    assert.equal(await t.page.evaluate(() => pushTest.installCalls), 1);
    assert.equal(await t.page.evaluate(() => pushTest.permissionCalls), 0);
    assert.deepEqual(t.db.errors, []);
    await t.context.close();
    t = null;
    console.log(
      "PASS device options: no automatic prompts; iOS installation guidance; explicit opt-in, denied/failed states, opt-out, sign-out cleanup, native install only on click, mobile layout and accessibility. All push services mocked.",
    );
  } finally {
    if (t) await t.context.close();
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
