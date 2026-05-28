-- Fix: eliminate cold-buffer timeout in get_claim_bucket_metrics (finance page initial load)
--
-- Why migration 20260527170000 still times out:
--
--   The covering index idx_ec_status_total_amount reduced page reads from ~464 (heap)
--   to 289 total (64 index + 237 heap via visibility-map checks).
--   VACUUM (FREEZE, ANALYZE) did NOT clear the heap fetches — Supabase's internal
--   connection pool holds old transaction xmins that prevent the visibility map from
--   being marked all-visible.
--
--   Cold I/O on the shared Supabase test instance: ~26 ms/page
--   289 pages × 26 ms ≈ 7.5 s → still at/beyond the 8 s statement_timeout
--
-- Fix — trigger-maintained summary table:
--
--   1. expense_claims_status_summary: one row per distinct status_id
--      Tiny table (~10–20 rows). Finance page reads ~1 buffer page: effectively 0 ms cold.
--
--   2. AFTER INSERT / UPDATE OF status_id, total_amount / DELETE trigger
--      on expense_claims keeps the summary atomically in sync.
--      Trigger overhead per claim write: negligible (1-2 index lookups).
--
--   3. get_claim_bucket_metrics — Path A (p_claim_ids IS NULL) now reads the summary
--      table instead of expense_claims.
--      Path B (p_claim_ids provided) is unchanged: unnest JOIN PK, reads only N rows.
--
-- No change to function signature, return columns, or calling code.
-- Results are identical to the original function (exact counts, not approximate).


-- ── 1. Summary table ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.expense_claims_status_summary (
  status_id    uuid    PRIMARY KEY,
  claim_count  bigint  NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0
);

COMMENT ON TABLE public.expense_claims_status_summary IS
  'Trigger-maintained per-status aggregate of expense_claims. '
  'Used by get_claim_bucket_metrics for the no-filter (all-claims) case '
  'to avoid a full heap scan on every finance page load. '
  'Updated atomically by trg_expense_claims_status_summary on each claim write.';


-- ── 2. Initialise from current data ──────────────────────────────────────────

INSERT INTO public.expense_claims_status_summary (status_id, claim_count, total_amount)
SELECT
  status_id,
  count(*)::bigint                        AS claim_count,
  coalesce(sum(total_amount), 0)::numeric AS total_amount
FROM public.expense_claims
WHERE status_id IS NOT NULL
GROUP BY status_id
ON CONFLICT (status_id) DO UPDATE
  SET claim_count  = EXCLUDED.claim_count,
      total_amount = EXCLUDED.total_amount;


-- ── 3. Trigger function ──────────────────────────────────────────────────────

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


-- ── 4. Attach trigger to expense_claims ─────────────────────────────────────
--
-- UPDATE OF status_id, total_amount — only fires when these two columns change.
-- Unrelated updates (e.g. notes, attachments) do NOT fire the trigger.

DROP TRIGGER IF EXISTS trg_expense_claims_status_summary ON public.expense_claims;

CREATE TRIGGER trg_expense_claims_status_summary
AFTER INSERT OR UPDATE OF status_id, total_amount OR DELETE
ON public.expense_claims
FOR EACH ROW EXECUTE FUNCTION public.maintain_expense_claims_status_summary();


-- ── 5. Rewrite get_claim_bucket_metrics ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_claim_bucket_metrics(
  p_claim_ids           uuid[]  DEFAULT NULL::uuid[],
  p_pending_status_ids  uuid[]  DEFAULT NULL::uuid[],
  p_approved_status_ids uuid[]  DEFAULT NULL::uuid[],
  p_rejected_status_ids uuid[]  DEFAULT NULL::uuid[]
)
RETURNS TABLE(
  total_count     integer,
  total_amount    numeric,
  pending_count   integer,
  pending_amount  numeric,
  approved_count  integer,
  approved_amount numeric,
  rejected_count  integer,
  rejected_amount numeric
)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_has_pending  boolean := coalesce(array_length(p_pending_status_ids,  1), 0) > 0;
  v_has_approved boolean := coalesce(array_length(p_approved_status_ids, 1), 0) > 0;
  v_has_rejected boolean := coalesce(array_length(p_rejected_status_ids, 1), 0) > 0;
