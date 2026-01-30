-- ============================================
-- REGIONAL APP - SCHEMA SUPABASE
-- Execute este script no SQL Editor do Supabase
-- Dashboard > SQL Editor > New Query
-- ============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================
-- ENUMS
-- ============================================

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('regional_leader', 'unit_leader');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE task_status AS ENUM ('pending', 'completed', 'late', 'verified');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE task_recurrence AS ENUM ('none', 'daily', 'weekly', 'monthly');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE validation_type AS ENUM ('checkbox', 'photo', 'text');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- TABLES
-- ============================================

-- PROFILES (Extends Auth)
create table if not exists profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  full_name text,
  role user_role default 'unit_leader',
  avatar_url text,
  updated_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- UNITS (Unidades/Lojas)
create table if not exists units (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  code text unique not null,
  leader_id uuid references profiles(id),
  regional_group text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- DATA SOURCES (Rastreamento de arquivos enviados)
create table if not exists data_sources (
  id uuid default uuid_generate_v4() primary key,
  filename text not null,
  file_type text check (file_type in ('csv', 'pdf')),
  extraction_date date,
  created_by uuid references profiles(id),
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- NPS METRICS (Dados Quantitativos do CSV)
create table if not exists nps_metrics (
  id uuid default uuid_generate_v4() primary key,
  unit_id uuid references units(id) not null,
  source_id uuid references data_sources(id) on delete cascade,
  week_start_date date not null,
  position_ranking int,
  responses_count int default 0,
  promoters_count int default 0,
  detractors_count int default 0,
  nps_score decimal(5,2),
  goal_2026_1 decimal(5,2),
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- QUALITATIVE REPORTS (Relatórios Gerados por IA)
create table if not exists qualitative_reports (
  id uuid default uuid_generate_v4() primary key,
  unit_id uuid references units(id) not null,
  source_id uuid references data_sources(id) on delete cascade,
  report_date date default current_date,
  original_pdf_url text,
  ai_summary jsonb, -- { highlights: [], risks: [], action_plan: [] }
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- TASKS (Tarefas - Checklist dos Líderes)
create table if not exists tasks (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text,
  regional_leader_id uuid references profiles(id),
  unit_leader_id uuid references profiles(id),
  due_date timestamp with time zone,
  status task_status default 'pending',
  priority task_priority default 'medium',
  recurrence task_recurrence default 'none',
  validation_type validation_type default 'checkbox',
  proof_url text,
  completed_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

alter table profiles enable row level security;
alter table units enable row level security;
alter table nps_metrics enable row level security;
alter table qualitative_reports enable row level security;
alter table tasks enable row level security;
alter table data_sources enable row level security;

-- DATA SOURCES POLICIES
DROP POLICY IF EXISTS "Regional full access data_sources" ON data_sources;
create policy "Regional full access data_sources" on data_sources for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'regional_leader')
);

-- PROFILES POLICIES
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
create policy "Public profiles are viewable by everyone" on profiles for select using (true);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);

-- UNITS POLICIES
DROP POLICY IF EXISTS "Regional sees all units" ON units;
create policy "Regional sees all units" on units for select using (
  exists (select 1 from profiles where id = auth.uid() and role = 'regional_leader')
);

DROP POLICY IF EXISTS "Leader sees own unit" ON units;
create policy "Leader sees own unit" on units for select using ( leader_id = auth.uid() );

DROP POLICY IF EXISTS "Regional can insert units" ON units;
create policy "Regional can insert units" on units for insert with check (
  exists (select 1 from profiles where id = auth.uid() and role = 'regional_leader')
);

DROP POLICY IF EXISTS "Regional can update units" ON units;
create policy "Regional can update units" on units for update using (
  exists (select 1 from profiles where id = auth.uid() and role = 'regional_leader')
);

-- NPS METRICS POLICIES
DROP POLICY IF EXISTS "Regional full access nps_metrics" ON nps_metrics;
create policy "Regional full access nps_metrics" on nps_metrics for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'regional_leader')
);

DROP POLICY IF EXISTS "Leader view own unit metrics" ON nps_metrics;
create policy "Leader view own unit metrics" on nps_metrics for select using (
  exists (select 1 from units where units.id = nps_metrics.unit_id and units.leader_id = auth.uid())
);

-- QUALITATIVE REPORTS POLICIES
DROP POLICY IF EXISTS "Regional full access qualitative_reports" ON qualitative_reports;
create policy "Regional full access qualitative_reports" on qualitative_reports for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'regional_leader')
);

-- TASKS POLICIES
DROP POLICY IF EXISTS "Regional full access tasks" ON tasks;
create policy "Regional full access tasks" on tasks for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'regional_leader')
);

DROP POLICY IF EXISTS "Leader view assigned tasks" ON tasks;
create policy "Leader view assigned tasks" on tasks for select using ( unit_leader_id = auth.uid() );

DROP POLICY IF EXISTS "Leader update assigned tasks" ON tasks;
create policy "Leader update assigned tasks" on tasks for update using ( unit_leader_id = auth.uid() );

-- ============================================
-- TRIGGER: Auto-create profile on signup
-- ============================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', 'unit_leader');
  return new;
end;
$$ language plpgsql security definer;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
