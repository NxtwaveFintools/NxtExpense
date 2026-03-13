BEGIN;

-- Align resolve_next_approval_level with ID-based approver columns.
-- Behavior parity is preserved:
-- - clear   -> null
-- - retain  -> current level
-- - reset_first_configured -> first valid configured level (L1 else L3)
-- - otherwise advance from L1/L2 to L3 when valid, else null
CREATE OR REPLACE FUNCTION public.resolve_next_approval_level(
  p_owner public.employees,
  p_current_level integer,
  p_mode text
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
declare
  v_level int;
  v_owner_id uuid := p_owner.id;
  v_level_1_id uuid := p_owner.approval_employee_id_level_1;
  v_level_3_id uuid := p_owner.approval_employee_id_level_3;
  v_level_1_valid boolean := v_level_1_id is not null and v_level_1_id <> v_owner_id;
  v_level_3_valid boolean := v_level_3_id is not null and v_level_3_id <> v_owner_id;
begin
  if p_mode = 'clear' then return null; end if;
  if p_mode = 'retain' then return p_current_level; end if;

  if p_mode = 'reset_first_configured' then
    if v_level_1_valid then return 1; end if;
    if v_level_3_valid then return 3; end if;
    return null;
  end if;

  if p_current_level is null then return null; end if;
  v_level := null;
  if p_current_level < 3 and v_level_3_valid then v_level := 3; end if;
  return v_level;
end;
$function$;

COMMIT;
