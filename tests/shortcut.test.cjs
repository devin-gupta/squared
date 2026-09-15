const test = require("node:test");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const moduleAt = require("./load-module.cjs");
const { database, as } = require("./sql-fixture.cjs");

const shortcut = moduleAt(
  "lib/shortcut/server.ts",
  {
    "server-only": {},
    "node:crypto": {
      createHash,
      randomBytes: () => Buffer.alloc(32, 7),
    },
    "@supabase/supabase-js": { createClient: () => ({}) },
  },
  { process: { env: {} }, Buffer },
);

test("shortcut credentials are strict and identical receipt bytes produce one operation id", () => {
  const token = shortcut.newShortcutToken();
  assert.match(token, /^sqr_[A-Za-z0-9_-]{43}$/);
  const hash = shortcut.shortcutTokenHash(token);
  assert.equal(hash.length, 64);
  assert.equal(shortcut.shortcutTokenHash("not-a-token"), null);
  const bytes = new Uint8Array([1, 2, 3, 4]);
  assert.equal(
    shortcut.receiptOperationId(hash, bytes),
    shortcut.receiptOperationId(hash, bytes),
  );
  assert.notEqual(
    shortcut.receiptOperationId(hash, bytes),
    shortcut.receiptOperationId(hash, new Uint8Array([1, 2, 3, 5])),
  );
});

test("service-only shortcut credentials are trip-scoped, rate-limited and idempotently create an audited expense", async () => {
  const db = await database();
  const alice = "11111111-1111-4111-8111-111111111111";
  const tokenHash = "a".repeat(64);
  const operationId = "77777777-7777-4777-8777-777777777777";
  try {
    await as(db, alice);
    const trip = (
      await db.query(
        "SELECT start_group_trip($1,$2,$3,$4) result",
        [
          "Shortcut trip",
          "Sam",
          JSON.stringify(["Alex", "Priya"]),
          "66666666-6666-4666-8666-666666666666",
        ],
      )
    ).rows[0].result;
    await db.exec("RESET ROLE");
    await db.exec("SET ROLE service_role");
    await db.query(
      "INSERT INTO shortcut_receipt_tokens(user_id,trip_id,token_hash) VALUES($1,$2,$3)",
      [alice, trip.tripId, tokenHash],
    );
    const claimed = (
      await db.query("SELECT claim_shortcut_receipt($1,$2) result", [
        tokenHash,
        operationId,
      ])
    ).rows[0].result;
    assert.equal(claimed.existing, false);
    assert.equal(claimed.payerName, "Sam");
    assert.deepEqual(Array.from(claimed.memberNames), ["Sam", "Alex", "Priya"]);
    const payload = {
      description: "Translated dinner receipt",
      total_amount: 90,
      payer_id: claimed.payerId,
      split_type: "equal",
      receipt_url: "https://example.test/receipt.jpg",
      category: "food",
      line_items: [
        {
          description: "Dinner",
          amount: 90,
          category: "food",
          split_among: [],
        },
      ],
      currency_conversion: null,
      shares: [],
    };
    const saved = (
      await db.query(
        "SELECT commit_shortcut_receipt($1,$2,$3) result",
        [tokenHash, operationId, JSON.stringify(payload)],
      )
    ).rows[0].result;
    assert.equal(saved.description, payload.description);
    await db.exec("RESET ROLE");
    const row = (
      await db.query(
        `SELECT t.description,c.actor_id,c.command
           FROM transactions t JOIN expense_changes c ON c.expense_id=t.id
          WHERE t.id=$1`,
        [saved.transactionId],
      )
    ).rows[0];
    assert.deepEqual(row, {
      description: payload.description,
      actor_id: alice,
      command: "create",
    });
    await db.exec("SET ROLE service_role");
    const repeated = (
      await db.query("SELECT claim_shortcut_receipt($1,$2) result", [
        tokenHash,
        operationId,
      ])
    ).rows[0].result;
    assert.equal(repeated.existing, true);
    assert.equal(repeated.result.transactionId, saved.transactionId);
    await db.query(
      "UPDATE shortcut_receipt_tokens SET rate_count=20,rate_window_at=now() WHERE token_hash=$1",
      [tokenHash],
    );
    await assert.rejects(
      db.query("SELECT claim_shortcut_receipt($1,$2)", [
        tokenHash,
        "88888888-8888-4888-8888-888888888888",
      ]),
      /hourly receipt limit/,
    );
    await assert.rejects(
      db.query("SELECT claim_shortcut_receipt($1,$2)", [
        "b".repeat(64),
        "99999999-9999-4999-8999-999999999999",
      ]),
      /invalid or expired/,
    );
    await as(db, alice);
    await assert.rejects(
      db.query("SELECT claim_shortcut_receipt($1,$2)", [
        tokenHash,
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      ]),
      /permission denied/i,
    );
  } finally {
    await db.close();
  }
});
