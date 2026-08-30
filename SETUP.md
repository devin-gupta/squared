# Squared Setup Guide

## Quick Start

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Set up environment variables** - Create a `.env.local` file:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
   OPENROUTER_API_KEY=your_openrouter_api_key
   # Optional paid fallback, used only after a primary rate limit:
   OPENAI_API_KEY=your_openai_api_key
   ```

3. **Run database migration** - See Step 2 below

4. **Create storage bucket** - See Step 3 below

5. **Start development server:**
   ```bash
   npm run dev
   ```

## Step 1: Environment Variables

Create a `.env.local` file in the root directory with the following content:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
OPENROUTER_API_KEY=your_openrouter_api_key
# Optional paid fallback, used only after a primary rate limit:
OPENAI_API_KEY=your_openai_api_key
```

**Important Notes:**

- The code expects `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Supabase's new publishable key format)
- Replace the placeholder values with your actual credentials
- AI first uses the pinned `google/gemma-4-31b-it:free` vision/instruction model. The random `openrouter/free` router can select a content-safety classifier instead of an expense reader. When the primary returns HTTP 429 and `OPENAI_API_KEY` is configured, the app makes exactly one paid fallback attempt using OpenAI `gpt-4.1-mini-2025-04-14`. No fallback occurs for other errors or malformed output. Each provider has a 25-second timeout, no automatic retries, and a 4,096-token output cap. Manual entry remains available if either service is unavailable.
- To enable fallback, set `OPENAI_API_KEY` server-side in local development and as a **Sensitive** Vercel environment variable for Production and Preview, then deploy through the repository's CI/CD. Never put it in Git or a `NEXT_PUBLIC_` variable. OpenAI API usage is billed separately; configure usage alerts/budgets in the OpenAI project. Without this key, the app retains free-only behavior.

Receipt and booking images can be attached with the picker, pasted into the Add Expense box, or dropped onto it. Use one JPEG, PNG, or WebP up to 4 MB; typed notes are sent with the image to clarify the payer or split. Image results always open for review before saving. The parser retains the printed total for review and interprets locale-specific separators (for example, `79.086 ISK` means 79,086 Icelandic króna). Conversion uses the current reference rate, not an AI-generated rate, and the ledger remains in USD. Categories include car rental, flights, public transport, parking/tolls, insurance, visas, SIM/eSIM, and other travel costs.

For an opt-in live image evaluation, run `node scripts/evaluate-receipt.cjs /path/to/receipt.png 3`. This sends that image to the configured AI providers, including the paid fallback when enabled, but does not upload it to Supabase or write an expense. The script stops on unrecovered provider errors; mocked tests do not prove live extraction accuracy.
- AI requests require a signed-in trip member. Keep both AI keys server-only and out of Git.
- Receipt uploads support JPEG, PNG, or WebP up to 4 MB; HEIC must be converted before upload.
- You can find your publishable key in Supabase Dashboard → Settings → API → Publishable key

## Step 2: Run Database Migration

### Option A: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy the entire contents of `supabase/migrations/001_initial_schema.sql`
5. Paste it into the SQL Editor
6. Click **Run** (or press Cmd/Ctrl + Enter)
7. You should see "Success. No rows returned" if it executed successfully

### Option B: Using Supabase CLI (Alternative)

If you have the Supabase CLI installed:

```bash
# Link your project (replace with your project ref)
supabase link --project-ref your-project-ref

