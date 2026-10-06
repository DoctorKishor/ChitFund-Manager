-- ==========================================
-- Supabase PostgreSQL Schema for Chit Fund Manager
-- Optimized for multi-admin role access control and audit tracking
-- ==========================================

-- Enable the UUID extension for primary keys
create extension if not exists "uuid-ossp";

-- ==========================================
-- 1. Tables and Integrity Constraints
-- ==========================================

-- custom_roles: Dynamic Discord-style roles & granular permissions
create table public.custom_roles (
  id text primary key,
  name text not null,
  description text default '',
  color text default '#6366F1',
  is_system boolean not null default false,
  is_privileged boolean not null default false,
  allowed_tabs text[] default '{}',
  allowed_actions text[] default '{}',
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

-- profiles: User profiles extending Supabase auth.users
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  phone_number text not null unique,
  full_name text not null,
  role text not null default 'subscriber' references public.custom_roles(id) on update cascade on delete set default,
  passbook_token uuid default null unique,
  passbook_issued_at timestamp with time zone default null,
  passbook_last_scanned_at timestamp with time zone,
  mpin varchar(6) default '1234',
  is_blocked boolean not null default false,
  is_deleted boolean not null default false,
  reschedule_acknowledgments jsonb default '{}'::jsonb,
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
  auction_day_of_month integer default 10,
  auction_time text default '19:00',
  next_auction_date date default null,
  next_auction_time text default '19:00',
  last_rescheduled_at timestamp with time zone default null,
  reschedule_reason text default null,
  is_live_auction_active boolean not null default false,
  live_auction_started_at timestamp with time zone default null,
  live_bid_stream jsonb default '[]'::jsonb,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  constraint check_member_count_eq_duration check (member_count = duration_months)
);

-- group_members: Memberships of profiles in specific chit groups
create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.chit_groups(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
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
  current_balance numeric not null default 0 check (current_balance >= 0),
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
  from_wallet text default null,
  to_wallet text default null,
  transfer_pair_id uuid default null,
  type text not null check (type in ('collection', 'payout', 'personal_draw', 'atm_withdrawal', 'transfer', 'transfer_in', 'organizer_profit')),
  status text not null check (status in ('completed', 'pending_verification')),
  amount numeric not null check (amount >= 0),
  notes text default null,
  denomination_log jsonb default null,
  voice_note_text text default null,
  verification_proof_url text default null,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  cycle_month integer default null,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  constraint check_collection_has_cycle_month check (type != 'collection' or cycle_month is not null)
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
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  constraint unique_auction_group_month unique (group_id, month)
);

-- login_attempts: MPIN rate limiting
create table if not exists public.login_attempts (
  id uuid primary key default gen_random_uuid(),
  phone_number text not null,
  attempted_at timestamp with time zone not null default timezone('utc'::text, now()),
  success boolean not null default false,
  ip_address text default null
);
create index if not exists idx_login_attempts_phone_time on public.login_attempts (phone_number, attempted_at);

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

-- Check if the current authenticated user is an admin, manager, or has an is_privileged role
create or replace function public.is_admin_or_manager()
returns boolean as $$
  select coalesce(
    exists (
      select 1
      from public.profiles p
      left join public.custom_roles cr on cr.id = p.role
      where p.id = auth.uid()
        and (
          p.role in ('admin', 'manager')
          or coalesce(cr.is_privileged, false) = true
        )
    ),
    false
  );
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
  select id, full_name, phone_number, role, passbook_token, coalesce(mpin, '1234') as mpin
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
      'passbookToken', v_profile.passbook_token,
      'mpin', v_profile.mpin,
      'isDefaultPin', (v_profile.mpin = '1234')
    )
  );
end;
$$ language plpgsql security definer set search_path = public;

-- Atomically pair a physical Passbook QR token to a member profile
create or replace function public.pair_passbook_qr(p_token uuid, p_profile_id uuid)
returns jsonb as $$
declare
  v_profile record;
  v_existing_profile record;
