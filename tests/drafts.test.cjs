const test = require("node:test");
const assert = require("node:assert/strict");
const { IDBFactory } = require("fake-indexeddb");
const moduleAt = require("./load-module.cjs");
test("IndexedDB preserves image drafts and exact retry payloads while isolating accounts and trips", async () => {
  const storage = moduleAt(
    "lib/drafts/storage.ts",
    {},
    { indexedDB: new IDBFactory(), Blob },
  );
  const key = storage.draftKey("alice", "iceland");
  const draft = {
    ...storage.newDraft(),
    text: "Sam paid",
    image: {
      blob: new Blob(["test image"], { type: "image/png" }),
      name: "booking.png",
      type: "image/png",
    },
    parsed: {
      description: "Car rental",
      total_amount: 79086,
      currency: "ISK",
      split_type: "equal",
    },
    submission: {
      tripId: "iceland",
      payload: {
        total_amount: 654.83,
        currency_conversion: { original_amount: 79086, rate: 0.00828 },
      },
    },
  };
  await storage.writeDraft(key, draft);
  const restored = await storage.readDraft(key);
  assert.equal(restored.id, draft.id);
  assert.equal(await restored.image.blob.text(), "test image");
  assert.deepEqual(restored.submission, draft.submission);
  assert.equal(
    await storage.readDraft(storage.draftKey("bob", "iceland")),
    undefined,
  );
  assert.equal(
    await storage.readDraft(storage.draftKey("alice", "other")),
    undefined,
  );
  await storage.removeDraft(key);
  assert.equal(await storage.readDraft(key), undefined);
  assert.notEqual(storage.newDraft().id, draft.id);
});
test("trip defaults remember original currency and participants without leaking across accounts or retaining removed people", () => {
  const values = new Map(),
    localStorage = {
      getItem: (k) => values.get(k) || null,
      setItem: (k, v) => values.set(k, v),
    };
  const currency = moduleAt("lib/currency/convert.ts");
  const d = moduleAt(
    "lib/drafts/defaults.ts",
    { "../currency/convert": currency },
    { localStorage },
  );
  d.rememberExpenseDefaults(
    "a",
    "trip",
    {
      currency: "ISK",
      payer_name: "Sam",
      participants: ["Sam"],
      split_type: "equal",
    },
    ["Sam", "Alex"],
  );
  const defaults = d.getExpenseDefaults("a", "trip", ["Sam", "Alex"]);
  assert.equal(defaults.currency, "ISK");
  assert.equal(defaults.payerName, "Sam");
  assert.deepEqual(Array.from(defaults.participants), ["Sam"]);
  assert.equal(d.getExpenseDefaults("b", "trip", ["Sam"]).currency, "USD");
  assert.equal(
    d.getExpenseDefaults("a", "trip", ["Alex"]).payerName,
    undefined,
  );
  assert.equal(
    d.getExpenseDefaults("a", "trip", ["Alex"]).participants.length,
    0,
  );
});
