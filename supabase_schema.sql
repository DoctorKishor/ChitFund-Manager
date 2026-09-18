-- ==========================================
-- Supabase PostgreSQL Schema for Chit Fund Manager
-- Optimized for multi-admin role access control and audit tracking
-- ==========================================

-- Enable the UUID extension for primary keys
create extension if not exists "uuid-ossp";

-- ==========================================
-- 1. Tables and Integrity Constraints
-- ==========================================

-- profiles: User profiles extending Supabase auth.users
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone_number text not null unique,
  full_name text not null,
  role text not null default 'subscriber' check (role in ('admin', 'manager', 'subscriber')),
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

-- chit_groups: Chit group configurations and running totals
create table public.chit_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  total_value numeric not null check (total_value >= 0),
  member_count integer not null check (member_count > 0),
  duration_months integer not null check (duration_months > 0),
  current_month integer not null default 0 check (current_month >= 0),
  kai_iruppu_pool numeric not null default 0 check (kai_iruppu_pool >= 0),
  laaba_seetu_rules jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('draft', 'active', 'completed')),
  start_date date default current_date,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  constraint check_member_count_eq_duration check (member_count = duration_months)
);

-- group_members: Memberships of profiles in specific chit groups
create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.chit_groups(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  ticket_number integer not null check (ticket_number > 0),
  has_won_regular boolean not null default false,
  physical_book_synced boolean not null default true,
  split_pool jsonb default null,
  custom_installment numeric default null,
  exit_month integer default null,
  transferred_from uuid references public.profiles(id),
  transfer_effective_month integer default null,
  constraint unique_group_ticket unique (group_id, ticket_number)
);

-- global_treasury: Tracks balances of different payment accounts / methods
create table public.global_treasury (
  id uuid primary key default gen_random_uuid(),
  wallet_type text not null unique check (wallet_type in ('cash_in_hand', 'kishor_bank', 'dad_bank', 'mom_bank')),
  current_balance numeric not null default 0,
  pending_verification_balance numeric not null default 0,
  last_updated_by uuid references public.profiles(id) on delete set null
);

-- transactions: Cash flow details (collections, payouts, etc.)
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.chit_groups(id) on delete set null,
  profile_id uuid references public.profiles(id) on delete set null,
  group_member_id uuid references public.group_members(id) on delete set null,
  wallet_type text not null check (wallet_type in ('cash_in_hand', 'kishor_bank', 'dad_bank', 'mom_bank')),
  type text not null check (type in ('collection', 'payout', 'personal_draw', 'atm_withdrawal', 'transfer')),
  status text not null check (status in ('completed', 'pending_verification')),
  amount numeric not null check (amount > 0),
  notes text default null,
  denomination_log jsonb default null,
  voice_note_text text default null,
  verification_proof_url text default null,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

-- auction_logs: Monthly group bidding records
create table public.auction_logs (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.chit_groups(id) on delete cascade,
  month integer not null check (month >= 0),
  bid_stream jsonb not null default '[]'::jsonb,
  winning_bidder_id uuid not null references public.profiles(id) on delete restrict,
  winning_discount numeric not null check (winning_discount >= 0),
  runner_up_bidder_id uuid references public.profiles(id) on delete restrict,
  is_laaba_seetu boolean not null default false,
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

-- security_audit_logs: Logs of administrative database actions
create table public.security_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles(id) on delete set null,
  action_description text not null,
  target_table text not null,
  timestamp timestamp with time zone not null default timezone('utc'::text, now())
);

-- ==========================================
-- 2. Security Helper Functions
-- ==========================================

-- Get a user's role bypassing RLS (marked security definer)
create or replace function public.get_user_role(user_id uuid)
returns text as $$
  select role from public.profiles where id = user_id;
$$ language sql security definer set search_path = public;

-- Check if the current authenticated user is an admin or a manager
create or replace function public.is_admin_or_manager()
returns boolean as $$
  select coalesce(public.get_user_role(auth.uid()) in ('admin', 'manager'), false);
$$ language sql security definer set search_path = public;

-- Get the set of group IDs that a user belongs to, bypassing RLS to prevent recursion
create or replace function public.get_user_groups(user_id uuid)
returns table (group_id uuid) as $$
  select gm.group_id from public.group_members gm where gm.profile_id = user_id;
$$ language sql security definer set search_path = public;

-- ==========================================
-- 3. Triggers
-- ==========================================

