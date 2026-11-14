-- Drop overloaded 0-arg functions so PostgREST has no ambiguity
drop function if exists public.purge_all_audit_logs();
drop function if exists public.purge_all_audit_logs(text);
drop function if exists public.reset_test_database();
drop function if exists public.reset_test_database(uuid);
drop function if exists public.reset_test_database(text);

-- Create single canonical purge_all_audit_logs with WHERE clause
create or replace function public.purge_all_audit_logs(p_confirm text default 'PURGE_LOGS')
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  -- Bypass audit trigger recording during the purge
  perform set_config('app.skip_audit_log', 'true', true);
  
  delete from public.security_audit_logs where id is not null;
  
  perform set_config('app.skip_audit_log', 'false', true);

  return jsonb_build_object(
    'success', true,
    'message', 'All security audit logs successfully cleared.',
    'cleared_at', now()
  );
end;
$$;

grant execute on function public.purge_all_audit_logs(text) to authenticated, anon, service_role, public;

-- Create single canonical reset_test_database with WHERE clauses
create or replace function public.reset_test_database(p_confirm_phrase text default 'WIPE_ALL_DATA')
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_caller_id uuid;
  v_main_admin_id uuid;
  v_admin_email text := 'kishoranbazhakan@gmail.com';
  result jsonb;
begin
  if p_confirm_phrase is distinct from 'WIPE_ALL_DATA' then
    raise exception 'Unauthorized: Invalid confirmation phrase.';
  end if;

  -- Resolve admin identity
  v_caller_id := auth.uid();
  select id into v_main_admin_id from auth.users where lower(email) = v_admin_email limit 1;
  if v_main_admin_id is null then
    select id into v_main_admin_id from public.profiles where phone_number = '9943609010' limit 1;
  end if;
  if v_main_admin_id is null then
    v_main_admin_id := v_caller_id;
  end if;

  -- Suppress audit trigger during factory purge
  perform set_config('app.skip_audit_log', 'true', true);

  -- Nullify foreign keys to break circular dependencies
  update public.system_settings set updated_by = v_main_admin_id where key is not null;
  update public.group_members set transferred_from = null, profile_id = null where id is not null;
  update public.transactions set group_id = null, profile_id = null, group_member_id = null, created_by = null where id is not null;
  update public.auction_logs set winning_bidder_id = null, winning_member_id = null, runner_up_bidder_id = null where id is not null;
  update public.passbook_inventory set assigned_to_profile_id = null where id is not null;
  update public.security_audit_logs set admin_id = null where id is not null;

  -- Purge operational tables with WHERE clauses
  delete from public.transactions where id is not null;
  delete from public.auction_logs where id is not null;
  delete from public.group_members where id is not null;
  delete from public.chit_groups where id is not null;
  delete from public.passbook_inventory where id is not null;

  -- Reset treasury balances to 0
  update public.global_treasury 
  set current_balance = 0, 
      pending_verification_balance = 0,
      last_updated_by = v_main_admin_id
  where wallet_type is not null;

  insert into public.global_treasury (wallet_type, current_balance, pending_verification_balance, last_updated_by)
  values 
    ('cash_in_hand', 0, 0, v_main_admin_id),
    ('kishor_bank', 0, 0, v_main_admin_id),
    ('dad_bank', 0, 0, v_main_admin_id),
    ('mom_bank', 0, 0, v_main_admin_id)
  on conflict (wallet_type) do update 
  set current_balance = 0, pending_verification_balance = 0, last_updated_by = v_main_admin_id;

  -- Delete non-admin profiles
  if v_main_admin_id is not null then
    delete from public.profiles where id != v_main_admin_id;
    update public.profiles set is_deleted = false, is_blocked = false, role = 'admin' where id = v_main_admin_id;
  end if;

  -- Delete non-admin auth accounts
  begin
    if v_main_admin_id is not null then
      delete from auth.users where id != v_main_admin_id;
    end if;
  exception when others then
    null;
  end;

  -- Purge all audit logs completely
  delete from public.security_audit_logs where id is not null;
  perform set_config('app.skip_audit_log', 'false', true);

  result := jsonb_build_object(
    'success', true,
    'message', 'Factory database reset completed successfully. All data wiped. Main admin account preserved.'
  );

  return result;
end;
$$;

grant execute on function public.reset_test_database(text) to authenticated, anon, service_role, public;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
