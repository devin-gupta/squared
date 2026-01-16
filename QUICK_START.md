# Quick Start Guide

## 1. Create `.env.local` file

Create a file named `.env.local` in the root directory with:

```env
NEXT_PUBLIC_SUPABASE_URL=https://omuavzmycthzgwrxuzsc.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_EhQJp15ZpKz-giAHEUHU6g_Rz6IKEWG
OPENAI_API_KEY=your_openai_api_key_here
```

**Note:** Get your publishable key from Supabase Dashboard → Settings → API → Publishable key (it should start with `sb_publishable_...`)

## 2. Run Database Migration

### Via Supabase Dashboard:

1. Go to: https://supabase.com/dashboard/project/omuavzmycthzgwrxuzsc/sql/new
2. Copy all content from `supabase/migrations/001_initial_schema.sql`
3. Paste into the SQL Editor
4. Click **Run** (or Cmd/Ctrl + Enter)

## 3. Create Storage Bucket

1. Go to: https://supabase.com/dashboard/project/omuavzmycthzgwrxuzsc/storage/buckets
2. Click **New bucket**
3. Name: `receipts`
4. ✅ **Enable "Public bucket"**
5. Click **Create bucket**

### Add Storage Policies:

After creating the bucket:

1. Click on the `receipts` bucket
2. Go to **Policies** tab
3. Click **New Policy** → **For full customization**

**Policy 1 - Public Read:**
- Name: `Public read access`
- Operation: `SELECT`
- Definition: `(bucket_id = 'receipts')`
- Save

**Policy 2 - Upload:**
- Name: `Authenticated uploads`  
- Operation: `INSERT`
- Definition: `(bucket_id = 'receipts')`
- Save

## 4. Install & Run

```bash
npm install
npm run dev
```

Visit http://localhost:3000