BEGIN

  -- ── Path A: no claim-ID filter (initial finance page load) ─────────────────
  --
  --   Reads expense_claims_status_summary — ~10–20 rows, 1 buffer page.
  --   Zero cold-buffer overhead regardless of expense_claims size.
  --   Summary is atomically maintained by trg_expense_claims_status_summary.
  --
  IF p_claim_ids IS NULL THEN

    SELECT
      coalesce(sum(s.claim_count), 0)::int,
      coalesce(sum(s.total_amount), 0)::numeric,
      coalesce(sum(s.claim_count) FILTER (
        WHERE v_has_pending  AND s.status_id = ANY(p_pending_status_ids)
      ), 0)::int,
      coalesce(sum(s.total_amount) FILTER (
        WHERE v_has_pending  AND s.status_id = ANY(p_pending_status_ids)
      ), 0)::numeric,
      coalesce(sum(s.claim_count) FILTER (
        WHERE v_has_approved AND s.status_id = ANY(p_approved_status_ids)
      ), 0)::int,
      coalesce(sum(s.total_amount) FILTER (
        WHERE v_has_approved AND s.status_id = ANY(p_approved_status_ids)
      ), 0)::numeric,
      coalesce(sum(s.claim_count) FILTER (
        WHERE v_has_rejected AND s.status_id = ANY(p_rejected_status_ids)
      ), 0)::int,
      coalesce(sum(s.total_amount) FILTER (
        WHERE v_has_rejected AND s.status_id = ANY(p_rejected_status_ids)
      ), 0)::numeric
    INTO
      total_count,    total_amount,
      pending_count,  pending_amount,
      approved_count, approved_amount,
      rejected_count, rejected_amount
    FROM public.expense_claims_status_summary s;

  -- ── Path B: claim-ID filter active (any filter on the finance page) ─────────
  --
  --   unnest(p_claim_ids) JOIN expense_claims ON PK.
  --   Reads only the N matching claims via PK index lookups.
  --   Unchanged from migration 20260527170000.
  --
  ELSE

    SELECT
      count(*)::int,
      coalesce(sum(ec.total_amount), 0)::numeric,
      count(*) FILTER (WHERE v_has_pending  AND ec.status_id = ANY(p_pending_status_ids))::int,
      coalesce(sum(ec.total_amount) FILTER (WHERE v_has_pending  AND ec.status_id = ANY(p_pending_status_ids)), 0)::numeric,
      count(*) FILTER (WHERE v_has_approved AND ec.status_id = ANY(p_approved_status_ids))::int,
      coalesce(sum(ec.total_amount) FILTER (WHERE v_has_approved AND ec.status_id = ANY(p_approved_status_ids)), 0)::numeric,
      count(*) FILTER (WHERE v_has_rejected AND ec.status_id = ANY(p_rejected_status_ids))::int,
      coalesce(sum(ec.total_amount) FILTER (WHERE v_has_rejected AND ec.status_id = ANY(p_rejected_status_ids)), 0)::numeric
    INTO
      total_count,    total_amount,
      pending_count,  pending_amount,
      approved_count, approved_amount,
      rejected_count, rejected_amount
    FROM unnest(p_claim_ids) AS cid(id)
    JOIN public.expense_claims ec ON ec.id = cid.id;

  END IF;

  -- NULL guards (empty table / zero-row unnest)
  total_count     := coalesce(total_count,     0);
  total_amount    := coalesce(total_amount,    0);
  pending_count   := coalesce(pending_count,   0);
  pending_amount  := coalesce(pending_amount,  0);
  approved_count  := coalesce(approved_count,  0);
  approved_amount := coalesce(approved_amount, 0);
  rejected_count  := coalesce(rejected_count,  0);
  rejected_amount := coalesce(rejected_amount, 0);

  RETURN NEXT;
END;
$function$;
