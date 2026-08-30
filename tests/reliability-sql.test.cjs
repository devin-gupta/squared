const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const alice = "11111111-1111-4111-8111-111111111111",
  bob = "22222222-2222-4222-8222-222222222222",
  cara = "33333333-3333-4333-8333-333333333333";
const { database, as } = require("./sql-fixture.cjs");
const call = async (db, sql, args = []) =>
  (await db.query(sql, args)).rows[0].result;
const commit = (
  db,
  op,
  command,
  trip,
  eid,
  payload = {},
  version = null,
  undo = null,
) =>
  call(db, "SELECT commit_expense($1,$2,$3,$4,$5,$6,$7) result", [
    op,
    command,
    trip,
    eid,
    JSON.stringify(payload),
    version,
    undo,
  ]);
test("real PostgreSQL: name claiming, idempotent writes, atomic allocations, conflicts, audit and undo", async () => {
  const db = await database();
  try {
    await as(db, alice);
    const trip = await call(db, "SELECT start_group_trip($1,$2,$3,$4) result", [
      "Iceland",
      "Alice",
      JSON.stringify(["Bob", "Cara"]),
      randomUUID(),
    ]);
    const ctx = await call(db, "SELECT invite_context($1) result", [
      trip.inviteCode,
    ]);
    assert.equal(ctx.tripName, "Iceland");
    assert.equal(ctx.members.length, 2);
    const bm = ctx.members.find((m) => m.name === "Bob").id;
    const am = ctx.memberId;
    const payload = {
      description: "Car rental",
      total_amount: 654.83,
      payer_id: bm,
      split_type: "custom",
      category: "car_rental",
      line_items: null,
      currency_conversion: {
        original_currency: "ISK",
        original_amount: 79086,
        rate: 0.00828,
        rate_date: "2026-08-30",
        provider: "Frankfurter",
      },
      shares: [
        { member_id: am, amount: 200 },
        { member_id: bm, amount: 454.83 },
      ],
    };
    const createId = randomUUID();
    const first = await commit(
      db,
      createId,
      "create",
      trip.tripId,
      null,
      payload,
    );
    const retry = await commit(
      db,
      createId,
      "create",
      trip.tripId,
      null,
      payload,
    );
    assert.deepEqual(retry, first);
    assert.equal(
      (await db.query("SELECT count(*)::int n FROM transactions")).rows[0].n,
      1,
    );
    await assert.rejects(
      commit(db, createId, "create", trip.tripId, null, {
        ...payload,
        total_amount: 1,
      }),
      /already used/,
    );
    await as(db, bob);
    assert.equal(
      (await call(db, "SELECT invite_context($1) result", [trip.inviteCode]))
        .memberId,
      null,
    );
    assert.equal(
      await call(db, "SELECT join_invited_trip($1,$2,NULL) result", [
        trip.inviteCode,
        bm,
      ]),
      trip.tripId,
    );
    assert.equal(
      await call(db, "SELECT join_invited_trip($1,$2,NULL) result", [
        trip.inviteCode,
        bm,
      ]),
      trip.tripId,
    );
    assert.equal(
      (
        await db.query("SELECT payer_id FROM transactions WHERE id=$1", [
          first.transactionId,
        ])
      ).rows[0].payer_id,
      bm,
    );
    await assert.rejects(
      call(db, "SELECT add_trip_names($1,$2) result", [
        trip.tripId,
        JSON.stringify(["Dan"]),
      ]),
      /Only the organizer/,
    );
    await as(db, cara);
    await assert.rejects(
      call(db, "SELECT join_invited_trip($1,$2,NULL) result", [
        trip.inviteCode,
        bm,
      ]),
      /already been claimed/,
    );
    await assert.rejects(
      commit(
        db,
        randomUUID(),
        "update",
        trip.tripId,
        first.transactionId,
        { category: "gas" },
        1,
      ),
      /Join this trip/,
    );
    assert.equal(
      (await db.query("SELECT count(*)::int n FROM expense_changes")).rows[0].n,
      0,
      "Nonmembers cannot read history",
    );
    await as(db, alice);
    const edit = await commit(
      db,
      randomUUID(),
      "update",
      trip.tripId,
      first.transactionId,
      { category: "transport" },
      1,
    );
    assert.equal(edit.version, 2);
    const row = (
      await db.query("SELECT * FROM transactions WHERE id=$1", [
        first.transactionId,
      ])
    ).rows[0];
    assert.equal(row.line_items, null);
    assert.equal(Number(row.total_amount), 654.83);
    assert.deepEqual(row.currency_conversion, payload.currency_conversion);
    assert.equal(
      (
        await db.query(
          "SELECT sum(amount)::text n FROM transaction_adjustments",
        )
      ).rows[0].n,
      "654.83",
    );
    await assert.rejects(
      commit(
        db,
        randomUUID(),
        "update",
        trip.tripId,
        first.transactionId,
        { description: "Stale" },
        1,
      ),
      /changed/,
    );
    await assert.rejects(
      commit(
        db,
        randomUUID(),
        "update",
        trip.tripId,
        first.transactionId,
        { shares: [{ member_id: am, amount: 1 }] },
        2,
      ),
      /add up/,
    );
    assert.equal(
      (
        await db.query(
          "SELECT sum(amount)::text n FROM transaction_adjustments",
        )
      ).rows[0].n,
      "654.83",
      "Invalid update rolls back shares and expense",
    );
    const undoEdit = await commit(
      db,
      randomUUID(),
      "undo",
      trip.tripId,
      null,
      {},
      null,
      edit.changeId,
    );
    assert.equal(undoEdit.version, 3);
    await assert.rejects(
      commit(
        db,
        randomUUID(),
        "undo",
        trip.tripId,
        null,
        {},
        null,
        edit.changeId,
      ),
      /Someone changed/,
    );
    const deleted = await commit(
      db,
      randomUUID(),
      "delete",
      trip.tripId,
      first.transactionId,
      {},
      3,
    );
    assert.equal(
      (await db.query("SELECT count(*)::int n FROM transactions")).rows[0].n,
      0,
    );
    const restored = await commit(
      db,
      randomUUID(),
      "undo",
      trip.tripId,
      null,
      {},
      null,
      deleted.changeId,
    );
    assert.equal(restored.transactionId, first.transactionId);
    assert.equal(restored.version, 4);
    assert.equal(
      (
        await db.query(
          "SELECT sum(amount)::text n FROM transaction_adjustments",
        )
      ).rows[0].n,
      "654.83",
    );
    await as(db, bob);
    await assert.rejects(
      commit(
        db,
        randomUUID(),
        "undo",
        trip.tripId,
        null,
        {},
        null,
        deleted.changeId,
      ),
      /own changes/,
    );
    await assert.rejects(
      db.query("DELETE FROM expense_changes"),
      /permission denied/,
    );
    await as(db, null);
    await assert.rejects(
      call(db, "SELECT invite_context($1) result", [trip.inviteCode]),
      /Sign in/,
    );
  } finally {
    await db.close();
  }
});

