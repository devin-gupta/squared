# 🚨 IMPORTANT: Production Migration Required

## Issue
The production database is missing the `user_id` column in the `trip_members` table, which is required for authentication. This causes errors when creating trips.

## Quick Fix (Run this NOW)

### Steps:

1. **Go to your Supabase Dashboard** (production database)
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy the **ENTIRE** contents of `supabase/migrations/002_auth_schema.sql`
5. Paste it into the SQL Editor
6. Click **Run** (or press Cmd/Ctrl + Enter)

You should see "Success" or "Success. No rows returned" if it executed successfully.

## What This Migration Does

- Adds `user_id` column to `trip_members` table (nullable, so existing data is safe)
- Creates an index on `user_id` for faster queries
- Updates RLS (Row Level Security) policies to use authentication
- The migration is **idempotent** - safe to run multiple times

## Verification

After running the migration, you can verify it worked:

1. Go to **Table Editor** → `trip_members` table
2. You should see a new `user_id` column (UUID type, nullable)

## Important Notes

- This migration is **safe** - it won't break existing data
- The `user_id` column is **nullable**, so existing trip members without user_id will still work
- The migration checks if the column exists before adding it, so it's safe to run multiple times
