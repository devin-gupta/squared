const test = require("node:test");
const assert = require("node:assert/strict");
const moduleAt = require("./load-module.cjs");

test("a fresh app registers the worker before waiting for activation and shares concurrent attempts", async () => {
  let activate;
  const registration = { scope: "https://squared.example.test/" };
  const calls = [];
  const { ensureBackgroundWorker } = moduleAt(
    "lib/push/registration.ts",
    {},
    {
      setTimeout,
      clearTimeout,
      navigator: {
        serviceWorker: {
          ready: new Promise((resolve) => {
            activate = resolve;
          }),
          register: async (url, options) => {
            calls.push([url, options.scope, options.updateViaCache]);
            return registration;
          },
        },
      },
    },
  );
  const first = ensureBackgroundWorker();
  assert.equal(ensureBackgroundWorker(), first);
  assert.deepEqual(calls, [["/sw.js", "/", "none"]]);
  activate(registration);
  assert.equal(await first, registration);
});

test("failed registration is retryable without reloading the app", async () => {
  let calls = 0;
  const registration = {};
  const { ensureBackgroundWorker } = moduleAt(
    "lib/push/registration.ts",
    {},
    {
      setTimeout,
      clearTimeout,
      navigator: {
        serviceWorker: {
          ready: Promise.resolve(registration),
          register: async () => {
            if (++calls === 1) throw new Error("Offline");
            return registration;
          },
        },
      },
    },
  );
  await assert.rejects(ensureBackgroundWorker(), /Check your connection/);
  assert.equal(await ensureBackgroundWorker(), registration);
  assert.equal(calls, 2);
});

test("stalled activation times out, clears its timer and releases the attempt for retry", async () => {
  let timeout,
    cleared = 0;
  const worker = { register: async () => ({}), ready: new Promise(() => {}) };
  const { ensureBackgroundWorker } = moduleAt(
    "lib/push/registration.ts",
    {},
    {
      setTimeout: (callback) => {
        timeout = callback;
        return 1;
      },
      clearTimeout: () => {
        cleared++;
      },
      navigator: { serviceWorker: worker },
    },
  );
  const stalled = ensureBackgroundWorker();
  const rejection = assert.rejects(stalled, /tap Enable notifications again/);
  timeout();
  await rejection;
  assert.equal(cleared, 1);
  const registration = {};
  worker.ready = Promise.resolve(registration);
  assert.equal(await ensureBackgroundWorker(), registration);
  assert.equal(cleared, 2);
});
