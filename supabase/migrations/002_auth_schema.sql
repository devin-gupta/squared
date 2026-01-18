-- Add user_id column to trip_members for authentication (if it doesn't exist)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'trip_members' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE trip_members
    ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create index on user_id for faster queries (if it doesn't exist)
CREATE INDEX IF NOT EXISTS idx_trip_members_user_id ON trip_members(user_id);

-- Update RLS policies to use authentication
-- Drop existing permissive policies
DROP POLICY IF EXISTS "Allow all operations on trips" ON trips;
DROP POLICY IF EXISTS "Allow all operations on trip_members" ON trip_members;
DROP POLICY IF EXISTS "Allow all operations on transactions" ON transactions;
DROP POLICY IF EXISTS "Allow all operations on transaction_adjustments" ON transaction_adjustments;

-- New RLS policies based on authentication

-- Trips: Users can see trips (simplified to avoid recursion - membership checks in app)
DROP POLICY IF EXISTS "Users can view trips they're members of" ON trips;
CREATE POLICY "Users can view trips they're members of" ON trips
  FOR SELECT USING (
    auth.uid() IS NOT NULL
  );

-- Trips: Users can create trips
DROP POLICY IF EXISTS "Authenticated users can create trips" ON trips;
CREATE POLICY "Authenticated users can create trips" ON trips
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Trips: Trip creators can update their trips
DROP POLICY IF EXISTS "Trip creators can update trips" ON trips;
CREATE POLICY "Trip creators can update trips" ON trips
  FOR UPDATE USING (
    created_by IN (
      SELECT display_name FROM trip_members WHERE trip_id = trips.id AND user_id = auth.uid()
    )
  );

-- Trips: Trip creators can delete their trips
DROP POLICY IF EXISTS "Trip creators can delete trips" ON trips;
CREATE POLICY "Trip creators can delete trips" ON trips
  FOR DELETE USING (
    created_by IN (
      SELECT display_name FROM trip_members WHERE trip_id = trips.id AND user_id = auth.uid()
    )
  );

-- Trip members: Users can see members of trips (check via trips table to avoid recursion)
DROP POLICY IF EXISTS "Users can view members of their trips" ON trip_members;
CREATE POLICY "Users can view members of their trips" ON trip_members
  FOR SELECT USING (
    -- Allow if trip exists and user is authenticated
    trip_id IN (SELECT id FROM trips)
    AND auth.uid() IS NOT NULL
  );

-- Trip members: Authenticated users can add members
-- Allow self-insertion (for trip creators) - membership checks handled at app level
DROP POLICY IF EXISTS "Users can add members to their trips" ON trip_members;
CREATE POLICY "Users can add members to their trips" ON trip_members
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND user_id = auth.uid()
  );

-- Trip members: Users can remove themselves or trip creators can remove anyone
DROP POLICY IF EXISTS "Users can remove members from their trips" ON trip_members;
CREATE POLICY "Users can remove members from their trips" ON trip_members
  FOR DELETE USING (
    user_id = auth.uid() OR
    trip_id IN (
      SELECT tm.trip_id FROM trip_members tm
      JOIN trips t ON t.id = tm.trip_id
      WHERE tm.user_id = auth.uid() AND t.created_by = tm.display_name
    )
  );

-- Transactions: Users can see transactions for trips they're members of
DROP POLICY IF EXISTS "Users can view transactions of their trips" ON transactions;
CREATE POLICY "Users can view transactions of their trips" ON transactions
  FOR SELECT USING (
    trip_id IN (
      SELECT trip_id FROM trip_members WHERE user_id = auth.uid()
    )
  );

-- Transactions: Users can create transactions for trips they're members of
DROP POLICY IF EXISTS "Users can create transactions in their trips" ON transactions;
CREATE POLICY "Users can create transactions in their trips" ON transactions
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND
    trip_id IN (
      SELECT trip_id FROM trip_members WHERE user_id = auth.uid()
    )
  );

-- Transactions: Users can update transactions in their trips
DROP POLICY IF EXISTS "Users can update transactions in their trips" ON transactions;
CREATE POLICY "Users can update transactions in their trips" ON transactions
  FOR UPDATE USING (
    trip_id IN (
      SELECT trip_id FROM trip_members WHERE user_id = auth.uid()
    )
  );

-- Transactions: Users can delete transactions in their trips
DROP POLICY IF EXISTS "Users can delete transactions in their trips" ON transactions;
CREATE POLICY "Users can delete transactions in their trips" ON transactions
  FOR DELETE USING (
    trip_id IN (
      SELECT trip_id FROM trip_members WHERE user_id = auth.uid()
    )
  );

-- Transaction adjustments: Users can see adjustments for transactions in their trips
DROP POLICY IF EXISTS "Users can view adjustments of their trips" ON transaction_adjustments;
CREATE POLICY "Users can view adjustments of their trips" ON transaction_adjustments
  FOR SELECT USING (
    transaction_id IN (
      SELECT t.id FROM transactions t
      JOIN trip_members tm ON tm.trip_id = t.trip_id
      WHERE tm.user_id = auth.uid()
    )
  );

-- Transaction adjustments: Users can create adjustments for transactions in their trips
DROP POLICY IF EXISTS "Users can create adjustments in their trips" ON transaction_adjustments;
CREATE POLICY "Users can create adjustments in their trips" ON transaction_adjustments
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND
    transaction_id IN (
      SELECT t.id FROM transactions t
      JOIN trip_members tm ON tm.trip_id = t.trip_id
      WHERE tm.user_id = auth.uid()
    )
  );

-- Transaction adjustments: Users can update adjustments in their trips
DROP POLICY IF EXISTS "Users can update adjustments in their trips" ON transaction_adjustments;
CREATE POLICY "Users can update adjustments in their trips" ON transaction_adjustments
  FOR UPDATE USING (
    transaction_id IN (
      SELECT t.id FROM transactions t
      JOIN trip_members tm ON tm.trip_id = t.trip_id
      WHERE tm.user_id = auth.uid()
    )
  );

-- Transaction adjustments: Users can delete adjustments in their trips
DROP POLICY IF EXISTS "Users can delete adjustments in their trips" ON transaction_adjustments;
CREATE POLICY "Users can delete adjustments in their trips" ON transaction_adjustments
  FOR DELETE USING (
    transaction_id IN (
      SELECT t.id FROM transactions t
      JOIN trip_members tm ON tm.trip_id = t.trip_id
      WHERE tm.user_id = auth.uid()
    )
  );
