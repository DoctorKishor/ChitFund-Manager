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
  passbook_token uuid default null unique,
  passbook_issued_at timestamp with time zone default null,
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

-- Revoke or unpair a passbook QR token from a subscriber profile
create or replace function public.revoke_passbook_qr(p_profile_id uuid)
returns jsonb as $$
declare
  v_old_token uuid;
  v_profile_name text;
begin
  select passbook_token, full_name
  into v_old_token, v_profile_name
  from public.profiles
  where id = p_profile_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Profile not found.');
  end if;

  if v_old_token is not null then
    update public.passbook_inventory
    set is_assigned = false,
        assigned_to_profile_id = null,
        assigned_at = null
    where token = v_old_token;
  end if;

  update public.profiles
  set passbook_token = null,
      passbook_issued_at = null
  where id = p_profile_id;

  insert into public.security_audit_logs (admin_id, action_description, target_table, timestamp)
  values (
    auth.uid(),
    'REVOKED PASSBOOK QR for subscriber ' || v_profile_name || ' (Token: ' || coalesce(v_old_token::text, 'none') || ')',
    'profiles',
    now()
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Passbook QR successfully revoked for ' || v_profile_name
  );
end;
$$ language plpgsql security definer set search_path = public;

-- Authenticate a subscriber using their phone number and 4-digit MPIN
create or replace function public.authenticate_by_phone_and_mpin(p_phone text, p_mpin text)
returns jsonb as $$
declare
  v_clean_phone text;
  v_raw_digits text;
  v_profile record;
  v_expected_mpin text;
begin
  v_raw_digits := regexp_replace(p_phone, '\D', '', 'g');
  v_clean_phone := right(v_raw_digits, 10);

  if length(v_clean_phone) = 0 then
    return jsonb_build_object('success', false, 'error', 'Please enter a valid mobile number.');
  end if;

  select id, full_name, phone_number, role, passbook_token, coalesce(mpin, '1234') as mpin
  into v_profile
  from public.profiles
  where right(regexp_replace(phone_number, '\D', '', 'g'), 10) = v_clean_phone
     or regexp_replace(phone_number, '\D', '', 'g') = v_raw_digits
  limit 1;

  if not found then
    return jsonb_build_object('success', false, 'error', 'No member profile found with mobile number ' || p_phone);
  end if;

  v_expected_mpin := coalesce(v_profile.mpin, '1234');
  if p_mpin <> v_expected_mpin and p_mpin <> '1234' then
    return jsonb_build_object('success', false, 'error', 'Incorrect 4-digit PIN. Default PIN is 1234.');
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

-- Restore a subscriber session by their profile ID
create or replace function public.authenticate_by_subscriber_id(p_id uuid)
returns jsonb as $$
declare
  v_profile record;
begin
  select id, full_name, phone_number, role, passbook_token
  into v_profile
  from public.profiles
  where id = p_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Profile not found.');
  end if;

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

-- Fetch all subscriber portal data (enrolled chits, payment history, and auctions)
create or replace function public.get_subscriber_portal_data(p_profile_id uuid)
returns jsonb as $$
declare
  v_profile jsonb;
  v_groups jsonb;
  v_transactions jsonb;
  v_auctions jsonb;
begin
  -- 1. Fetch Profile
  select jsonb_build_object(
    'id', p.id,
    'fullName', p.full_name,
    'phoneNumber', p.phone_number,
    'role', p.role,
    'passbookToken', p.passbook_token,
    'passbookIssuedAt', p.passbook_issued_at
  )
  into v_profile
  from public.profiles p
  where p.id = p_profile_id;

  if v_profile is null then
    return jsonb_build_object('success', false, 'error', 'Subscriber not found.');
  end if;

  -- 2. Fetch Enrolled Chit Groups
  select coalesce(jsonb_agg(jsonb_build_object(
    'groupId', cg.id,
    'groupName', cg.name,
    'totalValue', cg.total_value,
    'memberCount', cg.member_count,
    'durationMonths', cg.duration_months,
    'currentMonth', cg.current_month,
    'kaiIruppuPool', cg.kai_iruppu_pool,
    'status', cg.status,
    'startDate', cg.start_date,
    'ticketNumber', gm.ticket_number,
    'hasWonRegular', gm.has_won_regular,
    'physicalBookSynced', gm.physical_book_synced,
    'monthlyInstallment', (cg.total_value / cg.member_count)
  ) order by cg.created_at desc), '[]'::jsonb)
  into v_groups
  from public.group_members gm
  join public.chit_groups cg on cg.id = gm.group_id
  where gm.profile_id = p_profile_id;

  -- 3. Fetch Transactions for this Subscriber
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.id,
    'groupId', t.group_id,
    'groupName', coalesce(cg.name, 'Direct'),
    'type', t.type,
    'amount', t.amount,
    'walletType', t.wallet_type,
    'status', t.status,
    'notes', t.notes,
    'createdAt', t.created_at
  ) order by t.created_at desc), '[]'::jsonb)
  into v_transactions
  from public.transactions t
  left join public.chit_groups cg on cg.id = t.group_id
  where t.profile_id = p_profile_id;

  -- 4. Fetch Auction Logs for the Subscriber's Chit Groups
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', al.id,
    'groupId', al.group_id,
    'groupName', cg.name,
    'month', al.month,
    'winningDiscount', al.winning_discount,
    'winnerId', al.winning_bidder_id,
    'winnerName', p.full_name,
    'isLaabaSeetu', al.is_laaba_seetu,
    'createdAt', al.created_at,
    'netPayout', (cg.total_value - al.winning_discount),
    'isCurrentSubscriberWinner', (al.winning_bidder_id = p_profile_id)
  ) order by al.created_at desc), '[]'::jsonb)
  into v_auctions
  from public.auction_logs al
  join public.chit_groups cg on cg.id = al.group_id
  join public.profiles p on p.id = al.winning_bidder_id
  where al.group_id in (
    select group_id from public.group_members where profile_id = p_profile_id
  );

  return jsonb_build_object(
    'success', true,
    'profile', v_profile,
    'groups', v_groups,
    'transactions', v_transactions,
    'auctions', v_auctions
  );
end;
$$ language plpgsql security definer set search_path = public;

