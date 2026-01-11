-- DFI System - Users Table (BRD EXACT)
-- Run this FIRST in Supabase SQL Editor

-- Enable pgcrypto for gen_random_uuid()
create extension if not exists pgcrypto;

-- Drop existing users table if exists (CAREFUL in production!)
-- drop table if exists public.users cascade;

-- Create users table EXACTLY per BRD spec
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password_hash text not null,
  role text not null check (role in ('superadmin','senior','exec','officer')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references public.users(id)
);

-- Comments
comment on table public.users is 'System users with role-based access control (BRD-compliant)';
comment on column public.users.role is 'User role: superadmin, senior, exec, officer';
comment on column public.users.created_by is 'UUID of user who created this account';

-- Indexes
create index if not exists idx_users_username on public.users(username);
create index if not exists idx_users_role on public.users(role);
create index if not exists idx_users_is_active on public.users(is_active);

-- Enable RLS
alter table public.users enable row level security;

-- Policy for service role (backend uses service key)
drop policy if exists "Service role full access users" on public.users;
create policy "Service role full access users" on public.users for all using (true);
