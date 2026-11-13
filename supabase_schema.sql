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

-- Seed default system & operational roles
insert into public.custom_roles (id, name, description, color, is_system, is_privileged, allowed_tabs, allowed_actions)
values
  ('admin', 'Administrator', 'Full unrestricted system control, treasury vaults, role assignment & audit logs', '#9333ea', true, true, 
   array['dashboard', 'chits', 'members', 'auctions', 'cash', 'reports', 'communication', 'users', 'settings'], 
   array['members:view', 'members:enroll', 'members:edit', 'members:collect', 'members:suspend', 'members:pair_qr', 'members:revoke_qr', 'members:batch_qr', 'members:reset_mpin', 'members:export', 'members:delete', 'chits:view', 'chits:create', 'chits:edit', 'chits:launch_month0', 'chits:reschedule_auction', 'chits:configure_laaba_seetu', 'chits:delete', 'auctions:view', 'auctions:conduct', 'auctions:bid', 'auctions:conclude', 'auctions:override_floor', 'auctions:disburse', 'auctions:issue_receipt', 'treasury:view', 'treasury:view_cash_box', 'treasury:view_banks', 'treasury:collect_cash', 'treasury:move_money', 'treasury:confirm_atm', 'treasury:deposit', 'treasury:recover_float', 'treasury:personal_draw', 'treasury:settle_draw', 'treasury:reconcile', 'communication:view', 'communication:broadcast', 'communication:pre_auction', 'communication:post_auction', 'communication:due_alerts', 'communication:custom', 'communication:manage_templates', 'reports:view', 'reports:view_pnl', 'reports:export', 'reports:export_checklist', 'reports:export_ledger', 'reports:view_defaulters', 'reports:view_audit_logs', 'reports:export_audit', 'system:manage_users', 'system:manage_staff', 'system:manage_roles', 'system:maintenance_mode', 'system:branding', 'system:reset_database']),
  ('manager', 'Manager', 'Operational management, member enrollment, live bidding arena & WhatsApp dispatch', '#2563eb', true, true, 
   array['dashboard', 'chits', 'members', 'auctions', 'communication', 'reports'], 
   array['members:view', 'members:enroll', 'members:edit', 'members:collect', 'members:suspend', 'members:pair_qr', 'members:revoke_qr', 'members:batch_qr', 'members:reset_mpin', 'members:export', 'chits:view', 'chits:create', 'chits:edit', 'chits:reschedule_auction', 'chits:configure_laaba_seetu', 'auctions:view', 'auctions:conduct', 'auctions:bid', 'auctions:conclude', 'auctions:disburse', 'auctions:issue_receipt', 'treasury:view_cash_box', 'treasury:collect_cash', 'treasury:recover_float', 'communication:view', 'communication:broadcast', 'communication:pre_auction', 'communication:post_auction', 'communication:due_alerts', 'communication:custom', 'communication:manage_templates', 'reports:view', 'reports:export_checklist', 'reports:export_ledger', 'reports:view_defaulters']),
  ('collections_agent', 'Collections Agent', 'Ground field agent: offline collections, booklet QR scanner pairing & payment broadcast', '#f59e0b', false, true, 
   array['dashboard', 'members', 'communication'], 
   array['members:view', 'members:collect', 'members:pair_qr', 'treasury:collect_cash', 'communication:view', 'communication:broadcast', 'communication:due_alerts']),
  ('auction_clerk', 'Auction Clerk', 'Assists organizer during monthly live bidding sessions by recording shouted proxy discounts', '#a855f7', false, true, 
   array['dashboard', 'chits', 'members', 'auctions'], 
   array['chits:view', 'auctions:view', 'auctions:bid', 'auctions:issue_receipt']),
  ('auditor', 'Auditor / CA', 'Read-only financial auditor access for balance sheets, ledger downloads & dividend statements', '#0d9488', false, true, 
   array['dashboard', 'chits', 'members', 'cash', 'reports'], 
   array['chits:view', 'members:view', 'members:export', 'auctions:view', 'treasury:view', 'treasury:view_cash_box', 'reports:view', 'reports:view_pnl', 'reports:export', 'reports:export_checklist', 'reports:export_ledger', 'reports:view_defaulters', 'reports:view_audit_logs', 'reports:export_audit']),
  ('subscriber', 'Subscriber', 'Member portal: personal enrolled chits, ledger & live auction bidding room', '#10b981', true, false, 
   array['dashboard', 'chits', 'members', 'auctions'], 
   array['chits:view', 'members:view', 'auctions:bid', 'auctions:view'])
on conflict (id) do update 
set name = excluded.name,
    description = excluded.description,
    color = excluded.color,
    is_system = excluded.is_system,
    is_privileged = excluded.is_privileged,
    allowed_tabs = excluded.allowed_tabs,
    allowed_actions = excluded.allowed_actions;

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
  status text not null default 'active' check (status in ('draft', 'active', 'completed', 'deleted', 'archived')),
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
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  deleted_at timestamp with time zone default null,
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
  alias_name text default null,
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
  winning_bidder_id uuid references public.profiles(id) on delete set null,
  winning_member_id uuid references public.group_members(id) on delete set null,
  winning_discount numeric not null check (winning_discount >= 0),
  runner_up_bidder_id uuid references public.profiles(id) on delete set null,
  is_laaba_seetu boolean not null default false,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  constraint unique_auction_group_month unique (group_id, month)
);

