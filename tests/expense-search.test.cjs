const test = require("node:test");
const assert = require("node:assert/strict");
const moduleAt = require("./load-module.cjs");

const allocation = moduleAt("lib/transactions/allocation.ts");
const categories = moduleAt("lib/categories.ts");
const {
  expenseMatchesCategory,
  expenseMatchesDateRange,
  expenseMatchesSearch,
} = moduleAt(
  "lib/transactions/search.ts",
  {
    "./allocation": allocation,
    "../categories": categories,
  },
);

const members = [
  { id: "alex", display_name: "Alex" },
  { id: "blair", display_name: "Blair" },
  { id: "casey", display_name: "Casey" },
];

function expense(overrides = {}) {
  return {
    description: "Museum tickets",
    total_amount: 60,
    payer_id: "alex",
    split_type: "custom",
    adjustments: [
      { member_id: "alex", amount: 0 },
      { member_id: "blair", amount: 30 },
      { member_id: "casey", amount: 30 },
    ],
    ...overrides,
  };
}

test("expense search matches descriptions and payees, but not a payer with no share", () => {
  const transaction = expense();

  assert.equal(expenseMatchesSearch(transaction, members, "museum"), true);
  assert.equal(expenseMatchesSearch(transaction, members, "BLAIR"), true);
  assert.equal(expenseMatchesSearch(transaction, members, "Alex"), false);
});

test("expense search derives payees from equal and receipt-item splits", () => {
  assert.equal(
    expenseMatchesSearch(
      expense({ split_type: "equal", adjustments: undefined }),
      members,
      "Alex",
    ),
    true,
  );

  const receipt = expense({
    line_items: [
      {
        description: "Casey's admission",
        amount: 60,
        split_among: ["casey"],
      },
    ],
  });
  assert.equal(expenseMatchesSearch(receipt, members, "Casey"), true);
  assert.equal(expenseMatchesSearch(receipt, members, "Blair"), false);
});

test("blank expense searches continue to show every transaction", () => {
  assert.equal(expenseMatchesSearch(expense(), members, "   "), true);
});

test("category filtering checks expense categories and every receipt item", () => {
  assert.equal(
    expenseMatchesCategory(expense({ category: "activities" }), "activities"),
    true,
  );
  assert.equal(
    expenseMatchesCategory(expense({ category: "activities" }), "food"),
    false,
  );

  const mixedReceipt = expense({
    category: "other",
    line_items: [
      { description: "Lunch", amount: 20, category: "food" },
      { description: "Admission", amount: 40, category: "activities" },
    ],
  });
  assert.equal(expenseMatchesCategory(mixedReceipt, "food"), true);
  assert.equal(expenseMatchesCategory(mixedReceipt, "activities"), true);
  assert.equal(expenseMatchesCategory(mixedReceipt, "lodging"), false);
  assert.equal(expenseMatchesCategory(mixedReceipt, ""), true);
});

test("date filtering supports inclusive, open-ended local date ranges", () => {
  const transaction = expense({ created_at: "2026-09-15T12:00:00" });

  assert.equal(
    expenseMatchesDateRange(transaction, "2026-09-15", "2026-09-15"),
    true,
  );
  assert.equal(expenseMatchesDateRange(transaction, "2026-09-16", ""), false);
  assert.equal(expenseMatchesDateRange(transaction, "", "2026-09-14"), false);
  assert.equal(expenseMatchesDateRange(transaction, "", ""), true);
});
