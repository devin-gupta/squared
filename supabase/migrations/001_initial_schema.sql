-- Create trips table
CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  invite_code TEXT UNIQUE NOT NULL,
  created_by TEXT NOT NULL
);

-- Create trip_members table
CREATE TABLE trip_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(trip_id, display_name)
);

-- Create transactions table
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  total_amount NUMERIC(10, 2) NOT NULL,
  payer_id UUID NOT NULL REFERENCES trip_members(id) ON DELETE RESTRICT,
  split_type TEXT NOT NULL DEFAULT 'equal' CHECK (split_type IN ('equal', 'custom')),
  receipt_url TEXT,
  line_items JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'finalized'))
);

-- Create transaction_adjustments table
CREATE TABLE transaction_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES trip_members(id) ON DELETE RESTRICT,
  amount NUMERIC(10, 2) NOT NULL,
  UNIQUE(transaction_id, member_id)
);

-- Create indexes for performance
CREATE INDEX idx_trip_members_trip_id ON trip_members(trip_id);
CREATE INDEX idx_transactions_trip_id ON transactions(trip_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX idx_transaction_adjustments_transaction_id ON transaction_adjustments(transaction_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for transactions
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_adjustments ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow all operations for now (can be restricted later)
-- In production, you'd want more restrictive policies based on trip membership

CREATE POLICY "Allow all operations on trips" ON trips
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on trip_members" ON trip_members
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on transactions" ON transactions
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on transaction_adjustments" ON transaction_adjustments
  FOR ALL USING (true) WITH CHECK (true);

-- Enable Realtime for transactions
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
