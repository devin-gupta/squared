# Trip-expense app review and Squared UX roadmap

Reviewed August 29, 2026. This is a review of official product and help literature for eight relevant apps, compared with Squared's local implementation. It is not an exhaustive inventory of every expense app, a hands-on test of competitors, or evidence that a competitor feature is available on every platform, plan, or market. Recommendations below are product judgments, not measured usability findings.

## Main finding

Squared now has a coherent core: create/join a trip, conversational or manual entry, direct expense editing, exact custom shares, personal net owed, and an actionable settlement list. The most important next improvement is **completing the repayment loop**, not adding more dashboard cards.

Users need to know: “What did we spend?”, “What is my position?”, “Why?”, “Who do I pay?”, and “Did that payment clear my balance?” Our current Venmo handoff answers the fourth question but does not record or verify repayment. It must never imply that opening a payment app completes a transfer.

## Comparative review

| App             | Documented flows worth studying                                                                                                                                 | Useful statistics / information                                                                          | Lesson for Squared                                                                                                                                                                                                                                                                                                                 |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Splitwise**   | Group and one-off expenses; exact, percentage, and share-based splits; record outside payments; supported payment integrations.                                 | Personal balances, group spending totals, categories, charts.                                            | Keep payment recording separate from expense entry. Let advanced splits remain available without complicating the default. [Getting started](https://kb.splitwise.com/getting-started/how-do-i-use-splitwise), [feature list](https://www.splitwise.com/)                                                                          |
| **tricount**    | Unequal shares, reimbursements, income, “mark as paid,” invite links, and currency conversion.                                                                  | Personal expense total and category insights, separate from what a person initially paid.                | Distinguish spending, payment, and debt. A returned deposit is not an ordinary positive expense. [Expense help](https://help.tricount.com/articles/how-can-i-manage-my-tricounts-and-expenses), [FAQ](https://help.tricount.com/articles/tricount-faqs), [insights](https://help.tricount.com/articles/tricount-spending-insights) |
| **Settle Up**   | Identify “this is me”; default shares; exclude departed members from future expenses; archive finished groups; duplicate expenses.                              | Member balances; a suggestion for who should pay next; explainable debt minimization.                    | Membership changes must preserve history, and identity should set useful defaults. [Official tips](https://settleup.io/tips)                                                                                                                                                                                                       |
| **Splid**       | Offline groups, optional synchronization, no sign-up requirement, foreign-currency conversion, PDF/Excel summaries.                                             | Clear who-owes-whom summary. The reviewed page does not establish a detailed analytics feature set.      | Reliable entry without connectivity and an exportable final summary matter more than decorative analytics. [Official product page](https://splid.app/english/)                                                                                                                                                                     |
| **Splittr**     | Its official site lists offline operation, friend sync, no registration, unequal splitting, and PDF/CSV export. It also announces a new app in development.     | Categories, statistics, and debt minimization are listed; precise current screens are not verified here. | Use these as product patterns, not a claim about a freshly tested release. [Official product page](https://splittr.io/)                                                                                                                                                                                                            |
| **Kittysplit**  | Link-based participation with optional accounts; expense, transfer, and income entry; exact amounts or weighted shares; exports.                                | Event totals and final balances.                                                                         | Reduce invitation friction while giving users a durable way to recover their groups. [Help](https://www.kittysplit.com/en/help), [optional accounts announcement](https://blog.kittysplit.com/introducing-accounts/), [overview redesign](https://blog.kittysplit.com/improved-overview-and-cat-avatars/)                          |
| **TravelSpend** | Travel budgeting, offline entry, shared trips, currency conversion, locations, CSV export.                                                                      | Daily average, remaining daily budget, surplus/deficit, visual spending analysis.                        | Budget statistics are useful when trip dates and a budget exist. They should be opt-in, not empty tiles for every weekend. [Product](https://travel-spend.com/), [daily metrics](https://help.travel-spend.com/daily-metrics/nsEZBhRKe4aEiaHGB4fnwF)                                                                               |
| **Splitser**    | Expenses, income, transfers, partial settlement, payment requests, settlement history; delete from the editor; restrictions on removing members with a balance. | Member balance with a breakdown of the transactions behind it; open/completed payments.                  | Make balances auditable and preserve history instead of erasing context. [Official support](https://splitser.com/support/)                                                                                                                                                                                                         |

## Flows Squared is missing or needs to strengthen

The implementation status below comes from the repository, not competitor literature.

### 1. Record a repayment and reconcile the balance — highest priority

**Current:** Venmo links can open a payment or request. They do not confirm payment and do not reduce balances. There is no separate repayment ledger.

**Proposed flow:** Settle up → choose transfer → open Venmo → return → “Record payment” → confirm amount, payer, recipient, date, and method. Support partial payment and an explicit “I received this” action. Record actor and time; allow a correction rather than silently deleting history.

A recorded payment must reduce debt but **must not increase trip spending or expense count**. A manual payment is a user's record, not provider-verified proof. Use labels that make that distinction explicit. Splitwise and tricount both document recording external transfers; that is a better model than assuming an app handoff succeeded. [Splitwise](https://kb.splitwise.com/getting-started/how-do-i-use-splitwise), [tricount](https://help.tricount.com/articles/how-can-i-manage-my-tricounts-and-expenses)

### 2. Preserve participants and money exactly — highest priority

**Current:** Equal-share calculations use the current trip-member list. Adding/removing a member can therefore reinterpret older expenses. Custom allocations have UI validation, but saving the expense and its allocations is not a single database transaction. Some error paths can leave partial state. Arithmetic also mixes floating point shares and displayed cents.

**Proposed:** Store the participants and allocated cents on each expense. Commit an expense and its allocations atomically. Use deterministic remainder distribution. Deactivate departing members for future expenses rather than changing past costs. Validate allocations again on the server, not only in the browser. These are trust requirements beneath the UI, and should precede a larger group rollout. Settle Up explicitly distinguishes excluding a member from future transactions from deleting history. [Settle Up](https://settleup.io/tips)

### 3. Make “who is included?” an explicit control — high priority

**Current:** Equal splits include everyone. Exact custom amounts can exclude someone through $0, but that is not as discoverable as selecting participants.

**Proposed:** Keep Equal and Custom visible. Add participant chips with Everyone / Select people. Within Custom, start with exact amounts; add percentages and shares behind an additional selector only when needed. Use shares for different numbers of nights, couples, or families. Keep an always-visible allocated/remaining amount and prevent an invalid save. [Splitwise splits](https://www.splitwise.com/), [Kittysplit splits](https://www.kittysplit.com/en/help)

### 4. Make invitation and identity recovery obvious — high priority

**Current:** Email sign-in and invite links exist. Trip selection uses local storage, and names may originate from an email prefix. Venmo usernames are currently saved per trip on the current device, not shared account metadata.

**Proposed:** After an invitation, show the trip name and a clear “You are…” identity confirmation; resume the invite after authentication. Show existing trips when opening on a new device. Add an account menu with display name, sign out, and payment profile settings. Share verified-by-the-user handles only through an authenticated member profile and show the handle before external payment. Do not infer a Venmo account from a person's display name. Optional-account products demonstrate a lower-friction alternative, but copying guest access would require a deliberate permissions model. [Kittysplit accounts](https://blog.kittysplit.com/introducing-accounts/)

### 5. Review AI results without losing the fast path — high priority

**Current:** Natural-language and receipt parsing can auto-save when an amount and description are present. Manual entry and direct editing exist.

**Proposed:** Show a compact confirmation with amount, payer, participants, and split before committing ambiguous or receipt-derived results. Preserve the draft on failure; provide Retry and Enter manually. Never silently create a new trip member from a likely misspelled payer. For unambiguous repeat entries, keep a fast confirmation action. This is an inference from Squared's own AI-specific risk, not a claim that competitors use the same review policy.

### 6. Explain why a transfer exists — high priority

**Current:** Suggested transfers minimize debts, but the payment path may be surprising.

**Proposed:** Add “Why this amount?” beside net owed. Show paid expenses, assigned costs, repayments, and the resulting balance. Explain that simplification changes payment partners without changing the net amount. Keep the sums of incoming and outgoing transfers visible. Splitwise explicitly documents this distinction. [Debt simplification](https://kb.splitwise.com/balances-and-expenses/what-is-simplify-debts)

### 7. Travel resilience, refunds, and currency — next

**Current:** USD formatting is fixed; there is no trip currency or exchange-rate model. A service worker is present, but there is no durable offline write queue. Refunds/income and multiple payers are not explicit types. Cached reads alone do not make entry work offline.

**Proposed:** Start with draft preservation and a visible offline/pending/synced state. Then add an outbox with idempotent retries. Add expense date, duplicate expense, and refund/returned-deposit entry. For international use, store original currency/amount, conversion rate and date, and base-currency amount; allow a user-corrected rate. Currency is a data-model feature, not a symbol replacement. [Splid](https://splid.app/english/), [TravelSpend](https://travel-spend.com/), [Settle Up currency and income guidance](https://settleup.io/tips)

### 8. Finish and keep a trip — next

**Current:** Search and CSV export exist. Trip deletion is available, but archiving, a repayment history, and an expense change log are absent.

**Proposed:** Add archive/read-only history after settlement, an export containing expenses **and** repayments, and “edited by…” with time and changed fields. Avoid making permanent deletion the normal end-of-trip action. [Settle Up archives](https://settleup.io/tips), [Splitser history](https://splitser.com/support/)

## Statistics: useful numbers, in the right place

Keep the user's requested overview: **Total trip spending → Net owed → Transactions**. Do not add a wall of competing cards.

| Statistic                            | Definition                                                                             | Placement / action                                     | Status                                                      |
| ------------------------------------ | -------------------------------------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------- |
| Total trip spending                  | Shared expense cost, minus refunds; excludes repayments                                | Overview; opens expenses                               | Current total exists; refunds not modeled                   |
| Net owed                             | Personal incoming minus outgoing settlement amount; positive = receive, negative = pay | Overview; leads to Settle up                           | Implemented for expenses; repayment recording still missing |
| Transaction count                    | Count of recorded expenses; do not count payment-app launches                          | Overview; opens ledger                                 | Implemented                                                 |
| You owe / you are owed               | Sums of displayed outgoing / incoming transfers involving the current member           | Settle up, above the actionable list                   | Implemented                                                 |
| You paid / your share                | Amount advanced versus expense cost allocated to you                                   | “Why this balance?” detail, not more top-level cards   | Calculation exists; a dedicated breakdown is a next step    |
| Outstanding vs recorded repayments   | What remains after recorded transfers                                                  | Settlement history                                     | Missing; requires repayment ledger                          |
| Personal and group category totals   | Two separate views; your allocation is not the full cost of every expense you joined   | Optional Insights section                              | Basic group category chart exists; personal view missing    |
| Budget remaining and daily allowance | Budget minus eligible costs; remaining amount divided by remaining trip days           | Optional travel-budget section                         | Missing; requires budget and dates                          |
| Daily average / trend                | Eligible trip cost over explicitly defined elapsed trip days                           | Insights, with inclusion controls for flights/deposits | Missing                                                     |
| Unsynced / incomplete entries        | Count of entries not yet safely committed or needing review                            | Status indicator with a repair action                  | Missing                                                     |

TravelSpend's daily metrics show why the denominator and excluded costs must be explicit; a large prepaid flight should not silently make a daily food allowance meaningless. tricount's personal totals and category insights also support separating a person's cost from their cash advanced. [TravelSpend daily average](https://help.travel-spend.com/daily-metrics/nsEZBhRKe4aEiaHGB4fnwF/how-does-the-daily-average-work/ixayoUZqmZcxikYkFpPVf4), [remaining daily budget](https://help.travel-spend.com/daily-metrics/nsEZBhRKe4aEiaHGB4fnwF/how-does-the-remaining-daily-budget-work/uT5EPNGKPV3AFsgGuuKQGq), [tricount insights](https://help.tricount.com/articles/tricount-spending-insights)

## Keep the mobile interaction model simple

Recommended primary paths:

- **Overview:** trip switcher, three summary numbers, New expense (chat), recent expenses. Manual entry remains one obvious secondary action.
- **Expenses:** search/filter → tap a row → edit; Delete lives inside the editor and asks for confirmation.
- **Settle up:** personal incoming/outgoing/net → relevant transfers → pay/request → record the result. Other members' transfers should not become a payment from the current user's account.
- **Trip settings:** people, identity, currency, shared payment profiles, export, archive. Keep destructive controls away from frequent actions.

Keep exact balances and field labels literal even when headings are friendly. Do not use color alone for owe/owed. Keep touch controls reachable, input text at least 16px on iPhone, visible focus, scrolling dialogs, safe-area spacing, and a non-AI path. Charts should answer a question and lead to the underlying transactions.

## Suggested next release order

1. **Trust and closure:** atomic allocations, historical participants/cents, repayment recording, and a balance explanation.
2. **Everyday speed:** participant selection, expense date/duplicate, identity defaults, draft recovery and clear retry states.
3. **Travel depth:** currencies, refunds, offline synchronization, archival exports.
4. **Optional insights:** personal category breakdown and budget/day metrics after their inputs exist.

Do not prioritize social feeds, rankings, recurring household billing, maps, or automated bank connections ahead of the first two stages. Those may be useful for different audiences; they are not necessary to make a weekend trip intuitive.

## Real-iPhone usability checks before calling the experience complete

Use five short tasks with someone who has not seen the app. Suggested success criteria are targets, not current measured results:

1. Join an invited trip and identify yourself without assistance.
2. Add a dinner excluding one person; explain who paid versus who owes.
3. Tap an expense, correct the payer, and find Delete without searching another menu.
4. Read Net owed, explain its sign, and match it to the transfers on Settle up.
5. Open a Venmo payment/request, return, and explain whether Squared knows it was paid.

Also test an interrupted network request, a lost magic link, the real iOS keyboard, large text, landscape, and a return from the Venmo app. Track task success, time to a correct save, errors/retries, and mistaken payment assumptions. Avoid collecting raw expense descriptions or payment handles in analytics.

## Release limitations to communicate

Venmo links are a best-effort handoff with a profile fallback. Usernames are device-local in this iteration. No payment is automatically sent, verified, or marked complete. The sample preview is development-only. Competitor feature presence does not prove usability; the priorities above still need validation with Squared's users.
