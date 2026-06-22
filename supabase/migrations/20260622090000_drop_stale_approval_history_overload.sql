-- Drop the stale 14-arg overload of get_filtered_approval_history.
--
-- WHY:
--   public.get_filtered_approval_history exists in TWO overloads:
--     • 17-arg (canonical) — has p_amount_operator / p_amount_value / p_location_type
--     • 14-arg (this one)  — a thin backward-compat shim that just forwards to the
--                            17-arg with ('lte', NULL, NULL) for those three params.
--
--   PostgREST resolves RPCs by the SET of named arguments supplied. The app
--   (src/features/approvals/data/rpc/approval-history-args.ts → buildApprovalHistoryRpcArgs)
--   ALWAYS sends p_amount_operator / p_amount_value / p_location_type, so today it
--   binds the 17-arg unambiguously and works. But if ANY caller ever omits those
--   three params, PostgREST cannot choose between the two candidates and returns:
--       HTTP 300  PGRST203  "Could not choose the best candidate function ..."
--   — silently breaking the entire Approval History tab. Verified live 2026-06-22:
--   omitting amount/location params against the live DB returns exactly that error.
--
--   The 14-arg version adds no behaviour (pure forwarding shim), so removing it
--   eliminates the ambiguity with zero functional change to the canonical path.
--   get_filtered_approval_history_count has only one signature and is unaffected.

DROP FUNCTION IF EXISTS public.get_filtered_approval_history(
  integer,                  -- p_limit
  timestamp with time zone, -- p_cursor_acted_at
  uuid,                     -- p_cursor_action_id
  text,                     -- p_name_search
  text[],                   -- p_actor_filters
  text,                     -- p_claim_status
  uuid,                     -- p_claim_status_id
  boolean,                  -- p_claim_allow_resubmit
  date,                     -- p_claim_date_from
  date,                     -- p_claim_date_to
  timestamp with time zone, -- p_hod_approved_from
  timestamp with time zone, -- p_hod_approved_to
  timestamp with time zone, -- p_finance_approved_from
  timestamp with time zone  -- p_finance_approved_to
);
