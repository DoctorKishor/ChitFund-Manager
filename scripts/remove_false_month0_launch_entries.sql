-- ==============================================================================
-- SQL SCRIPT: Remove False Automated Month 0 Launch Entries from Transactions
-- ==============================================================================
-- Purpose:
-- When Month 0 was previously advanced to Month 1, an automated transaction entry
-- of type 'organizer_profit' was erroneously inserted into the transactions table.
-- Organizer profit must ONLY be recorded when explicitly and manually withdrawn
-- by the administrator via the dedicated WithdrawOrganizerProfitModal pipeline.
--
-- This script:
-- 1. Deletes the false automated launch entries (TXN #9960B0, #75F3A8, #D03D81, etc.)
-- 2. Records an audit event in security_audit_logs for complete traceability.
-- ==============================================================================

DO $$
DECLARE
  v_deleted_count int;
BEGIN
  -- 1. Delete false automated entries
  DELETE FROM public.transactions
  WHERE type = 'organizer_profit'
    AND (
      notes ILIKE '%[Organizer Profit] Month 0 Launch — Full chit value%'
      OR notes ILIKE '%Month 0 Launch — Full chit value%'
      OR (notes ILIKE '%[Organizer Profit] Month 0 Launch%' AND cycle_month = 0)
    );

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RAISE NOTICE 'Deleted % false automated Month 0 launch transactions.', v_deleted_count;

  -- 2. Log administrative audit entry if any were removed
  IF v_deleted_count > 0 THEN
    INSERT INTO public.security_audit_logs (
      action_description,
      target_table,
      timestamp
    ) VALUES (
      'LEDGER RECONCILIATION: Purged ' || v_deleted_count || ' false automated Month 0 launch entries from transactions table.',
      'transactions',
      NOW()
    );
  END IF;
END $$;
