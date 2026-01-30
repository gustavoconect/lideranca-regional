-- ============================================
-- MIGRATION: DATA SOURCES TRACKING
-- ============================================

-- 1. Create Data Sources table
CREATE TABLE IF NOT EXISTS data_sources (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  filename text NOT NULL,
  file_type text CHECK (file_type IN ('csv', 'pdf')),
  extraction_date date,
  created_by uuid REFERENCES profiles(id),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- 2. Add source_id to metrics and reports
ALTER TABLE nps_metrics ADD COLUMN IF NOT EXISTS source_id uuid REFERENCES data_sources(id) ON DELETE CASCADE;
ALTER TABLE qualitative_reports ADD COLUMN IF NOT EXISTS source_id uuid REFERENCES data_sources(id) ON DELETE CASCADE;

-- 3. Enable RLS
ALTER TABLE data_sources ENABLE ROW LEVEL SECURITY;

-- 4. Policies for Data Sources
DROP POLICY IF EXISTS "Regional full access data_sources" ON data_sources;
CREATE POLICY "Regional full access data_sources" ON data_sources FOR ALL USING (
  exists (select 1 from profiles where id = auth.uid() and role = 'regional_leader')
);

-- 5. Logic note: ON DELETE CASCADE will automatically remove metrics/reports when source is deleted.