-- Trigger: Automatically create public profile for new auth.users
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, phone_number, full_name, role)
  values (
    new.id,
    coalesce(
      nullif(new.phone, ''),
      nullif(new.raw_user_meta_data->>'phone_number', ''),
      'unknown_' || new.id::text
    ),
    coalesce(
      nullif(new.raw_user_meta_data->>'full_name', ''),
      'User_' || substr(new.id::text, 1, 8)
    ),
    coalesce(
      nullif(new.raw_user_meta_data->>'role', ''),
      'subscriber'
    )
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Trigger: Update treasury last_updated_by field automatically
create or replace function public.update_treasury_last_updated()
returns trigger as $$
begin
  new.last_updated_by = auth.uid();
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create or replace trigger on_treasury_updated
  before insert or update on public.global_treasury
  for each row execute procedure public.update_treasury_last_updated();

-- Trigger: Process audit logs for administrative inserts, updates, and deletes
create or replace function public.process_audit_log()
returns trigger as $$
declare
  log_description text;
  record_id uuid;
begin
  if TG_OP = 'DELETE' then
    record_id = old.id;
  else
    record_id = new.id;
  end if;

  log_description = TG_OP || ' action on record ID: ' || record_id::text;

  insert into public.security_audit_logs (admin_id, action_description, target_table, timestamp)
  values (
    auth.uid(),
    log_description,
    TG_TABLE_NAME,
    now()
  );
  
  if TG_OP = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$ language plpgsql security definer set search_path = public;

-- Attach audit log triggers to sensitive tables
create or replace trigger audit_profiles_changes
  after insert or update or delete on public.profiles
  for each row execute procedure public.process_audit_log();

create or replace trigger audit_chit_groups_changes
  after insert or update or delete on public.chit_groups
  for each row execute procedure public.process_audit_log();

create or replace trigger audit_global_treasury_changes
  after insert or update or delete on public.global_treasury
  for each row execute procedure public.process_audit_log();

create or replace trigger audit_transactions_changes
  after insert or update or delete on public.transactions
  for each row execute procedure public.process_audit_log();

create or replace trigger audit_auction_logs_changes
  after insert or update or delete on public.auction_logs
  for each row execute procedure public.process_audit_log();

-- ==========================================
-- 4. Row-Level Security (RLS) Policies
-- ==========================================

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.chit_groups enable row level security;
alter table public.group_members enable row level security;
alter table public.global_treasury enable row level security;
alter table public.transactions enable row level security;
alter table public.auction_logs enable row level security;
alter table public.security_audit_logs enable row level security;

-- A. Profiles Policies
create policy "Allow profiles SELECT access" on public.profiles
  for select
  using (
    auth.uid() = id
    or public.is_admin_or_manager()
    or id in (
      select profile_id 
      from public.group_members 
      where group_id in (select group_id from public.get_user_groups(auth.uid()))
    )
  );

create policy "Allow profiles write access to admin/manager" on public.profiles
  for all
  using (public.is_admin_or_manager())
  with check (public.is_admin_or_manager());

-- B. Chit Groups Policies
create policy "Allow chit_groups SELECT access" on public.chit_groups
  for select
  using (
    public.is_admin_or_manager()
    or id in (select group_id from public.get_user_groups(auth.uid()))
  );

create policy "Allow chit_groups write access to admin/manager" on public.chit_groups
  for all
  using (public.is_admin_or_manager())
  with check (public.is_admin_or_manager());

-- C. Group Members Policies
create policy "Allow group_members SELECT access" on public.group_members
  for select
  using (
    public.is_admin_or_manager()
    or group_id in (select group_id from public.get_user_groups(auth.uid()))
  );

create policy "Allow group_members write access to admin/manager" on public.group_members
  for all
  using (public.is_admin_or_manager())
  with check (public.is_admin_or_manager());

-- D. Global Treasury Policies (Admins/Managers only)
create policy "Allow global_treasury access to admin/manager" on public.global_treasury
  for all
  using (public.is_admin_or_manager())
  with check (public.is_admin_or_manager());

-- E. Transactions Policies
create policy "Allow transactions SELECT access" on public.transactions
  for select
  using (
    public.is_admin_or_manager()
    or profile_id = auth.uid()
    or group_id in (select group_id from public.get_user_groups(auth.uid()))
  );

create policy "Allow transactions write access to admin/manager" on public.transactions
  for all
  using (public.is_admin_or_manager())
  with check (public.is_admin_or_manager());

-- F. Auction Logs Policies
create policy "Allow auction_logs SELECT access" on public.auction_logs
  for select
  using (
    public.is_admin_or_manager()
    or group_id in (select group_id from public.get_user_groups(auth.uid()))
  );

create policy "Allow auction_logs write access to admin/manager" on public.auction_logs
  for all
  using (public.is_admin_or_manager())
  with check (public.is_admin_or_manager());

-- G. Security Audit Logs Policies (Admins/Managers read-only, write is system-only)
create policy "Allow security_audit_logs SELECT access to admin/manager" on public.security_audit_logs
  for select
  using (public.is_admin_or_manager());
