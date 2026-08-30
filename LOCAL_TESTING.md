# Local design preview

Run `npm run dev -- --hostname 0.0.0.0 --port 3000` and open
[localhost:3000/preview](http://localhost:3000/preview).
On an iPhone on the same Wi-Fi, use the computer's LAN IP instead of `localhost`.
Keep the development server on a trusted local network; it is not a production server.

## Safe sample trip

`/preview`, `/preview/feed`, and `/preview/settle` use sample data in memory.
You can create a sample trip, add/edit/delete expenses, search, export CSV, and
inspect suggested settlements without signing in or changing real data.
Sample expenses support equal and custom dollar splits; custom amounts must add up to the expense total. Changes reset on reload or when leaving the
preview; the Reset sample button restores the example trip.

The preview simulates the expense animation without calling AI or saving real data. Enter a description containing an amount such as `Dinner was $120` to see reading, saving, and confirmation. Receipt input or text without an amount opens manual review. Invitations and real receipt processing remain disabled. The preview route returns 404 in production.

The regular app at `/` uses the Supabase project and AI credentials configured in
`.env.local`. Actions there can affect real data. Local magic-link sign-in also
requires your local origin to be allowed in Supabase's Auth redirect settings.
Do not add secrets to version control.

## Design direction

- Warm neutral backgrounds, forest-green primary actions, and consistent bordered surfaces.
- Serif page titles paired with system UI text; no external font requests.
- A compact trip picker in the title. Mobile shows trip total and your net balance beside it; desktop retains the larger summary and transaction count.
- Animated expense entry with real reading/saving stages, a slow-response hint, confirmed-save feedback, and retained drafts on failure.
- Persistent mobile navigation and a quick-add shortcut; a sidebar on larger screens.
- Explicit welcome, empty, loading, and error states. Failed balance requests no longer look settled.
- Native dialogs with focus containment, Escape handling, and focus restoration.
- Safe-area padding, scrollable dialogs, 44px touch controls, 16px mobile inputs,
  decimal keyboards for amounts, reduced-motion support, and browser zoom enabled.

## Validation and iPhone checklist

The production build and TypeScript checks pass. Temporary Playwright/WebKit checks
cover the three preview screens at 320, 375, 390, 430, and 820px widths, plus desktop.
They exercise sample creation, edits, deletion, search, CSV export, dialog focus,
and opening/dismissing sign-in. Custom splits retain per-person amounts, reject totals that do not match, and update net owed; positive amounts mean money to receive, negative amounts mean money still owed. Automated accessibility checks cover the preview
screens and the manual-entry dialog. The preview makes no external service requests.

WebKit emulation is not a physical iPhone test. In Safari, check:

1. Portrait and landscape navigation, including the home indicator and screen edges.
2. Open New expense to enter a description in chat. Use Enter manually for a form; check the real keyboard and scrolling.
3. Tap an expense to edit it immediately. Delete from inside the editor and confirm; search and export from Expenses.
4. Test large text and pinch-to-zoom. Check that controls remain reachable.
5. For real data only, verify sign-in, receipt capture, and invitation sharing separately.

PWA/service-worker registration is disabled in development. Home-screen installation,
offline behavior, and native sharing need a separate HTTPS check before deployment.
The preview stays local-only after production deployment. This redesign does not change the database schema.

Venmo usernames are stored only in this browser. Suggested payments open a payment or request with the intended recipient and amount; confirm both in Venmo. Opening a link never changes the balance. Actual iPhone-to-Venmo handoff still needs a physical-device test.

AI uses a server-only OpenRouter key and the free router. Synthetic text and receipt parsing passed against the provider. Free-model availability and limits vary; authenticated end-to-end expense creation should also be checked with a real trip.

## Returning users and invitations

Supabase retains its existing persistent browser session and automatically refreshes access tokens; no custom cookie stores a password or grants access. A single shared auth observer waits for session restoration. The sign-in email, selected trip per account, and pending invite are local browser preferences. Pending invites expire after seven days and clear after joining or choosing Leave this invite.

Magic-link redirects retain the trip code, including when the email opens in a fresh browser. A saved invite also recovers same-browser redirects that return to `/` without a query. Old `/trip/CODE` links use the same authenticated flow. Returning users automatically open their last accessible trip, or their most recent existing trip on a new device. Failed membership reads show retry, not a create-trip prompt. Sign out affects only the current device.

Run `npm run test:auth` for regression checks covering invite validation/expiry, blocked storage, account preferences, duplicate joins, name collisions, and membership failures. Isolated WebKit tests additionally cover simulated magic-link callbacks, session persistence across reload/browser reopening, expired-token refresh, remembered email, sign-out, invalid invites, and accessibility at 320/390/430px. Supabase's live invalid-token redirect was checked without sending email and preserved the invite query.

A real successful email delivery/sign-in still needs user testing. Browser storage is per origin/profile: Safari, an in-app browser, and an installed home-screen app may not share sign-in state. Private browsing or clearing website data can require login again. Production Supabase responses now use NetworkOnly in the service worker so authentication and account data cannot fall back to the previous response cache.

## Statistics regression

Statistics and the category chart share one authenticated request. The API verifies
the signed-in account and its trip membership, keeps database row-level security,
and derives “You Paid” from that account's member ID. Only finalized expenses count.
Failed requests show an error with retry; an empty trip legitimately shows zeros.
Statistics remain visible even when there are no outstanding settlements.
On desktop, the compact Statistics card aligns with the top of the payment panel
in the right column. On mobile, it follows payments and precedes Venmo help.
Loading, error, and loaded states share the same card container.

`node --test tests/statistics.test.cjs` uses the real Supabase SDK with a synthetic
transport to check totals, payer identity, trip/status filtering, concurrent account
isolation, empty trips, expired/missing authentication, and database failures.
Isolated WebKit checks against the production build cover authenticated requests,
displayed values, a shared chart request, loading/error/retry, responsive layout at
320/390/430/820/1280/1440px, placement with and without outstanding payments,
and accessibility. These checks use mocked sessions and API
responses; they do not read or change real expenses.

## Expense progress and compact mobile header

On mobile, tap the trip name to open the trip picker, or tap the two figures to open Expenses and Settle up. The figures share the dashboard transaction data and show a dash while loading or on an error. Desktop keeps the three summary cards.

Expense entry shows reading and saving stages from the actual request lifecycle, not a made-up percentage. Slow reads show a hint after 12 seconds and time out after 55 seconds before any write begins. Failed reads and rejected saves keep the draft available for retry or manual entry. A success card appears only after the save completes. The dialog retains its state when closed and reopened while processing; this is in-memory state, not recovery across a page reload. Reduced-motion preferences disable the receipt animation.

Isolated WebKit checks cover mobile header values and accessibility at 320/390/430/820px, desktop summary visibility, trip picker/new-trip handoff, delayed reading, actual saving, confirmation, refreshed balances, duplicate-submit prevention, closing/reopening the composer, failed parsing, rejected writes, timeout, and draft retention. Auth and database responses are mocked; these checks do not create real expenses or send emails.

## Trip deletion regression

`npm run test:trip-delete` exercises the route with the real Supabase SDK and a fully mocked transport. It verifies that authentication is forwarded to every query, each request has its own client, non-creators and invalid sessions cannot delete, read errors remain errors, and filtered or failed deletes cannot report success. Deletion remains a single database statement with cascading cleanup; the app does not delete children in separate requests. The mobile confirmation shows API errors inline and retains the trip on failure. Isolated WebKit checks cover cancel, pending state, error/retry, confirmed success, and accessibility at 320/390/430px without deleting real data.

## Member removal and currency entry

Member removal now verifies the signed-in account, permits the creator to remove
another member or a non-creator to leave, protects the creator, and confirms a row
was actually deleted. Existing payer links, explicit shares, equal shares, and
receipt allocations block removal with a useful explanation and a link to expenses.
No expense history is deleted or reassigned. These checks do not implement archival
or access-only removal, and no live member was removed during development.

`npm test` covers removal authorization, paginated expense checks, foreign-key and
read failures, and filtered deletes. Currency tests cover exact decimal conversion,
rounding of custom shares and receipt discounts, stale/invalid rates, and no writes
on rate failure. Foreign expenses use a single authenticated database transaction
so a failed allocation does not leave an incomplete expense. An isolated PostgreSQL
check applied migration 003 twice, verified unchanged USD history, and tested
rollback after an allocation failure plus rejection of nonmembers and invalid totals.

Isolated WebKit checks cover member confirmation/cancel/busy/error/retry; INR manual
entry and shares; USD previews; preserved drafts when rates fail; saved currency
references; foreign AI receipt review; the USD editor; CSV export; and mobile layout
and accessibility. All accounts and database requests in those checks are mocked.
The public rate endpoint was also checked with a real INR/USD lookup, without any
expense data. Production needs migration 003 from SETUP.md before foreign saves.
