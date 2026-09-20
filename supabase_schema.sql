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
  passbook_token uuid default gen_random_uuid() unique,
  passbook_issued_at timestamp with time zone default timezone('utc'::text, now()),
  passbook_last_scanned_at timestamp with time zone,
  mpin varchar(6) default '1234',
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

-- ==========================================
-- 5. Passbook Inventory & Token Authentication
-- ==========================================

create table if not exists public.passbook_inventory (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),
  batch_code text not null default 'BATCH_001',
  is_assigned boolean not null default false,
  assigned_to_profile_id uuid references public.profiles(id) on delete set null,
  assigned_at timestamp with time zone,
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

create index if not exists idx_passbook_inventory_token on public.passbook_inventory(token);
create index if not exists idx_passbook_inventory_batch on public.passbook_inventory(batch_code);

alter table public.passbook_inventory enable row level security;

create policy "Allow passbook_inventory access to admin/manager" on public.passbook_inventory
  for all
  using (public.is_admin_or_manager())
  with check (public.is_admin_or_manager());

create policy "Allow passbook_inventory SELECT access for token check" on public.passbook_inventory
  for select
  using (true);

-- Authenticate a subscriber using their Passbook QR UUID token
create or replace function public.authenticate_by_passbook_token(p_token uuid)
returns jsonb as $$
declare
  v_profile record;
begin
  select id, full_name, phone_number, role, passbook_token, mpin
  into v_profile
  from public.profiles
  where passbook_token = p_token;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Invalid or unassigned passbook QR code.');
  end if;

  update public.profiles
  set passbook_last_scanned_at = now()
  where id = v_profile.id;

  return jsonb_build_object(
    'success', true,
    'user', jsonb_build_object(
      'id', v_profile.id,
      'fullName', v_profile.full_name,
      'phoneNumber', v_profile.phone_number,
      'role', v_profile.role,
      'passbookToken', v_profile.passbook_token
    )
  );
end;
$$ language plpgsql security definer set search_path = public;

-- Atomically pair a physical Passbook QR token to a member profile
create or replace function public.pair_passbook_qr(p_token uuid, p_profile_id uuid)
returns jsonb as $$
declare
  v_profile record;
begin
  select id, full_name, phone_number, role
  into v_profile
  from public.profiles
  where id = p_profile_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Member profile not found.');
  end if;

  insert into public.passbook_inventory (token, batch_code, is_assigned, assigned_to_profile_id, assigned_at)
  values (p_token, 'MANUAL_PAIR', true, p_profile_id, now())
  on conflict (token) do update
  set is_assigned = true,
      assigned_to_profile_id = p_profile_id,
      assigned_at = now();

  update public.profiles
  set passbook_token = p_token,
      passbook_issued_at = now()
  where id = p_profile_id;

  insert into public.security_audit_logs (admin_id, action_description, target_table, timestamp)
  values (
    auth.uid(),
    'PAIRED PASSBOOK QR: ' || p_token::text || ' to subscriber ' || v_profile.full_name || ' (' || v_profile.phone_number || ')',
    'profiles',
    now()
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Passbook QR successfully paired to ' || v_profile.full_name,
    'token', p_token
  );
end;
$$ language plpgsql security definer set search_path = public;

-- Bulk generate a batch of unassigned blank passbook tokens for print inventory
create or replace function public.generate_blank_passbook_batch(p_count int, p_batch_code text default 'BATCH_001')
returns jsonb as $$
declare
  i int;
  v_token uuid;
  v_tokens uuid[] := array[]::uuid[];
begin
  if p_count <= 0 or p_count > 1000 then
    return jsonb_build_object('success', false, 'error', 'Count must be between 1 and 1000.');
  end if;

  for i in 1..p_count loop
    v_token := gen_random_uuid();
    insert into public.passbook_inventory (token, batch_code, is_assigned, created_at)
    values (v_token, p_batch_code, false, now());
    v_tokens := array_append(v_tokens, v_token);
  end loop;

  return jsonb_build_object(
    'success', true,
    'batch_code', p_batch_code,
    'count', p_count,
    'tokens', v_tokens
  );
end;
$$ language plpgsql security definer set search_path = public;
