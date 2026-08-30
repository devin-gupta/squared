const test = require("node:test");
const assert = require("node:assert/strict");
const moduleAt = require("./load-module.cjs");
const currency = moduleAt("lib/currency/convert.ts");
const quote = (rate = 0.01, code = "INR") => ({
  currency: code,
  rate,
  date: new Date().toISOString().slice(0, 10),
  provider: "Frankfurter",
});
const expense = (options = {}) => ({
  description: "Dinner",
  total_amount: 1000,
  currency: "INR",
  split_type: "equal",
  ...options,
});

test("foreign expenses become USD while retaining original currency, amount, rate, and date", () => {
  const result = currency.convertExpense(expense(), quote());
  assert.equal(result.total_amount, 10);
  assert.equal(result.currency, "USD");
  assert.equal(result.currency_conversion.original_amount, 1000);
  assert.equal(result.currency_conversion.original_currency, "INR");
  assert.equal(result.currency_conversion.rate, 0.01);
  assert.equal(result.currency_conversion.rate_date, quote().date);
});

test("rounding converted custom shares and receipt items preserves exactly the USD total", () => {
  const result = currency.convertExpense(
    expense({
      total_amount: 3,
      split_type: "custom",
      adjustments: [
        { user_name: "A", amount: 1 },
        { user_name: "B", amount: 1 },
        { user_name: "C", amount: 1 },
        { user_name: "Excluded", amount: 0 },
      ],
    }),
    quote(1.005),
  );
  assert.equal(result.total_amount, 3.02);
  assert.deepEqual(
    Array.from(result.adjustments, (share) => share.amount),
    [1.01, 1.01, 1, 0],
  );
  const receipt = currency.convertExpense(
    expense({
      total_amount: 8,
      line_items: [
        {
          description: "Meal",
          amount: 10,
          category: "Food",
          split_among: ["A"],
        },
        {
          description: "Discount",
          amount: -2,
          category: "Food",
          split_among: ["A"],
        },
      ],
    }),
    quote(1.234),
  );
  assert.equal(receipt.total_amount, 9.87);
  assert.equal(
    receipt.line_items.reduce(
      (sum, item) => sum + Math.round(item.amount * 100),
      0,
    ),
    987,
  );
  assert.equal(receipt.line_items[0].split_among[0], "A");
});

test("invalid/stale rates, unsupported currencies, and mismatched shares fail without treating the amount as USD", () => {
  for (const rate of [0, -1, NaN, Infinity])
    assert.throws(() => currency.convertExpense(expense(), quote(rate)));
  assert.throws(() =>
    currency.convertExpense(expense(), { ...quote(), date: "2000-01-01" }),
  );
  assert.throws(() => currency.convertExpense(expense(), quote(1, "EUR")));
  assert.throws(() =>
    currency.convertExpense(expense({ currency: "UNKNOWN" }), quote()),
  );
  assert.throws(() =>
    currency.convertExpense(expense({ total_amount: NaN }), quote()),
  );
  assert.throws(() =>
    currency.convertExpense(
      expense({
        split_type: "custom",
        adjustments: [{ amount: 500, user_name: "A" }],
      }),
      quote(),
    ),
  );
  assert.throws(() =>
    currency.convertExpense(
      expense({ line_items: [{ amount: 999 }] }),
      quote(),
    ),
  );
});

test("USD entry skips rate requests; failed foreign conversion performs no database writes", async () => {
  let calls = 0;
  const client = moduleAt(
    "lib/currency/client.ts",
    { "./convert": currency },
    {
      fetch: async () => {
        calls++;
        return Response.json({ error: "Rate unavailable" }, { status: 503 });
      },
    },
  );
  const usd = await client.prepareUsdExpense(expense({ currency: "USD" }));
  assert.equal(usd.total_amount, 1000);
  assert.equal(calls, 0);
  const create = moduleAt("lib/transactions/create.ts", {
    "../currency/client": client,
    "../supabase/client": {
      supabase: {
        from() {
          assert.fail("No DB calls before conversion succeeds");
        },
      },
    },
    "../trips/addMember": {
      addMember() {
        assert.fail("No member writes before conversion succeeds");
      },
    },
  });
  await assert.rejects(
    create.createTransaction("trip", expense()),
    /Rate unavailable/,
  );
  assert.equal(calls, 1);
});

test("rate lookup sends only a currency pair, validates the response, and rejects provider failures", async () => {
  let calls = [],
    response = { base: "INR", quote: "USD", date: quote().date, rate: 0.01 };
  const rates = moduleAt(
    "lib/currency/rates.ts",
    { "server-only": {}, "./convert": currency },
    {
      fetch: async (url, init) => {
        calls.push({ url, init });
        return response === null
          ? Response.json({}, { status: 503 })
          : Response.json(response);
      },
    },
  );
  assert.equal((await rates.getUsdRate("inr")).rate, 0.01);
  assert.equal(calls[0].url, "https://api.frankfurter.dev/v2/rate/INR/USD");
  assert.equal(calls[0].init.body, undefined);
  response = { ...response, quote: "EUR" };
  await assert.rejects(rates.getUsdRate("INR"), /invalid/);
  response = null;
  await assert.rejects(rates.getUsdRate("INR"), /unavailable/);
  await assert.rejects(rates.getUsdRate("../../evil"), /supported/);
});

test("foreign save uses one atomic RPC with USD shares and the conversion reference", async () => {
  const converted = currency.convertExpense(
    expense({
      split_type: "custom",
      adjustments: [
        { user_name: "Sam", amount: 400 },
        { user_name: "Alex", amount: 600 },
      ],
    }),
    quote(),
  );
  const calls = [];
  const supabase = {
    from(table) {
      return {
        select() {
          return this;
        },
        limit: async () => ({ error: null }),
        eq: async () => ({
          data: [
            { id: "sam", display_name: "Sam" },
            { id: "alex", display_name: "Alex" },
          ],
        }),
      };
    },
    async rpc(name, args) {
      calls.push({ name, args });
      return { data: "saved-id", error: null };
    },
  };
  const create = moduleAt("lib/transactions/create.ts", {
    "../currency/client": { prepareUsdExpense: async () => converted },
    "../supabase/client": { supabase },
    "../trips/addMember": {},
  });
  const result = await create.createTransaction("trip", converted, null, "Sam");
  assert.equal(result.totalAmount, 10);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, "create_converted_expense");
  assert.equal(
    calls[0].args.expense.currency_conversion.original_currency,
    "INR",
  );
  assert.deepEqual(
    Array.from(calls[0].args.shares, (share) => share.amount),
    [4, 6],
  );
});

test("missing currency storage stops before member or expense writes", async () => {
  const create = moduleAt("lib/transactions/create.ts", {
    "../currency/client": { prepareUsdExpense: async parsed => currency.convertExpense(parsed, quote()) },
    "../supabase/client": { supabase: {
      from(table) {
        assert.equal(table, "transactions");
        return { select() { return this; }, limit: async () => ({ error: { code: "PGRST204" } }) };
      },
      rpc() { assert.fail("Do not save when the migration is missing"); },
    } },
    "../trips/addMember": { addMember() { assert.fail("Do not add members before storage is ready"); } },
  });
  await assert.rejects(create.createTransaction("trip", expense()), /migration; no expense was saved/);
});
