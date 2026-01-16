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
OPENAI_API_KEY=your_openai_api_key
```

**Important Notes:**
- The code expects `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Supabase's new publishable key format)
- Replace the placeholder values with your actual credentials
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

### Vercel Deployment

1. Push your code to GitHub/GitLab/Bitbucket
2. Go to [vercel.com](https://vercel.com) and import your repository
3. Add environment variables in Vercel project settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `OPENAI_API_KEY`
4. Deploy - Vercel will automatically detect Next.js and build

The `vercel.json` file is already configured with proper PWA headers and caching strategies.

## Troubleshooting

### Migration Errors

If you get errors about tables already existing:
- The migration is idempotent, but if tables exist, you may need to drop them first
- Go to **SQL Editor** and run: `DROP TABLE IF EXISTS transaction_adjustments CASCADE; DROP TABLE IF EXISTS transactions CASCADE; DROP TABLE IF EXISTS trip_members CASCADE; DROP TABLE IF EXISTS trips CASCADE;`
- Then re-run the migration

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