begin
  -- 1. Check target member profile
  select id, full_name, phone_number, role
  into v_profile
  from public.profiles
  where id = p_profile_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Member profile not found.');
  end if;

  -- 2. Check if this token is already linked to ANOTHER user profile
  select id, full_name, phone_number
  into v_existing_profile
  from public.profiles
  where passbook_token = p_token
    and id != p_profile_id;

  if found then
    return jsonb_build_object(
      'success', false,
      'already_linked', true,
      'linked_to_name', v_existing_profile.full_name,
      'linked_to_phone', v_existing_profile.phone_number,
      'error', 'This QR code is already linked to subscriber ' || v_existing_profile.full_name || ' (' || coalesce(v_existing_profile.phone_number, 'no phone') || '). Please use an unassigned passbook sticker.'
    );
  end if;

  -- 3. Check if this token in passbook_inventory is assigned to someone else
  select pi.assigned_to_profile_id, p.full_name, p.phone_number
  into v_existing_profile
  from public.passbook_inventory pi
  left join public.profiles p on p.id = pi.assigned_to_profile_id
  where pi.token = p_token
    and pi.is_assigned = true
    and pi.assigned_to_profile_id is not null
    and pi.assigned_to_profile_id != p_profile_id;

  if found then
    return jsonb_build_object(
      'success', false,
      'already_linked', true,
      'linked_to_name', coalesce(v_existing_profile.full_name, 'another member'),
      'linked_to_phone', v_existing_profile.phone_number,
      'error', 'This QR code is already assigned in inventory to ' || coalesce(v_existing_profile.full_name, 'another subscriber') || '. Please scan an unassigned passbook sticker.'
    );
  end if;

  -- 4. Unassign any prior token assigned to this profile in inventory (clean replacement)
  update public.passbook_inventory
  set is_assigned = false,
      assigned_to_profile_id = null,
      assigned_at = null
  where assigned_to_profile_id = p_profile_id
    and token != p_token;

  -- 5. Pair new token
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
    'PAIRED / RE-LINKED PASSBOOK QR: ' || p_token::text || ' to subscriber ' || v_profile.full_name || ' (' || coalesce(v_profile.phone_number, '') || ')',
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
  if p_mpin <> v_expected_mpin then
    return jsonb_build_object('success', false, 'error', 'Incorrect 4-digit PIN.');
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
      'passbookToken', v_profile.passbook_token,
      'mpin', v_profile.mpin,
      'isDefaultPin', (v_profile.mpin = '1234')
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
    'passbookIssuedAt', p.passbook_issued_at,
    'mpin', coalesce(p.mpin, '1234'),
    'isDefaultPin', (coalesce(p.mpin, '1234') = '1234'),
    'rescheduleAcknowledgments', coalesce(p.reschedule_acknowledgments, '{}'::jsonb)
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
    'customInstallment', gm.custom_installment,
    'physicalBookSynced', coalesce(gm.physical_book_synced, false),
    'monthlyInstallment', coalesce(gm.custom_installment, (cg.total_value / cg.member_count)),
    'auctionDayOfMonth', cg.auction_day_of_month,
    'auctionTime', cg.auction_time,
    'nextAuctionDate', cg.next_auction_date,
    'nextAuctionTime', cg.next_auction_time,
    'lastRescheduledAt', cg.last_rescheduled_at,
    'rescheduleReason', cg.reschedule_reason,
    'isLiveAuctionActive', coalesce(cg.is_live_auction_active, false),
    'liveAuctionStartedAt', cg.live_auction_started_at,
    'liveBidStream', coalesce(cg.live_bid_stream, '[]'::jsonb),
    'members', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', gm2.id,
        'profileId', gm2.profile_id,
        'fullName', coalesce(p2.full_name, 'Ticket #' || gm2.ticket_number),
        'ticketNumber', gm2.ticket_number,
        'hasWonRegular', gm2.has_won_regular
      ) order by gm2.ticket_number), '[]'::jsonb)
      from public.group_members gm2
      left join public.profiles p2 on p2.id = gm2.profile_id
      where gm2.group_id = cg.id
    )
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
    'cycleMonth', t.cycle_month,
    'notes', t.notes,
    'createdAt', t.created_at
  ) order by t.created_at desc), '[]'::jsonb)
  into v_transactions
  from public.transactions t
  left join public.chit_groups cg on cg.id = t.group_id
  where t.profile_id = p_profile_id
     or t.group_member_id in (select id from public.group_members where profile_id = p_profile_id);

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

