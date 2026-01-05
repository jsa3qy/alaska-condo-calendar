-- Alaska Condo Calendar - Supabase Schema
-- Run this in your Supabase SQL Editor to set up the database

-- Visitors table: stores information about people who visit the condo
CREATE TABLE visitors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,  -- Optional: describe who they are (e.g., "Friend from college")
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Visits table: stores date ranges for each visitor's stay
CREATE TABLE visits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id UUID REFERENCES visitors(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  arrival_time TIME,    -- Optional: flight/arrival time
  departure_time TIME,  -- Optional: flight/departure time
  notes TEXT,           -- Optional: any notes about the visit
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for the calendar display)
CREATE POLICY "Allow public read" ON visitors FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON visits FOR SELECT USING (true);

-- Example: Insert some test data
-- INSERT INTO visitors (name, description) VALUES ('John Smith', 'Family friend');
-- INSERT INTO visits (visitor_id, start_date, end_date, arrival_time, departure_time)
-- SELECT id, '2025-01-15', '2025-01-22', '14:30', '10:00' FROM visitors WHERE name = 'John Smith';
