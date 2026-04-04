BEGIN;

CREATE OR REPLACE FUNCTION public.get_filtered_approval_history(
  p_limit integer DEFAULT 10,
  p_cursor_acted_at timestamptz DEFAULT NULL,
  p_cursor_action_id uuid DEFAULT NULL,
  p_name_search text DEFAULT NULL,
  p_actor_filters text[] DEFAULT NULL,
  p_claim_status text DEFAULT NULL,
  p_claim_status_id uuid DEFAULT NULL,
  p_claim_allow_resubmit boolean DEFAULT NULL,
  p_claim_date_from date DEFAULT NULL,
  p_claim_date_to date DEFAULT NULL,
  p_hod_approved_from timestamptz DEFAULT NULL,
  p_hod_approved_to timestamptz DEFAULT NULL,
  p_finance_approved_from timestamptz DEFAULT NULL,
  p_finance_approved_to timestamptz DEFAULT NULL
)
RETURNS TABLE(
  action_id uuid,
  claim_id uuid,
  claim_number text,
  claim_date date,
  work_location text,
  total_amount numeric,
  claim_status text,
  claim_status_name text,
  claim_status_display_color text,
  owner_name text,
  owner_designation text,
  actor_email text,
  actor_designation text,
  action text,
  approval_level integer,
  notes text,
  acted_at timestamptz,
  hod_approved_at timestamptz,
  finance_approved_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT *
  FROM public.get_filtered_approval_history(
    p_limit,
    p_cursor_acted_at,
    p_cursor_action_id,
    p_name_search,
    p_actor_filters,
    p_claim_status,
    p_claim_status_id,
    p_claim_allow_resubmit,
    'lte',
    NULL,
    NULL,
    p_claim_date_from,
    p_claim_date_to,
    p_hod_approved_from,
    p_hod_approved_to,
    p_finance_approved_from,
    p_finance_approved_to
  );
$function$;

GRANT EXECUTE ON FUNCTION public.get_filtered_approval_history(integer, timestamptz, uuid, text, text[], text, uuid, boolean, date, date, timestamptz, timestamptz, timestamptz, timestamptz) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