-- Enable Realtime publication for all core tables
alter table public.chit_groups replica identity full;
alter table public.group_members replica identity full;
alter table public.profiles replica identity full;
alter table public.transactions replica identity full;
alter table public.auction_logs replica identity full;
alter table public.global_treasury replica identity full;

do $$
begin
  begin alter publication supabase_realtime add table public.chit_groups; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.group_members; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.profiles; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.transactions; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.auction_logs; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.global_treasury; exception when duplicate_object then null; end;
end $$;

-- ==========================================
-- 8. Global System Settings (Maintenance Mode)
-- ==========================================
create table if not exists public.system_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_by uuid references public.profiles(id)
);

insert into public.system_settings (key, value)
values ('maintenance_mode', '{"enabled": false, "message": "Scheduled upgrades in progress."}'::jsonb)
on conflict (key) do nothing;

-- ==========================================
-- 9. Secure Test Database Reset / Purge RPC
-- ==========================================
create or replace function public.reset_test_database()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id uuid;
  caller_role text;
  result jsonb;
begin
  -- 1. Security Check: Only authenticated admins can invoke this database reset
  v_caller_id := auth.uid();
  if v_caller_id is null then
    raise exception 'Unauthorized: Authentication session required.';
  end if;

  select role into caller_role from public.profiles where id = v_caller_id;
  if caller_role is distinct from 'admin' then
    raise exception 'Unauthorized: Only an administrator can execute a database reset.';
  end if;

  -- 2. Clear transactional and auction history
  delete from public.transactions;
  delete from public.auction_logs;
  
  -- 3. Clear memberships and chit groups
  delete from public.group_members;
  delete from public.chit_groups;
  
  -- 4. Clear passbook inventory if any
  delete from public.passbook_inventory;

  -- 5. Delete all test subscribers/non-auth profiles, but PRESERVE authenticated admin users
  delete from public.profiles 
  where id not in (select id from auth.users)
     or role = 'subscriber';

  -- 6. Reset all 4 treasury vaults to zero balance
  update public.global_treasury 
  set current_balance = 0, 
      pending_verification_balance = 0,
      last_updated_by = v_caller_id;

  -- Ensure all 4 default vaults exist in case any was missing
  insert into public.global_treasury (wallet_type, current_balance, pending_verification_balance, last_updated_by)
  values 
    ('cash_in_hand', 0, 0, v_caller_id),
    ('kishor_bank', 0, 0, v_caller_id),
    ('dad_bank', 0, 0, v_caller_id),
    ('mom_bank', 0, 0, v_caller_id)
  on conflict (wallet_type) do update 
  set current_balance = 0, pending_verification_balance = 0;

  -- 7. Reset audit logs and record the purge event
  delete from public.security_audit_logs;
  insert into public.security_audit_logs (admin_id, action_description, target_table, timestamp)
  values (v_caller_id, 'SYSTEM RESET: Full test database cleared. All chit groups, transactions, auctions, and test members wiped.', 'all', timezone('utc'::text, now()));

  result := jsonb_build_object(
    'success', true,
    'message', 'Database test data wiped successfully. Treasury reset to ₹0. System ready for fresh testing or production.'
  );

  return result;
end;
$$;

-- ==========================================
-- 10. Atomic Mutation RPC Functions
-- ==========================================

