-- Munda FFS Tracker Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)

-- ═══════ GROUPS ═══════
CREATE TABLE IF NOT EXISTS ffs_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  area TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed 13 default groups
INSERT INTO ffs_groups (name) VALUES
  ('Group 1'),('Group 2'),('Group 3'),('Group 4'),('Group 5'),
  ('Group 6'),('Group 7'),('Group 8'),('Group 9'),('Group 10'),
  ('Group 11'),('Group 12'),('Group 13');

-- ═══════ HOST FARMERS ═══════
CREATE TABLE IF NOT EXISTS ffs_hosts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID REFERENCES ffs_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  practice TEXT DEFAULT '',
  year TEXT DEFAULT '2026',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════ OBSERVATIONS ═══════
CREATE TABLE IF NOT EXISTS ffs_observations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  group_id UUID REFERENCES ffs_groups(id),
  host_id UUID REFERENCES ffs_hosts(id),
  meeting_type TEXT,
  practice TEXT,
  practice_other TEXT,
  attendance INTEGER,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  gps_acc INTEGER,
  same_size TEXT,
  one_var TEXT,
  vis_diff TEXT,
  group_saw TEXT,
  fac_saw TEXT,
  problems TEXT,
  yield_a NUMERIC,
  yield_b NUMERIC,
  price NUMERIC,
  cost_a NUMERIC,
  cost_b NUMERIC,
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for dashboard queries
CREATE INDEX idx_obs_date ON ffs_observations(date);
CREATE INDEX idx_obs_group ON ffs_observations(group_id);
CREATE INDEX idx_obs_host ON ffs_observations(host_id);
CREATE INDEX idx_obs_practice ON ffs_observations(practice);

-- ═══════ ROW LEVEL SECURITY ═══════
-- Enable RLS but allow all access via anon key for now
-- (field trainers don't have accounts — open write access)
ALTER TABLE ffs_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE ffs_hosts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ffs_observations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read" ON ffs_groups FOR SELECT USING (true);
CREATE POLICY "Allow all insert" ON ffs_groups FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update" ON ffs_groups FOR UPDATE USING (true);

CREATE POLICY "Allow all read" ON ffs_hosts FOR SELECT USING (true);
CREATE POLICY "Allow all insert" ON ffs_hosts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update" ON ffs_hosts FOR UPDATE USING (true);
CREATE POLICY "Allow all delete" ON ffs_hosts FOR DELETE USING (true);

CREATE POLICY "Allow all read" ON ffs_observations FOR SELECT USING (true);
CREATE POLICY "Allow all insert" ON ffs_observations FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update" ON ffs_observations FOR UPDATE USING (true);
