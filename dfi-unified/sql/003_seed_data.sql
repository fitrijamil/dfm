-- DFI System - Seed Data
-- Run this AFTER 001_create_users.sql and 002_create_tables.sql

-- =====================================================
-- DEFAULT SUPERADMIN USER
-- Password: Admin@123 (bcrypt hash with 12 rounds)
-- CHANGE THIS IMMEDIATELY AFTER FIRST LOGIN
-- =====================================================
insert into public.users (username, password_hash, role, is_active, created_by)
values (
  'admin',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4gBBKKLl5.5z4Gfq',
  'superadmin',
  true,
  null
)
on conflict (username) do nothing;

-- Get admin ID for created_by references
do $$
declare
  admin_id uuid;
begin
  select id into admin_id from public.users where username = 'admin';
  
  -- Sample Senior User (Password: Test@123)
  insert into public.users (username, password_hash, role, is_active, created_by)
  values ('senior1', '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'senior', true, admin_id)
  on conflict (username) do nothing;
  
  -- Sample Exec Users (Password: Test@123)
  insert into public.users (username, password_hash, role, is_active, created_by)
  values 
    ('exec1', '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'exec', true, admin_id),
    ('exec2', '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'exec', true, admin_id)
  on conflict (username) do nothing;
  
  -- Sample Officer User (Password: Test@123)
  insert into public.users (username, password_hash, role, is_active, created_by)
  values ('officer1', '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'officer', true, admin_id)
  on conflict (username) do nothing;
end $$;

-- =====================================================
-- USER PROFILES (optional extended info)
-- =====================================================
do $$
declare
  u record;
begin
  for u in select id, username from public.users loop
    insert into public.user_profiles (user_id, full_name, email)
    values (
      u.id,
      case u.username
        when 'admin' then 'System Administrator'
        when 'senior1' then 'Ahmad Senior'
        when 'exec1' then 'Muhammad Exec'
        when 'exec2' then 'Fatimah Exec'
        when 'officer1' then 'Ali Officer'
        else u.username
      end,
      u.username || '@dfi-system.local'
    )
    on conflict (user_id) do nothing;
  end loop;
end $$;

-- =====================================================
-- BRANCH MASTER DATA
-- =====================================================
insert into public.branch_master (branch_code, branch_name, region, state) values
  ('001', 'Kuala Lumpur Main', 'Central', 'Wilayah Persekutuan'),
  ('002', 'Petaling Jaya', 'Central', 'Selangor'),
  ('003', 'Shah Alam', 'Central', 'Selangor'),
  ('004', 'Subang Jaya', 'Central', 'Selangor'),
  ('005', 'Klang', 'Central', 'Selangor'),
  ('006', 'Ampang', 'Central', 'Selangor'),
  ('007', 'Cheras', 'Central', 'Kuala Lumpur'),
  ('008', 'Bangsar', 'Central', 'Kuala Lumpur'),
  ('009', 'KLCC', 'Central', 'Kuala Lumpur'),
  ('010', 'Bukit Bintang', 'Central', 'Kuala Lumpur'),
  ('011', 'Penang Georgetown', 'Northern', 'Pulau Pinang'),
  ('012', 'Penang Bayan Lepas', 'Northern', 'Pulau Pinang'),
  ('013', 'Ipoh', 'Northern', 'Perak'),
  ('014', 'Taiping', 'Northern', 'Perak'),
  ('015', 'Alor Setar', 'Northern', 'Kedah'),
  ('016', 'Sungai Petani', 'Northern', 'Kedah'),
  ('017', 'Kangar', 'Northern', 'Perlis'),
  ('021', 'Johor Bahru', 'Southern', 'Johor'),
  ('022', 'Batu Pahat', 'Southern', 'Johor'),
  ('023', 'Muar', 'Southern', 'Johor'),
  ('024', 'Kluang', 'Southern', 'Johor'),
  ('025', 'Melaka', 'Southern', 'Melaka'),
  ('026', 'Seremban', 'Southern', 'Negeri Sembilan'),
  ('031', 'Kuantan', 'East Coast', 'Pahang'),
  ('032', 'Temerloh', 'East Coast', 'Pahang'),
  ('033', 'Kuala Terengganu', 'East Coast', 'Terengganu'),
  ('034', 'Kota Bharu', 'East Coast', 'Kelantan'),
  ('041', 'Kota Kinabalu', 'East Malaysia', 'Sabah'),
  ('042', 'Sandakan', 'East Malaysia', 'Sabah'),
  ('043', 'Tawau', 'East Malaysia', 'Sabah'),
  ('044', 'Kuching', 'East Malaysia', 'Sarawak'),
  ('045', 'Miri', 'East Malaysia', 'Sarawak'),
  ('046', 'Sibu', 'East Malaysia', 'Sarawak'),
  ('047', 'Bintulu', 'East Malaysia', 'Sarawak')
on conflict (branch_code) do nothing;

-- =====================================================
-- SAMPLE EXEC CASES
-- =====================================================
do $$
declare
  exec1_id uuid;
  exec2_id uuid;
begin
  select id into exec1_id from public.users where username = 'exec1';
  select id into exec2_id from public.users where username = 'exec2';
  
  if exec1_id is not null then
    insert into public.exec_cases (case_id, ic_number, customer_name, classification, case_type, mo, branch_code, branch_name, date_escalated, amount_involved, status, remarks, pic, created_by)
    values 
      ('FRD-2024-000001', '901234-56-7890', 'AHMAD BIN ABDULLAH', 'Fraud', 'Account Takeover', 'Phishing Link', '001', 'Kuala Lumpur Main', '2024-01-15', 25000.00, 'WIP', 'Customer reported unauthorized transactions', exec1_id, exec1_id),
      ('FRD-2024-000002', '880101-14-5678', 'SITI AMINAH BINTI OMAR', 'Scam', 'Investment Scam', 'Crypto Scam', '002', 'Petaling Jaya', '2024-01-18', 150000.00, 'WIP', 'Investment scam via social media', exec1_id, exec1_id),
      ('FRD-2024-000003', '750515-08-1234', 'TAN AH KOW', 'Fraud', 'Card Fraud', 'Skimming', '003', 'Shah Alam', '2024-01-10', 8500.00, 'Closed', 'Card skimming at ATM', exec1_id, exec1_id)
    on conflict (case_id) do nothing;
  end if;
  
  if exec2_id is not null then
    insert into public.exec_cases (case_id, ic_number, customer_name, classification, case_type, mo, branch_code, branch_name, date_escalated, amount_involved, status, remarks, pic, created_by)
    values 
      ('FRD-2024-000004', '920303-10-9876', 'MUTHU A/L KRISHNAN', 'Scam', 'Love Scam', 'Social Media', '011', 'Penang Georgetown', '2024-01-20', 75000.00, 'WIP', 'Love scam via dating app', exec2_id, exec2_id),
      ('FRD-2024-000005', '850712-01-4321', 'WONG MEI LING', 'Non-Fraud', 'Other', 'Other', '021', 'Johor Bahru', '2024-01-22', 0.00, 'WIP', 'False alarm - customer error', exec2_id, exec2_id)
    on conflict (case_id) do nothing;
  end if;
end $$;

-- =====================================================
-- SAMPLE RPP CASES (with BRD FR-40/41/42 fields)
-- =====================================================
do $$
declare
  officer1_id uuid;
begin
  select id into officer1_id from public.users where username = 'officer1';
  
  if officer1_id is not null then
    insert into public.rpp_cases (bmid, rpp_id, source_type, date_received, month_received, email, complainant_name, complainant_ic, complainant_phone, bank_name, account_number, amount, fraud_type, icbs_tag, action_taken_icbs, fund_result, fund_pr_status, fund_memo_type, status, pic, remarks, created_by)
    values 
      ('BMID-001', 'RPP-2024-0001', 'Email', '2024-01-25', '2024-01', 'complainant1@email.com', 'LEE CHONG WEI', '850315-14-5555', '012-3456789', 'Maybank', '1234567890', 50000.00, 'Investment Scam', 33, 'Scam/Fraud - Loss Reported', 'Found', 'Pending', 'Standard', 'Pending', officer1_id, 'Reported via email', officer1_id),
      ('BMID-001', 'RPP-2024-0002', 'RPP Portal', '2024-01-26', '2024-01', null, 'LEE CHONG WEI', '850315-14-5555', '012-3456789', 'Maybank', '1234567890', 50000.00, 'Investment Scam', 19, 'Scam/Fraud - No Loss', 'None', 'Nil', 'No record found', 'Pending', officer1_id, 'Reported via RPP portal - same case different channel', officer1_id),
      ('BMID-002', 'RPP-2024-0003', 'Email', '2024-01-27', '2024-01', 'victim3@email.com', 'NUR AISYAH BINTI YUSOF', '950505-10-7777', '019-1112233', 'Public Bank', '1122334455', 100000.00, 'Job Scam', null, null, 'Found', 'Approved', 'Urgent', 'Processed', officer1_id, 'Case processed and forwarded', officer1_id);
  end if;
end $$;