test("next-trip creation is retry-safe and copies only names, with no account claims or balances", async () => {
  const db = await database();
  try {
    await as(db, alice);
    const original = await call(
      db,
      "SELECT start_group_trip($1,$2,$3,$4) result",
      ["First trip", "Alice", JSON.stringify(["Bob", "Cara"]), randomUUID()],
    );
    const ctx = await call(db, "SELECT invite_context($1) result", [
      original.inviteCode,
    ]);
    await commit(db, randomUUID(), "create", original.tripId, null, {
      description: "Dinner",
      total_amount: 90,
      payer_id: ctx.memberId,
      split_type: "equal",
    });
    await as(db, bob);
    await call(db, "SELECT join_invited_trip($1,$2,NULL) result", [
      original.inviteCode,
      ctx.members.find((m) => m.name === "Bob").id,
    ]);
    await as(db, alice);
    const names = (
      await db.query(
        "SELECT display_name FROM trip_members WHERE trip_id=$1 AND user_id IS DISTINCT FROM $2 ORDER BY display_name",
        [original.tripId, alice],
      )
    ).rows.map((m) => m.display_name);
    const id = randomUUID();
    const args = ["Second trip", "Alice", JSON.stringify(names), id];
    const [next, retry] = await Promise.all([
      call(db, "SELECT start_group_trip($1,$2,$3,$4) result", args),
      call(db, "SELECT start_group_trip($1,$2,$3,$4) result", args),
    ]);
    assert.deepEqual(next, retry);
    assert.notEqual(next.inviteCode, original.inviteCode);
    const people = (
      await db.query("SELECT * FROM trip_members WHERE trip_id=$1", [id])
    ).rows;
    assert.equal(people.length, 3);
    assert.equal(people.filter((m) => m.user_id).length, 1);
    assert.equal(
      (
        await db.query(
          "SELECT count(*)::int n FROM transactions WHERE trip_id=$1",
          [id],
        )
      ).rows[0].n,
      0,
    );
    assert.equal(
      (
        await db.query(
          "SELECT count(*)::int n FROM transactions WHERE trip_id=$1",
          [original.tripId],
        )
      ).rows[0].n,
      1,
    );
    await call(db, "SELECT add_trip_names($1,$2) result", [
      id,
      JSON.stringify(["bob", "Dana", "Dana"]),
    ]);
    assert.equal(
      (
        await db.query(
          "SELECT count(*)::int n FROM trip_members WHERE trip_id=$1",
          [id],
        )
      ).rows[0].n,
      4,
    );
    await assert.rejects(
      call(db, "SELECT add_trip_names($1,$2) result", [
        id,
        JSON.stringify(["Eli", "X".repeat(81)]),
      ]),
      /1 to 80/,
    );
    assert.equal(
      (
        await db.query(
          "SELECT count(*)::int n FROM trip_members WHERE trip_id=$1",
          [id],
        )
      ).rows[0].n,
      4,
      "Failed bulk add rolls back earlier names",
    );
  } finally {
    await db.close();
  }
});

