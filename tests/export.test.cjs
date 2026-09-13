const test = require("node:test");
const assert = require("node:assert/strict");
const moduleAt = require("./load-module.cjs");

const allocation = moduleAt("lib/transactions/allocation.ts");
const { expenseCsv } = moduleAt("lib/transactions/export.ts", {
  "./allocation": allocation,
});

const members = [
  { id: "devin", display_name: "Devin" },
  { id: "elyne", display_name: "Elyne" },
  { id: "josue", display_name: "Josue" },
];

test("CSV exposes each member's paid, share, and net amounts for custom splits", () => {
  const csv = expenseCsv(
    [
      {
        id: "expense",
        trip_id: "trip",
        description: "Groceries",
        total_amount: 90,
        payer_id: "devin",
        payer: { display_name: "Devin" },
        split_type: "custom",
        adjustments: [
          { member_id: "devin", amount: 20 },
          { member_id: "elyne", amount: 50 },
          { member_id: "josue", amount: 20 },
        ],
        created_at: "2026-09-13T12:00:00Z",
        updated_at: "2026-09-13T12:00:00Z",
        status: "finalized",
      },
    ],
    members,
  );
  const [header, row] = csv.split("\n");
  assert.match(header, /"Elyne share \(USD\)"/);
  assert.match(header, /"Elyne net: paid minus share \(USD\)"/);
  assert.match(row, /"Devin: 20.00; Elyne: 50.00; Josue: 20.00"/);
  assert.match(row, /,0,50,-50,/);
});

test("item-level and equal splits produce member allocations without losing cents", () => {
  const item = allocation.expenseAllocations(
    {
      total_amount: 80,
      split_type: "equal",
      line_items: [
        { amount: 60, split_among: ["Elyne", "Josue"] },
        { amount: 20 },
      ],
    },
    members,
  );
  assert.equal(item.find((share) => share.memberId === "devin").amount, 20 / 3);
  assert.equal(item.find((share) => share.memberId === "elyne").amount, 30 + 20 / 3);
  const equal = allocation.expenseAllocations(
    { total_amount: 100, split_type: "equal" },
    members,
  );
  assert.equal(
    equal.reduce((sum, share) => sum + share.amount, 0),
    100,
  );
});
