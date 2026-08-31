const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const origin = process.env.APP_ORIGIN || "http://127.0.0.1:3000";

// Unlike the UI fixtures, use a real worker on a fresh, signed-out browser.
// Never subscribe to push, request real permissions, or write live trip data.
(async () => {
  const browser = await chromium.launch({
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {}),
  });
  try {
    const context = await browser.newContext({ serviceWorkers: "allow" });
    const page = await context.newPage();
    const workerErrors = [];
    const cdp = await context.newCDPSession(page);
    await cdp.send("ServiceWorker.enable");
    cdp.on("ServiceWorker.workerErrorReported", (event) => {
      workerErrors.push(event.errorMessage.errorMessage);
    });
    await context.addInitScript(() => {
      window.permissionRequests = 0;
      Notification.requestPermission = async () => {
        window.permissionRequests++;
        throw new Error("Unexpected automatic notification prompt");
      };
    });
    await page.goto(origin);
    await page
      .getByRole("button", { name: "App & notifications", exact: true })
      .waitFor();
    // Registration must come from the app, never from this test.
    await page.waitForFunction(
      async () => {
        const registration = await navigator.serviceWorker.getRegistration("/");
        return registration?.active?.state === "activated";
      },
      null,
      { timeout: 25000 },
    );
    const result = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      return {
        scope: registration.scope,
        script: registration.active.scriptURL,
        count: (await navigator.serviceWorker.getRegistrations()).length,
        permissionRequests: window.permissionRequests,
      };
    });
    assert.equal(result.scope, new URL("/", origin).href);
    assert.equal(result.script, new URL("/sw.js", origin).href);
    assert.equal(result.count, 1);
    assert.equal(result.permissionRequests, 0);
    assert.deepEqual(workerErrors, []);
    const source = await (await context.request.get(origin + "/sw.js")).text();
    assert(source.includes("push-worker.js"));
    assert(!source.includes("/_next/app-build-manifest.json"));
    await page.reload();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    assert.equal(await page.evaluate(() => window.permissionRequests), 0);
    console.log(
      "PASS real service worker: App Router registers and activates the generated push worker, survives reload, and requests no notification permission.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