test("invalid cross-trip allocations roll back, and undo cannot overwrite a friend's later edit", async () => {
  const db = await database();
  try {
    await as(db, alice);
    const trip = await call(db, "SELECT start_group_trip($1,$2,$3,$4) result", [
      "Iceland",
      "Alice",
      JSON.stringify(["Bob"]),
      randomUUID(),
    ]);
    const ctx = await call(db, "SELECT invite_context($1) result", [
      trip.inviteCode,
    ]);
    const payload = {
      description: "Lunch",
      total_amount: 20,
      payer_id: ctx.memberId,
      split_type: "equal",
    };
    await assert.rejects(
      commit(db, randomUUID(), "create", trip.tripId, null, {
        ...payload,
        payer_id: randomUUID(),
      }),
      /payer in this trip/,
    );
    await assert.rejects(
      commit(db, randomUUID(), "create", trip.tripId, null, {
        ...payload,
        line_items: [
          { amount: 20, description: "Lunch", split_among: ["Unknown"] },
        ],
      }),
      /participants/,
    );
    assert.equal(
      (await db.query("SELECT count(*)::int n FROM transactions")).rows[0].n,
      0,
    );
    const created = await commit(
      db,
      randomUUID(),
      "create",
      trip.tripId,
      null,
      payload,
    );
    await as(db, bob);
    await call(db, "SELECT join_invited_trip($1,$2,NULL) result", [
      trip.inviteCode,
      ctx.members[0].id,
    ]);
    await commit(
      db,
      randomUUID(),
      "update",
      trip.tripId,
      created.transactionId,
      { description: "Lunch by the harbor" },
      1,
    );
    await as(db, alice);
    await assert.rejects(
      commit(
        db,
        randomUUID(),
        "undo",
        trip.tripId,
        null,
        {},
        null,
        created.changeId,
      ),
      /Someone changed/,
    );
    assert.equal(
      (await db.query("SELECT description FROM transactions")).rows[0]
        .description,
      "Lunch by the harbor",
    );
  } finally {
    await db.close();
  }
});