# Run the migration
supabase db push
```

## Step 3: Create Storage Bucket

1. In your Supabase dashboard, navigate to **Storage** in the left sidebar
2. Click **New bucket**
3. Configure the bucket:
   - **Name:** `receipts`
   - **Public bucket:** ✅ **Enable this** (check the box)
   - **File size limit:** Leave default or set to a reasonable limit (e.g., 5MB)
   - **Allowed MIME types:** Leave empty (allows all types) or specify: `image/jpeg,image/png,image/webp`
4. Click **Create bucket**

### Set Up Storage Policies (Important!)

After creating the bucket, you need to set up policies to allow public read access:

1. Click on the `receipts` bucket you just created
2. Go to the **Policies** tab
3. Click **New Policy**
4. Select **For full customization**, then click **Use this template**
5. Configure the policy:
   - **Policy name:** `Public read access`
   - **Allowed operation:** `SELECT` (for reading)
   - **Policy definition:**
     ```sql
     (bucket_id = 'receipts')
     ```
   - **Policy check:** Leave empty
6. Click **Review** then **Save policy**

7. Create another policy for uploads:
   - **Policy name:** `Authenticated uploads`
   - **Allowed operation:** `INSERT` (for uploading)
   - **Policy definition:**
     ```sql
     (bucket_id = 'receipts')
     ```
   - **Policy check:** Leave empty (or add authentication check if needed)
   - Click **Review** then **Save policy**

## Step 4: Verify Setup

### Verify Tables

1. Go to **Table Editor** in Supabase dashboard
2. You should see these tables:
   - `trips`
   - `trip_members`
   - `transactions`
   - `transaction_adjustments`

### Verify Storage

1. Go to **Storage** → `receipts` bucket
2. Try uploading a test image to verify it works

### Verify Realtime

1. Go to **Database** → **Replication** in Supabase dashboard
2. Check that `transactions` table has replication enabled

## Step 5: Install Dependencies & Run

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

The app should now be running at `http://localhost:3000`

## Production Deployment

### Automatic deployment for this repository

The existing `squared` Vercel project is connected to `devin-gupta/squared`, with `main` as the production branch. Push or merge into `main` to deploy the main site; other branches produce previews subject to Vercel’s contributor authorization. `.github/workflows/ci.yml` checks pushes and pull requests without production credentials. `vercel.json` independently runs the same tests/build before deploying, so failed checks leave the current production deployment intact.

Use Node.js 24 and `npm ci` to reproduce CI. Run `npm test` for regressions or `npm run check` for tests plus the production build. Supabase schema migrations require a separate reviewed change; deployment does not execute them.

### Foreign-currency expenses

Before deploying foreign-currency entry to an existing database, back up the database
and apply **only** [003_currency_conversion.sql](./supabase/migrations/003_currency_conversion.sql)
in the Supabase SQL editor. It requires the existing initial and auth schemas. The
migration adds a nullable conversion reference and an authenticated function that
saves a converted expense and its custom shares in one transaction. It is repeatable
and does not recalculate or modify existing expenses. No service-role key is needed
in the app. This migration is not applied by the build or Vercel deployment.

