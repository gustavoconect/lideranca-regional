-- ============================================
-- SECURITY FIX: DROP PERMISSIVE POLICIES
-- ============================================

-- Qualitative Reports: Remove insecure policies
DROP POLICY IF EXISTS "Authenticated users can read qualitative_reports" ON qualitative_reports;
DROP POLICY IF EXISTS "Authenticated users can insert qualitative_reports" ON qualitative_reports;
DROP POLICY IF EXISTS "Authenticated users can update qualitative_reports" ON qualitative_reports;
DROP POLICY IF EXISTS "Authenticated users can delete qualitative_reports" ON qualitative_reports;

-- Tasks: Remove insecure policies
DROP POLICY IF EXISTS "Authenticated users can read tasks" ON tasks;
DROP POLICY IF EXISTS "Authenticated users can insert tasks" ON tasks;
DROP POLICY IF EXISTS "Authenticated users can update tasks" ON tasks;
DROP POLICY IF EXISTS "Authenticated users can delete tasks" ON tasks;

-- ============================================
-- RE-APPLY STRICT POLICIES (FROM schema.sql)
-- ============================================

-- QUALITATIVE REPORTS
DROP POLICY IF EXISTS "Regional full access qualitative_reports" ON qualitative_reports;
create policy "Regional full access qualitative_reports" on qualitative_reports for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'regional_leader')
);

-- TASKS
DROP POLICY IF EXISTS "Regional full access tasks" ON tasks;
create policy "Regional full access tasks" on tasks for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'regional_leader')
);

DROP POLICY IF EXISTS "Leader view assigned tasks" ON tasks;
create policy "Leader view assigned tasks" on tasks for select using ( unit_leader_id = auth.uid() );

DROP POLICY IF EXISTS "Leader update assigned tasks" ON tasks;
create policy "Leader update assigned tasks" on tasks for update using ( unit_leader_id = auth.uid() );
