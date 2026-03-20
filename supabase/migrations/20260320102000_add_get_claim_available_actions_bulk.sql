BEGIN;

CREATE OR REPLACE FUNCTION public.get_claim_available_actions_bulk(
  p_claim_ids uuid[]
)
RETURNS TABLE(
  claim_id uuid,
  action text,
  display_label text,
  require_notes boolean,
  supports_allow_resubmit boolean,
  actor_scope text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT
    claim_ids.claim_id,
    available.action,
    available.display_label,
    available.require_notes,
    available.supports_allow_resubmit,
    available.actor_scope
  FROM unnest(coalesce(p_claim_ids, ARRAY[]::uuid[])) AS claim_ids(claim_id)
  CROSS JOIN LATERAL public.get_claim_available_actions(claim_ids.claim_id) AS available;
$$;

GRANT EXECUTE ON FUNCTION public.get_claim_available_actions_bulk(uuid[])
TO authenticated, service_role;

COMMIT;