-- Atomic treasury wallet mutation function
create or replace function public.mutate_wallet_balance(
  p_wallet text,
  p_delta numeric,
  p_user_id uuid default auth.uid()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_bal numeric;
begin
  insert into public.global_treasury (wallet_type, current_balance, pending_verification_balance, last_updated_by)
  values (p_wallet, 0, 0, p_user_id)
  on conflict (wallet_type) do nothing;

  update public.global_treasury
  set current_balance = current_balance + p_delta,
      last_updated_by = p_user_id
  where wallet_type = p_wallet
  returning current_balance into v_new_bal;

  return jsonb_build_object(
    'success', true,
    'wallet', p_wallet,
    'new_balance', v_new_bal,
    'delta', p_delta
  );
end;
$$;

-- Atomic live bid append function
create or replace function public.append_live_bid(
  p_group_id uuid,
  p_bid jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated_stream jsonb;
begin
  update public.chit_groups
  set live_bid_stream = p_bid || coalesce(live_bid_stream, '[]'::jsonb)
  where id = p_group_id
  returning live_bid_stream into v_updated_stream;

  return jsonb_build_object(
    'success', true,
    'live_bid_stream', v_updated_stream
  );
end;
$$;

-- Atomic auction conclusion function
create or replace function public.conclude_auction_cycle(
  p_group_id uuid,
  p_month integer,
  p_next_month integer,
  p_winner_member_id uuid,
  p_winner_profile_id uuid,
  p_winning_discount numeric,
  p_is_completing boolean,
  p_is_laaba_seetu boolean,
  p_next_pool numeric,
  p_bid_stream jsonb default '[]'::jsonb,
  p_admin_id uuid default auth.uid()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_name text;
  v_winner_name text;
begin
  select name into v_group_name from public.chit_groups where id = p_group_id;
  select full_name into v_winner_name from public.profiles where id = p_winner_profile_id;

  update public.chit_groups
  set current_month = p_next_month,
      kai_iruppu_pool = p_next_pool,
      status = case when p_is_completing then 'completed' else 'active' end,
      is_live_auction_active = false,
      live_auction_started_at = null,
      live_bid_stream = '[]'::jsonb
  where id = p_group_id;

  if p_winner_member_id is not null then
    update public.group_members
    set has_won_regular = true
    where id = p_winner_member_id;
  end if;

  if p_winner_profile_id is not null then
    insert into public.auction_logs (
      group_id,
      month,
      bid_stream,
      winning_bidder_id,
      winning_discount,
      is_laaba_seetu,
      created_at
    ) values (
      p_group_id,
      p_month,
      p_bid_stream,
      p_winner_profile_id,
      p_winning_discount,
      p_is_laaba_seetu,
      now()
    );
  end if;

  insert into public.security_audit_logs (
    admin_id,
    action_description,
    target_table,
    timestamp
  ) values (
    p_admin_id,
    'AUCTION CLOSED: Group "' || coalesce(v_group_name, 'Group') || '" Month ' || p_month || ' won by ' || coalesce(v_winner_name, 'Subscriber') || ' with discount ₹' || p_winning_discount || '. Group advanced to Month ' || p_next_month,
    'auction_logs',
    now()
  );

  return jsonb_build_object('success', true);
end;
$$;

-- ==========================================
-- 11. MPIN Security & Management RPCs
-- ==========================================

-- Subscriber Self-Service MPIN Update
create or replace function public.update_subscriber_mpin(
  p_profile_id uuid,
  p_old_mpin text,
  p_new_mpin text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_mpin text;
  v_clean_new text;
  v_profile_name text;
begin
  v_clean_new := trim(p_new_mpin);
  if length(v_clean_new) < 4 or length(v_clean_new) > 6 or v_clean_new !~ '^\d+$' then
    return jsonb_build_object('success', false, 'error', 'PIN must be a 4 to 6 digit numeric code.');
  end if;

  select full_name, coalesce(mpin, '1234')
  into v_profile_name, v_current_mpin
  from public.profiles
  where id = p_profile_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Subscriber profile not found.');
  end if;

  -- Validate old PIN if provided
  if p_old_mpin is not null and trim(p_old_mpin) <> '' and trim(p_old_mpin) <> v_current_mpin then
    return jsonb_build_object('success', false, 'error', 'Current PIN is incorrect.');
  end if;

  update public.profiles
  set mpin = v_clean_new
  where id = p_profile_id;

  insert into public.security_audit_logs (admin_id, action_description, target_table, timestamp)
  values (
    p_profile_id,
    'PIN UPDATED: Subscriber ' || coalesce(v_profile_name, p_profile_id::text) || ' updated their login PIN.',
    'profiles',
    now()
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Security PIN updated successfully.',
    'new_mpin', v_clean_new
  );
end;
$$;

-- Administrative MPIN Reset / Override
create or replace function public.admin_update_member_mpin(
  p_profile_id uuid,
  p_new_mpin text,
  p_admin_id uuid default auth.uid()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clean_new text;
  v_member_name text;
  v_member_phone text;
begin
  v_clean_new := trim(p_new_mpin);
  if length(v_clean_new) < 4 or length(v_clean_new) > 6 or v_clean_new !~ '^\d+$' then
    return jsonb_build_object('success', false, 'error', 'PIN must be a 4 to 6 digit numeric code.');
  end if;

  select full_name, phone_number
  into v_member_name, v_member_phone
  from public.profiles
  where id = p_profile_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Member profile not found.');
  end if;

  update public.profiles
  set mpin = v_clean_new
  where id = p_profile_id;

  insert into public.security_audit_logs (admin_id, action_description, target_table, timestamp)
  values (
    p_admin_id,
    'ADMIN PIN OVERRIDE: PIN for subscriber ' || coalesce(v_member_name, 'Member') || ' (' || coalesce(v_member_phone, '') || ') set to "' || v_clean_new || '".',
    'profiles',
    now()
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Member PIN successfully updated to ' || v_clean_new,
    'new_mpin', v_clean_new
  );
end;
$$;

-- Atomic Wallet Balance Mutation with non-negative guard & row-level locking
create or replace function public.mutate_wallet_balance(
  p_wallet text,
  p_delta numeric,
  p_user_id uuid default auth.uid()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_bal numeric;
  v_new_bal numeric;
begin
  insert into public.global_treasury (wallet_type, current_balance, pending_verification_balance, last_updated_by)
  values (p_wallet, 0, 0, p_user_id)
  on conflict (wallet_type) do nothing;

  select current_balance into v_current_bal
  from public.global_treasury
  where wallet_type = p_wallet
  for update;

  v_new_bal := v_current_bal + p_delta;

  if v_new_bal < 0 then
    return jsonb_build_object(
      'success', false,
      'error', 'Insufficient balance in ' || p_wallet || '. Available: ₹' || v_current_bal || ', Requested debit: ₹' || abs(p_delta)
    );
  end if;

  update public.global_treasury
  set current_balance = v_new_bal,
      last_updated_by = p_user_id
  where wallet_type = p_wallet
  returning current_balance into v_new_bal;

  return jsonb_build_object(
    'success', true,
    'wallet', p_wallet,
    'new_balance', v_new_bal,
    'delta', p_delta
  );
end;
$$;

-- Authenticate by Phone and MPIN with Rate Limiting (10 failed attempts / 15 mins)
create or replace function public.authenticate_by_phone_and_mpin(
  p_phone text,
  p_mpin text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile record;
  v_recent_failures int;
begin
  select count(*) into v_recent_failures
  from public.login_attempts
  where phone_number = p_phone
    and success = false
    and attempted_at > (now() - interval '15 minutes');

  if v_recent_failures >= 10 then
    return jsonb_build_object(
      'success', false,
      'error', 'Too many failed login attempts. Account temporarily locked for 15 minutes.'
    );
  end if;

  select * into v_profile
  from public.profiles
  where phone_number = p_phone
    and is_deleted = false
  limit 1;

  if not found then
    insert into public.login_attempts (phone_number, success) values (p_phone, false);
    return jsonb_build_object('success', false, 'error', 'Invalid phone number or MPIN.');
  end if;

  if v_profile.is_blocked = true then
    return jsonb_build_object('success', false, 'error', 'Your subscriber account is suspended. Contact administration.');
  end if;

  if coalesce(v_profile.mpin, '1234') <> p_mpin then
    insert into public.login_attempts (phone_number, success) values (p_phone, false);
    return jsonb_build_object('success', false, 'error', 'Invalid phone number or MPIN.');
  end if;

  insert into public.login_attempts (phone_number, success) values (p_phone, true);

  return jsonb_build_object(
    'success', true,
    'profile', jsonb_build_object(
      'id', v_profile.id,
      'fullName', v_profile.full_name,
      'phoneNumber', v_profile.phone_number,
      'role', v_profile.role,
      'passbookToken', v_profile.passbook_token,
      'isDefaultPin', coalesce(v_profile.mpin, '1234') = '1234',
      'isBlocked', v_profile.is_blocked
    )
  );
end;
$$;





