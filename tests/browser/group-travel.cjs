const { webkit } = require("playwright");
const AxeBuilder = require("@axe-core/playwright").default;
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { database, as } = require("../sql-fixture.cjs");
const { setup, origin, host } = require("./fixtures.cjs");
const alice = "11111111-1111-4111-8111-111111111111",
  bob = "22222222-2222-4222-8222-222222222222";
const json = (r, b, s = 200) =>
  r.fulfill({
    headers: {
      "access-control-allow-origin": origin,
      "access-control-allow-headers": "*",
    },
    status: s,
    contentType: "application/json",
    body: JSON.stringify(b),
  });
(async () => {
  const db = await database(),
    browser = await webkit.launch();
  const call = async (sql, args) => (await db.query(sql, args)).rows[0].result;
  let t;
  try {
    await as(db, alice);
    const trip = await call("SELECT start_group_trip($1,$2,$3,$4) result", [
      "Iceland",
      "Sam",
      JSON.stringify(["Alex", "Priya"]),
      randomUUID(),
    ]);
    t = await setup(browser, { signedIn: true, storedTrip: trip.tripId });
    let writes = [],
      loseResponse = false,
      apiWrites = 0;
    const rpc = async (name, b) => {
      switch (name) {
        case "invite_context":
          return call("SELECT invite_context($1) result", [b.invitation]);
        case "join_invited_trip":
          return call("SELECT join_invited_trip($1,$2,$3) result", [
            b.invitation,
            b.selected_member,
            b.new_name,
          ]);
        case "add_trip_names":
          return call("SELECT add_trip_names($1,$2) result", [
            b.selected_trip,
            JSON.stringify(b.names),
          ]);
        case "start_group_trip":
          return call("SELECT start_group_trip($1,$2,$3,$4) result", [
            b.trip_name,
            b.your_name,
            JSON.stringify(b.names),
            b.request_id,
          ]);
        case "commit_expense":
          writes.push(b);
          return call("SELECT commit_expense($1,$2,$3,$4,$5,$6,$7) result", [
            b.operation_id,
            b.command,
            b.selected_trip,
            b.selected_expense,
            JSON.stringify(b.payload),
            b.expected_version,
            b.undo_change,
          ]);
        default:
          throw Error("Unmocked RPC " + name);
      }
    };
    await t.context.route("https://" + host + "/rest/v1/**", async (r) => {
      const req = r.request(),
        u = new URL(req.url()),
        name = u.pathname.split("/").pop();
      try {
        if (req.method() === "OPTIONS")
          return r.fulfill({
            status: 204,
            headers: {
              "access-control-allow-origin": origin,
              "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
              "access-control-allow-headers":
                req.headers()["access-control-request-headers"] || "*",
            },
          });
        if (u.pathname.includes("/rpc/")) {
          const b = req.postDataJSON(),
            out = await rpc(name, b);
          if (
            loseResponse &&
            name === "commit_expense" &&
            b.command === "create"
          ) {
            loseResponse = false;
            return r.abort("failed");
          }
          return json(r, out);
        }
        assert(
          [
            "trips",
            "trip_members",
            "transactions",
            "transaction_adjustments",
            "expense_changes",
          ].includes(name),
          "Unmocked table " + name,
        );
        assert.equal(req.method(), "GET");
        let query = "SELECT * FROM " + name,
          vals = [],
          conditions = [];
        for (const [k, v] of u.searchParams) {
          if (
            [
              "id",
              "trip_id",
              "user_id",
              "display_name",
              "expense_id",
              "status",
            ].includes(k) &&
            v.startsWith("eq.")
          ) {
            vals.push(v.slice(3));
            conditions.push(k + "=$" + vals.length);
          }
          if (k === "id" && v.startsWith("in.(")) {
            vals.push(v.slice(4, -1).split(","));
            conditions.push("id=ANY($" + vals.length + "::uuid[])");
          }
        }
        if (conditions.length) query += " WHERE " + conditions.join(" AND ");
        if (name === "expense_changes") query += " ORDER BY sequence DESC";
        else if (name === "transactions") query += " ORDER BY created_at DESC";
        let rows = (await db.query(query, vals)).rows;
        if (name === "transactions")
          for (const row of rows) {
            row.total_amount = Number(row.total_amount);
            row.payer = (
              await db.query(
                "SELECT display_name FROM trip_members WHERE id=$1",
                [row.payer_id],
              )
            ).rows[0];
            row.adjustments = (
              await db.query(
                "SELECT * FROM transaction_adjustments WHERE transaction_id=$1",
                [row.id],
              )
            ).rows;
          }
        return json(
          r,
          req.headers().accept?.includes("vnd.pgrst.object")
            ? rows[0] || null
            : rows,
        );
      } catch (e) {
        console.log("SQL fixture rejected:", e.message);
        return json(r, { code: e.code || "XX000", message: e.message }, 400);
      }
    });
    await t.context.route(origin + "/api/currency*", (r) =>
      json(r, {
        quote: {
          currency: "ISK",
          rate: 0.00828,
          date: "2026-08-30",
          provider: "Frankfurter",
        },
      }),
    );
    await t.context.route(origin + "/api/transactions/*", async (r) => {
      apiWrites++;
      try {
        const b = r.request().postDataJSON(),
          id = new URL(r.request().url()).pathname.split("/").pop();
        const payload = {};
        for (const [k, v] of Object.entries({
          description: "description",
          totalAmount: "total_amount",
          payerId: "payer_id",
          splitType: "split_type",
          lineItems: "line_items",
          category: "category",
        }))
          if (b[k] !== undefined) payload[v] = b[k];
        if (b.adjustments)
          payload.shares = b.adjustments.map((a) => ({
            member_id: a.memberId,
            amount: a.amount,
          }));
        const out = await rpc("commit_expense", {
          operation_id: r.request().headers()["idempotency-key"],
          command: r.request().method() === "DELETE" ? "delete" : "update",
          selected_trip: b.tripId,
          selected_expense: id,
          payload,
          expected_version: b.expectedVersion,
          undo_change: null,
        });
        return json(r, { success: true, ...out });
      } catch (e) {
        return json(r, { error: e.message }, 409);
      }
    });
    const page = t.page;
    page.setDefaultTimeout(20000);
    const navigate = async (url) => {
      await page.waitForLoadState("networkidle");
      await page.goto(url);
    };
    const visible = () =>
      page.getByRole("heading", { name: "Iceland", exact: true }).waitFor();
    await navigate(origin);
    await visible();
    // Text and pasted image survive a page reload; all writes stay in local IndexedDB.
    const text = page
      .getByLabel("Describe your expense", { exact: true })
      .filter({ visible: true });
    await text.fill("Lunch in Reykjavik, Sam paid 5400 ISK");
    await page
      .getByText("Draft saved on this device · Not saved to the trip", {
        exact: true,
      })
      .filter({ visible: true })
      .waitFor();
    await text.evaluate((el) => {
      const data = new DataTransfer();
      data.items.add(
        new File([new Uint8Array([137, 80, 78, 71])], "draft.png", {
          type: "image/png",
        }),
      );
      el.dispatchEvent(
        new ClipboardEvent("paste", {
          clipboardData: data,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    await page
      .getByText("Draft saved on this device · Not saved to the trip", {
        exact: true,
      })
      .filter({ visible: true })
      .waitFor();
    await page.waitForLoadState("networkidle");
    await page.reload();
    await visible();
    assert.equal(
      await text.inputValue(),
      "Lunch in Reykjavik, Sam paid 5400 ISK",
    );
    await page
      .getByRole("button", { name: "Remove receipt", exact: true })
      .filter({ visible: true })
      .waitFor();
    await page.evaluate(() => {
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        value: false,
      });
      window.dispatchEvent(new Event("offline"));
    });
    await page
      .getByText("Saved on this device · Not synced yet", { exact: true })
      .filter({ visible: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Save draft", exact: true })
      .filter({ visible: true })
      .click();
    assert.equal(writes.length, 0);
    await page.evaluate(() => {
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        value: true,
      });
      window.dispatchEvent(new Event("online"));
    });
    await page
      .getByRole("button", { name: "Discard draft", exact: true })
      .filter({ visible: true })
      .click();
    console.log(
      "PASS image/text persisted through reload and offline save made no financial request",
    );
    await page
      .getByRole("button", { name: "New expense", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Enter manually", exact: true })
      .click();
    let d = page.getByRole("dialog");
    await d
      .getByLabel("Description", { exact: true })
      .first()
      .fill("Iceland car rental");
    await d.getByLabel("Amount ($)", { exact: true }).fill("79086");
    await d.getByLabel("Currency", { exact: true }).selectOption("ISK");
    await d.getByLabel("Paid By", { exact: true }).selectOption("Alex");
    await d.getByLabel("Category", { exact: true }).selectOption("car_rental");
    await d.getByRole("checkbox", { name: "Priya", exact: true }).uncheck();
    await d
      .getByText("Draft saved on this device · Not saved to the trip", {
        exact: true,
      })
      .waitFor();
    await page.waitForLoadState("networkidle");
    await page.reload();
    d = page.getByRole("dialog");
    assert.equal(
      await d.getByLabel("Description", { exact: true }).first().inputValue(),
      "Iceland car rental",
    );
    assert.equal(
      await d.getByLabel("Currency", { exact: true }).inputValue(),
      "ISK",
    );
    assert(
      !(await d
        .getByRole("checkbox", { name: "Priya", exact: true })
        .isChecked()),
    );
    for (const width of [320, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      assert(await d.evaluate((el) => el.scrollWidth <= el.clientWidth + 1));
    }
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    assert.deepEqual(
      audit.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.html),
      })),
      [],
    );
    await page.screenshot({
      path: require("node:path").join(
        require("node:os").tmpdir(),
        "squared-travel-manual.png",
      ),
      fullPage: true,
    });
    loseResponse = true;
    await d.getByRole("button", { name: "Save", exact: true }).click();
    await d.getByRole("alert").waitFor();
    assert.equal(
      (await db.query("SELECT count(*)::int n FROM transactions")).rows[0].n,
      1,
    );
    await page.waitForLoadState("networkidle");
    await page.reload();
    d = page.getByRole("dialog");
    assert(
      await d.getByLabel("Description", { exact: true }).first().isDisabled(),
    );
    await d.getByRole("button", { name: "Retry save", exact: true }).click();
    await visible();
    assert.equal(
      await page
        .getByText("You have an unfinished expense for Iceland.", {
          exact: true,
        })
        .count(),
      0,
    );
    assert.equal(writes.length, 2);
    assert.deepEqual(writes[0], writes[1]);
    assert.equal(
      (await db.query("SELECT count(*)::int n FROM transactions")).rows[0].n,
      1,
    );
    let expense = (await db.query("SELECT * FROM transactions")).rows[0];
    assert.equal(Number(expense.total_amount), 654.83);
    assert.equal(expense.currency_conversion.original_currency, "ISK");
    assert.deepEqual(expense.line_items[0].split_among, ["Sam", "Alex"]);
    console.log(
      "PASS lost response + reload retries identical UUID/FX/payload; one expense in database",
    );
    await page
      .getByRole("button", { name: "New expense", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Enter manually", exact: true })
      .click();
    d = page.getByRole("dialog");
    assert.equal(
      await d.getByLabel("Currency", { exact: true }).inputValue(),
      "ISK",
    );
    assert.equal(
      await d.getByLabel("Paid By", { exact: true }).inputValue(),
      "Alex",
    );
    assert(
      !(await d
        .getByRole("checkbox", { name: "Priya", exact: true })
        .isChecked()),
    );
    await d.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.getByText("Iceland car rental", { exact: true }).first().click();
    d = page.getByRole("dialog");
    await d
      .getByLabel("Description", { exact: true })
      .first()
      .fill("Rental car in Iceland");
    await d.getByRole("button", { name: "Save", exact: true }).click();
    await visible();
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    // The expense description can still be visible in history while undo is
    // in flight. Wait for its completion before asserting or navigating away.
    await page
      .getByRole("button", { name: "Dismiss undo", exact: true })
      .waitFor({ state: "hidden" });
    await page
      .getByText("Loading expenses…", { exact: true })
      .waitFor({ state: "hidden" });
    await page
      .getByText("Loading history…", { exact: true })
      .waitFor({ state: "hidden" });
    await page
      .getByText("Iceland car rental", { exact: true })
      .first()
      .waitFor();
    assert.equal(
      (await db.query("SELECT description FROM transactions")).rows[0]
        .description,
      "Iceland car rental",
    );
    await page
      .getByRole("button", { name: "Expense history", exact: true })
      .click();
    await page.getByText("undid a change to", { exact: false }).waitFor();
    console.log(
      "PASS remembered currency/payer/participants and edit/undo/history",
    );
    await page.getByText("Iceland car rental", { exact: true }).first().click();
    d = page.getByRole("dialog");
    await d
      .getByRole("button", { name: "Delete expense", exact: true })
      .click();
    await d.getByRole("button", { name: "Yes, delete", exact: true }).click();
    await visible();
    assert.equal(
      (await db.query("SELECT count(*)::int n FROM transactions")).rows[0].n,
      0,
    );
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    // The expense description can still be visible in history while undo is
    // in flight. Wait for its completion before asserting or navigating away.
    await page
      .getByRole("button", { name: "Dismiss undo", exact: true })
      .waitFor({ state: "hidden" });
    await page
      .getByText("Loading expenses…", { exact: true })
      .waitFor({ state: "hidden" });
    await page
      .getByText("Loading history…", { exact: true })
      .waitFor({ state: "hidden" });
    await page
      .getByText("Iceland car rental", { exact: true })
      .first()
      .waitFor();
    assert.equal(
      (await db.query("SELECT id FROM transactions")).rows[0].id,
      expense.id,
    );
    console.log(
      "PASS deletion undo restores the original expense identity and allocation",
    );

    // The next trip copies names only. This is the same destination used by the settlement CTA.
    await navigate(origin + "/?newTripFrom=" + trip.tripId);
    d = page.getByRole("dialog");
    assert.equal(
      await d.getByLabel("Friends’ names (optional)").inputValue(),
      "Alex\nPriya",
    );
    await d
      .getByLabel("Trip name", { exact: true })
      .fill("Next Iceland adventure");
    await d.getByRole("button", { name: "Create trip", exact: true }).click();
    await page
      .getByRole("heading", { name: "Next Iceland adventure", exact: true })
      .waitFor();
    const nextTrip = (
      await db.query("SELECT * FROM trips WHERE name='Next Iceland adventure'")
    ).rows[0];
    const nextPeople = (
      await db.query("SELECT * FROM trip_members WHERE trip_id=$1", [
        nextTrip.id,
      ])
    ).rows;
    assert.equal(nextPeople.length, 3);
    assert.equal(nextPeople.filter((m) => m.user_id).length, 1);
    assert.equal(
      (
        await db.query(
          "SELECT count(*)::int n FROM transactions WHERE trip_id=$1",
          [nextTrip.id],
        )
      ).rows[0].n,
      0,
    );
    // Creating a trip opens the existing QR-first invite dialog.
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Close dialog" })
      .click();
    await page
      .getByRole("button", { name: "View 3 trip members", exact: true })
      .click();
    d = page.getByRole("dialog");
    assert.equal(
      await d.getByText("Not joined yet", { exact: true }).count(),
      2,
    );
    await d
      .getByLabel("Add friends by name", { exact: true })
      .fill("Jordan, Morgan");
    await d.getByRole("button", { name: "Add names", exact: true }).click();
    await d.getByText("Jordan", { exact: true }).waitFor();
    await d.getByRole("button", { name: "Close dialog" }).click();
    console.log(
      "PASS next-trip reuse copies names only; organizer adds names without email",
    );
    // Existing account follows another shared link and must explicitly claim a name.
    await as(db, bob);
    const invited = await call("SELECT start_group_trip($1,$2,$3,$4) result", [
      "Kyoto",
      "Bob",
      JSON.stringify(["Sam", "Taylor"]),
      randomUUID(),
    ]);
    await as(db, alice);
    await navigate(origin + "/auth/callback?invite=" + invited.inviteCode);
    await page
      .getByRole("heading", { name: "Join Kyoto", exact: true })
      .waitFor();
    assert.equal(
      (
        await db.query(
          "SELECT count(*)::int n FROM trip_members WHERE trip_id=$1 AND user_id=$2",
          [invited.tripId, alice],
        )
      ).rows[0].n,
      0,
    );
    assert.equal(
      await page.getByRole("radio", { name: "Bob", exact: true }).count(),
      0,
    );
    assert(
      await page
        .getByRole("button", { name: "Join Kyoto", exact: true })
        .isDisabled(),
    );
    await page.getByRole("radio", { name: "Sam", exact: true }).check();
    await page.screenshot({
      path: require("node:path").join(
        require("node:os").tmpdir(),
        "squared-travel-join.png",
      ),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Join Kyoto", exact: true }).click();
    await page.getByRole("heading", { name: "Kyoto", exact: true }).waitFor();
    assert.equal(
      (
        await db.query(
          "SELECT count(*)::int n FROM trip_members WHERE trip_id=$1",
          [invited.tripId],
        )
      ).rows[0].n,
      3,
    );
    assert.equal(
      (
        await db.query(
          "SELECT display_name FROM trip_members WHERE trip_id=$1 AND user_id=$2",
          [invited.tripId, alice],
        )
      ).rows[0].display_name,
      "Sam",
    );
    await page.waitForURL(origin + "/");
    await navigate(origin + "/?code=" + invited.inviteCode);
    await page.getByRole("heading", { name: "Kyoto", exact: true }).waitFor();
    assert.equal(
      await page
        .getByRole("heading", { name: "Join Kyoto", exact: true })
        .count(),
      0,
    );
    await page.waitForURL(origin + "/");
    await page.waitForLoadState("networkidle");
    await as(db, bob);
    const other = await call("SELECT start_group_trip($1,$2,$3,$4) result", [
      "Osaka",
      "Bob",
      JSON.stringify(["Taylor"]),
      randomUUID(),
    ]);
    await as(db, alice);
    await navigate(origin + "/?code=" + other.inviteCode);
    await page
      .getByRole("radio", { name: "Add myself as someone new", exact: true })
      .check();
    await page.getByLabel("Your name", { exact: true }).fill("Sam");
    await page.getByRole("button", { name: "Join Osaka", exact: true }).click();
    await page.getByRole("heading", { name: "Osaka", exact: true }).waitFor();
    await page.waitForURL(origin + "/");
    await page.waitForLoadState("networkidle");
    assert.equal(
      (
        await db.query(
          "SELECT count(*)::int n FROM trip_members WHERE trip_id=$1",
          [other.tripId],
        )
      ).rows[0].n,
      3,
    );
    assert.deepEqual(t.db.errors, []);
    console.log(
      "PASS explicit claim/new-person journey and existing-member bypass",
    );
    console.log("PASS complete synthetic travel flow", { apiWrites });
  } catch (e) {
    if (t) {
      console.log("BROWSER", await t.page.locator("body").innerText());
      console.log("PAGE ERRORS", t.db.errors);
    }
    throw e;
  } finally {
    if (t) await t.context.close();
    await browser.close();
    await db.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
