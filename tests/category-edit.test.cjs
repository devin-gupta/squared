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
  const sdk = {
    createClient: (url, key, config) =>
      createClient(url, key, {
        ...config,
        global: {
          ...config?.global,
          fetch: async (input, init) => {
            const req = new Request(input, init),
              u = new URL(req.url);
            const body = req.method === "POST" ? await req.json() : undefined;
            calls.push({ path: u.pathname, method: req.method, body });
            if (u.pathname === "/auth/v1/user")
              return options.invalidAuth
                ? Response.json({ message: "Expired" }, { status: 401 })
                : Response.json({ id: "test-user" });
            assert.equal(
              req.headers.get("authorization"),
              "Bearer caller-token",
            );
            if (req.method === "GET")
              return Response.json(options.nonmember ? [] : [row]);
            assert.equal(u.pathname, "/rest/v1/rpc/commit_expense");
            if (options.missingSchema)
              return Response.json({ code: "PGRST202" }, { status: 404 });
            if (options.writeDenied)
              return Response.json(
                { code: "42501", message: "Join this trip" },
                { status: 403 },
              );
            if (options.conflict)
              return Response.json(
                { code: "40001", message: "This expense changed" },
                { status: 400 },
              );
            row = { ...row, ...body.payload };
            return Response.json({
              transactionId: row.id,
              changeId: body.operation_id,
              version: 2,
            });
          },
        },
      }),
  };
  const server = moduleAt("lib/transactions/server.ts", {
    "server-only": {},
    "@supabase/supabase-js": sdk,
  });
  const route = moduleAt("app/api/transactions/[id]/route.ts", {
    "next/server": {
      NextResponse: { json: (body, init) => Response.json(body, init) },
    },
    "@/lib/categories": categories,
    "@/lib/transactions/server": server,
  });
  return {
    calls,
    getRow: () => row,
    put: (body, auth = "Bearer caller-token", op = crypto.randomUUID()) =>
      route.PUT(
        new Request("https://squared.test/api/transactions/" + id, {
          method: "PUT",
          headers: {
            "content-type": "application/json",
            "idempotency-key": op,
            ...(auth ? { authorization: auth } : {}),
          },
          body: JSON.stringify({ expectedVersion: 1, ...body }),
        }),
        { params: Promise.resolve({ id }) },
      ),
  };
}
test("authenticated category PUT sends an atomic versioned operation without rewriting amount, shares or currency evidence", async () => {
  const f = fixture(),
    op = crypto.randomUUID();
  assert.equal(
    (await f.put({ category: "car_rental" }, undefined, op)).status,
    200,
  );
  const writes = f.calls.filter((c) => c.path.endsWith("/commit_expense"));
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0].body.payload, { category: "car_rental" });
  assert.equal(writes[0].body.operation_id, op);
  assert.equal(writes[0].body.expected_version, 1);
  assert.equal(f.getRow().category, "car_rental");
  assert.equal(f.getRow().total_amount, base.total_amount);
  assert.deepEqual(f.getRow().adjustments, base.adjustments);
  assert.deepEqual(f.getRow().currency_conversion, base.currency_conversion);
});
test("invalid categories, expired auth, inaccessible expenses and missing version/key cannot issue writes", async () => {
  for (const [options, body, auth, op, status] of [
    [{}, { category: "bad" }, undefined, undefined, 400],
    [{}, { category: "car_rental" }, "", undefined, 401],
    [{ invalidAuth: true }, {}, undefined, undefined, 401],
    [{ nonmember: true }, {}, undefined, undefined, 404],
    [{}, { expectedVersion: null }, undefined, undefined, 409],
    [{}, {}, undefined, "invalid", 400],
  ]) {
    const f = fixture(options);
    assert.equal((await f.put(body, auth, op)).status, status);
    assert.equal(
      f.calls.filter((c) => c.path.endsWith("/commit_expense")).length,
      0,
    );
  }
});
test("missing migration, access rejection and version conflicts preserve the expense", async () => {
  for (const [options, status] of [
    [{ missingSchema: true }, 503],
    [{ writeDenied: true }, 403],
    [{ conflict: true }, 409],
  ]) {
    const f = fixture(options);
    assert.equal((await f.put({ category: "car_rental" })).status, status);
    assert.equal(f.getRow().category, null);
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