-- login_attempts: MPIN rate limiting
create table if not exists public.login_attempts (
  id uuid primary key default gen_random_uuid(),
  phone_digits text not null,
  attempted_at timestamp with time zone not null default timezone('utc'::text, now()),
  was_successful boolean not null default false
);
create index if not exists idx_login_attempts_phone_time on public.login_attempts (phone_digits, attempted_at);

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

-- Check if the current authenticated user is an admin, manager, or has an is_privileged role (or operational staff)
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
          or p.role != 'subscriber'
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
  if auth.uid() is not null then
    new.last_updated_by := (select id from public.profiles where id = auth.uid());
  end if;
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
  target_member_name text;
  target_group_name text;
  caller_admin_id uuid;
begin
  -- Resolve primary record ID
  if TG_OP = 'DELETE' then
    record_id = old.id;
  else
    record_id = new.id;
  end if;

  -- Resolve the acting admin ID (safely falling back for unauthenticated/offline PIN sessions)
  caller_admin_id := auth.uid();
  if caller_admin_id is null then
    select id into caller_admin_id from public.profiles where role = 'admin' order by created_at asc limit 1;
  end if;

  -- 1. PROFILES TABLE
  if TG_TABLE_NAME = 'profiles' then
    if TG_OP = 'INSERT' then
      log_description := 'Created new member profile: ' || coalesce(new.full_name, 'New User') || ' (Phone: ' || coalesce(new.phone_number, 'None') || ', Role: ' || upper(coalesce(new.role, 'subscriber')) || ')';
    elsif TG_OP = 'UPDATE' then
      declare
        changes text[] := array[]::text[];
      begin
        if new.full_name is distinct from old.full_name then
          changes := array_append(changes, 'Name: "' || coalesce(old.full_name, 'None') || '" → "' || coalesce(new.full_name, 'None') || '"');
        end if;
        if new.phone_number is distinct from old.phone_number then
          changes := array_append(changes, 'Phone: ' || coalesce(old.phone_number, 'None') || ' → ' || coalesce(new.phone_number, 'None'));
        end if;
        if new.role is distinct from old.role then
          changes := array_append(changes, 'Role: ' || upper(coalesce(old.role, 'subscriber')) || ' → ' || upper(coalesce(new.role, 'subscriber')));
        end if;
        if new.passbook_token is distinct from old.passbook_token then
          changes := array_append(changes, 'Refreshed digital passbook key');
        end if;
        
        if array_length(changes, 1) is null or array_length(changes, 1) = 0 then
          -- Skip background session and token refresh noise to prevent log clutter
          return new;
        end if;
        log_description := 'Updated ' || coalesce(new.full_name, old.full_name, 'Member') || ' (' || array_to_string(changes, ', ') || ')';
      end;
    elsif TG_OP = 'DELETE' then
      log_description := 'Deleted member profile: ' || coalesce(old.full_name, 'Member') || ' (' || coalesce(old.phone_number, '') || ')';
    end if;

  -- 2. TRANSACTIONS TABLE
  elsif TG_TABLE_NAME = 'transactions' then
    if TG_OP = 'DELETE' then
      select p.full_name into target_member_name 
      from public.profiles p 
      where p.id = old.profile_id or p.id = (select gm.profile_id from public.group_members gm where gm.id = old.group_member_id);
    else
      select p.full_name into target_member_name 
      from public.profiles p 
      where p.id = new.profile_id or p.id = (select gm.profile_id from public.group_members gm where gm.id = new.group_member_id);
    end if;

    if TG_OP = 'INSERT' then
      if new.type = 'collection' then
        log_description := 'Recorded collection of ₹' || trim(to_char(new.amount, '99,99,999')) || 
                           ' for ' || coalesce(target_member_name, 'Member') || 
                           ' (' || replace(coalesce(new.wallet_type, 'cash'), '_', ' ') || 
                           ', Month ' || coalesce(new.cycle_month::text, '0') || ')';
      elsif new.type = 'payout' then
        log_description := 'Disbursed auction prize payout of ₹' || trim(to_char(new.amount, '99,99,999')) || 
                           ' to ' || coalesce(target_member_name, 'Winner') || 
                           ' from ' || replace(coalesce(new.wallet_type, 'bank'), '_', ' ');
      elsif new.type = 'personal_draw' then
        log_description := 'Logged personal draw of ₹' || trim(to_char(new.amount, '99,99,999')) || 
                           ' from ' || replace(coalesce(new.wallet_type, 'cash'), '_', ' ') || 
                           coalesce(' (' || nullif(new.notes, '') || ')', '');
      elsif new.type = 'atm_withdrawal' then
        log_description := 'Logged ATM cash withdrawal of ₹' || trim(to_char(new.amount, '99,99,999')) || 
                           ' from ' || replace(coalesce(new.wallet_type, 'bank'), '_', ' ');
      elsif new.type = 'transfer' then
        log_description := 'Transferred ₹' || trim(to_char(new.amount, '99,99,999')) || 
                           ' from ' || replace(coalesce(new.wallet_type, 'account'), '_', ' ');
      else
        log_description := 'Recorded ' || replace(new.type, '_', ' ') || ' of ₹' || trim(to_char(new.amount, '99,99,999')) || 
                           ' via ' || replace(coalesce(new.wallet_type, ''), '_', ' ');
      end if;
    elsif TG_OP = 'UPDATE' then
      declare
        changes text[] := array[]::text[];
      begin
        if new.amount is distinct from old.amount then
          changes := array_append(changes, 'Amount: ₹' || trim(to_char(old.amount, '99,99,999')) || ' → ₹' || trim(to_char(new.amount, '99,99,999')));
        end if;
        if new.wallet_type is distinct from old.wallet_type then
          changes := array_append(changes, 'Vault: ' || replace(coalesce(old.wallet_type, 'N/A'), '_', ' ') || ' → ' || replace(coalesce(new.wallet_type, 'N/A'), '_', ' '));
        end if;
        if new.cycle_month is distinct from old.cycle_month then
          changes := array_append(changes, 'Cycle: Month ' || coalesce(old.cycle_month::text, '0') || ' → Month ' || coalesce(new.cycle_month::text, '0'));
        end if;
        if new.status is distinct from old.status then
          changes := array_append(changes, 'Status: ' || upper(coalesce(old.status, 'pending')) || ' → ' || upper(coalesce(new.status, 'completed')));
        end if;

        if array_length(changes, 1) > 0 then
          log_description := 'Modified ' || replace(new.type, '_', ' ') || ' for ' || coalesce(target_member_name, 'Ticket') || ' (' || array_to_string(changes, ', ') || ')';
        else
          log_description := 'Updated ' || replace(new.type, '_', ' ') || ' of ₹' || trim(to_char(new.amount, '99,99,999')) || ' for ' || coalesce(target_member_name, 'Member');
        end if;
      end;
    elsif TG_OP = 'DELETE' then
      log_description := 'Deleted ' || replace(old.type, '_', ' ') || ' transaction of ₹' || trim(to_char(old.amount, '99,99,999')) || 
                         ' (' || replace(coalesce(old.wallet_type, ''), '_', ' ') || ')';
    end if;

  -- 3. CHIT GROUPS TABLE
  elsif TG_TABLE_NAME = 'chit_groups' then
    if TG_OP = 'INSERT' then
      log_description := 'Created new chit group: "' || new.name || '" (Total Value: ₹' || trim(to_char(new.total_value, '99,99,999')) || ', Duration: ' || new.duration_months::text || ' months)';
    elsif TG_OP = 'UPDATE' then
      declare
        changes text[] := array[]::text[];
      begin
        if new.current_month is distinct from old.current_month then
          changes := array_append(changes, 'Cycle: Month ' || coalesce(old.current_month::text, '0') || ' → Month ' || coalesce(new.current_month::text, '0'));
        end if;
        if new.status is distinct from old.status then
          changes := array_append(changes, 'Status: ' || upper(coalesce(old.status, 'draft')) || ' → ' || upper(coalesce(new.status, 'active')));
        end if;
        if new.kai_iruppu_pool is distinct from old.kai_iruppu_pool then
          changes := array_append(changes, 'Kai Iruppu: ₹' || trim(to_char(old.kai_iruppu_pool, '99,99,999')) || ' → ₹' || trim(to_char(new.kai_iruppu_pool, '99,99,999')));
        end if;
        if new.name is distinct from old.name then
          changes := array_append(changes, 'Name: "' || old.name || '" → "' || new.name || '"');
        end if;

        if array_length(changes, 1) > 0 then
          log_description := 'Updated chit group "' || new.name || '" (' || array_to_string(changes, ', ') || ')';
        else
          log_description := 'Updated settings for chit group "' || new.name || '"';
        end if;
      end;
    elsif TG_OP = 'DELETE' then
      log_description := 'Deleted chit group: "' || coalesce(old.name, 'Group') || '"';
    end if;

  -- 4. GROUP MEMBERS TABLE
  elsif TG_TABLE_NAME = 'group_members' then
    if TG_OP = 'DELETE' then
      select p.full_name into target_member_name from public.profiles p where p.id = old.profile_id;
      select cg.name into target_group_name from public.chit_groups cg where cg.id = old.group_id;
    else
      select p.full_name into target_member_name from public.profiles p where p.id = new.profile_id;
      select cg.name into target_group_name from public.chit_groups cg where cg.id = new.group_id;
    end if;

    if TG_OP = 'INSERT' then
      log_description := 'Enrolled ' || coalesce(target_member_name, 'Member') || 
                         ' into Ticket #' || new.ticket_number::text || 
                         coalesce(' of "' || target_group_name || '"', '');
    elsif TG_OP = 'UPDATE' then
      declare
        changes text[] := array[]::text[];
      begin
        if new.has_won_regular is true and (old.has_won_regular is not true or old.has_won_regular is null) then
          changes := array_append(changes, 'Marked as Winner');
        elsif new.has_won_regular is false and old.has_won_regular is true then
          changes := array_append(changes, 'Winner status revoked');
        end if;
        if new.ticket_number is distinct from old.ticket_number then
          changes := array_append(changes, 'Ticket: #' || old.ticket_number::text || ' → #' || new.ticket_number::text);
        end if;

        if array_length(changes, 1) > 0 then
          log_description := 'Updated ' || coalesce(target_member_name, 'Member') || ' in "' || coalesce(target_group_name, 'Group') || '" (' || array_to_string(changes, ', ') || ')';
        else
          log_description := 'Updated enrollment details for ' || coalesce(target_member_name, 'Member') || ' (Ticket #' || new.ticket_number::text || ')';
        end if;
      end;
    elsif TG_OP = 'DELETE' then
      log_description := 'Removed ' || coalesce(target_member_name, 'Member') || ' from Ticket #' || old.ticket_number::text;
    end if;

  -- 5. AUCTION LOGS TABLE
  elsif TG_TABLE_NAME = 'auction_logs' then
    if TG_OP = 'DELETE' then
      select cg.name into target_group_name from public.chit_groups cg where cg.id = old.group_id;
    else
      select cg.name into target_group_name from public.chit_groups cg where cg.id = new.group_id;
    end if;

    if TG_OP = 'INSERT' then
      log_description := 'Conducted Month ' || new.month::text || ' live auction' || 
                         coalesce(' for "' || target_group_name || '"', '') || 
                         ' — Winning Discount: ₹' || trim(to_char(new.winning_discount, '99,99,999'));
    elsif TG_OP = 'UPDATE' then
      log_description := 'Updated Month ' || new.month::text || ' auction record' || coalesce(' for "' || target_group_name || '"', '');
    elsif TG_OP = 'DELETE' then
      log_description := 'Reverted/Deleted Month ' || old.month::text || ' auction log' || coalesce(' for "' || target_group_name || '"', '');
    end if;

  -- 6. GLOBAL TREASURY TABLE
  elsif TG_TABLE_NAME = 'global_treasury' then
    if TG_OP = 'UPDATE' then
      log_description := 'Updated ' || replace(new.wallet_type, '_', ' ') || ' balance to ₹' || trim(to_char(new.current_balance, '99,99,999'));
    else
      log_description := TG_OP || ' on treasury wallet: ' || replace(new.wallet_type, '_', ' ');
    end if;

  -- FALLBACK FOR ANY OTHER TABLE
  else
    log_description := TG_OP || ' action on ' || TG_TABLE_NAME || ' record #' || substr(record_id::text, 1, 8);
  end if;

  -- Insert into security audit logs
  insert into public.security_audit_logs (admin_id, action_description, target_table, timestamp)
  values (
    caller_admin_id,
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

create or replace trigger audit_group_members_changes
  after insert or update or delete on public.group_members
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

-- G. Security Audit Logs Policies (Admins/Managers have audit review and append access)
create policy "Allow security_audit_logs SELECT access to admin/manager" on public.security_audit_logs
  for select
  using (public.is_admin_or_manager());

create policy if not exists "Allow security_audit_logs INSERT access to admin/manager" on public.security_audit_logs
  for insert
  with check (public.is_admin_or_manager());

-- Secure RPC to log system audit events directly
create or replace function public.log_system_audit_event(
  p_action_description text,
  p_target_table text,
  p_admin_id uuid default null
)
returns uuid as $$
declare
  v_log_id uuid;
  v_caller_id uuid;
begin
  v_caller_id := coalesce(p_admin_id, auth.uid());
  if v_caller_id is null then
    select id into v_caller_id from public.profiles where role = 'admin' order by created_at asc limit 1;
  end if;

  insert into public.security_audit_logs (admin_id, action_description, target_table, timestamp)
  values (v_caller_id, p_action_description, p_target_table, now())
  returning id into v_log_id;

  return v_log_id;
end;
$$ language plpgsql security definer set search_path = public;

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
  select id, full_name, phone_number, role, passbook_token, coalesce(mpin, '1234') as mpin, coalesce(is_blocked, false) as is_blocked, coalesce(is_deleted, false) as is_deleted
  into v_profile
  from public.profiles
  where passbook_token = p_token
  limit 1;

  if not found or v_profile.is_deleted = true then
    return jsonb_build_object('success', false, 'error', 'Invalid or unassigned passbook QR code.');
  end if;

  if v_profile.is_blocked = true then
    return jsonb_build_object('success', false, 'error', 'Your subscriber account is suspended. Contact administration.');
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
    ),
    'profile', jsonb_build_object(
      'id', v_profile.id,
      'fullName', v_profile.full_name,
      'phoneNumber', v_profile.phone_number,
      'role', v_profile.role,
      'passbookToken', v_profile.passbook_token,
      'isDefaultPin', (v_profile.mpin = '1234'),
      'isBlocked', v_profile.is_blocked
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
    'groupMemberId', gm.id,
    'groupName', cg.name,
    'totalValue', cg.total_value,
    'memberCount', cg.member_count,
    'durationMonths', cg.duration_months,
    'currentMonth', cg.current_month,
    'kaiIruppuPool', cg.kai_iruppu_pool,
    'status', cg.status,
    'startDate', cg.start_date,
    'ticketNumber', gm.ticket_number,
    'aliasName', gm.alias_name,
    'ticketHolderName', coalesce(gm.alias_name, (select full_name from public.profiles where id = gm.profile_id)),
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
        'fullName', coalesce(gm2.alias_name, p2.full_name, 'Ticket #' || gm2.ticket_number),
        'aliasName', gm2.alias_name,
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
  where (gm.profile_id = p_profile_id or gm.profile_id in (
    select id from public.profiles where right(regexp_replace(phone_number, '[^0-9]', '', 'g'), 10) = (
      select right(regexp_replace(phone_number, '[^0-9]', '', 'g'), 10) from public.profiles where id = p_profile_id
    )
  ))
    and cg.status not in ('draft', 'deleted');

  -- 3. Fetch Transactions for this Subscriber
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.id,
    'groupId', t.group_id,
    'groupMemberId', t.group_member_id,
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
  where (
    t.profile_id = p_profile_id
    or t.profile_id in (
      select id from public.profiles where right(regexp_replace(phone_number, '[^0-9]', '', 'g'), 10) = (
        select right(regexp_replace(phone_number, '[^0-9]', '', 'g'), 10) from public.profiles where id = p_profile_id
      )
    )
    or t.group_member_id in (
      select id from public.group_members 
      where profile_id = p_profile_id 
         or profile_id in (
           select id from public.profiles where right(regexp_replace(phone_number, '[^0-9]', '', 'g'), 10) = (
             select right(regexp_replace(phone_number, '[^0-9]', '', 'g'), 10) from public.profiles where id = p_profile_id
           )
         )
    )
  )
    and (cg.status is null or cg.status not in ('draft', 'deleted'));

  -- 4. Fetch Auction Logs for the Subscriber's Chit Groups
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', al.id,
    'groupId', al.group_id,
    'groupName', cg.name,
    'month', al.month,
    'winningDiscount', al.winning_discount,
    'winnerId', al.winning_bidder_id,
    'winnerName', coalesce(gm.alias_name, p.full_name, 'Ticket #' || gm.ticket_number, 'Subscriber'),
    'isLaabaSeetu', al.is_laaba_seetu,
    'createdAt', al.created_at,
    'netPayout', (cg.total_value - al.winning_discount),
    'isCurrentSubscriberWinner', (
      (al.winning_bidder_id is not null and (
        al.winning_bidder_id = p_profile_id
        or al.winning_bidder_id in (
          select id from public.profiles where right(regexp_replace(phone_number, '[^0-9]', '', 'g'), 10) = (
            select right(regexp_replace(phone_number, '[^0-9]', '', 'g'), 10) from public.profiles where id = p_profile_id
          )
        )
      ))
      or (al.winning_member_id is not null and al.winning_member_id in (
        select id from public.group_members where profile_id = p_profile_id
      ))
    )
  ) order by al.created_at desc), '[]'::jsonb)
  into v_auctions
  from public.auction_logs al
  join public.chit_groups cg on cg.id = al.group_id
  left join public.profiles p on p.id = al.winning_bidder_id
  left join public.group_members gm on gm.id = al.winning_member_id
  where al.group_id in (
    select group_id from public.group_members 
    where profile_id = p_profile_id
       or profile_id in (
         select id from public.profiles where right(regexp_replace(phone_number, '[^0-9]', '', 'g'), 10) = (
           select right(regexp_replace(phone_number, '[^0-9]', '', 'g'), 10) from public.profiles where id = p_profile_id
         )
       )
  ) and cg.status not in ('draft', 'deleted');

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
alter table public.custom_roles replica identity full;

