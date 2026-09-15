const test = require("node:test");
const assert = require("node:assert/strict");
const moduleAt = require("./load-module.cjs");

const token = "sqr_" + "a".repeat(43);
const operationId = "77777777-7777-4777-8777-777777777777";

function harness(options = {}) {
  const calls = [];
  let afterTask = Promise.resolve();
  const storage = {
    upload: async (path, bytes, config) => {
      calls.push({ type: "upload", path, size: bytes.length, config });
      return { data: { path }, error: null };
    },
    getPublicUrl: (path) => ({
      data: { publicUrl: `https://receipts.test/${path}` },
    }),
    remove: async (paths) => {
      calls.push({ type: "remove", paths });
      return { error: null };
    },
  };
  const admin = {
    storage: { from: () => storage },
    rpc: async (name, args) => {
      calls.push({ type: "rpc", name, args });
      if (name === "claim_shortcut_receipt")
        return {
          data: options.existing
            ? {
                existing: true,
                result: {
                  transactionId: operationId,
                  description: "Dinner",
                  totalAmount: 10,
                },
              }
            : {
                existing: false,
                userId: "user-id",
                tripId: "trip-id",
                payerId: "sam-id",
                payerName: "Sam",
                memberNames: ["Sam", "Alex"],
              },
          error: null,
        };
      return {
        data: {
          transactionId: operationId,
          description: "Translated dinner",
          totalAmount: 8.28,
        },
        error: options.saveError || null,
      };
    },
  };
  let parses = 0;
  const route = moduleAt("app/api/shortcut/receipt/route.ts", {
    "next/server": {
      NextResponse: Response,
      after: (callback) => {
        afterTask = Promise.resolve(callback());
      },
    },
    "@/lib/ai/parser": {
      parseReceiptImage: async () => {
        parses++;
        return (
          options.parsed || {
            description: "Translated dinner",
            total_amount: 1000,
            currency: "ISK",
            split_type: "custom",
            adjustments: [{ user_name: "Alex", amount: 1000 }],
            line_items: [
              { description: "Meal", amount: 1000, category: "food" },
            ],
          }
        );
      },
    },
    "@/lib/receipts/files": { receiptFileError: () => null },
    "@/lib/currency/convert": {
      normalizeCurrency: (currency) => {
        if (currency === "UNKNOWN") throw new Error("Unknown");
        return currency;
      },
      convertExpense: (parsed) => ({
        ...parsed,
        currency: "USD",
        total_amount: 8.28,
        line_items: parsed.line_items.map((item) => ({
          ...item,
          amount: 8.28,
        })),
        currency_conversion: {
          original_currency: "ISK",
          original_amount: 1000,
          rate: 0.00828,
          rate_date: "2026-09-15",
          provider: "Frankfurter",
        },
      }),
    },
    "@/lib/currency/rates": { getUsdRate: async () => ({ rate: 0.00828 }) },
    "@/lib/push/server": {
      dispatchPush: async (userId) => calls.push({ type: "push", userId }),
    },
    "@/lib/shortcut/server": {
      shortcutConfigured: () => true,
      shortcutToken: (request) =>
        request.headers.get("authorization") === `Bearer ${token}`
          ? token
          : null,
      shortcutTokenHash: () => "b".repeat(64),
      receiptOperationId: () => operationId,
      shortcutAdmin: () => admin,
    },
  }, { Buffer, File });
  return { route, calls, get parses() { return parses; }, after: () => afterTask };
}

function request(auth = true) {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }), "receipt.jpg");
  return new Request("https://squared.test/api/shortcut/receipt", {
    method: "POST",
    headers: auth ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
}

test("shortcut receipt rejects missing credentials before AI or storage work", async () => {
  const h = harness();
  const result = await h.route.POST(request(false));
  assert.equal(result.status, 401);
  assert.equal(h.parses, 0);
  assert.deepEqual(h.calls, []);
});

test("shortcut receipt forces owner-paid equal-all semantics and atomically saves translated foreign receipt", async () => {
  const h = harness();
  const result = await h.route.POST(request());
  assert.equal(result.status, 201);
  assert.equal((await result.json()).message, "Added Translated dinner to Squared.");
  const commit = h.calls.find(
    (call) => call.type === "rpc" && call.name === "commit_shortcut_receipt",
  );
  assert(commit);
  assert.equal(commit.args.operation_id, operationId);
  assert.equal(commit.args.payload.payer_id, "sam-id");
  assert.equal(commit.args.payload.split_type, "equal");
  assert.deepEqual(Array.from(commit.args.payload.shares), []);
  assert.deepEqual(
    Array.from(commit.args.payload.line_items[0].split_among),
    [],
  );
  assert.equal(commit.args.payload.total_amount, 8.28);
  assert.equal(
    commit.args.payload.currency_conversion.original_currency,
    "ISK",
  );
  await h.after();
  assert(h.calls.some((call) => call.type === "push" && call.userId === "user-id"));
});

test("ambiguous receipts fail without uploads and exact retries skip AI", async () => {
  const ambiguous = harness({
    parsed: {
      description: "Receipt",
      total_amount: 0,
      currency: "UNKNOWN",
      split_type: "equal",
      review_note: "Unreadable",
    },
  });
  assert.equal((await ambiguous.route.POST(request())).status, 422);
  assert.equal(
    ambiguous.calls.filter((call) => call.type === "upload").length,
    0,
  );
  const repeated = harness({ existing: true });
  const result = await repeated.route.POST(request());
  assert.equal(result.status, 200);
  assert.equal(repeated.parses, 0);
  assert.equal((await result.json()).message, "Receipt already added to Squared.");
});
