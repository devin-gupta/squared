const test = require("node:test");
const assert = require("node:assert/strict");
const moduleAt = require("./load-module.cjs");
const {
  splitIncludesMember,
  toggleSplitMember,
} = moduleAt("lib/transactions/participants.ts");

const members = [
  { id: "sam-id", name: "Sam" },
  { id: "alex-id", name: "Alex" },
  { id: "priya-id", name: "Priya" },
];

test("an omitted AI split is presented as everyone and toggles from everyone", () => {
  assert(members.every((member) => splitIncludesMember(undefined, member)));
  assert.deepEqual(Array.from(toggleSplitMember([], members, "priya-id")), [
    "sam-id",
    "alex-id",
  ]);
});

test("selecting the excluded person returns to the compact everyone split", () => {
  assert.deepEqual(
    Array.from(
      toggleSplitMember(["Sam", "alex-id"], members, "priya-id"),
    ),
    [],
  );
  assert(members.every((member) => splitIncludesMember([], member)));
});

test("the final participant cannot be deselected into the everyone shorthand", () => {
  assert.deepEqual(
    Array.from(toggleSplitMember(["sam-id"], members, "sam-id")),
    ["sam-id"],
  );
});