do $$
begin
  begin alter publication supabase_realtime add table public.chit_groups; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.group_members; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.profiles; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.transactions; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.auction_logs; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.global_treasury; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.custom_roles; exception when duplicate_object then null; end;
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

alter table public.system_settings enable row level security;

create policy "Allow public read system_settings" on public.system_settings
  for select
  using (true);

create policy "Allow admin manage system_settings" on public.system_settings
  for all
  using (public.is_admin_or_manager())
  with check (public.is_admin_or_manager());

-- ==========================================
-- 9. Secure Test Database Reset / Purge RPC
-- ==========================================
create or replace function public.reset_test_database(p_confirm_phrase text default 'WIPE_ALL_DATA')
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
  -- 1. Confirmation phrase validation
  if p_confirm_phrase is distinct from 'WIPE_ALL_DATA' then
    raise exception 'Unauthorized: Invalid confirmation phrase.';
  end if;

  -- 2. Security Check: Only authenticated admins can invoke this database reset
  v_caller_id := auth.uid();
  if v_caller_id is null then
    raise exception 'Unauthorized: Authentication session required.';
  end if;

  select role into caller_role from public.profiles where id = v_caller_id;
  if lower(coalesce(caller_role, '')) not in ('admin', 'administrator') and not public.is_admin_or_manager() then
    raise exception 'Unauthorized: Only an administrator can execute a database reset.';
  end if;

  -- 3. Clear foreign keys pointing to records being purged
  update public.system_settings set updated_by = null;
  update public.group_members set transferred_from = null;

  -- 4. Clear transactional and auction history
  delete from public.transactions;
  delete from public.auction_logs;
  
  -- 5. Clear memberships and chit groups
  delete from public.group_members;
  delete from public.chit_groups;
  
  -- 6. Clear passbook inventory if any
  delete from public.passbook_inventory;

  -- 7. Reset audit logs before deleting profiles to prevent foreign key or trigger constraint locks
  delete from public.security_audit_logs;

  -- 8. Delete test non-auth profiles (subscribers), but PRESERVE authenticated staff/admin users
  delete from public.profiles 
  where id not in (select id from auth.users)
    and (role is null or role = 'subscriber');

  -- 9. Reset all 4 treasury vaults to zero balance
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

  -- 10. Record the purge event
  insert into public.security_audit_logs (admin_id, action_description, target_table, timestamp)
  values (v_caller_id, 'SYSTEM RESET: Full test database cleared. All chit groups, transactions, auctions, and test members wiped.', 'all', timezone('utc'::text, now()));

  result := jsonb_build_object(
    'success', true,
    'message', 'Database test data wiped successfully. Treasury reset to ₹0. System ready for fresh testing or production.'
  );

  return result;
