-- Enable RLS on expense_claims_status_summary.
--
-- Currently this table has RLS disabled while carrying the same broad
-- anon/authenticated GRANTs as every other public-schema table (blanket
-- schema-level grants; RLS is what actually restricts row access in this
-- project — see expense_claims). With RLS off, ANY anon or authenticated
-- caller can read AND write this table directly via PostgREST
-- (`/rest/v1/expense_claims_status_summary`), exposing company-wide
-- aggregate claim totals per status to unauthenticated visitors and
-- allowing arbitrary corruption of the finance dashboard's numbers.
--
-- Two things read/write this table and must keep working after RLS is on:
--
--   1. trg_expense_claims_status_summary (AFTER INSERT/UPDATE/DELETE on
--      expense_claims) calls maintain_expense_claims_status_summary() to
--      keep the aggregate in sync. That function has no SECURITY clause,
--      so it defaults to SECURITY INVOKER and runs as whichever role fired
--      the triggering DML. Claim submission (insertClaim in
--      claims.repository.ts) inserts into expense_claims directly using
--      the user's session client (`authenticated` role, RLS-bound) rather
--      than a SECURITY DEFINER RPC, so the trigger's own INSERT into
--      expense_claims_status_summary would also run as `authenticated`.
--      Naively enabling RLS with no policies would make that nested INSERT
--      violate RLS and roll back the entire claim-submission transaction —
--      breaking new-claim submission for every employee.
--      (Approval / finance-review / reclaim status changes go through
--      submit_approval_action_atomic / submit_finance_action_atomic /
--      bulk_finance_actions_atomic / supersede_rejected_claim, all
--      SECURITY DEFINER owned by postgres, which already bypasses RLS —
--      those paths are unaffected either way.)
--
--      Fix: mark the trigger function SECURITY DEFINER so its writes
--      always succeed regardless of the invoking role. Safe here because
--      the function returns `trigger` (Postgres refuses to let it be
--      called directly via SQL), performs one fixed upsert with no dynamic
--      SQL, and already pins search_path.
--
--   2. get_finance_queue_metrics's Path A (no active filters) reads
--      expense_claims_status_summary directly. It is SECURITY INVOKER and
--      is called from the finance page using the user's session client, so
--      it runs as `authenticated`. Without a SELECT policy, Path A would
--      silently return all-zero totals on every finance-page load that has
--      no filters applied.
--
--      Fix: add a SELECT policy scoped to FINANCE_TEAM/ADMIN, mirroring
--      the existing "finance can read finance claims" / "admin reads all
--      claims" policies on expense_claims — this table is just a
--      pre-aggregated view of that same data, so it carries the same
--      visibility rules.
--
-- No INSERT/UPDATE/DELETE policy is added for anon/authenticated: the only
-- legitimate writer is now the SECURITY DEFINER trigger (plus service_role,
-- which already bypasses RLS). This closes the current anon/authenticated
-- direct-write hole instead of re-opening it under a new policy.


-- ── 1. Trigger function: SECURITY INVOKER → SECURITY DEFINER ─────────────────
-- (body unchanged from migration 20260527180000 — verified against live
--  pg_get_functiondef before writing this migration)

CREATE OR REPLACE FUNCTION public.maintain_expense_claims_status_summary()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN

  -- ── INSERT: add new claim to its bucket ────────────────────────────────────
  IF TG_OP = 'INSERT' THEN
    IF NEW.status_id IS NOT NULL THEN
      INSERT INTO expense_claims_status_summary (status_id, claim_count, total_amount)
      VALUES (NEW.status_id, 1, coalesce(NEW.total_amount, 0))
      ON CONFLICT (status_id) DO UPDATE
        SET claim_count  = expense_claims_status_summary.claim_count  + EXCLUDED.claim_count,
            total_amount = expense_claims_status_summary.total_amount + EXCLUDED.total_amount;
    END IF;
    RETURN NEW;

  -- ── UPDATE: only recalculate when status_id or total_amount actually changed ──
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status_id IS DISTINCT FROM NEW.status_id OR
       OLD.total_amount IS DISTINCT FROM NEW.total_amount THEN

      -- Remove from old bucket
      IF OLD.status_id IS NOT NULL THEN
        UPDATE expense_claims_status_summary
        SET claim_count  = GREATEST(claim_count - 1, 0),
            total_amount = total_amount - coalesce(OLD.total_amount, 0)
        WHERE status_id = OLD.status_id;
      END IF;

      -- Add to new bucket
      IF NEW.status_id IS NOT NULL THEN
        INSERT INTO expense_claims_status_summary (status_id, claim_count, total_amount)
        VALUES (NEW.status_id, 1, coalesce(NEW.total_amount, 0))
        ON CONFLICT (status_id) DO UPDATE
          SET claim_count  = expense_claims_status_summary.claim_count  + EXCLUDED.claim_count,
              total_amount = expense_claims_status_summary.total_amount + EXCLUDED.total_amount;
      END IF;
    END IF;
    RETURN NEW;

  -- ── DELETE: remove from bucket ─────────────────────────────────────────────
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status_id IS NOT NULL THEN
      UPDATE expense_claims_status_summary
      SET claim_count  = GREATEST(claim_count - 1, 0),
          total_amount = total_amount - coalesce(OLD.total_amount, 0)
      WHERE status_id = OLD.status_id;
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;


-- ── 2. Enable RLS ──────────────────────────────────────────────────────────

ALTER TABLE public.expense_claims_status_summary ENABLE ROW LEVEL SECURITY;


-- ── 3. SELECT policy: finance + admin only ────────────────────────────────
-- Mirrors "finance can read finance claims" / "admin reads all claims" on
-- expense_claims (same underlying data, just pre-aggregated).

CREATE POLICY "finance and admin read status summary"
ON public.expense_claims_status_summary
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM employees cur
    JOIN employee_roles er ON er.employee_id = cur.id AND er.is_active = true
    JOIN roles r ON r.id = er.role_id
    WHERE lower(cur.employee_email) = current_user_email()
      AND r.role_code::text = ANY (ARRAY['FINANCE_TEAM', 'ADMIN'])
  )
);


-- ── 4. service_role policy (documentation only — service_role already
--      bypasses RLS via BYPASSRLS; matches the claim_statuses_write_service
--      convention used elsewhere in this schema) ─────────────────────────────

CREATE POLICY "expense_claims_status_summary_write_service"
ON public.expense_claims_status_summary
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
