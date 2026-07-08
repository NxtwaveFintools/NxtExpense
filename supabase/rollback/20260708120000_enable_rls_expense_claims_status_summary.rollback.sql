-- Rollback for: 20260708120000_enable_rls_expense_claims_status_summary.sql
--
-- Restores expense_claims_status_summary to its pre-migration state:
-- RLS disabled, trigger function back to (implicit) SECURITY INVOKER.
--
-- NOTE: rolling back re-opens the anon/authenticated direct read+write
-- exposure this migration closed. Only roll back if the SECURITY DEFINER
-- trigger or the finance/admin SELECT policy is causing a correctness
-- problem — prefer fixing forward instead.


-- ── 1. Drop policies ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS "expense_claims_status_summary_write_service" ON public.expense_claims_status_summary;
DROP POLICY IF EXISTS "finance and admin read status summary" ON public.expense_claims_status_summary;


-- ── 2. Disable RLS ────────────────────────────────────────────────────────

ALTER TABLE public.expense_claims_status_summary DISABLE ROW LEVEL SECURITY;


-- ── 3. Trigger function: SECURITY DEFINER → SECURITY INVOKER (default) ──────
-- (body unchanged from migration 20260527180000)

CREATE OR REPLACE FUNCTION public.maintain_expense_claims_status_summary()
RETURNS TRIGGER
LANGUAGE plpgsql
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