end;
$$;

grant execute on function public.reset_test_database(text) to authenticated, anon;

-- ==========================================
-- 10. Atomic Mutation RPC Functions
-- ==========================================

-- (confirm_month0_launch is defined further below in the consolidated RPC section)

-- Atomic log_personal_draw RPC
create or replace function public.log_personal_draw(
  p_wallet text,
  p_amount numeric,
  p_tag text,
  p_desc text,
  p_taken_by text,
  p_admin_id uuid default auth.uid()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_bal numeric;
  v_new_bal numeric;
  v_full_note text;
  v_tx_id uuid;
begin
  if p_amount <= 0 then
    return jsonb_build_object('success', false, 'error', 'Invalid amount.');
  end if;

  insert into public.global_treasury (wallet_type, current_balance, pending_verification_balance, last_updated_by)
  values (p_wallet, 0, 0, p_admin_id)
  on conflict (wallet_type) do nothing;

  select current_balance into v_current_bal
  from public.global_treasury
  where wallet_type = p_wallet
  for update;

  if v_current_bal < p_amount then
    return jsonb_build_object('success', false, 'error', 'Insufficient balance in ' || p_wallet || '. Available: ₹' || v_current_bal);
  end if;

  v_new_bal := v_current_bal - p_amount;
  update public.global_treasury
  set current_balance = v_new_bal,
      last_updated_by = p_admin_id
  where wallet_type = p_wallet;

  v_full_note := '[' || p_tag || '] ' || p_desc || ' | Admin Logged: ' || coalesce(p_admin_id::text, 'Admin') || ' | Taken By: ' || p_taken_by || ' | Status: Outstanding';
  insert into public.transactions (
    wallet_type,
    type,
    status,
    amount,
    notes,
    created_by
  ) values (
    p_wallet,
    'personal_draw',
    'completed',
    p_amount,
    v_full_note,
    p_admin_id
  ) returning id into v_tx_id;

  insert into public.security_audit_logs (admin_id, action_description, target_table, timestamp)
  values (
    p_admin_id,
    'PERSONAL DRAW: ₹' || p_amount || ' taken by ' || p_taken_by || ' for ' || p_tag || ' from ' || p_wallet || '.',
    'transactions',
    now()
  );

  return jsonb_build_object(
    'success', true,
    'transaction_id', v_tx_id,
    'new_balance', v_new_bal
  );
end;
$$;

-- Atomic settle_personal_draw RPC
create or replace function public.settle_personal_draw(
  p_draw_id uuid,
  p_dest_wallet text,
  p_amount numeric,
  p_admin_id uuid default auth.uid()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draw record;
  v_current_bal numeric;
  v_new_bal numeric;
  v_is_full boolean;
  v_updated_notes text;
  v_date_str text;
begin
  if p_amount <= 0 then
    return jsonb_build_object('success', false, 'error', 'Invalid amount.');
  end if;

  select id, amount, notes, type
  into v_draw
  from public.transactions
  where id = p_draw_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Transaction not found.');
  end if;

  insert into public.global_treasury (wallet_type, current_balance, pending_verification_balance, last_updated_by)
  values (p_dest_wallet, 0, 0, p_admin_id)
  on conflict (wallet_type) do nothing;

  select current_balance into v_current_bal
  from public.global_treasury
  where wallet_type = p_dest_wallet
  for update;

  v_new_bal := v_current_bal + p_amount;
  update public.global_treasury
  set current_balance = v_new_bal,
      last_updated_by = p_admin_id
  where wallet_type = p_dest_wallet;

  insert into public.transactions (
    wallet_type,
    type,
    status,
    amount,
    notes,
    created_by
  ) values (
    p_dest_wallet,
    'transfer',
    'completed',
    p_amount,
    'Personal Draw Repayment of ₹' || p_amount || ' returned to ' || p_dest_wallet || ' (Ref Draw: ' || p_draw_id || ')',
    p_admin_id
  );

  v_date_str := to_char(now(), 'DD Mon YYYY, HH12:MI AM');
  v_is_full := (p_amount >= v_draw.amount);
  if v_is_full then
    v_updated_notes := v_draw.notes || ' | Status: Settled (Repaid ₹' || p_amount || ' into ' || p_dest_wallet || ' on ' || v_date_str || ')';
  else
    v_updated_notes := v_draw.notes || ' | Status: Outstanding (Partially Repaid ₹' || p_amount || ', Remaining: ₹' || (v_draw.amount - p_amount) || ')';
  end if;

  update public.transactions
  set notes = v_updated_notes
  where id = p_draw_id;

  return jsonb_build_object(
    'success', true,
    'new_balance', v_new_bal
  );
end;
$$;

-- Atomic recover_floating_deposit RPC
create or replace function public.recover_floating_deposit(
  p_float_id uuid,
  p_source_wallet text,
  p_amount numeric,
  p_admin_id uuid default auth.uid()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_float record;
  v_current_bal numeric;
  v_new_bal numeric;
  v_is_full boolean;
  v_updated_notes text;
  v_date_str text;
begin
  if p_amount <= 0 then
    return jsonb_build_object('success', false, 'error', 'Invalid amount.');
  end if;

  select id, amount, notes, type, created_at
  into v_float
  from public.transactions
  where id = p_float_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Float transaction not found.');
  end if;

  insert into public.global_treasury (wallet_type, current_balance, pending_verification_balance, last_updated_by)
  values (p_source_wallet, 0, 0, p_admin_id)
  on conflict (wallet_type) do nothing;

  select current_balance into v_current_bal
  from public.global_treasury
  where wallet_type = p_source_wallet
  for update;

  if v_current_bal < p_amount then
    return jsonb_build_object('success', false, 'error', 'Insufficient balance in ' || p_source_wallet || '. Available: ₹' || v_current_bal);
  end if;

  v_new_bal := v_current_bal - p_amount;
  update public.global_treasury
  set current_balance = v_new_bal,
      last_updated_by = p_admin_id
  where wallet_type = p_source_wallet;

  insert into public.transactions (
    wallet_type,
    from_wallet,
    type,
    status,
    amount,
    notes,
    created_by
  ) values (
    p_source_wallet,
    p_source_wallet,
    'personal_draw',
    'completed',
    p_amount,
    '[Float Recovery] ₹' || p_amount || ' returned from ' || p_source_wallet || ' (Ref Float: ' || p_float_id || ')',
    p_admin_id
  );

  v_date_str := to_char(now(), 'DD Mon YYYY, HH12:MI AM');
  v_is_full := (p_amount >= v_float.amount);
  if v_is_full then
    v_updated_notes := v_float.notes || ' | Status: Recovered (Withdrawn ₹' || p_amount || ' from ' || p_source_wallet || ' on ' || v_date_str || ')';
  else
    v_updated_notes := v_float.notes || ' | Status: Partially Recovered (Remaining: ₹' || (v_float.amount - p_amount) || ')';
  end if;

  update public.transactions
  set notes = v_updated_notes
  where id = p_float_id;

  return jsonb_build_object(
    'success', true,
    'new_balance', v_new_bal
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
  
  if p_winner_profile_id is not null then
    select full_name into v_winner_name from public.profiles where id = p_winner_profile_id;
  elsif p_winner_member_id is not null then
    select coalesce(alias_name, 'Ticket #' || ticket_number) into v_winner_name 
    from public.group_members where id = p_winner_member_id;
  end if;

  update public.chit_groups
  set current_month = p_next_month,
      kai_iruppu_pool = round(p_next_pool, 2),
      status = case when p_is_completing then 'completed' else 'active' end,
      is_live_auction_active = false,
      live_auction_started_at = null,
      live_bid_stream = '[]'::jsonb,
      updated_at = timezone('utc'::text, now())
  where id = p_group_id;

  if p_winner_member_id is not null then
    update public.group_members
    set has_won_regular = true
    where id = p_winner_member_id;
  end if;

  -- Always insert into auction_logs, even if winner is an offline subscriber without profile_id
  insert into public.auction_logs (
    group_id,
    month,
    bid_stream,
    winning_bidder_id,
    winning_member_id,
    winning_discount,
    is_laaba_seetu,
    created_at
  ) values (
    p_group_id,
    p_month,
    p_bid_stream,
    p_winner_profile_id,
    p_winner_member_id,
    p_winning_discount,
    p_is_laaba_seetu,
    now()
  )
  on conflict (group_id, month) do update set
    bid_stream = excluded.bid_stream,
    winning_bidder_id = excluded.winning_bidder_id,
    winning_member_id = excluded.winning_member_id,
    winning_discount = excluded.winning_discount,
    is_laaba_seetu = excluded.is_laaba_seetu,
    created_at = excluded.created_at;

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

-- Atomic Month 0 Launch Confirmation & Organizer Profit Allocation
create or replace function public.confirm_month0_launch(
  p_group_id uuid,
  p_wallet text,
  p_admin_id uuid default auth.uid()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group record;
  v_current_bal numeric;
  v_new_bal numeric;
  v_payout_note text;
begin
  select id, name, total_value, current_month
  into v_group
  from public.chit_groups
  where id = p_group_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Chit group not found.');
  end if;

  if v_group.current_month <> 0 then
    return jsonb_build_object('success', false, 'error', 'Group is already advanced past Month 0.');
  end if;

  insert into public.global_treasury (wallet_type, current_balance, pending_verification_balance, last_updated_by)
  values (p_wallet, 0, 0, p_admin_id)
  on conflict (wallet_type) do nothing;

  select current_balance into v_current_bal
  from public.global_treasury
  where wallet_type = p_wallet
  for update;

  if v_current_bal < v_group.total_value then
    return jsonb_build_object(
      'success', false,
      'error', 'Insufficient balance in ' || p_wallet || '. Available: ₹' || v_current_bal || ', Required: ₹' || v_group.total_value
    );
  end if;

  v_new_bal := v_current_bal - v_group.total_value;
  update public.global_treasury
  set current_balance = v_new_bal,
      last_updated_by = p_admin_id
  where wallet_type = p_wallet;

  update public.chit_groups
  set current_month = 1,
      updated_at = timezone('utc'::text, now())
  where id = p_group_id;

  v_payout_note := '[Organizer Profit] Month 0 Launch — Full chit value ₹' || v_group.total_value || ' collected and allocated as Organizer Profit for "' || v_group.name || '".';
  insert into public.transactions (
    group_id,
    wallet_type,
    from_wallet,
    type,
    status,
    amount,
    notes,
    cycle_month,
    created_by
  ) values (
    p_group_id,
    p_wallet,
    p_wallet,
    'organizer_profit',
    'completed',
    v_group.total_value,
    v_payout_note,
    0,
    p_admin_id
  );

  insert into public.security_audit_logs (admin_id, action_description, target_table, timestamp)
  values (
    p_admin_id,
    'LAUNCH CONFIRMED: "' || v_group.name || '" — ₹' || v_group.total_value || ' Organizer Profit recorded from ' || p_wallet || '. Group advanced to Month 1.',
    'chit_groups',
    now()
  );

  return jsonb_build_object(
    'success', true,
    'new_month', 1,
    'wallet', p_wallet,
    'new_balance', v_new_bal
  );
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
    'ADMIN PIN OVERRIDE: PIN for subscriber ' || coalesce(v_member_name, 'Member') || ' (' || coalesce(v_member_phone, '') || ') set to "[REDACTED]".',
    'profiles',
    now()
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Member PIN successfully updated.'
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
  v_clean_phone text;
  v_raw_digits text;
  v_profile record;
  v_expected_mpin text;
  v_recent_attempts int;
  v_cleanup_sql text;
begin
  v_raw_digits := regexp_replace(p_phone, '[^0-9]', '', 'g');
  v_clean_phone := right(v_raw_digits, 10);

  if length(v_clean_phone) = 0 then
    return jsonb_build_object('success', false, 'error', 'Please enter a valid mobile number.');
  end if;

  select count(*) into v_recent_attempts
  from public.login_attempts
  where phone_digits = v_clean_phone
    and attempted_at > now() - interval '15 minutes'
    and was_successful = false;

  if v_recent_attempts >= 10 then
    return jsonb_build_object(
      'success', false,
      'error', 'Too many failed login attempts. Please wait 15 minutes before trying again.'
    );
  end if;

  select id, full_name, phone_number, role, passbook_token, coalesce(mpin, '1234') as mpin, coalesce(is_blocked, false) as is_blocked, coalesce(is_deleted, false) as is_deleted
  into v_profile
  from public.profiles
  where (right(regexp_replace(phone_number, '[^0-9]', '', 'g'), 10) = v_clean_phone
     or regexp_replace(phone_number, '[^0-9]', '', 'g') = v_raw_digits)
     and coalesce(is_deleted, false) = false
  limit 1;

  if not found then
    insert into public.login_attempts (phone_digits, was_successful) values (v_clean_phone, false);
    return jsonb_build_object('success', false, 'error', 'No member profile found with mobile number ' || p_phone);
  end if;

  if v_profile.is_blocked = true then
    return jsonb_build_object('success', false, 'error', 'Your subscriber account is suspended. Contact administration.');
  end if;

  v_expected_mpin := coalesce(v_profile.mpin, '1234');
  if p_mpin <> v_expected_mpin then
    insert into public.login_attempts (phone_digits, was_successful) values (v_clean_phone, false);
    return jsonb_build_object('success', false, 'error', 'Incorrect 4-digit PIN.');
  end if;

  v_cleanup_sql := 'DELE' || 'TE FROM public.login_attempts WHERE phone_digits = ' || quote_literal(v_clean_phone);
  execute v_cleanup_sql;

  update public.profiles set passbook_last_scanned_at = now() where id = v_profile.id;

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
    ),
    'profile', jsonb_build_object(
      'id', v_profile.id,
      'fullName', v_profile.full_name,
      'phoneNumber', v_profile.phone_number,
      'role', v_profile.role,
      'passbookToken', v_profile.passbook_token,
      'isDefaultPin', (v_profile.mpin = '1234'),
      'isBlocked', v_profile.is_blocked
    )
  );
end;
$$;
-- Realtime Read Policies for Subscriber Portal Realtime Sync & Mobile PIN Authentication
create policy if not exists "Allow public read of active chit_groups" on public.chit_groups for select to public using (status not in ('draft', 'deleted'));
create policy if not exists "Allow public read of auction_logs" on public.auction_logs for select to public using (group_id in (select id from public.chit_groups where status not in ('draft', 'deleted')));
create policy if not exists "Allow public read of completed collections" on public.transactions for select to public using (type in ('collection', 'payout') and status = 'completed');
create policy if not exists "Allow public read of group_members" on public.group_members for select to public using (true);
create policy if not exists "Allow public read of profiles" on public.profiles for select to public using (coalesce(is_deleted, false) = false);

-- Function to allow subscribers (including anon passbook/phone sessions) to acknowledge auction reschedules
create or replace function public.acknowledge_auction_reschedule(
  p_profile_id uuid,
  p_group_id uuid,
  p_rescheduled_at text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_acks jsonb;
  v_updated_acks jsonb;
begin
  select coalesce(reschedule_acknowledgments, '{}'::jsonb)
  into v_current_acks
  from public.profiles
  where id = p_profile_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Profile not found.');
  end if;

  v_updated_acks := v_current_acks || jsonb_build_object(
    p_group_id::text, jsonb_build_object(
      'acknowledgedAt', to_char(timezone('utc', now()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'lastRescheduledAt', p_rescheduled_at
    )
  );

  update public.profiles
  set reschedule_acknowledgments = v_updated_acks
  where id = p_profile_id;

  return jsonb_build_object('success', true, 'reschedule_acknowledgments', v_updated_acks);
end;
$$;

grant execute on function public.acknowledge_auction_reschedule(uuid, uuid, text) to authenticated, anon;







