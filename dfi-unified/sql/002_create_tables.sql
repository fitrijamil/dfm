-- DFI System - Other Tables
-- Run this AFTER 001_create_users.sql

-- =====================================================
-- USER PROFILES TABLE (optional extra fields)
-- =====================================================
create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references public.users(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  department text,
  last_login timestamptz,
  updated_at timestamptz default now()
);

comment on table public.user_profiles is 'Extended user profile data (separate from core users table)';
create index if not exists idx_user_profiles_user_id on public.user_profiles(user_id);

-- =====================================================
-- BRANCH MASTER TABLE
-- =====================================================
create table if not exists public.branch_master (
  id uuid primary key default gen_random_uuid(),
  branch_code text unique not null,
  branch_name text not null,
  region text,
  state text,
  is_active boolean default true,
  created_at timestamptz default now()
);

comment on table public.branch_master is 'Master list of bank branches';
create index if not exists idx_branch_code on public.branch_master(branch_code);

-- =====================================================
-- EXEC CASES TABLE
-- =====================================================
create table if not exists public.exec_cases (
  id uuid primary key default gen_random_uuid(),
  case_id text unique not null,
  ic_number text not null,
  customer_name text not null,
  classification text not null check (classification in ('Fraud', 'Scam', 'Non-Fraud')),
  case_type text not null,
  mo text not null,
  branch_code text not null,
  branch_name text,
  date_escalated date not null,
  date_closed date,
  amount_involved decimal(15, 2) default 0,
  status text default 'WIP' check (status in ('WIP', 'Closed')),
  remarks text,
  closing_remarks text,
  resolution text,
  pic uuid not null references public.users(id),
  created_by uuid references public.users(id),
  closed_by uuid references public.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table public.exec_cases is 'Executive fraud investigation cases';
comment on column public.exec_cases.pic is 'Person In Charge - assigned EXEC';
comment on column public.exec_cases.mo is 'Modus Operandi';

create index if not exists idx_exec_cases_case_id on public.exec_cases(case_id);
create index if not exists idx_exec_cases_pic on public.exec_cases(pic);
create index if not exists idx_exec_cases_status on public.exec_cases(status);
create index if not exists idx_exec_cases_classification on public.exec_cases(classification);
create index if not exists idx_exec_cases_date_escalated on public.exec_cases(date_escalated);

-- =====================================================
-- RPP CASES TABLE (Officer Module - BRD FR-40/41/42)
-- =====================================================
create table if not exists public.rpp_cases (
  id uuid primary key default gen_random_uuid(),
  -- Case identification
  bmid text,  -- Business Master ID - used as case key for duplicate check
  rpp_id text,
  source_type text check (source_type in ('Email', 'RPP Portal')),
  
  -- Date fields
  date_received date not null,
  month_received text,  -- Auto-calculated from date_received (FR-40)
  
  -- Contact info
  email text,
  rpp_portal text,
  
  -- Complainant info
  complainant_name text not null,
  complainant_ic text,
  complainant_phone text,
  
  -- Bank info
  bank_name text not null,
  account_number text,
  amount decimal(15, 2) default 0,
  
  -- Case classification
  fraud_type text,
  
  -- ICBS fields (FR-41)
  icbs_tag integer,
  action_taken_icbs text,
  
  -- Fund fields (FR-41)
  fund_result text,
  fund_pr_status text,
  fund_memo_type text,
  
  -- Status and assignment
  status text default 'Pending' check (status in ('Pending', 'Processed')),
  pic uuid references public.users(id),  -- Auto from logged-in officer (FR-40)
  remarks text,
  
  -- Audit
  created_by uuid references public.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table public.rpp_cases is 'RPP Incoming cases managed by Officers (BRD FR-40/41/42)';
comment on column public.rpp_cases.bmid is 'Business Master ID - case key for duplicate checking';
comment on column public.rpp_cases.source_type is 'Email or RPP Portal - max 2 per BMID (one each)';
comment on column public.rpp_cases.icbs_tag is 'ICBS Tag value - 33 or 19 triggers auto-fill';
comment on column public.rpp_cases.fund_result is 'None means Nil status and No record found memo';

create index if not exists idx_rpp_cases_bmid on public.rpp_cases(bmid);
create index if not exists idx_rpp_cases_email on public.rpp_cases(email);
create index if not exists idx_rpp_cases_rpp_portal on public.rpp_cases(rpp_portal);
create index if not exists idx_rpp_cases_source_type on public.rpp_cases(source_type);
create index if not exists idx_rpp_cases_bank_name on public.rpp_cases(bank_name);
create index if not exists idx_rpp_cases_date_received on public.rpp_cases(date_received);
create index if not exists idx_rpp_cases_pic on public.rpp_cases(pic);

-- =====================================================
-- CLOSE CASE REQUESTS TABLE
-- =====================================================
create table if not exists public.close_case_requests (
  id uuid primary key default gen_random_uuid(),
  exec_case_id uuid not null references public.exec_cases(id),
  case_id_ref text not null,
  customer_name text,
  classification text,
  requested_by uuid not null references public.users(id),
  remarks text,
  resolution text,
  status text default 'Pending' check (status in ('Pending', 'Approved', 'Rejected')),
  senior_remark text,  -- MANDATORY on approval/rejection
  reviewed_by uuid references public.users(id),
  reviewed_at timestamptz,
  created_at timestamptz default now()
);

comment on table public.close_case_requests is 'Close case requests requiring Senior approval';
comment on column public.close_case_requests.senior_remark is 'MANDATORY when approving or rejecting';

create index if not exists idx_close_requests_status on public.close_case_requests(status);
create index if not exists idx_close_requests_requested_by on public.close_case_requests(requested_by);
create index if not exists idx_close_requests_exec_case_id on public.close_case_requests(exec_case_id);

-- =====================================================
-- AUDIT LOGS TABLE
-- =====================================================
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id),
  action text not null,
  resource_type text not null,
  resource_id uuid,
  details jsonb,
  ip_address text,
  created_at timestamptz default now()
);

comment on table public.audit_logs is 'System audit trail for all actions';

create index if not exists idx_audit_logs_user on public.audit_logs(user_id);
create index if not exists idx_audit_logs_action on public.audit_logs(action);
create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================
alter table public.user_profiles enable row level security;
alter table public.branch_master enable row level security;
alter table public.exec_cases enable row level security;
alter table public.rpp_cases enable row level security;
alter table public.close_case_requests enable row level security;
alter table public.audit_logs enable row level security;

-- Policies for service role (backend) - full access
create policy "Service role full access" on public.user_profiles for all using (true);
create policy "Service role full access" on public.branch_master for all using (true);
create policy "Service role full access" on public.exec_cases for all using (true);
create policy "Service role full access" on public.rpp_cases for all using (true);
create policy "Service role full access" on public.close_case_requests for all using (true);
create policy "Service role full access" on public.audit_logs for all using (true);