New foreign-currency expenses use [Frankfurter's daily reference rates](https://frankfurter.dev/)
and save totals, receipt items, and custom shares in USD. The original currency,
amount, rate, rate date, and provider remain available in the ledger/editor and CSV.
Rates are checked at save time, then locked; existing expenses are not revalued.
These are reference rates, not a card statement's final amount or fees. Only the
currency pair is sent to the rate provider, never expense descriptions or amounts.

Without the migration, foreign-currency saves show a setup error without saving an
expense. Existing USD entry continues to work. Failed or stale rate requests never
fall back to treating foreign amounts as USD. Historical expenses entered as dollars
are not automatically reinterpreted as another currency.

### Connecting a new Vercel project

1. Push your code to GitHub/GitLab/Bitbucket
2. Go to [vercel.com](https://vercel.com) and import your repository
3. Add environment variables in Vercel project settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `OPENROUTER_API_KEY` (mark Sensitive for Production and Preview; never prefix with `NEXT_PUBLIC_`)
   - `OPENAI_API_KEY` (optional rate-limit fallback; mark Sensitive for each environment where it should be enabled)
4. Deploy — Vercel detects Next.js, installs from the lockfile, runs the regression tests, and builds. A successful production-branch build is promoted automatically.

The `vercel.json` file is already configured with proper PWA headers and caching strategies.

### Google sign-in

Google sign-in uses the existing browser Supabase session. The client page at
`/auth/callback` finishes the SDK's implicit OAuth flow; it is not a server route
that exchanges a PKCE code into cookies. Keep the shared auth client and existing
email-link flow unchanged unless migrating the entire application to cookie auth.
No database migration, SMTP service, or new app environment variables are needed.

Configure a Web application OAuth client in Google Cloud, with:

- Authorized JavaScript origin: `https://squared-omega.vercel.app`
- Authorized redirect URI: `https://omuavzmycthzgwrxuzsc.supabase.co/auth/v1/callback`
- Basic identity scopes only (email and profile). Squared does not need offline
  access to Google APIs. Make the consent app available to your intended audience;
  if it is in Testing, check its test-user restrictions.

Store the Google client ID and secret in Supabase Authentication → Sign In / Providers
→ Google, and enable that provider. Never commit the client secret or put it in a
`NEXT_PUBLIC_` environment variable.

In Supabase Authentication → URL Configuration:

- Site URL: `https://squared-omega.vercel.app`
- Add redirect URL `https://squared-omega.vercel.app/auth/callback`
- Add redirect URL `https://squared-omega.vercel.app/auth/callback?invite=*`
  to preserve invite queries across browsers. Keep existing email-link URLs.
- For local development, allow the corresponding `http://localhost:3000` callback
  URLs and add that origin to the Google client. Allow only trusted preview hosts.

The query wildcard is restricted to the callback on the production host. See
[Supabase redirect matching](https://supabase.com/docs/guides/auth/redirect-urls)
and [Google provider setup](https://supabase.com/docs/guides/auth/social-login/auth-google).
An invite is also saved locally before leaving Squared. Callback failures offer a
retry without sending email; arbitrary `next` destinations are never followed.

To smoke-test, open an invite, choose **Continue with Google**, finish consent,
and confirm the invited trip opens. Reload to confirm the session persists. Also
cancel Google sign-in and verify the retry keeps the invite. Existing users should
choose Google with the same verified email they previously used: Supabase
[automatically links identities with matching verified emails](https://supabase.com/docs/guides/auth/auth-identity-linking).
Different Google email addresses create different accounts.

## Troubleshooting

### Brand icons and iMessage invite previews

The editable vector sources are `public/brand/mark.svg` and
`public/brand/share-card.svg`. Run `node scripts/generate-brand-assets.cjs` after
editing them to regenerate the committed PNGs and multi-resolution favicon. The
script uses Sharp, installed by Next.js. No image generation service is needed
at build time or when someone shares a link.

New invite URLs use `/trip/INVITEAA?name=Yosemite+Weekend`. Native sharing and
clipboard fallback send **only this URL**, without a message body or separate
title field. The invite dialog opens with a large QR code, then the copy-link
controls, then native sharing when supported. The artwork remains in the link
preview and recipient page, not in the sender's dialog. Cancelling native sharing
never changes the clipboard.

The public landing page shows the invitation, trip name, artwork, and reason to
join before sign-in. Google sign-in is available directly; email is an alternative.
Signed-in recipients continue into the existing `/?code=INVITEAA` join flow.
Old nameless `/trip/CODE` and `/?code=CODE` links still work with generic copy.
The path format also avoids Next.js 15 dropping queries on root Open Graph URLs.
Open Graph and Twitter metadata are
rendered into the initial HTML, with a public 1200×630 image and a high-resolution
Apple touch icon. Preview crawlers do not need to sign in or run JavaScript.
The optional `name` is a bounded, escaped display label supplied by the sender.
It is public to anyone receiving the link, and is not a verified database value.
It never chooses a trip or grants membership: after authentication the invite
code is resolved against Supabase. Metadata never fetches members, expenses,
balances, or trip records, so there is no database/image-generation dependency
on preview loads. `og:url` preserves both the code and label, and invite pages
are marked `noindex`. If a trip is renamed, reshare from the app for a fresh label.
Run `node scripts/check-share-preview.cjs https://squared-omega.vercel.app` to
check the deployed HTML as multiple crawlers and validate image dimensions.

The default public origin is `https://squared-omega.vercel.app`. If the app moves,
set `NEXT_PUBLIC_SITE_URL` to its new HTTPS origin and update Supabase redirects.
The preview image and icons use versioned asset paths; increment those references
for future redesigns. The manifest revalidates rather than caching for a year.

Apple controls the final preview layout and caches previews already sent in
Messages. Test with a newly sent invitation; an old message may retain its old
card. Existing Home Screen shortcuts may need to be removed and added again to
refresh their icon. A real Messages send and Add to Home Screen check on an iPhone
is the final device check; browser previews do not emulate Apple's native renderer.
See [Apple's rich-preview guidance](https://developer.apple.com/documentation/technotes/tn3156-create-rich-previews-for-messages).

### Migration Errors

If you get errors about tables already existing:

- Inspect the existing schema and migration history before making changes.
- Back up the database and use an incremental migration; never drop production expense tables to resolve a setup error.

### Storage Upload Errors

- Make sure the bucket is set to **Public**
- Verify the storage policies are set up correctly
- Check that the bucket name is exactly `receipts` (case-sensitive)

### Realtime Not Working

- Go to **Database** → **Replication**
- Ensure `transactions` table is enabled for replication
- If not, you can enable it manually in the SQL Editor:
  ```sql
  ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
  ```

### Categories for expenses without receipt items

Apply `supabase/migrations/004_expense_categories.sql` after the currency migration and before deploying expense-level category editing. It adds a nullable `transactions.category` column and updates the atomic converted-expense function to retain it. No historical amounts, shares, or currency references are changed, and existing RLS remains in force.

To recategorize an existing expense, open it from the trip overview or Expenses, choose **Category**, and save. Expenses with receipt items keep their per-item category selectors. Manual entry also has a category selector. A category-only edit sends only the category and leaves all financial fields untouched; statistics use the expense category when there are no receipt items.

### Shared invitations and travel reliability

Apply `supabase/migrations/005_group_travel.sql` after 004, before deploying this
release. It adds name-claiming functions, atomic expense writes, a version column,
and a member-readable expense history. Its policy/trigger replacements may trigger
the SQL editor's destructive-operation warning; the migration does not delete
existing expenses or reassign members. The DELETE statements inside the function
body run only when someone later requests deletion or undo.

Organizers can add friends by name when creating a trip or from the people list.
Friends use the same shared QR/link, sign in, and explicitly choose an unclaimed
name or add a distinct new name. Claiming preserves the member ID and all existing
payments/shares. Existing members bypass this choice. A shared invite is a trusted
invitation: anyone holding it can join and claim an unclaimed name. Keep it within
the group. Claimed names and the organizer are not offered for claiming.

Expense drafts (including attached images) are stored in IndexedDB on the current
browser, scoped to the signed-in account and trip. Offline drafts say **Not synced
yet**. Reconnecting does not post expenses automatically: the person explicitly
saves when online. A previously loaded trip can use cached names for draft entry;
loading an uncached app or signing in still requires a connection. Browser storage
can be cleared or evicted, and private browsing may not retain drafts after the
browser closes. Storage failures are shown, never silently described as saved.
Drafts and remembered defaults do not transfer to another device.

Before posting an expense, the app persists its operation UUID and exact USD
payload, including the chosen exchange rate. An uncertain save retries that same
request after reload. `commit_expense` atomically writes the expense, shares, and
audit entry; repeated requests return the original result. Editing uses an expected
version to reject stale changes. The original currency/payer/participants become
the next expense's defaults, but explicit input overrides them.

Undo is available after an expense change and from **Expense history**, including
for deleted expenses. Only the actor's latest change to that expense can be undone,
and only if no later change has occurred. Undo retains the original amounts,
currency evidence, and member references. Removed members may prevent restoration.
History begins with writes through this release; earlier changes are not invented.

The settlement screen's **Start another trip with this group** shortcut pre-fills
names only. It creates a fresh invite and does not copy balances, expenses, or
other people's account memberships.

Google consent branding is configured in the existing Google Cloud project's
**Google Auth Platform → Branding**: use **Squared** and
`public/brand/icon-512-v2.png`. Leave the working OAuth scopes and redirect URIs
unchanged. The project owner has reported completing this configuration. Google
may require verification before draft branding can be published; check the console's
published status if the old name/logo remains visible. See Google's
[brand verification requirements](https://developers.google.com/identity/verification/authentication-verification).
No Apple sign-in, Home Screen prompts, or analytics were added in this release.
