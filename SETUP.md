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
```

**Important Notes:**

- The code expects `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Supabase's new publishable key format)
- Replace the placeholder values with your actual credentials
- AI uses only `openrouter/free`, with no paid fallback. Free models have shared usage limits and varying availability; manual entry remains available.
- AI requests require a signed-in trip member. Keep `OPENROUTER_API_KEY` server-only and out of Git.
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
4. Deploy — Vercel detects Next.js, installs from the lockfile, runs the regression tests, and builds. A successful production-branch build is promoted automatically.

The `vercel.json` file is already configured with proper PWA headers and caching strategies.

## Troubleshooting

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
