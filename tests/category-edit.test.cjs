const test = require("node:test");
const assert = require("node:assert/strict");
const { createClient } = require("@supabase/supabase-js");
const moduleAt = require("./load-module.cjs");
const categories = moduleAt("lib/categories.ts");
const { expenseEdits } = moduleAt("lib/transactions/edit.ts", {
  "../categories": categories,
});
const { personalSpending } = moduleAt("lib/statistics/personal.ts");
const id = "33333333-3333-4333-8333-333333333333";
const base = {
  id,
  trip_id: "22222222-2222-4222-8222-222222222222",
  description: "Iceland rental",
  total_amount: 654.83,
  payer_id: "sam",
  split_type: "custom",
  line_items: null,
  category: null,
  status: "finalized",
  currency_conversion: {
    original_currency: "ISK",
    original_amount: 79086,
    rate: 0.00828,
    rate_date: "2026-08-30",
    provider: "Frankfurter",
  },
  adjustments: [
    { member_id: "sam", amount: "200" },
    { member_id: "alex", amount: "454.83" },
  ],
};
const draft = (tx, overrides = {}) => ({
  description: tx.description,
  totalAmount: Number(tx.total_amount),
  payerId: tx.payer_id,
  splitType: tx.split_type,
  category: "car_rental",
  lineItems: tx.line_items || [],
  adjustments: (tx.adjustments || []).map((a) => ({
    memberId: a.member_id,
    amount: Number(a.amount),
  })),
  ...overrides,
});
const plain = (value) => JSON.parse(JSON.stringify(value));

