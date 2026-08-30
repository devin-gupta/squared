const test = require("node:test");
const assert = require("node:assert/strict");
const moduleAt = require("./load-module.cjs");
const amounts = moduleAt("lib/ai/amounts.ts", {}, { Intl });
const categories = moduleAt("lib/categories.ts");
const { normalizeParsedExpense } = moduleAt("lib/ai/normalize.ts", {
  "../categories": categories,
  "./amounts": amounts,
});
const currency = moduleAt("lib/currency/convert.ts");

test("printed totals handle Icelandic thousands, European decimals, and ordinary dollar cents", () => {
  for (const [text, code, expected] of [
    ["79.086 ISK", "ISK", 79086],
    ["ISK 79 086", "ISK", 79086],
    ["42.750 kr", "ISK", 42750],
    ["79.086,00 ISK", "ISK", 79086],
    ["€1.234,56", "EUR", 1234.56],
    ["USD 1,234.56", "USD", 1234.56],
    ["$12.50", "USD", 12.5],
    ["JPY 15,000", "JPY", 15000],
    ["CHF 1’234.50", "CHF", 1234.5],
    ["-1.000 ISK", "ISK", -1000],
  ])
    assert.equal(amounts.printedAmount(text, code), expected, text);
  for (const [text, code] of [
    ["6.9.2026 10:00", "ISK"],
    ["12.50 + 2.00", "USD"],
    ["7 9", "USD"],
    ["1.234", "KWD"],
    ["0.125", "ISK"],
    ["unreadable", "ISK"],
  ]) {
    assert.equal(amounts.printedAmount(text, code), null, text);
  }
});

test("printed ISK evidence corrects decimal misreads without multiplying a correctly read amount", () => {
  for (const modelAmount of [79.086, 79086]) {
    const parsed = normalizeParsedExpense({
      description: "Car rental — MG ZS, Keflavík Airport",
      total_amount: modelAmount,
      amount_text: "79.086 ISK",
      currency: "isk",
      category: "car rental",
      split_type: "equal",
      line_items: [
        {
          description: "Car rental",
          amount: modelAmount,
          category: "car_rental",
        },
      ],
    });
    assert.equal(parsed.total_amount, 79086);
    assert.equal(parsed.line_items.length, 1);
    assert.equal(parsed.line_items[0].amount, 79086);
    assert.equal(parsed.line_items[0].category, "car_rental");
    const converted = currency.convertExpense(parsed, {
      currency: "ISK",
      rate: 0.00828,
      date: new Date().toISOString().slice(0, 10),
      provider: "Frankfurter",
    });
    assert.equal(converted.total_amount, 654.83);
    assert.equal(converted.line_items[0].amount, 654.83);
    assert.equal(converted.currency_conversion.original_amount, 79086);
    assert.equal(converted.currency_conversion.original_currency, "ISK");
  }
});

test("a whole-booking category is retained without inventing prices for unpriced extras", () => {
  const parsed = normalizeParsedExpense({
    description: "Car rental",
    total_amount: 42750,
    currency: "ISK",
    category: "car_rental_expenses",
    split_type: "equal",
  });
  assert.equal(parsed.line_items.length, 1);
  assert.equal(parsed.line_items[0].amount, 42750);
  assert.equal(parsed.line_items[0].category, "car_rental");
  const custom = normalizeParsedExpense({
    ...parsed,
    line_items: undefined,
    split_type: "custom",
    adjustments: [
      { user_name: "A", amount: 10000 },
      { user_name: "B", amount: 32750 },
    ],
  });
  assert.equal(
    custom.line_items,
    undefined,
    "Do not replace custom shares with an equal-split line",
  );
  assert.equal(custom.adjustments[0].amount, 10000);
});

test("ambiguous totals and inconsistent items require review rather than silent amount guesses", () => {
  const base = {
    description: "Booking",
    total_amount: 123,
    currency: "USD",
    category: "lodging",
    split_type: "equal",
  };
  const unknown = normalizeParsedExpense({
    ...base,
    amount_text: "Total unclear",
  });
  assert.equal(unknown.total_amount, 0);
  assert.match(unknown.review_note, /Confirm/);
  const inconsistent = normalizeParsedExpense({
    ...base,
    line_items: [
      { description: "Stay", amount: 100, category: "lodging" },
      { description: "Tax", amount: 10, category: "fees" },
    ],
  });
  assert.match(inconsistent.review_note, /do not add up/);
});

test("file validation is shared by paste, drop, picker and the server", () => {
  const { receiptFileError, transferredFiles } = moduleAt(
    "lib/receipts/files.ts",
  );
  assert.equal(receiptFileError({ type: "image/png", size: 1000 }), null);
  for (const file of [
    { type: "application/pdf", size: 10 },
    { type: "image/heic", size: 10 },
    { type: "image/png", size: 0 },
    { type: "image/png", size: 4 * 1024 * 1024 + 1 },
  ])
    assert(receiptFileError(file));
  const file = { type: "image/png", size: 10 };
  assert.equal(
    transferredFiles({
      files: [],
      items: [{ kind: "file", getAsFile: () => file }],
    })[0],
    file,
  );
  assert.equal(transferredFiles({ files: [file], items: [] })[0], file);
  assert.equal(
    transferredFiles({ files: [], items: [{ kind: "string" }] }).length,
    0,
  );
});

test("travel categories cover specific transport and common international costs", () => {
  for (const category of [
    "car_rental",
    "public_transport",
    "flights",
    "parking_tolls",
    "insurance",
    "visas",
    "connectivity",
    "fees",
    "health",
    "laundry",
  ]) {
    assert.equal(categories.normalizeCategory(category), category);
    assert.notEqual(categories.categoryLabel(category), "Other");
  }
  assert.equal(
    categories.normalizeCategory("unknown invented category"),
    "other",
  );
  assert.equal(categories.normalizeCategory("Food"), "food");
  assert.equal(currency.normalizeCurrency("isk"), "ISK");
});
