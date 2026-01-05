-- Alaska Condo Calendar - Supabase Schema
-- Run this in your Supabase SQL Editor to set up the database

-- ============================================
-- PROFILES TABLE (linked to Supabase Auth)
-- ============================================
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- VISITORS TABLE
-- ============================================
CREATE TABLE visitors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,  -- Link to user profile
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- VISITS TABLE
-- ============================================
CREATE TYPE visit_status AS ENUM ('pending', 'confirmed', 'denied');

CREATE TABLE visits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id UUID REFERENCES visitors(id) ON DELETE CASCADE,
  submitted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,  -- Who submitted this
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  arrival_time TIME,
  departure_time TIME,
  notes TEXT,
  status visit_status DEFAULT 'pending',
  reviewed_at TIMESTAMPTZ,  -- When admin approved/denied
  reviewed_by UUID REFERENCES profiles(id),  -- Which admin reviewed
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;

-- PROFILES policies
CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- VISITORS policies
CREATE POLICY "Anyone can view visitors"
  ON visitors FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create visitors"
  ON visitors FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own visitor records"
  ON visitors FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can update any visitor"
  ON visitors FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- VISITS policies
CREATE POLICY "Anyone can view visits"
  ON visits FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create visits"
  ON visits FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own pending visits"
  ON visits FOR UPDATE USING (
    auth.uid() = submitted_by AND status = 'pending'
  );

CREATE POLICY "Admins can update any visit"
  ON visits FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Users can delete own pending visits"
  ON visits FOR DELETE USING (
    auth.uid() = submitted_by AND status = 'pending'
  );

CREATE POLICY "Admins can delete any visit"
  ON visits FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ============================================
-- HELPER FUNCTION: Check if user is admin
-- ============================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND is_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX idx_visits_status ON visits(status);
CREATE INDEX idx_visits_submitted_by ON visits(submitted_by);
CREATE INDEX idx_visits_dates ON visits(start_date, end_date);
CREATE INDEX idx_visitors_user_id ON visitors(user_id);

-- ============================================
-- MAKE YOURSELF AN ADMIN (run after signing up)
-- ============================================
-- UPDATE profiles SET is_admin = true WHERE email = 'your-email@example.com';