test("recategorizing equal or custom expenses emits only category and preserves balances, original currency and empty line items", () => {
  for (const split_type of ["equal", "custom"]) {
    const tx = { ...base, split_type };
    const edits = expenseEdits(tx, draft(tx));
    assert.deepEqual(plain(edits), { category: "car_rental" });
    const updated = { ...tx, ...edits };
    const members = [
      { id: "sam", display_name: "Sam" },
      { id: "alex", display_name: "Alex" },
    ];
    assert.deepEqual(
      personalSpending([updated], members, "alex"),
      personalSpending([tx], members, "alex"),
    );
    assert.equal(updated.line_items, null);
    assert.equal(updated.currency_conversion, tx.currency_conversion);
    assert.equal(updated.adjustments, tx.adjustments);
  }
});
test("unchanged categories do not write; real split changes and receipt category edits retain their own update fields", () => {
  const tx = { ...base, category: "car_rental" };
  assert.deepEqual(plain(expenseEdits(tx, draft(tx))), {});
  const equal = { ...base, split_type: "equal" };
  const custom = expenseEdits(
    equal,
    draft(equal, { category: "other", splitType: "custom" }),
  );
  assert.equal(custom.split_type, "custom");
  assert.equal(custom.adjustments.length, 2);
  const receipt = {
    ...base,
    line_items: [{ description: "Fuel", amount: 654.83, category: "gas" }],
  };
  const changed = expenseEdits(
    receipt,
    draft(receipt, {
      lineItems: [{ ...receipt.line_items[0], category: "car_rental" }],
    }),
  );
  assert.deepEqual(Object.keys(changed), ["lineItems"]);
  assert.equal(changed.lineItems[0].category, "car_rental");
});
function fixture(options = {}) {
  const calls = [];
  let row = structuredClone(base);
  const route = moduleAt(
    "app/api/transactions/[id]/route.ts",
    {
      "next/server": {
        NextResponse: { json: (body, init) => Response.json(body, init) },
      },
      "@/lib/categories": categories,
      "@supabase/supabase-js": {
        createClient: (url, key, config) =>
          createClient(url, key, {
            ...config,
            global: {
              ...config?.global,
              fetch: async (input, init) => {
                const req = new Request(input, init),
                  url = new URL(req.url);
                calls.push({
                  path: url.pathname,
                  method: req.method,
                  body: req.method === "PATCH" ? await req.json() : undefined,
                  auth: req.headers.get("authorization"),
                });
                if (url.pathname === "/auth/v1/user")
                  return options.invalidAuth
                    ? Response.json({ message: "Expired" }, { status: 401 })
                    : Response.json({ id: "test-user" });
                assert.equal(
                  req.headers.get("authorization"),
                  "Bearer caller-token",
                );
                assert.equal(
                  url.pathname,
                  "/rest/v1/transactions",
                  "No share delete/insert is permitted for a category edit",
                );
                if (req.method === "GET")
                  return Response.json(options.nonmember ? [] : [row]);
                assert.equal(req.method, "PATCH");
                assert.equal(url.searchParams.get("id"), "eq." + id);
                if (options.missingSchema)
                  return Response.json(
                    { code: "PGRST204", message: "column absent" },
                    { status: 400 },
                  );
                if (options.writeDenied)
                  return Response.json(
                    { code: "PGRST116", message: "No updated rows" },
                    { status: 406 },
                  );
                row = { ...row, ...calls.at(-1).body };
                return Response.json(row);
              },
            },
          }),
      },
    },
    { console: { error() {} } },
  );
  return {
    calls,
    getRow: () => row,
    put: (body, auth = "Bearer caller-token") =>
      route.PUT(
        new Request("https://squared.test/api/transactions/" + id, {
          method: "PUT",
          headers: {
            "content-type": "application/json",
            ...(auth ? { authorization: auth } : {}),
          },
          body: JSON.stringify(body),
        }),
        { params: Promise.resolve({ id }) },
      ),
  };
}
test("authenticated category PUT persists and reloads without touching amount, shares or currency evidence", async () => {
  const f = fixture();
  const response = await f.put({ category: "car_rental" });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).transaction.category, "car_rental");
  const writes = f.calls.filter((c) => c.method === "PATCH");
  assert.equal(writes.length, 1);
  assert.deepEqual(Object.keys(writes[0].body).sort(), [
    "category",
    "updated_at",
  ]);
  const row = f.getRow();
  assert.equal(row.total_amount, base.total_amount);
  assert.deepEqual(row.adjustments, base.adjustments);
  assert.deepEqual(row.currency_conversion, base.currency_conversion);
  assert.equal(row.line_items, null);
});
test("category edits reject bad input, expired auth and inaccessible transactions without writes", async () => {
  for (const [options, body, auth, status] of [
    [{}, { category: "made_up" }, undefined, 400],
    [{}, { category: "car_rental" }, "", 401],
    [{ invalidAuth: true }, { category: "car_rental" }, undefined, 401],
    [{ nonmember: true }, { category: "car_rental" }, undefined, 500],
  ]) {
    const f = fixture(options);
    assert.equal((await f.put(body, auth)).status, status);
    assert.equal(f.calls.filter((c) => c.method === "PATCH").length, 0);
  }
});
test("missing migration and RLS-blocked updates cannot report a successful recategorization", async () => {
  for (const [options, status] of [
    [{ missingSchema: true }, 503],
    [{ writeDenied: true }, 500],
  ]) {
    const f = fixture(options);
    const response = await f.put({ category: "car_rental" });
    assert.equal(response.status, status);
    assert.equal(f.getRow().category, null);
    if (options.missingSchema)
      assert.match((await response.json()).error, /migration/);
  }
});
test("statistics count an expense-level category once while receipt item categories remain primary", async () => {
  const { calculateStatistics } = moduleAt("lib/statistics/calculate.ts");
  const client = {
    from() {
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        order: async () => ({
          data: [
            { ...base, category: "car_rental" },
            {
              ...base,
              total_amount: 20,
              category: "car_rental",
              line_items: [{ amount: 20, category: "gas" }],
            },
          ],
        }),
      };
    },
  };
  const result = await calculateStatistics(client, base.trip_id, "sam");
  assert.equal(result.totalSpent, 674.83);
  assert.equal(
    result.categoryBreakdown.find((c) => c.category === "car_rental").amount,
    654.83,
  );
  assert.equal(
    result.categoryBreakdown.find((c) => c.category === "gas").amount,
    20,
  );
});
