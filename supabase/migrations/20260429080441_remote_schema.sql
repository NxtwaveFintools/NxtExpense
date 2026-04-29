


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "hypopg" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "index_advisor" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."admin_change_claim_status_with_audit_atomic"("p_claim_id" "uuid", "p_target_status_id" "uuid", "p_reason" "text", "p_confirmation" "text" DEFAULT 'CONFIRM'::"text") RETURNS TABLE("claim_id" "uuid", "previous_status_code" "text", "updated_status_code" "text", "updated_approval_level" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_admin_id uuid;
  v_reason text;
  v_claim public.expense_claims%ROWTYPE;
  v_old_status public.claim_statuses%ROWTYPE;
  v_new_status public.claim_statuses%ROWTYPE;
  v_target_level integer;
BEGIN
  v_admin_id := public.require_admin_actor();
  v_reason := nullif(trim(coalesce(p_reason, '')), '');

  IF p_confirmation <> 'CONFIRM' THEN
    RAISE EXCEPTION 'Secondary confirmation is required.';
  END IF;

  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'Status change reason is required.';
  END IF;

  SELECT *
  INTO v_claim
  FROM public.expense_claims
  WHERE id = p_claim_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Claim not found.';
  END IF;

  SELECT *
  INTO v_old_status
  FROM public.claim_statuses
  WHERE id = v_claim.status_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Current claim status is invalid.';
  END IF;

  SELECT *
  INTO v_new_status
  FROM public.claim_statuses
  WHERE id = p_target_status_id
    AND is_active = true
    AND is_terminal = false
    AND is_rejection = false
    AND is_approval = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selected status is not eligible for admin reassignment.';
  END IF;

  IF v_claim.status_id = v_new_status.id THEN
    RAISE EXCEPTION 'Claim is already in the selected status.';
  END IF;

  v_target_level := v_new_status.approval_level;

  UPDATE public.expense_claims
  SET status_id = v_new_status.id,
      current_approval_level = v_target_level,
      updated_at = now()
  WHERE id = v_claim.id;

  INSERT INTO public.approval_history (
    claim_id,
    approver_employee_id,
    approval_level,
    action,
    notes,
    reason,
    old_status_id,
    new_status_id,
    metadata
  )
  VALUES (
    v_claim.id,
    v_admin_id,
    v_target_level,
    'admin_override',
    v_reason,
    v_reason,
    v_old_status.id,
    v_new_status.id,
    jsonb_build_object(
      'operation', 'admin_status_reassignment',
      'from_status_code', v_old_status.status_code,
      'to_status_code', v_new_status.status_code,
      'from_approval_level', v_claim.current_approval_level,
      'to_approval_level', v_target_level
    )
  );

  INSERT INTO public.admin_logs (
    admin_id,
    action_type,
    entity_type,
    entity_id,
    old_value,
    new_value
  )
  VALUES (
    v_admin_id,
    'update',
    'claim_status',
    v_claim.id,
    jsonb_build_object(
      'status_id', v_old_status.id,
      'status_code', v_old_status.status_code,
      'approval_level', v_claim.current_approval_level
    ),
    jsonb_build_object(
      'status_id', v_new_status.id,
      'status_code', v_new_status.status_code,
      'approval_level', v_target_level,
      'reason', v_reason
    )
  );

  RETURN QUERY
  SELECT
    v_claim.id,
    v_old_status.status_code::text,
    v_new_status.status_code::text,
    v_target_level::integer;
END;
$$;


ALTER FUNCTION "public"."admin_change_claim_status_with_audit_atomic"("p_claim_id" "uuid", "p_target_status_id" "uuid", "p_reason" "text", "p_confirmation" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_create_employee_atomic"("p_employee_id" "text", "p_employee_name" "text", "p_employee_email" "text", "p_designation_id" "uuid", "p_employee_status_id" "uuid", "p_role_id" "uuid", "p_state_id" "uuid", "p_approval_employee_id_level_1" "uuid" DEFAULT NULL::"uuid", "p_approval_employee_id_level_2" "uuid" DEFAULT NULL::"uuid", "p_approval_employee_id_level_3" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("id" "uuid", "employee_id" "text", "employee_name" "text", "employee_email" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_actor_email text;
  v_admin_employee_id uuid;
  v_created_employee public.employees%ROWTYPE;
  v_l1_designation_id uuid;
  v_l2_designation_id uuid;
  v_l3_designation_id uuid;
  v_l1_state_id uuid;
  v_l2_state_id uuid;
  v_l3_state_id uuid;
BEGIN
  v_actor_email := public.current_user_email();

  IF coalesce(v_actor_email, '') = '' THEN
    RAISE EXCEPTION 'Unauthorized request.';
  END IF;

  SELECT e.id
  INTO v_admin_employee_id
  FROM public.employees e
  WHERE lower(e.employee_email) = v_actor_email;

  IF v_admin_employee_id IS NULL THEN
    RAISE EXCEPTION 'Admin access is required.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.employee_roles er
    JOIN public.roles r ON r.id = er.role_id
    WHERE er.employee_id = v_admin_employee_id
      AND er.is_active = true
      AND r.is_admin_role = true
  ) THEN
    RAISE EXCEPTION 'Admin access is required.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.designations d
    WHERE d.id = p_designation_id
      AND d.is_active = true
  ) THEN
    RAISE EXCEPTION 'Invalid active designation selected.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.employee_statuses s
    WHERE s.id = p_employee_status_id
  ) THEN
    RAISE EXCEPTION 'Invalid employee status selected.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.roles r
    WHERE r.id = p_role_id
      AND r.is_active = true
  ) THEN
    RAISE EXCEPTION 'Invalid active role selected.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.states s
    WHERE s.id = p_state_id
      AND s.is_active = true
  ) THEN
    RAISE EXCEPTION 'Invalid active state selected.';
  END IF;

  IF p_approval_employee_id_level_1 IS NOT NULL THEN
    SELECT e.designation_id, es.state_id
    INTO v_l1_designation_id, v_l1_state_id
    FROM public.employees e
    LEFT JOIN public.employee_states es
      ON es.employee_id = e.id
     AND es.is_primary = true
    WHERE e.id = p_approval_employee_id_level_1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invalid level 1 approver selected.';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.approver_selection_rules r
      WHERE r.approval_level = 1
        AND r.designation_id = v_l1_designation_id
        AND r.is_active = true
        AND (
          r.requires_same_state = false
          OR v_l1_state_id = p_state_id
        )
    ) THEN
      RAISE EXCEPTION 'Selected level 1 approver does not match configured workflow rules.';
    END IF;
  END IF;

  IF p_approval_employee_id_level_2 IS NOT NULL THEN
    SELECT e.designation_id, es.state_id
    INTO v_l2_designation_id, v_l2_state_id
    FROM public.employees e
    LEFT JOIN public.employee_states es
      ON es.employee_id = e.id
     AND es.is_primary = true
    WHERE e.id = p_approval_employee_id_level_2;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invalid level 2 approver selected.';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.approver_selection_rules r
      WHERE r.approval_level = 2
        AND r.designation_id = v_l2_designation_id
        AND r.is_active = true
        AND (
          r.requires_same_state = false
          OR v_l2_state_id = p_state_id
        )
    ) THEN
      RAISE EXCEPTION 'Selected level 2 approver does not match configured workflow rules.';
    END IF;
  END IF;

  IF p_approval_employee_id_level_3 IS NOT NULL THEN
    SELECT e.designation_id, es.state_id
    INTO v_l3_designation_id, v_l3_state_id
    FROM public.employees e
    LEFT JOIN public.employee_states es
      ON es.employee_id = e.id
     AND es.is_primary = true
    WHERE e.id = p_approval_employee_id_level_3;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invalid level 3 approver selected.';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.approver_selection_rules r
      WHERE r.approval_level = 3
        AND r.designation_id = v_l3_designation_id
        AND r.is_active = true
        AND (
          r.requires_same_state = false
          OR v_l3_state_id = p_state_id
        )
    ) THEN
      RAISE EXCEPTION 'Selected level 3 approver does not match configured workflow rules.';
    END IF;
  END IF;

  INSERT INTO public.employees (
    employee_id,
    employee_name,
    employee_email,
    designation_id,
    employee_status_id,
    approval_employee_id_level_1,
    approval_employee_id_level_2,
    approval_employee_id_level_3
  )
  VALUES (
    trim(p_employee_id),
    trim(p_employee_name),
    lower(trim(p_employee_email)),
    p_designation_id,
    p_employee_status_id,
    p_approval_employee_id_level_1,
    p_approval_employee_id_level_2,
    p_approval_employee_id_level_3
  )
  RETURNING * INTO v_created_employee;

  INSERT INTO public.employee_states (
    employee_id,
    state_id,
    is_primary
  )
  VALUES (
    v_created_employee.id,
    p_state_id,
    true
  );

  INSERT INTO public.employee_roles (
    employee_id,
    role_id,
    assigned_by,
    is_active
  )
  VALUES (
    v_created_employee.id,
    p_role_id,
    v_admin_employee_id,
    true
  );

  INSERT INTO public.admin_logs (
    admin_id,
    action_type,
    entity_type,
    entity_id,
    old_value,
    new_value
  )
  VALUES (
    v_admin_employee_id,
    'create',
    'employee',
    v_created_employee.id,
    NULL,
    jsonb_build_object(
      'employee_id', v_created_employee.employee_id,
      'employee_name', v_created_employee.employee_name,
      'employee_email', v_created_employee.employee_email,
      'designation_id', v_created_employee.designation_id,
      'employee_status_id', v_created_employee.employee_status_id,
      'state_id', p_state_id,
      'role_id', p_role_id,
      'approval_employee_id_level_1', v_created_employee.approval_employee_id_level_1,
      'approval_employee_id_level_2', v_created_employee.approval_employee_id_level_2,
      'approval_employee_id_level_3', v_created_employee.approval_employee_id_level_3
    )
  );

  RETURN QUERY
  SELECT
    v_created_employee.id,
    v_created_employee.employee_id,
    v_created_employee.employee_name,
    v_created_employee.employee_email;
END;
$$;


ALTER FUNCTION "public"."admin_create_employee_atomic"("p_employee_id" "text", "p_employee_name" "text", "p_employee_email" "text", "p_designation_id" "uuid", "p_employee_status_id" "uuid", "p_role_id" "uuid", "p_state_id" "uuid", "p_approval_employee_id_level_1" "uuid", "p_approval_employee_id_level_2" "uuid", "p_approval_employee_id_level_3" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_finalize_employee_replacement_atomic"("p_old_employee_id" "uuid", "p_new_employee_id" "uuid", "p_reason" "text", "p_confirmation" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_admin_id uuid;
BEGIN
  v_admin_id := public.require_admin_actor();

  IF p_confirmation IS DISTINCT FROM 'CONFIRM' THEN
    RAISE EXCEPTION 'Secondary confirmation is required.';
  END IF;

  IF p_old_employee_id = p_new_employee_id THEN
    RAISE EXCEPTION 'Old and new employee cannot be the same.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.employees WHERE id = p_old_employee_id
  ) THEN
    RAISE EXCEPTION 'Old employee not found.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.employees WHERE id = p_new_employee_id
  ) THEN
    RAISE EXCEPTION 'New employee not found.';
  END IF;

  INSERT INTO public.employee_replacements (
    old_employee_id,
    new_employee_id,
    replaced_by_admin_id,
    replacement_reason
  )
  VALUES (
    p_old_employee_id,
    p_new_employee_id,
    v_admin_id,
    p_reason
  );

  UPDATE public.employees
  SET
    approval_employee_id_level_1 = CASE
      WHEN approval_employee_id_level_1 = p_old_employee_id THEN p_new_employee_id
      ELSE approval_employee_id_level_1
    END,
    approval_employee_id_level_2 = CASE
      WHEN approval_employee_id_level_2 = p_old_employee_id THEN p_new_employee_id
      ELSE approval_employee_id_level_2
    END,
    approval_employee_id_level_3 = CASE
      WHEN approval_employee_id_level_3 = p_old_employee_id THEN p_new_employee_id
      ELSE approval_employee_id_level_3
    END,
    updated_at = now()
  WHERE
    approval_employee_id_level_1 = p_old_employee_id
    OR approval_employee_id_level_2 = p_old_employee_id
    OR approval_employee_id_level_3 = p_old_employee_id;

  INSERT INTO public.admin_logs (
    admin_id,
    action_type,
    entity_type,
    entity_id,
    old_value,
    new_value
  )
  VALUES (
    v_admin_id,
    'replace_finalize',
    'employee_replacement',
    p_new_employee_id,
    jsonb_build_object(
      'old_employee_id', p_old_employee_id
    ),
    jsonb_build_object(
      'old_employee_id', p_old_employee_id,
      'new_employee_id', p_new_employee_id,
      'reason', p_reason
    )
  );
END;
$$;


ALTER FUNCTION "public"."admin_finalize_employee_replacement_atomic"("p_old_employee_id" "uuid", "p_new_employee_id" "uuid", "p_reason" "text", "p_confirmation" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_prepare_employee_replacement_atomic"("p_employee_id" "uuid", "p_reason" "text", "p_confirmation" "text") RETURNS TABLE("old_employee_id" "uuid", "old_employee_name" "text", "default_designation_id" "uuid", "default_role_id" "uuid", "default_state_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_admin_id uuid;
  v_inactive_status_id uuid;
  v_old_status_id uuid;
  v_old_status_code text;
  v_employee public.employees%ROWTYPE;
  v_role_id uuid;
  v_state_id uuid;
BEGIN
  v_admin_id := public.require_admin_actor();

  IF p_confirmation IS DISTINCT FROM 'CONFIRM' THEN
    RAISE EXCEPTION 'Secondary confirmation is required.';
  END IF;

  SELECT *
  INTO v_employee
  FROM public.employees
  WHERE id = p_employee_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Employee not found.';
  END IF;

  SELECT id
  INTO v_inactive_status_id
  FROM public.employee_statuses
  WHERE status_code = 'INACTIVE'
  LIMIT 1;

  IF v_inactive_status_id IS NULL THEN
    RAISE EXCEPTION 'INACTIVE employee status is not configured.';
  END IF;

  v_old_status_id := v_employee.employee_status_id;

  SELECT status_code
  INTO v_old_status_code
  FROM public.employee_statuses
  WHERE id = v_old_status_id;

  IF v_old_status_id = v_inactive_status_id OR v_old_status_code = 'INACTIVE' THEN
    RAISE EXCEPTION 'Employee is already inactive.';
  END IF;

  UPDATE public.employees
  SET
    employee_status_id = v_inactive_status_id,
    updated_at = now()
  WHERE id = p_employee_id;

  SELECT er.role_id
  INTO v_role_id
  FROM public.employee_roles er
  WHERE er.employee_id = p_employee_id
    AND er.is_active = true
  ORDER BY er.assigned_at DESC
  LIMIT 1;

  SELECT es.state_id
  INTO v_state_id
  FROM public.employee_states es
  WHERE es.employee_id = p_employee_id
    AND es.is_primary = true
  LIMIT 1;

  INSERT INTO public.admin_logs (
    admin_id,
    action_type,
    entity_type,
    entity_id,
    old_value,
    new_value
  )
  VALUES (
    v_admin_id,
    'replace_prepare',
    'employee',
    p_employee_id,
    jsonb_build_object(
      'employee_status_id', v_old_status_id,
      'status_code', coalesce(v_old_status_code, 'UNKNOWN')
    ),
    jsonb_build_object(
      'employee_status_id', v_inactive_status_id,
      'status_code', 'INACTIVE',
      'reason', p_reason
    )
  );

  RETURN QUERY
  SELECT
    v_employee.id,
    v_employee.employee_name,
    v_employee.designation_id,
    v_role_id,
    v_state_id;
END;
$$;


ALTER FUNCTION "public"."admin_prepare_employee_replacement_atomic"("p_employee_id" "uuid", "p_reason" "text", "p_confirmation" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_reassign_employee_approvers_atomic"("p_employee_id" "uuid", "p_level_1" "text" DEFAULT NULL::"text", "p_level_2" "text" DEFAULT NULL::"text", "p_level_3" "text" DEFAULT NULL::"text", "p_reason" "text" DEFAULT NULL::"text", "p_confirmation" "text" DEFAULT NULL::"text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_email               text;
  v_admin_employee_id   uuid;
  v_reason              text;
  v_l1_email            text;
  v_l2_email            text;
  v_l3_email            text;
  v_l1_id               uuid;
  v_l2_id               uuid;
  v_l3_id               uuid;
  v_claim_count         int;
BEGIN
  v_email  := public.current_user_email();
  v_reason := nullif(trim(coalesce(p_reason, '')), '');

  IF coalesce(v_email, '') = ''  THEN RAISE EXCEPTION 'Unauthorized request.'; END IF;
  IF p_confirmation <> 'CONFIRM' THEN RAISE EXCEPTION 'Secondary confirmation is required.'; END IF;
  IF v_reason IS NULL            THEN RAISE EXCEPTION 'Reassignment reason is required.'; END IF;

  SELECT e.id INTO v_admin_employee_id
  FROM public.employees e
  JOIN public.employee_roles er ON er.employee_id = e.id AND er.is_active = true
  JOIN public.roles r ON r.id = er.role_id
  WHERE lower(e.employee_email) = v_email AND r.role_code = 'ADMIN'
  LIMIT 1;
  IF v_admin_employee_id IS NULL THEN RAISE EXCEPTION 'Admin access is required.'; END IF;

  v_l1_email := nullif(lower(trim(coalesce(p_level_1, ''))), '');
  v_l2_email := nullif(lower(trim(coalesce(p_level_2, ''))), '');
  v_l3_email := nullif(lower(trim(coalesce(p_level_3, ''))), '');

  IF v_l1_email IS NOT NULL THEN
    SELECT id INTO v_l1_id FROM public.employees WHERE lower(employee_email) = v_l1_email;
    IF v_l1_id IS NULL THEN RAISE EXCEPTION 'Level 1 approver email not found: %', v_l1_email; END IF;
  END IF;
  IF v_l2_email IS NOT NULL THEN
    SELECT id INTO v_l2_id FROM public.employees WHERE lower(employee_email) = v_l2_email;
    IF v_l2_id IS NULL THEN RAISE EXCEPTION 'Level 2 approver email not found: %', v_l2_email; END IF;
  END IF;
  IF v_l3_email IS NOT NULL THEN
    SELECT id INTO v_l3_id FROM public.employees WHERE lower(employee_email) = v_l3_email;
    IF v_l3_id IS NULL THEN RAISE EXCEPTION 'Level 3 approver email not found: %', v_l3_email; END IF;
  END IF;

  UPDATE public.employees
  SET approval_employee_id_level_1 = v_l1_id,
      approval_employee_id_level_2 = v_l2_id,
      approval_employee_id_level_3 = v_l3_id
  WHERE id = p_employee_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Employee not found for approver reassignment.'; END IF;

  INSERT INTO public.approval_history (
    claim_id, approver_employee_id, approval_level, action, notes, reason, metadata
  )
  SELECT c.id, v_admin_employee_id, null, 'admin_override', v_reason, v_reason,
    jsonb_build_object(
      'operation',   'reassign_approvers',
      'employee_id', p_employee_id,
      'level_1_email', v_l1_email,
      'level_2_email', v_l2_email,
      'level_3_email', v_l3_email
    )
  FROM public.expense_claims c
  WHERE c.employee_id = p_employee_id
    AND c.status_id IN (
      SELECT id
      FROM public.claim_statuses
      WHERE status_code IN ('L1_PENDING', 'L2_PENDING', 'L3_PENDING_FINANCE_REVIEW')
    );

  GET DIAGNOSTICS v_claim_count = ROW_COUNT;
  RETURN v_claim_count;
END;
$$;


ALTER FUNCTION "public"."admin_reassign_employee_approvers_atomic"("p_employee_id" "uuid", "p_level_1" "text", "p_level_2" "text", "p_level_3" "text", "p_reason" "text", "p_confirmation" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_reassign_employee_approvers_with_audit_atomic"("p_employee_id" "uuid", "p_level_1" "text", "p_level_2" "text", "p_level_3" "text", "p_reason" "text", "p_confirmation" "text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_admin_id uuid;
  v_impacted_claims integer;
  v_old_l1 uuid;
  v_old_l2 uuid;
  v_old_l3 uuid;
  v_new_l1 uuid;
  v_new_l2 uuid;
  v_new_l3 uuid;
BEGIN
  v_admin_id := public.require_admin_actor();

  SELECT
    approval_employee_id_level_1,
    approval_employee_id_level_2,
    approval_employee_id_level_3
  INTO
    v_old_l1,
    v_old_l2,
    v_old_l3
  FROM public.employees
  WHERE id = p_employee_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Employee not found.';
  END IF;

  SELECT public.admin_reassign_employee_approvers_atomic(
    p_employee_id,
    p_level_1,
    p_level_2,
    p_level_3,
    p_reason,
    p_confirmation
  )
  INTO v_impacted_claims;

  SELECT
    approval_employee_id_level_1,
    approval_employee_id_level_2,
    approval_employee_id_level_3
  INTO
    v_new_l1,
    v_new_l2,
    v_new_l3
  FROM public.employees
  WHERE id = p_employee_id;

  INSERT INTO public.admin_logs (
    admin_id,
    action_type,
    entity_type,
    entity_id,
    old_value,
    new_value
  )
  VALUES (
    v_admin_id,
    'update',
    'approval_chain',
    p_employee_id,
    jsonb_build_object(
      'approval_employee_id_level_1', v_old_l1,
      'approval_employee_id_level_2', v_old_l2,
      'approval_employee_id_level_3', v_old_l3
    ),
    jsonb_build_object(
      'approval_employee_id_level_1', v_new_l1,
      'approval_employee_id_level_2', v_new_l2,
      'approval_employee_id_level_3', v_new_l3,
      'reason', p_reason,
      'impacted_claims', coalesce(v_impacted_claims, 0)
    )
  );

  RETURN coalesce(v_impacted_claims, 0);
END;
$$;


ALTER FUNCTION "public"."admin_reassign_employee_approvers_with_audit_atomic"("p_employee_id" "uuid", "p_level_1" "text", "p_level_2" "text", "p_level_3" "text", "p_reason" "text", "p_confirmation" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_rollback_claim_atomic"("p_claim_id" "uuid", "p_reason" "text", "p_confirmation" "text" DEFAULT NULL::"text") RETURNS TABLE("claim_id" "uuid", "rolled_back_to_status_code" "text", "rolled_back_to_level" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_email               text;
  v_admin_employee_id   uuid;
  v_reason              text;
  v_claim               public.expense_claims%rowtype;
  v_target_status_id    uuid;
  v_target_level        int;
  v_target_status_code  text;
BEGIN
  v_email  := public.current_user_email();
  v_reason := nullif(trim(coalesce(p_reason, '')), '');

  IF coalesce(v_email, '') = ''  THEN RAISE EXCEPTION 'Unauthorized request.'; END IF;
  IF p_confirmation <> 'CONFIRM' THEN RAISE EXCEPTION 'Secondary confirmation is required.'; END IF;
  IF v_reason IS NULL            THEN RAISE EXCEPTION 'Rollback reason is required.'; END IF;

  SELECT e.id INTO v_admin_employee_id
  FROM public.employees e
  JOIN public.employee_roles er ON er.employee_id = e.id AND er.is_active = true
  JOIN public.roles r ON r.id = er.role_id
  WHERE lower(e.employee_email) = v_email AND r.role_code = 'ADMIN'
  LIMIT 1;
  IF v_admin_employee_id IS NULL THEN RAISE EXCEPTION 'Admin access is required.'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.approval_history h
    WHERE h.approver_employee_id = v_admin_employee_id
      AND h.action = 'admin_override'
      AND h.acted_at > now() - INTERVAL '30 seconds'
  ) THEN RAISE EXCEPTION 'Please wait before applying another admin override.'; END IF;

  SELECT * INTO v_claim FROM public.expense_claims WHERE id = p_claim_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Claim not found.'; END IF;

  SELECT h.old_status_id, cs.approval_level
  INTO v_target_status_id, v_target_level
  FROM public.approval_history h
  JOIN public.claim_statuses cs ON cs.id = h.old_status_id
  WHERE h.claim_id = v_claim.id
    AND h.old_status_id IS NOT NULL
  ORDER BY h.acted_at DESC
  LIMIT 1;

  IF v_target_status_id IS NULL THEN
    RAISE EXCEPTION 'No previous status found for rollback.';
  END IF;

  SELECT status_code INTO v_target_status_code FROM public.claim_statuses WHERE id = v_target_status_id;

  v_target_level := CASE v_target_status_code
    WHEN 'L1_PENDING' THEN 1
    WHEN 'L2_PENDING' THEN 2
    ELSE NULL
  END;

  UPDATE public.expense_claims
  SET status_id              = v_target_status_id,
      current_approval_level = v_target_level,
      updated_at             = now()
  WHERE id = v_claim.id;

  INSERT INTO public.approval_history (
    claim_id, approver_employee_id, approval_level, action, notes, reason, metadata
  ) VALUES (
    v_claim.id, v_admin_employee_id, null, 'admin_override', v_reason, v_reason,
    jsonb_build_object(
      'from_status_id', v_claim.status_id,
      'to_status_id',   v_target_status_id,
      'to_status_code', v_target_status_code
    )
  );

  RETURN QUERY SELECT v_claim.id, v_target_status_code, v_target_level;
END;
$$;


ALTER FUNCTION "public"."admin_rollback_claim_atomic"("p_claim_id" "uuid", "p_reason" "text", "p_confirmation" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_toggle_designation_active_atomic"("p_id" "uuid", "p_is_active" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_admin_id uuid;
  v_old_value boolean;
BEGIN
  v_admin_id := public.require_admin_actor();

  SELECT is_active INTO v_old_value
  FROM public.designations
  WHERE id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Designation not found.';
  END IF;

  UPDATE public.designations
  SET is_active = p_is_active,
      updated_at = now()
  WHERE id = p_id;

  INSERT INTO public.admin_logs (
    admin_id,
    action_type,
    entity_type,
    entity_id,
    old_value,
    new_value
  )
  VALUES (
    v_admin_id,
    'update',
    'designation',
    p_id,
    jsonb_build_object('is_active', v_old_value),
    jsonb_build_object('is_active', p_is_active)
  );
END;
$$;


ALTER FUNCTION "public"."admin_toggle_designation_active_atomic"("p_id" "uuid", "p_is_active" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_toggle_expense_rate_active_atomic"("p_id" "uuid", "p_is_active" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_admin_id uuid;
  v_old_is_active boolean;
BEGIN
  v_admin_id := public.require_admin_actor();

  SELECT is_active INTO v_old_is_active
  FROM public.expense_rates
  WHERE id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expense rate not found.';
  END IF;

  UPDATE public.expense_rates
  SET is_active = p_is_active,
      updated_at = now()
  WHERE id = p_id;

  INSERT INTO public.admin_logs (
    admin_id,
    action_type,
    entity_type,
    entity_id,
    old_value,
    new_value
  )
  VALUES (
    v_admin_id,
    'update',
    'expense_rate_status',
    p_id,
    jsonb_build_object('is_active', v_old_is_active),
    jsonb_build_object('is_active', p_is_active)
  );
END;
$$;


ALTER FUNCTION "public"."admin_toggle_expense_rate_active_atomic"("p_id" "uuid", "p_is_active" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_toggle_vehicle_type_active_atomic"("p_id" "uuid", "p_is_active" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_admin_id uuid;
  v_old_value boolean;
BEGIN
  v_admin_id := public.require_admin_actor();

  SELECT is_active INTO v_old_value
  FROM public.vehicle_types
  WHERE id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vehicle type not found.';
  END IF;

  UPDATE public.vehicle_types
  SET is_active = p_is_active,
      updated_at = now()
  WHERE id = p_id;

  INSERT INTO public.admin_logs (
    admin_id,
    action_type,
    entity_type,
    entity_id,
    old_value,
    new_value
  )
  VALUES (
    v_admin_id,
    'update',
    'vehicle_type',
    p_id,
    jsonb_build_object('is_active', v_old_value),
    jsonb_build_object('is_active', p_is_active)
  );
END;
$$;


ALTER FUNCTION "public"."admin_toggle_vehicle_type_active_atomic"("p_id" "uuid", "p_is_active" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_toggle_work_location_active_atomic"("p_id" "uuid", "p_is_active" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_admin_id uuid;
  v_old_value boolean;
BEGIN
  v_admin_id := public.require_admin_actor();

  SELECT is_active INTO v_old_value
  FROM public.work_locations
  WHERE id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Work location not found.';
  END IF;

  UPDATE public.work_locations
  SET is_active = p_is_active,
      updated_at = now()
  WHERE id = p_id;

  INSERT INTO public.admin_logs (
    admin_id,
    action_type,
    entity_type,
    entity_id,
    old_value,
    new_value
  )
  VALUES (
    v_admin_id,
    'update',
    'work_location',
    p_id,
    jsonb_build_object('is_active', v_old_value),
    jsonb_build_object('is_active', p_is_active)
  );
END;
$$;


ALTER FUNCTION "public"."admin_toggle_work_location_active_atomic"("p_id" "uuid", "p_is_active" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_update_expense_rate_amount_atomic"("p_id" "uuid", "p_rate_amount" numeric) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_admin_id uuid;
  v_old_rate numeric;
BEGIN
  v_admin_id := public.require_admin_actor();

  SELECT rate_amount INTO v_old_rate
  FROM public.expense_rates
  WHERE id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expense rate not found.';
  END IF;

  UPDATE public.expense_rates
  SET rate_amount = p_rate_amount,
      updated_at = now()
  WHERE id = p_id;

  INSERT INTO public.admin_logs (
    admin_id,
    action_type,
    entity_type,
    entity_id,
    old_value,
    new_value
  )
  VALUES (
    v_admin_id,
    'update',
    'expense_rate_amount',
    p_id,
    jsonb_build_object('rate_amount', v_old_rate),
    jsonb_build_object('rate_amount', p_rate_amount)
  );
END;
$$;


ALTER FUNCTION "public"."admin_update_expense_rate_amount_atomic"("p_id" "uuid", "p_rate_amount" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_update_vehicle_rates_atomic"("p_id" "uuid", "p_base_fuel_rate_per_day" numeric, "p_intercity_rate_per_km" numeric, "p_max_km_round_trip" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_admin_id uuid;
  v_old_base numeric;
  v_old_intercity numeric;
  v_old_max integer;
BEGIN
  v_admin_id := public.require_admin_actor();

  SELECT
    base_fuel_rate_per_day,
    intercity_rate_per_km,
    max_km_round_trip
  INTO
    v_old_base,
    v_old_intercity,
    v_old_max
  FROM public.vehicle_types
  WHERE id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vehicle type not found.';
  END IF;

  UPDATE public.vehicle_types
  SET
    base_fuel_rate_per_day = p_base_fuel_rate_per_day,
    intercity_rate_per_km = p_intercity_rate_per_km,
    max_km_round_trip = p_max_km_round_trip,
    updated_at = now()
  WHERE id = p_id;

  INSERT INTO public.admin_logs (
    admin_id,
    action_type,
    entity_type,
    entity_id,
    old_value,
    new_value
  )
  VALUES (
    v_admin_id,
    'update',
    'vehicle_type_rates',
    p_id,
    jsonb_build_object(
      'base_fuel_rate_per_day', v_old_base,
      'intercity_rate_per_km', v_old_intercity,
      'max_km_round_trip', v_old_max
    ),
    jsonb_build_object(
      'base_fuel_rate_per_day', p_base_fuel_rate_per_day,
      'intercity_rate_per_km', p_intercity_rate_per_km,
      'max_km_round_trip', p_max_km_round_trip
    )
  );
END;
$$;


ALTER FUNCTION "public"."admin_update_vehicle_rates_atomic"("p_id" "uuid", "p_base_fuel_rate_per_day" numeric, "p_intercity_rate_per_km" numeric, "p_max_km_round_trip" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_upsert_approver_selection_rule_atomic"("p_approval_level" integer, "p_designation_id" "uuid", "p_requires_same_state" boolean, "p_is_active" boolean) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_admin_id uuid;
  v_existing_id uuid;
  v_rule_id uuid;
  v_old_value jsonb;
  v_new_value jsonb;
BEGIN
  v_admin_id := public.require_admin_actor();

  IF p_approval_level < 1 OR p_approval_level > 3 THEN
    RAISE EXCEPTION 'Approval level must be between 1 and 3.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.designations d
    WHERE d.id = p_designation_id
      AND d.is_active = true
  ) THEN
    RAISE EXCEPTION 'Invalid active designation selected for approver rule.';
  END IF;

  SELECT id
  INTO v_existing_id
  FROM public.approver_selection_rules
  WHERE approval_level = p_approval_level
    AND designation_id = p_designation_id;

  IF v_existing_id IS NOT NULL THEN
    SELECT to_jsonb(r)
    INTO v_old_value
    FROM public.approver_selection_rules r
    WHERE r.id = v_existing_id;

    UPDATE public.approver_selection_rules
    SET requires_same_state = p_requires_same_state,
        is_active = p_is_active,
        updated_at = now()
    WHERE id = v_existing_id
    RETURNING id INTO v_rule_id;
  ELSE
    INSERT INTO public.approver_selection_rules (
      approval_level,
      designation_id,
      requires_same_state,
      is_active
    )
    VALUES (
      p_approval_level,
      p_designation_id,
      p_requires_same_state,
      p_is_active
    )
    RETURNING id INTO v_rule_id;
  END IF;

  SELECT to_jsonb(r)
  INTO v_new_value
  FROM public.approver_selection_rules r
  WHERE r.id = v_rule_id;

  INSERT INTO public.admin_logs (
    admin_id,
    action_type,
    entity_type,
    entity_id,
    old_value,
    new_value
  )
  VALUES (
    v_admin_id,
    'update',
    'approver_selection_rule',
    v_rule_id,
    v_old_value,
    v_new_value
  );

  RETURN v_rule_id;
END;
$$;


ALTER FUNCTION "public"."admin_upsert_approver_selection_rule_atomic"("p_approval_level" integer, "p_designation_id" "uuid", "p_requires_same_state" boolean, "p_is_active" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auth_user_has_elevated_role"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.employee_roles er
    JOIN public.employees e ON e.id = er.employee_id
    JOIN public.roles r ON r.id = er.role_id
    WHERE e.employee_email = (auth.jwt() ->> 'email')
    AND r.role_code IN ('APPROVER_L1', 'APPROVER_L2', 'FINANCE_REVIEWER', 'FINANCE_PROCESSOR', 'ADMIN')
    AND er.is_active = true
  );
$$;


ALTER FUNCTION "public"."auth_user_has_elevated_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bulk_finance_actions_atomic"("p_claim_ids" "uuid"[], "p_action" "text", "p_notes" "text" DEFAULT NULL::"text", "p_allow_resubmit" boolean DEFAULT false) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_claim_id uuid;
  v_processed int := 0;
BEGIN
  IF p_claim_ids IS NULL OR coalesce(array_length(p_claim_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'At least one claim must be selected.';
  END IF;

  FOR v_claim_id IN SELECT DISTINCT unnest(p_claim_ids)
  LOOP
    PERFORM *
    FROM public.submit_finance_action_atomic(
      v_claim_id,
      p_action,
      p_notes,
      p_allow_resubmit
    );

    v_processed := v_processed + 1;
  END LOOP;

  RETURN v_processed;
END;
$$;


ALTER FUNCTION "public"."bulk_finance_actions_atomic"("p_claim_ids" "uuid"[], "p_action" "text", "p_notes" "text", "p_allow_resubmit" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bulk_issue_claims_atomic"("p_claim_ids" "uuid"[], "p_notes" "text" DEFAULT NULL::"text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_email text;
  v_finance_employee_id uuid;
  v_is_finance boolean;
  v_requested_count int;
  v_eligible_count int;
  v_updated_count int;
begin
  v_email := public.current_user_email();
  if coalesce(v_email, '') = '' then raise exception 'Unauthorized request.'; end if;

  select id into v_finance_employee_id from public.employees where lower(employee_email) = v_email;

  select exists (
    select 1 from public.employees e
    join public.employee_roles er on er.employee_id = e.id and er.is_active = true
    join public.roles r on r.id = er.role_id
    where lower(e.employee_email) = v_email
      and r.role_code in ('FINANCE_REVIEWER', 'FINANCE_PROCESSOR')
  ) into v_is_finance;
  if not v_is_finance then raise exception 'Finance access is required.'; end if;

  if p_claim_ids is null or coalesce(array_length(p_claim_ids, 1), 0) = 0 then
    raise exception 'At least one claim must be selected.';
  end if;

  with requested as (select distinct unnest(p_claim_ids) as claim_id)
  select count(*) into v_requested_count from requested;

  with requested as (select distinct unnest(p_claim_ids) as claim_id),
  eligible as (
    select c.id from public.expense_claims c
    join requested r on r.claim_id = c.id
    where c.status = 'finance_review' for update
  )
  select count(*) into v_eligible_count from eligible;

  if v_eligible_count <> v_requested_count then
    raise exception 'One or more selected claims are not available in finance review.';
  end if;

  with requested as (select distinct unnest(p_claim_ids) as claim_id)
  insert into public.finance_actions (claim_id, actor_employee_id, action, notes)
  select r.claim_id, v_finance_employee_id, 'issued', nullif(trim(coalesce(p_notes, '')), '')
  from requested r;

  with requested as (select distinct unnest(p_claim_ids) as claim_id)
  update public.expense_claims c
  set status = 'issued', current_approval_level = null, updated_at = now()
  from requested r where c.id = r.claim_id;

  get diagnostics v_updated_count = row_count;
  return v_updated_count;
end;
$$;


ALTER FUNCTION "public"."bulk_issue_claims_atomic"("p_claim_ids" "uuid"[], "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bump_config_version_from_admin_log"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.entity_type IN (
    'designation',
    'work_location',
    'vehicle_type',
    'vehicle_type_rates',
    'expense_rate_amount',
    'expense_rate_status',
    'approval_chain',
    'designation_vehicle_permission',
    'validation_rule',
    'system_setting',
    'approval_flow'
  ) THEN
    INSERT INTO public.config_versions (
      source_admin_log_id,
      change_scope,
      change_summary,
      created_by
    )
    VALUES (
      NEW.id,
      NEW.entity_type,
      concat('Admin action: ', NEW.action_type, ' on ', NEW.entity_type),
      NEW.admin_id
    );
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."bump_config_version_from_admin_log"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."capture_claim_config_snapshot_on_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_version_id uuid;
  v_snapshot jsonb;
BEGIN
  SELECT id
  INTO v_version_id
  FROM public.config_versions
  ORDER BY version_number DESC
  LIMIT 1;

  IF v_version_id IS NULL THEN
    INSERT INTO public.config_versions (change_scope, change_summary)
    VALUES ('bootstrap', 'Auto-created baseline configuration version.')
    RETURNING id INTO v_version_id;
  END IF;

  v_snapshot := jsonb_build_object(
    'claim_context',
    jsonb_build_object(
      'claim_id', NEW.id,
      'claim_date', NEW.claim_date,
      'employee_id', NEW.employee_id,
      'designation_id', NEW.designation_id,
      'work_location_id', NEW.work_location_id,
      'base_location_day_type_code', NEW.base_location_day_type_code,
      'vehicle_type_id', NEW.vehicle_type_id,
      'outstation_state_id', NEW.outstation_state_id,
      'has_intercity_travel', NEW.has_intercity_travel,
      'has_intracity_travel', NEW.has_intracity_travel,
      'intercity_own_vehicle_used', NEW.intercity_own_vehicle_used,
      'intracity_own_vehicle_used', NEW.intracity_own_vehicle_used
    ),
    'designation',
    (
      SELECT to_jsonb(d)
      FROM public.designations d
      WHERE d.id = NEW.designation_id
    ),
    'work_location',
    (
      SELECT to_jsonb(wl)
      FROM public.work_locations wl
      WHERE wl.id = NEW.work_location_id
    ),
    'vehicle_type',
    (
      SELECT to_jsonb(vt)
      FROM public.vehicle_types vt
      WHERE vt.id = NEW.vehicle_type_id
    ),
    'approval_flow',
    (
      SELECT to_jsonb(af)
      FROM public.designation_approval_flow af
      WHERE af.designation_id = NEW.designation_id
        AND af.is_active = true
      ORDER BY af.created_at DESC
      LIMIT 1
    ),
    'allowed_vehicle_types',
    COALESCE(
      (
        SELECT jsonb_agg(to_jsonb(vt) ORDER BY vt.display_order)
        FROM public.designation_vehicle_permissions p
        JOIN public.vehicle_types vt ON vt.id = p.vehicle_type_id
        WHERE p.designation_id = NEW.designation_id
      ),
      '[]'::jsonb
    ),
    'effective_expense_rates',
    COALESCE(
      (
        SELECT jsonb_agg(to_jsonb(er) ORDER BY er.expense_type, er.effective_from DESC)
        FROM public.expense_rates er
        WHERE er.location_id = NEW.work_location_id
          AND er.is_active = true
          AND er.effective_from <= NEW.claim_date
          AND (er.effective_to IS NULL OR er.effective_to >= NEW.claim_date)
          AND (er.designation_id IS NULL OR er.designation_id = NEW.designation_id)
      ),
      '[]'::jsonb
    ),
    'validation_rules',
    COALESCE(
      (
        SELECT jsonb_agg(to_jsonb(vr) ORDER BY vr.rule_code)
        FROM public.validation_rules vr
        WHERE vr.is_active = true
      ),
      '[]'::jsonb
    ),
    'system_settings',
    COALESCE(
      (
        SELECT jsonb_object_agg(ss.setting_key, ss.setting_value)
        FROM public.system_settings ss
        WHERE ss.is_active = true
      ),
      '{}'::jsonb
    )
  );

  INSERT INTO public.claim_config_snapshots (
    claim_id,
    config_version_id,
    snapshot_data
  )
  VALUES (
    NEW.id,
    v_version_id,
    v_snapshot
  )
  ON CONFLICT (claim_id) DO NOTHING;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."capture_claim_config_snapshot_on_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_user_email"() RETURNS "text"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;


ALTER FUNCTION "public"."current_user_email"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_claim_number"("p_employee_uuid" "uuid", "p_claim_date" "date") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_employee_code text;
  v_sequence_value bigint;
begin
  select e.employee_id
  into v_employee_code
  from public.employees e
  where e.id = p_employee_uuid;

  if v_employee_code is null then
    raise exception 'Employee code not found for claim number generation.';
  end if;

  v_sequence_value := nextval('public.claim_number_seq');

  return format(
    'CLAIM-%s-%s-%s',
    upper(regexp_replace(v_employee_code, '[^A-Za-z0-9]', '', 'g')),
    to_char(p_claim_date, 'DDMMYY'),
    lpad(v_sequence_value::text, 4, '0')
  );
end;
$$;


ALTER FUNCTION "public"."generate_claim_number"("p_employee_uuid" "uuid", "p_claim_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_admin_approver_options_by_state"("p_state_id" "uuid") RETURNS TABLE("approval_level" integer, "employee_id" "uuid", "employee_name" "text", "employee_email" "text", "designation_id" "uuid", "designation_name" "text", "state_id" "uuid", "state_name" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_admin_id uuid;
BEGIN
  v_admin_id := public.require_admin_actor();

  RETURN QUERY
  SELECT
    r.approval_level::integer,
    e.id::uuid,
    e.employee_name::text,
    e.employee_email::text,
    d.id::uuid,
    d.designation_name::text,
    display_state.state_id::uuid,
    s.state_name::text
  FROM public.approver_selection_rules r
  JOIN public.employees e
    ON e.designation_id = r.designation_id
  JOIN public.employee_statuses est
    ON est.id = e.employee_status_id
   AND est.status_code = 'ACTIVE'
  JOIN public.designations d
    ON d.id = e.designation_id
  LEFT JOIN LATERAL (
    SELECT es.state_id
    FROM public.employee_states es
    WHERE es.employee_id = e.id
    ORDER BY es.is_primary DESC, es.created_at ASC, es.state_id ASC
    LIMIT 1
  ) AS display_state ON true
  LEFT JOIN public.states s
    ON s.id = display_state.state_id
  WHERE r.is_active = true
    AND d.is_active = true
    AND (
      r.requires_same_state = false
      OR EXISTS (
        SELECT 1
        FROM public.employee_states same_state_es
        WHERE same_state_es.employee_id = e.id
          AND same_state_es.state_id = p_state_id
      )
    )
  ORDER BY r.approval_level ASC, e.employee_name ASC;
END;
$$;


ALTER FUNCTION "public"."get_admin_approver_options_by_state"("p_state_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_admin_dashboard_analytics"("p_date_from" "date" DEFAULT NULL::"date", "p_date_to" "date" DEFAULT NULL::"date", "p_date_filter_field" "text" DEFAULT 'travel_date'::"text", "p_designation_id" "uuid" DEFAULT NULL::"uuid", "p_work_location_id" "uuid" DEFAULT NULL::"uuid", "p_state_id" "uuid" DEFAULT NULL::"uuid", "p_employee_id" "text" DEFAULT NULL::"text", "p_employee_name" "text" DEFAULT NULL::"text", "p_vehicle_code" "text" DEFAULT NULL::"text", "p_claim_status_id" "uuid" DEFAULT NULL::"uuid", "p_pending_only" boolean DEFAULT false, "p_top_claims_limit" integer DEFAULT 10) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_admin_id uuid;
  v_result jsonb;
  v_date_filter_field text;
  v_top_claims_limit integer;
BEGIN
  v_admin_id := public.require_admin_actor();
  v_date_filter_field := lower(coalesce(nullif(trim(p_date_filter_field), ''), 'travel_date'));
  IF v_date_filter_field NOT IN ('travel_date', 'submission_date') THEN
    RAISE EXCEPTION 'Invalid date filter field. Expected travel_date or submission_date.';
  END IF;
  v_top_claims_limit := greatest(1, least(coalesce(p_top_claims_limit, 10), 50));
  WITH pending_statuses AS (
    SELECT cs.id
    FROM public.claim_statuses cs
    WHERE cs.is_active = true
      AND cs.is_terminal = false
      AND cs.is_rejection = false
      AND cs.is_approval = false
  ),
  payment_issued_statuses AS (
    SELECT cs.id
    FROM public.claim_statuses cs
    WHERE cs.is_active = true
      AND cs.is_payment_issued = true
  ),
  rejected_statuses AS (
    SELECT cs.id
    FROM public.claim_statuses cs
    WHERE cs.is_active = true
      AND cs.is_rejection = true
  ),
  filtered_claims AS (
    SELECT
      c.id,
      c.claim_number,
      c.claim_date,
      c.submitted_at,
      c.total_amount,
      c.status_id,
      c.designation_id,
      c.work_location_id,
      c.vehicle_type_id,
      c.employee_id,
      e.employee_id AS employee_code,
      e.employee_name
    FROM public.expense_claims c
    JOIN public.employees e ON e.id = c.employee_id
    WHERE true
      AND (
        p_date_from IS NULL
        OR (
          (v_date_filter_field = 'travel_date' AND c.claim_date >= p_date_from)
          OR (v_date_filter_field = 'submission_date' AND c.submitted_at::date >= p_date_from)
        )
      )
      AND (
        p_date_to IS NULL
        OR (
          (v_date_filter_field = 'travel_date' AND c.claim_date <= p_date_to)
          OR (v_date_filter_field = 'submission_date' AND c.submitted_at::date <= p_date_to)
        )
      )
      AND (p_designation_id IS NULL OR c.designation_id = p_designation_id)
      AND (p_work_location_id IS NULL OR c.work_location_id = p_work_location_id)
      AND (p_claim_status_id IS NULL OR c.status_id = p_claim_status_id)
      AND (p_employee_id IS NULL OR e.employee_id ILIKE '%' || p_employee_id || '%')
      AND (p_employee_name IS NULL OR e.employee_name ILIKE '%' || p_employee_name || '%')
      AND (
        p_vehicle_code IS NULL
        OR c.vehicle_type_id = (
          SELECT vt.id
          FROM public.vehicle_types vt
          WHERE vt.vehicle_code = p_vehicle_code
            AND vt.is_active = true
          LIMIT 1
        )
      )
      AND (
        p_state_id IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.employee_states es
          WHERE es.employee_id = c.employee_id
            AND es.state_id = p_state_id
        )
      )
      AND (NOT coalesce(p_pending_only, false) OR c.status_id IN (SELECT id FROM pending_statuses))
  ),
  kpi AS (
    SELECT
      count(*)::int AS total_count,
      coalesce(sum(fc.total_amount), 0)::numeric AS total_amount,
      coalesce(avg(fc.total_amount), 0)::numeric AS avg_amount,
      count(*) FILTER (WHERE fc.status_id IN (SELECT id FROM pending_statuses))::int AS pending_count,
      coalesce(sum(fc.total_amount) FILTER (WHERE fc.status_id IN (SELECT id FROM pending_statuses)), 0)::numeric AS pending_amount,
      count(*) FILTER (WHERE fc.status_id IN (SELECT id FROM payment_issued_statuses))::int AS payment_released_count,
      coalesce(sum(fc.total_amount) FILTER (WHERE fc.status_id IN (SELECT id FROM payment_issued_statuses)), 0)::numeric AS payment_released_amount,
      count(*) FILTER (WHERE fc.status_id IN (SELECT id FROM rejected_statuses))::int AS rejected_count,
      coalesce(sum(fc.total_amount) FILTER (WHERE fc.status_id IN (SELECT id FROM rejected_statuses)), 0)::numeric AS rejected_amount
    FROM filtered_claims fc
  ),
  by_status AS (
    SELECT jsonb_agg(jsonb_build_object('status_name', cs.status_name, 'claim_count', agg.claim_count, 'total_amount', agg.total_amount) ORDER BY agg.claim_count DESC) AS data
    FROM (
      SELECT fc.status_id, count(*)::int AS claim_count, coalesce(sum(fc.total_amount), 0)::numeric AS total_amount
      FROM filtered_claims fc
      GROUP BY fc.status_id
    ) agg
    LEFT JOIN public.claim_statuses cs ON cs.id = agg.status_id
  ),
  by_designation AS (
    SELECT jsonb_agg(jsonb_build_object('designation_name', d.designation_name, 'claim_count', agg.claim_count, 'total_amount', agg.total_amount, 'avg_amount', agg.avg_amount) ORDER BY agg.total_amount DESC) AS data
    FROM (
      SELECT
        fc.designation_id,
        count(*)::int AS claim_count,
        coalesce(sum(fc.total_amount), 0)::numeric AS total_amount,
        coalesce(avg(fc.total_amount), 0)::numeric AS avg_amount
      FROM filtered_claims fc
      GROUP BY fc.designation_id
    ) agg
    LEFT JOIN public.designations d ON d.id = agg.designation_id
  ),
  by_work_location AS (
    SELECT jsonb_agg(jsonb_build_object('location_name', wl.location_name, 'claim_count', agg.claim_count, 'total_amount', agg.total_amount) ORDER BY agg.total_amount DESC) AS data
    FROM (
      SELECT fc.work_location_id, count(*)::int AS claim_count, coalesce(sum(fc.total_amount), 0)::numeric AS total_amount
      FROM filtered_claims fc
      GROUP BY fc.work_location_id
    ) agg
    LEFT JOIN public.work_locations wl ON wl.id = agg.work_location_id
  ),
  by_state AS (
    SELECT jsonb_agg(jsonb_build_object('state_name', s.state_name, 'claim_count', agg.claim_count, 'total_amount', agg.total_amount) ORDER BY agg.total_amount DESC) AS data
    FROM (
      SELECT es.state_id, count(*)::int AS claim_count, coalesce(sum(fc.total_amount), 0)::numeric AS total_amount
      FROM filtered_claims fc
      JOIN public.employee_states es ON es.employee_id = fc.employee_id AND es.is_primary = true
      GROUP BY es.state_id
    ) agg
    LEFT JOIN public.states s ON s.id = agg.state_id
  ),
  by_vehicle_type AS (
    SELECT jsonb_agg(jsonb_build_object('vehicle_name', coalesce(vt.vehicle_name, 'No Vehicle'), 'claim_count', agg.claim_count, 'total_amount', agg.total_amount) ORDER BY agg.total_amount DESC) AS data
    FROM (
      SELECT fc.vehicle_type_id, count(*)::int AS claim_count, coalesce(sum(fc.total_amount), 0)::numeric AS total_amount
      FROM filtered_claims fc
      GROUP BY fc.vehicle_type_id
    ) agg
    LEFT JOIN public.vehicle_types vt ON vt.id = agg.vehicle_type_id
  ),
  top_claims AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'claim_id', rows.id,
        'claim_number', rows.claim_number,
        'employee_id', rows.employee_code,
        'employee_name', rows.employee_name,
        'claim_date', rows.claim_date,
        'submitted_at', rows.submitted_at,
        'status_name', rows.status_name,
        'total_amount', rows.total_amount
      )
      ORDER BY rows.total_amount DESC, rows.submitted_at ASC NULLS LAST
    ) AS data
    FROM (
      SELECT
        fc.id,
        fc.claim_number,
        fc.employee_code,
        fc.employee_name,
        fc.claim_date,
        fc.submitted_at,
        coalesce(cs.status_name, 'Unknown') AS status_name,
        fc.total_amount
      FROM filtered_claims fc
      LEFT JOIN public.claim_statuses cs ON cs.id = fc.status_id
      ORDER BY fc.total_amount DESC, fc.submitted_at ASC NULLS LAST
      LIMIT v_top_claims_limit
    ) rows
  )
  SELECT jsonb_build_object(
    'kpi', (
      SELECT jsonb_build_object(
        'total_count', k.total_count,
        'total_amount', k.total_amount,
        'avg_amount', k.avg_amount,
        'pending_count', k.pending_count,
        'pending_amount', k.pending_amount,
        'payment_released_count', k.payment_released_count,
        'payment_released_amount', k.payment_released_amount,
        'rejected_count', k.rejected_count,
        'rejected_amount', k.rejected_amount
      )
      FROM kpi k
    ),
    'by_status', coalesce((SELECT data FROM by_status), '[]'::jsonb),
    'by_designation', coalesce((SELECT data FROM by_designation), '[]'::jsonb),
    'by_work_location', coalesce((SELECT data FROM by_work_location), '[]'::jsonb),
    'by_state', coalesce((SELECT data FROM by_state), '[]'::jsonb),
    'by_vehicle_type', coalesce((SELECT data FROM by_vehicle_type), '[]'::jsonb),
    'top_claims', coalesce((SELECT data FROM top_claims), '[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."get_admin_dashboard_analytics"("p_date_from" "date", "p_date_to" "date", "p_date_filter_field" "text", "p_designation_id" "uuid", "p_work_location_id" "uuid", "p_state_id" "uuid", "p_employee_id" "text", "p_employee_name" "text", "p_vehicle_code" "text", "p_claim_status_id" "uuid", "p_pending_only" boolean, "p_top_claims_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_admin_dashboard_analytics"("p_date_from" "date" DEFAULT NULL::"date", "p_date_to" "date" DEFAULT NULL::"date", "p_claim_id" "text" DEFAULT NULL::"text", "p_date_filter_field" "text" DEFAULT 'travel_date'::"text", "p_designation_id" "uuid" DEFAULT NULL::"uuid", "p_work_location_id" "uuid" DEFAULT NULL::"uuid", "p_state_id" "uuid" DEFAULT NULL::"uuid", "p_employee_id" "text" DEFAULT NULL::"text", "p_employee_name" "text" DEFAULT NULL::"text", "p_vehicle_code" "text" DEFAULT NULL::"text", "p_claim_status_id" "uuid" DEFAULT NULL::"uuid", "p_pending_only" boolean DEFAULT false, "p_top_claims_limit" integer DEFAULT 10) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_admin_id uuid;
  v_result jsonb;
  v_date_filter_field text;
  v_top_claims_limit integer;
BEGIN
  v_admin_id := public.require_admin_actor();
  v_date_filter_field := lower(coalesce(nullif(trim(p_date_filter_field), ''), 'travel_date'));

  IF v_date_filter_field NOT IN ('travel_date', 'submission_date') THEN
    RAISE EXCEPTION 'Invalid date filter field. Expected travel_date or submission_date.';
  END IF;

  v_top_claims_limit := greatest(1, least(coalesce(p_top_claims_limit, 10), 50));

  WITH pending_statuses AS (
    SELECT cs.id
    FROM public.claim_statuses cs
    WHERE cs.is_active = true
      AND cs.is_terminal = false
      AND cs.is_rejection = false
      AND cs.is_approval = false
  ),
  payment_issued_statuses AS (
    SELECT cs.id
    FROM public.claim_statuses cs
    WHERE cs.is_active = true
      AND cs.is_payment_issued = true
  ),
  rejected_statuses AS (
    SELECT cs.id
    FROM public.claim_statuses cs
    WHERE cs.is_active = true
      AND cs.is_rejection = true
  ),
  filtered_claims AS (
    SELECT
      c.id,
      c.claim_number,
      c.claim_date,
      c.submitted_at,
      c.total_amount,
      c.status_id,
      c.designation_id,
      c.work_location_id,
      c.vehicle_type_id,
      c.employee_id,
      coalesce(c.allow_resubmit, false) AS allow_resubmit,
      e.employee_id AS employee_code,
      e.employee_name
    FROM public.expense_claims c
    JOIN public.employees e ON e.id = c.employee_id
    WHERE true
      AND (
        p_date_from IS NULL
        OR (
          (v_date_filter_field = 'travel_date' AND c.claim_date >= p_date_from)
          OR (v_date_filter_field = 'submission_date' AND c.submitted_at::date >= p_date_from)
        )
      )
      AND (
        p_date_to IS NULL
        OR (
          (v_date_filter_field = 'travel_date' AND c.claim_date <= p_date_to)
          OR (v_date_filter_field = 'submission_date' AND c.submitted_at::date <= p_date_to)
        )
      )
      AND (
        p_claim_id IS NULL
        OR c.claim_number ILIKE '%' || p_claim_id || '%'
        OR c.id::text ILIKE '%' || p_claim_id || '%'
      )
      AND (p_designation_id IS NULL OR c.designation_id = p_designation_id)
      AND (p_work_location_id IS NULL OR c.work_location_id = p_work_location_id)
      AND (p_claim_status_id IS NULL OR c.status_id = p_claim_status_id)
      AND (p_employee_id IS NULL OR e.employee_id ILIKE '%' || p_employee_id || '%')
      AND (p_employee_name IS NULL OR e.employee_name ILIKE '%' || p_employee_name || '%')
      AND (
        p_vehicle_code IS NULL
        OR c.vehicle_type_id = (
          SELECT vt.id
          FROM public.vehicle_types vt
          WHERE vt.vehicle_code = p_vehicle_code
            AND vt.is_active = true
          LIMIT 1
        )
      )
      AND (
        p_state_id IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.employee_states es
          WHERE es.employee_id = c.employee_id
            AND es.state_id = p_state_id
        )
      )
      AND (NOT coalesce(p_pending_only, false) OR c.status_id IN (SELECT id FROM pending_statuses))
  ),
  kpi AS (
    SELECT
      count(*)::int AS total_count,
      coalesce(sum(fc.total_amount), 0)::numeric AS total_amount,
      coalesce(avg(fc.total_amount), 0)::numeric AS avg_amount,
      count(*) FILTER (WHERE fc.status_id IN (SELECT id FROM pending_statuses))::int AS pending_count,
      coalesce(sum(fc.total_amount) FILTER (WHERE fc.status_id IN (SELECT id FROM pending_statuses)), 0)::numeric AS pending_amount,
      count(*) FILTER (WHERE fc.status_id IN (SELECT id FROM payment_issued_statuses))::int AS payment_released_count,
      coalesce(sum(fc.total_amount) FILTER (WHERE fc.status_id IN (SELECT id FROM payment_issued_statuses)), 0)::numeric AS payment_released_amount,
      count(*) FILTER (WHERE fc.status_id IN (SELECT id FROM rejected_statuses))::int AS rejected_count,
      coalesce(sum(fc.total_amount) FILTER (WHERE fc.status_id IN (SELECT id FROM rejected_statuses)), 0)::numeric AS rejected_amount,
      count(*) FILTER (
        WHERE fc.status_id IN (SELECT id FROM rejected_statuses)
          AND fc.allow_resubmit = false
      )::int AS rejected_without_reclaim_count,
      coalesce(sum(fc.total_amount) FILTER (
        WHERE fc.status_id IN (SELECT id FROM rejected_statuses)
          AND fc.allow_resubmit = false
      ), 0)::numeric AS rejected_without_reclaim_amount,
      count(*) FILTER (
        WHERE fc.status_id IN (SELECT id FROM rejected_statuses)
          AND fc.allow_resubmit = true
      )::int AS rejected_allow_reclaim_count,
      coalesce(sum(fc.total_amount) FILTER (
        WHERE fc.status_id IN (SELECT id FROM rejected_statuses)
          AND fc.allow_resubmit = true
      ), 0)::numeric AS rejected_allow_reclaim_amount
    FROM filtered_claims fc
  ),
  by_status AS (
    SELECT
      jsonb_agg(
        jsonb_build_object(
          'status_name', agg.status_name,
          'claim_count', agg.claim_count,
          'total_amount', agg.total_amount
        )
        ORDER BY agg.total_amount DESC
      ) AS data
    FROM (
      SELECT
        CASE
          WHEN coalesce(cs.is_rejection, false) = true
            AND fc.allow_resubmit = true
            THEN 'Rejected - Allow Reclaim'
          WHEN coalesce(cs.is_rejection, false) = true
            THEN 'Rejected'
          ELSE coalesce(cs.status_name, 'Unknown')
        END AS status_name,
        count(*)::int AS claim_count,
        coalesce(sum(fc.total_amount), 0)::numeric AS total_amount
      FROM filtered_claims fc
      LEFT JOIN public.claim_statuses cs ON cs.id = fc.status_id
      GROUP BY 1
    ) agg
  ),
  by_designation AS (
    SELECT jsonb_agg(jsonb_build_object('designation_name', d.designation_name, 'claim_count', agg.claim_count, 'total_amount', agg.total_amount, 'avg_amount', agg.avg_amount) ORDER BY agg.total_amount DESC) AS data
    FROM (
      SELECT
        fc.designation_id,
        count(*)::int AS claim_count,
        coalesce(sum(fc.total_amount), 0)::numeric AS total_amount,
        coalesce(avg(fc.total_amount), 0)::numeric AS avg_amount
      FROM filtered_claims fc
      GROUP BY fc.designation_id
    ) agg
    LEFT JOIN public.designations d ON d.id = agg.designation_id
  ),
  by_work_location AS (
    SELECT jsonb_agg(jsonb_build_object('location_name', wl.location_name, 'claim_count', agg.claim_count, 'total_amount', agg.total_amount) ORDER BY agg.total_amount DESC) AS data
    FROM (
      SELECT fc.work_location_id, count(*)::int AS claim_count, coalesce(sum(fc.total_amount), 0)::numeric AS total_amount
      FROM filtered_claims fc
      GROUP BY fc.work_location_id
    ) agg
    LEFT JOIN public.work_locations wl ON wl.id = agg.work_location_id
  ),
  by_state AS (
    SELECT jsonb_agg(jsonb_build_object('state_name', s.state_name, 'claim_count', agg.claim_count, 'total_amount', agg.total_amount) ORDER BY agg.total_amount DESC) AS data
    FROM (
      SELECT es.state_id, count(*)::int AS claim_count, coalesce(sum(fc.total_amount), 0)::numeric AS total_amount
      FROM filtered_claims fc
      JOIN public.employee_states es ON es.employee_id = fc.employee_id AND es.is_primary = true
      GROUP BY es.state_id
    ) agg
    LEFT JOIN public.states s ON s.id = agg.state_id
  ),
  by_vehicle_type AS (
    SELECT jsonb_agg(jsonb_build_object('vehicle_name', coalesce(vt.vehicle_name, 'No Vehicle'), 'claim_count', agg.claim_count, 'total_amount', agg.total_amount) ORDER BY agg.total_amount DESC) AS data
    FROM (
      SELECT fc.vehicle_type_id, count(*)::int AS claim_count, coalesce(sum(fc.total_amount), 0)::numeric AS total_amount
      FROM filtered_claims fc
      GROUP BY fc.vehicle_type_id
    ) agg
    LEFT JOIN public.vehicle_types vt ON vt.id = agg.vehicle_type_id
  ),
  top_claims AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'claim_id', rows.id,
        'claim_number', rows.claim_number,
        'employee_id', rows.employee_code,
        'employee_name', rows.employee_name,
        'claim_date', rows.claim_date,
        'submitted_at', rows.submitted_at,
        'status_name', rows.status_name,
        'total_amount', rows.total_amount
      )
      ORDER BY rows.total_amount DESC, rows.submitted_at ASC NULLS LAST
    ) AS data
    FROM (
      SELECT
        fc.id,
        fc.claim_number,
        fc.employee_code,
        fc.employee_name,
        fc.claim_date,
        fc.submitted_at,
        CASE
          WHEN coalesce(cs.is_rejection, false) = true
            AND fc.allow_resubmit = true
            THEN 'Rejected - Allow Reclaim'
          WHEN coalesce(cs.is_rejection, false) = true
            THEN 'Rejected'
          ELSE coalesce(cs.status_name, 'Unknown')
        END AS status_name,
        fc.total_amount
      FROM filtered_claims fc
      LEFT JOIN public.claim_statuses cs ON cs.id = fc.status_id
      ORDER BY fc.total_amount DESC, fc.submitted_at ASC NULLS LAST
      LIMIT v_top_claims_limit
    ) rows
  )
  SELECT jsonb_build_object(
    'kpi', (
      SELECT jsonb_build_object(
        'total_count', k.total_count,
        'total_amount', k.total_amount,
        'avg_amount', k.avg_amount,
        'pending_count', k.pending_count,
        'pending_amount', k.pending_amount,
        'payment_released_count', k.payment_released_count,
        'payment_released_amount', k.payment_released_amount,
        'rejected_count', k.rejected_count,
        'rejected_amount', k.rejected_amount,
        'rejected_without_reclaim_count', k.rejected_without_reclaim_count,
        'rejected_without_reclaim_amount', k.rejected_without_reclaim_amount,
        'rejected_allow_reclaim_count', k.rejected_allow_reclaim_count,
        'rejected_allow_reclaim_amount', k.rejected_allow_reclaim_amount
      )
      FROM kpi k
    ),
    'by_status', coalesce((SELECT data FROM by_status), '[]'::jsonb),
    'by_designation', coalesce((SELECT data FROM by_designation), '[]'::jsonb),
    'by_work_location', coalesce((SELECT data FROM by_work_location), '[]'::jsonb),
    'by_state', coalesce((SELECT data FROM by_state), '[]'::jsonb),
    'by_vehicle_type', coalesce((SELECT data FROM by_vehicle_type), '[]'::jsonb),
    'top_claims', coalesce((SELECT data FROM top_claims), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."get_admin_dashboard_analytics"("p_date_from" "date", "p_date_to" "date", "p_claim_id" "text", "p_date_filter_field" "text", "p_designation_id" "uuid", "p_work_location_id" "uuid", "p_state_id" "uuid", "p_employee_id" "text", "p_employee_name" "text", "p_vehicle_code" "text", "p_claim_status_id" "uuid", "p_pending_only" boolean, "p_top_claims_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_admin_finance_overview_metrics"() RETURNS TABLE("total_claims_count" bigint, "total_claims_amount" numeric, "pending_finance_count" bigint, "pending_finance_amount" numeric, "payment_issued_count" bigint, "payment_issued_amount" numeric, "rejected_count" bigint, "rejected_amount" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_admin_id uuid;
BEGIN
  v_admin_id := public.require_admin_actor();

  RETURN QUERY
  WITH pending_finance_statuses AS (
    SELECT id
    FROM public.claim_statuses
    WHERE approval_level = 3
      AND is_approval = false
      AND is_rejection = false
      AND is_terminal = false
      AND is_active = true
  ),
  payment_issued_statuses AS (
    SELECT id
    FROM public.claim_statuses
    WHERE is_payment_issued = true
      AND is_active = true
  ),
  rejected_statuses AS (
    SELECT id
    FROM public.claim_statuses
    WHERE is_rejection = true
      AND is_active = true
  )
  SELECT
    count(*)::bigint,
    coalesce(sum(c.total_amount), 0)::numeric,
    count(*) FILTER (
      WHERE c.status_id IN (SELECT id FROM pending_finance_statuses)
    )::bigint,
    coalesce(
      sum(c.total_amount) FILTER (
        WHERE c.status_id IN (SELECT id FROM pending_finance_statuses)
      ),
      0
    )::numeric,
    count(*) FILTER (
      WHERE c.status_id IN (SELECT id FROM payment_issued_statuses)
    )::bigint,
    coalesce(
      sum(c.total_amount) FILTER (
        WHERE c.status_id IN (SELECT id FROM payment_issued_statuses)
      ),
      0
    )::numeric,
    count(*) FILTER (
      WHERE c.status_id IN (SELECT id FROM rejected_statuses)
    )::bigint,
    coalesce(
      sum(c.total_amount) FILTER (
        WHERE c.status_id IN (SELECT id FROM rejected_statuses)
      ),
      0
    )::numeric
  FROM public.expense_claims c;
END;
$$;


ALTER FUNCTION "public"."get_admin_finance_overview_metrics"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_admin_summary_counts"() RETURNS TABLE("total_employees" bigint, "total_claims" bigint, "pending_claims" bigint, "designation_count" bigint, "work_location_count" bigint, "vehicle_type_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  WITH pending_status_ids AS (
    SELECT cs.id
    FROM claim_statuses cs
    WHERE cs.approval_level IS NOT NULL
      AND cs.is_terminal = false
      AND cs.is_rejection = false
      AND cs.is_approval = false
      AND cs.is_active = true
  )
  SELECT
    (SELECT count(*) FROM employees)::bigint AS total_employees,
    (SELECT count(*) FROM expense_claims)::bigint AS total_claims,
    (SELECT count(*) FROM expense_claims ec
     WHERE ec.status_id IN (SELECT psi.id FROM pending_status_ids psi))::bigint AS pending_claims,
    (SELECT count(*) FROM designations d WHERE d.is_active = true)::bigint AS designation_count,
    (SELECT count(*) FROM work_locations wl WHERE wl.is_active = true)::bigint AS work_location_count,
    (SELECT count(*) FROM vehicle_types vt WHERE vt.is_active = true)::bigint AS vehicle_type_count;
END;
$$;


ALTER FUNCTION "public"."get_admin_summary_counts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_approval_employee_name_suggestions"("p_name_search" "text" DEFAULT NULL::"text", "p_limit" integer DEFAULT 50) RETURNS TABLE("employee_name" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH role_scope AS (
    SELECT
      bool_or(r.is_admin_role) AS is_admin,
      bool_or(r.role_code = 'FINANCE_TEAM') AS is_finance
    FROM public.employees cur
    JOIN public.employee_roles er ON er.employee_id = cur.id
    JOIN public.roles r ON r.id = er.role_id
    WHERE er.is_active = true
      AND lower(cur.employee_email) = current_user_email()
  ),
  scoped_claims AS (
    SELECT c.id, c.employee_id
    FROM public.expense_claims c
    WHERE
      c.id IN (SELECT public.get_my_approver_acted_claim_ids())
      OR coalesce((SELECT rs.is_admin FROM role_scope rs LIMIT 1), false)
      OR (
        coalesce((SELECT rs.is_finance FROM role_scope rs LIMIT 1), false)
        AND c.status_id IN (SELECT public.get_finance_visible_status_ids())
      )
  )
  SELECT DISTINCT owner.employee_name
  FROM scoped_claims sc
  JOIN public.employees owner ON owner.id = sc.employee_id
  WHERE
    owner.employee_name IS NOT NULL
    AND (
      p_name_search IS NULL
      OR btrim(p_name_search) = ''
      OR owner.employee_name ILIKE ('%' || btrim(p_name_search) || '%')
    )
  ORDER BY owner.employee_name
  LIMIT greatest(coalesce(p_limit, 50), 1);
$$;


ALTER FUNCTION "public"."get_approval_employee_name_suggestions"("p_name_search" "text", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_approval_history_analytics"("p_name_search" "text" DEFAULT NULL::"text", "p_claim_status_id" "uuid" DEFAULT NULL::"uuid", "p_claim_allow_resubmit" boolean DEFAULT NULL::boolean, "p_amount_operator" "text" DEFAULT 'lte'::"text", "p_amount_value" numeric DEFAULT NULL::numeric, "p_location_type" "text" DEFAULT NULL::"text", "p_claim_date_from" "date" DEFAULT NULL::"date", "p_claim_date_to" "date" DEFAULT NULL::"date", "p_hod_approved_from" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_hod_approved_to" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_finance_approved_from" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_finance_approved_to" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE("approved_count" bigint, "approved_amount" numeric, "payment_issued_count" bigint, "payment_issued_amount" numeric, "rejected_count" bigint, "rejected_amount" numeric)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH payment_issued_actions AS (
    SELECT DISTINCT
      CASE
        WHEN coalesce(to_status.is_payment_issued, false) = true
          AND cst.action_code LIKE 'finance_%'
          THEN substr(cst.action_code, length('finance_') + 1)
        ELSE cst.action_code
      END AS action_code
    FROM public.claim_status_transitions cst
    JOIN public.claim_statuses to_status ON to_status.id = cst.to_status_id
    WHERE cst.is_active = true
      AND to_status.is_active = true
      AND coalesce(to_status.is_payment_issued, false) = true
  ),
  role_scope AS (
    SELECT
      bool_or(r.is_admin_role) AS is_admin,
      bool_or(r.role_code = 'FINANCE_TEAM') AS is_finance
    FROM public.employees cur
    JOIN public.employee_roles er ON er.employee_id = cur.id
    JOIN public.roles r ON r.id = er.role_id
    WHERE er.is_active = true
      AND lower(cur.employee_email) = current_user_email()
  ),
  latest_actions AS (
    SELECT DISTINCT ON (ah.claim_id)
      ah.claim_id,
      ah.action,
      coalesce(ah.allow_resubmit, false) AS allow_resubmit,
      ah.acted_at
    FROM public.approval_history ah
    ORDER BY ah.claim_id, ah.acted_at DESC, ah.id DESC
  ),
  filtered_claims AS (
    SELECT
      c.id,
      c.total_amount,
      coalesce(cs.is_payment_issued, false) AS is_payment_issued,
      coalesce(cs.is_rejection, false) AS is_rejection
    FROM latest_actions la
    JOIN public.expense_claims c ON c.id = la.claim_id
    JOIN public.claim_statuses cs ON cs.id = c.status_id
    JOIN public.employees owner_emp ON owner_emp.id = c.employee_id
    LEFT JOIN LATERAL (
      SELECT ah_hod.acted_at AS hod_approved_at
      FROM public.approval_history ah_hod
      JOIN public.claim_statuses to_status ON to_status.id = ah_hod.new_status_id
      WHERE ah_hod.claim_id = c.id
        AND to_status.approval_level = 3
        AND to_status.is_approval = false
        AND to_status.is_rejection = false
        AND to_status.is_terminal = false
      ORDER BY ah_hod.acted_at DESC
      LIMIT 1
    ) hod_event ON true
    LEFT JOIN LATERAL (
      SELECT fa.acted_at AS finance_approved_at
      FROM public.finance_actions fa
      WHERE fa.claim_id = c.id
        AND EXISTS (
          SELECT 1
          FROM payment_issued_actions pia
          WHERE pia.action_code = CASE
            WHEN fa.action LIKE 'finance_%' THEN substr(fa.action, length('finance_') + 1)
            ELSE fa.action
          END
        )
      ORDER BY fa.acted_at DESC
      LIMIT 1
    ) finance_event ON true
    WHERE
      (
        c.id IN (SELECT public.get_my_approver_acted_claim_ids())
        OR coalesce((SELECT rs.is_admin FROM role_scope rs LIMIT 1), false)
        OR (
          coalesce((SELECT rs.is_finance FROM role_scope rs LIMIT 1), false)
          AND c.status_id IN (SELECT public.get_finance_visible_status_ids())
        )
      )
      AND (
        p_name_search IS NULL
        OR trim(p_name_search) = ''
        OR owner_emp.employee_name ILIKE ('%' || trim(p_name_search) || '%')
      )
      AND (
        p_claim_status_id IS NULL
        OR cs.id = p_claim_status_id
      )
      AND (
        p_claim_allow_resubmit IS NULL
        OR la.allow_resubmit = p_claim_allow_resubmit
      )
      AND (
        p_amount_value IS NULL
        OR (
          coalesce(nullif(trim(lower(p_amount_operator)), ''), 'lte') = 'gte'
          AND c.total_amount >= p_amount_value
        )
        OR (
          coalesce(nullif(trim(lower(p_amount_operator)), ''), 'lte') = 'eq'
          AND c.total_amount = p_amount_value
        )
        OR (
          coalesce(nullif(trim(lower(p_amount_operator)), ''), 'lte') = 'lte'
          AND c.total_amount <= p_amount_value
        )
      )
      AND (
        p_location_type IS NULL
        OR trim(p_location_type) = ''
        OR (
          lower(trim(p_location_type)) = 'outstation'
          AND EXISTS (
            SELECT 1
            FROM public.work_locations wlo
            WHERE wlo.id = c.work_location_id
              AND wlo.requires_outstation_details = true
          )
        )
        OR (
          lower(trim(p_location_type)) = 'base'
          AND EXISTS (
            SELECT 1
            FROM public.work_locations wlb
            WHERE wlb.id = c.work_location_id
              AND wlb.requires_outstation_details = false
              AND wlb.requires_vehicle_selection = true
          )
        )
      )
      AND (
        p_claim_date_from IS NULL
        OR c.claim_date >= p_claim_date_from
      )
      AND (
        p_claim_date_to IS NULL
        OR c.claim_date <= p_claim_date_to
      )
      AND (
        p_hod_approved_from IS NULL
        OR hod_event.hod_approved_at >= p_hod_approved_from
      )
      AND (
        p_hod_approved_to IS NULL
        OR hod_event.hod_approved_at <= p_hod_approved_to
      )
      AND (
        p_finance_approved_from IS NULL
        OR finance_event.finance_approved_at >= p_finance_approved_from
      )
      AND (
        p_finance_approved_to IS NULL
        OR finance_event.finance_approved_at <= p_finance_approved_to
      )
  )
  SELECT
    count(*) FILTER (WHERE is_rejection = false)::bigint AS approved_count,
    coalesce(sum(total_amount) FILTER (WHERE is_rejection = false), 0)::numeric AS approved_amount,
    count(*) FILTER (WHERE is_payment_issued = true)::bigint AS payment_issued_count,
    coalesce(sum(total_amount) FILTER (WHERE is_payment_issued = true), 0)::numeric AS payment_issued_amount,
    count(*) FILTER (WHERE is_rejection = true)::bigint AS rejected_count,
    coalesce(sum(total_amount) FILTER (WHERE is_rejection = true), 0)::numeric AS rejected_amount
  FROM filtered_claims;
$$;


ALTER FUNCTION "public"."get_approval_history_analytics"("p_name_search" "text", "p_claim_status_id" "uuid", "p_claim_allow_resubmit" boolean, "p_amount_operator" "text", "p_amount_value" numeric, "p_location_type" "text", "p_claim_date_from" "date", "p_claim_date_to" "date", "p_hod_approved_from" timestamp with time zone, "p_hod_approved_to" timestamp with time zone, "p_finance_approved_from" timestamp with time zone, "p_finance_approved_to" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_claim_available_actions"("p_claim_id" "uuid") RETURNS TABLE("action" "text", "display_label" "text", "require_notes" boolean, "supports_allow_resubmit" boolean, "actor_scope" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_email text;
  v_claim public.expense_claims%rowtype;
  v_owner public.employees%rowtype;
  v_current public.employees%rowtype;
  v_actor text;
  v_is_zbh boolean := false;
BEGIN
  v_email := public.current_user_email();
  IF coalesce(v_email, '') = '' THEN
    RETURN;
  END IF;

  SELECT *
  INTO v_claim
  FROM public.expense_claims
  WHERE id = p_claim_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT *
  INTO v_owner
  FROM public.employees
  WHERE id = v_claim.employee_id;

  SELECT *
  INTO v_current
  FROM public.employees
  WHERE lower(employee_email) = v_email;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.designations d
    WHERE d.id = v_current.designation_id
      AND d.designation_code = 'ZBH'
      AND d.is_active = true
  )
  INTO v_is_zbh;

  IF v_is_zbh THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.employee_roles er
    JOIN public.roles r ON r.id = er.role_id
    WHERE er.employee_id = v_current.id
      AND er.is_active = true
      AND r.is_admin_role = true
  ) THEN
    v_actor := 'admin';
  ELSIF EXISTS (
    SELECT 1
    FROM public.employee_roles er
    JOIN public.roles r ON r.id = er.role_id
    WHERE er.employee_id = v_current.id
      AND er.is_active = true
      AND r.is_finance_role = true
  ) THEN
    v_actor := 'finance';
  ELSIF v_owner.approval_employee_id_level_1 = v_current.id
    AND v_claim.current_approval_level = 1
  THEN
    v_actor := 'approver';
  ELSIF v_owner.approval_employee_id_level_3 = v_current.id
    AND v_claim.current_approval_level = 2
  THEN
    v_actor := 'approver';
  ELSE
    RETURN;
  END IF;

  RETURN QUERY
  WITH eligible_transitions AS (
    SELECT
      t.action_code,
      t.requires_comment,
      coalesce(t.allow_resubmit, false) AS allow_resubmit,
      t.created_at,
      to_status.is_payment_issued,
      to_status.is_rejection
    FROM public.claim_status_transitions t
    JOIN public.claim_statuses to_status ON to_status.id = t.to_status_id
    WHERE t.from_status_id = v_claim.status_id
      AND t.is_active = true
      AND t.is_auto_transition = false
      AND (
        v_actor = 'admin'
        OR t.requires_role_id IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.employee_roles er
          WHERE er.employee_id = v_current.id
            AND er.role_id = t.requires_role_id
            AND er.is_active = true
        )
      )
  ),
  normalized_transitions AS (
    SELECT
      CASE
        WHEN coalesce(is_payment_issued, false) = true
          AND action_code LIKE 'finance_%'
          THEN substr(action_code, length('finance_') + 1)
        ELSE action_code
      END AS normalized_action,
      requires_comment,
      allow_resubmit,
      is_rejection,
      created_at
    FROM eligible_transitions
  )
  SELECT
    nt.normalized_action AS action,
    initcap(replace(nt.normalized_action, '_', ' ')) AS display_label,
    bool_or(nt.requires_comment) AS require_notes,
    bool_or(nt.allow_resubmit OR coalesce(nt.is_rejection, false)) AS supports_allow_resubmit,
    v_actor AS actor_scope
  FROM normalized_transitions nt
  GROUP BY nt.normalized_action
  ORDER BY min(nt.created_at);
END;
$$;


ALTER FUNCTION "public"."get_claim_available_actions"("p_claim_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_claim_available_actions_bulk"("p_claim_ids" "uuid"[]) RETURNS TABLE("claim_id" "uuid", "action" "text", "display_label" "text", "require_notes" boolean, "supports_allow_resubmit" boolean, "actor_scope" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."get_claim_available_actions_bulk"("p_claim_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_claim_bucket_metrics"("p_claim_ids" "uuid"[] DEFAULT NULL::"uuid"[], "p_pending_status_ids" "uuid"[] DEFAULT NULL::"uuid"[], "p_approved_status_ids" "uuid"[] DEFAULT NULL::"uuid"[], "p_rejected_status_ids" "uuid"[] DEFAULT NULL::"uuid"[]) RETURNS TABLE("total_count" integer, "total_amount" numeric, "pending_count" integer, "pending_amount" numeric, "approved_count" integer, "approved_amount" numeric, "rejected_count" integer, "rejected_amount" numeric)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  WITH scoped_claims AS (
    SELECT c.status_id, c.total_amount
    FROM public.expense_claims c
    WHERE p_claim_ids IS NULL OR c.id = ANY(p_claim_ids)
  )
  SELECT
    COUNT(*)::int AS total_count,
    COALESCE(SUM(sc.total_amount), 0)::numeric AS total_amount,
    COUNT(*) FILTER (
      WHERE COALESCE(array_length(p_pending_status_ids, 1), 0) > 0
        AND sc.status_id = ANY(p_pending_status_ids)
    )::int AS pending_count,
    COALESCE(SUM(sc.total_amount) FILTER (
      WHERE COALESCE(array_length(p_pending_status_ids, 1), 0) > 0
        AND sc.status_id = ANY(p_pending_status_ids)
    ), 0)::numeric AS pending_amount,
    COUNT(*) FILTER (
      WHERE COALESCE(array_length(p_approved_status_ids, 1), 0) > 0
        AND sc.status_id = ANY(p_approved_status_ids)
    )::int AS approved_count,
    COALESCE(SUM(sc.total_amount) FILTER (
      WHERE COALESCE(array_length(p_approved_status_ids, 1), 0) > 0
        AND sc.status_id = ANY(p_approved_status_ids)
    ), 0)::numeric AS approved_amount,
    COUNT(*) FILTER (
      WHERE COALESCE(array_length(p_rejected_status_ids, 1), 0) > 0
        AND sc.status_id = ANY(p_rejected_status_ids)
    )::int AS rejected_count,
    COALESCE(SUM(sc.total_amount) FILTER (
      WHERE COALESCE(array_length(p_rejected_status_ids, 1), 0) > 0
        AND sc.status_id = ANY(p_rejected_status_ids)
    ), 0)::numeric AS rejected_amount
  FROM scoped_claims sc;
$$;


ALTER FUNCTION "public"."get_claim_bucket_metrics"("p_claim_ids" "uuid"[], "p_pending_status_ids" "uuid"[], "p_approved_status_ids" "uuid"[], "p_rejected_status_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_claim_status_id"("p_code" character varying) RETURNS "uuid"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT id FROM claim_statuses WHERE status_code = p_code;
$$;


ALTER FUNCTION "public"."get_claim_status_id"("p_code" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_designation_id"("p_code" character varying) RETURNS "uuid"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT id FROM designations WHERE designation_code = p_code;
$$;


ALTER FUNCTION "public"."get_designation_id"("p_code" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_employee_claim_metrics"("p_employee_id" "uuid") RETURNS TABLE("total_count" integer, "total_amount" numeric, "pending_count" integer, "pending_amount" numeric, "approved_count" integer, "approved_amount" numeric, "rejected_count" integer, "rejected_amount" numeric, "rejected_allow_reclaim_count" integer, "rejected_allow_reclaim_amount" numeric)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  WITH scoped_claims AS (
    SELECT
      c.total_amount,
      c.allow_resubmit,
      cs.is_rejection,
      cs.is_payment_issued
    FROM public.expense_claims c
    JOIN public.claim_statuses cs ON cs.id = c.status_id
    WHERE c.employee_id = p_employee_id
  )
  SELECT
    COUNT(*)::int AS total_count,
    COALESCE(SUM(sc.total_amount), 0)::numeric AS total_amount,
    COUNT(*) FILTER (
      WHERE NOT COALESCE(sc.is_rejection, false)
        AND NOT COALESCE(sc.is_payment_issued, false)
    )::int AS pending_count,
    COALESCE(SUM(sc.total_amount) FILTER (
      WHERE NOT COALESCE(sc.is_rejection, false)
        AND NOT COALESCE(sc.is_payment_issued, false)
    ), 0)::numeric AS pending_amount,
    COUNT(*) FILTER (
      WHERE COALESCE(sc.is_payment_issued, false)
    )::int AS approved_count,
    COALESCE(SUM(sc.total_amount) FILTER (
      WHERE COALESCE(sc.is_payment_issued, false)
    ), 0)::numeric AS approved_amount,
    COUNT(*) FILTER (
      WHERE COALESCE(sc.is_rejection, false)
        AND NOT COALESCE(sc.allow_resubmit, false)
    )::int AS rejected_count,
    COALESCE(SUM(sc.total_amount) FILTER (
      WHERE COALESCE(sc.is_rejection, false)
        AND NOT COALESCE(sc.allow_resubmit, false)
    ), 0)::numeric AS rejected_amount,
    COUNT(*) FILTER (
      WHERE COALESCE(sc.is_rejection, false)
        AND COALESCE(sc.allow_resubmit, false)
    )::int AS rejected_allow_reclaim_count,
    COALESCE(SUM(sc.total_amount) FILTER (
      WHERE COALESCE(sc.is_rejection, false)
        AND COALESCE(sc.allow_resubmit, false)
    ), 0)::numeric AS rejected_allow_reclaim_amount
  FROM scoped_claims sc;
$$;


ALTER FUNCTION "public"."get_employee_claim_metrics"("p_employee_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_filtered_approval_history"("p_limit" integer DEFAULT 10, "p_cursor_acted_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_cursor_action_id" "uuid" DEFAULT NULL::"uuid", "p_name_search" "text" DEFAULT NULL::"text", "p_actor_filters" "text"[] DEFAULT NULL::"text"[], "p_claim_status" "text" DEFAULT NULL::"text", "p_claim_status_id" "uuid" DEFAULT NULL::"uuid", "p_claim_allow_resubmit" boolean DEFAULT NULL::boolean, "p_claim_date_from" "date" DEFAULT NULL::"date", "p_claim_date_to" "date" DEFAULT NULL::"date", "p_hod_approved_from" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_hod_approved_to" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_finance_approved_from" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_finance_approved_to" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE("action_id" "uuid", "claim_id" "uuid", "claim_number" "text", "claim_date" "date", "work_location" "text", "total_amount" numeric, "claim_status" "text", "claim_status_name" "text", "claim_status_display_color" "text", "owner_name" "text", "owner_designation" "text", "actor_email" "text", "actor_designation" "text", "action" "text", "approval_level" integer, "notes" "text", "acted_at" timestamp with time zone, "hod_approved_at" timestamp with time zone, "finance_approved_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."get_filtered_approval_history"("p_limit" integer, "p_cursor_acted_at" timestamp with time zone, "p_cursor_action_id" "uuid", "p_name_search" "text", "p_actor_filters" "text"[], "p_claim_status" "text", "p_claim_status_id" "uuid", "p_claim_allow_resubmit" boolean, "p_claim_date_from" "date", "p_claim_date_to" "date", "p_hod_approved_from" timestamp with time zone, "p_hod_approved_to" timestamp with time zone, "p_finance_approved_from" timestamp with time zone, "p_finance_approved_to" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_filtered_approval_history"("p_limit" integer DEFAULT 10, "p_cursor_acted_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_cursor_action_id" "uuid" DEFAULT NULL::"uuid", "p_name_search" "text" DEFAULT NULL::"text", "p_actor_filters" "text"[] DEFAULT NULL::"text"[], "p_claim_status" "text" DEFAULT NULL::"text", "p_claim_status_id" "uuid" DEFAULT NULL::"uuid", "p_claim_allow_resubmit" boolean DEFAULT NULL::boolean, "p_amount_operator" "text" DEFAULT 'lte'::"text", "p_amount_value" numeric DEFAULT NULL::numeric, "p_location_type" "text" DEFAULT NULL::"text", "p_claim_date_from" "date" DEFAULT NULL::"date", "p_claim_date_to" "date" DEFAULT NULL::"date", "p_hod_approved_from" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_hod_approved_to" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_finance_approved_from" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_finance_approved_to" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE("action_id" "uuid", "claim_id" "uuid", "claim_number" "text", "claim_date" "date", "work_location" "text", "total_amount" numeric, "claim_status" "text", "claim_status_name" "text", "claim_status_display_color" "text", "owner_name" "text", "owner_designation" "text", "actor_email" "text", "actor_designation" "text", "action" "text", "approval_level" integer, "notes" "text", "acted_at" timestamp with time zone, "hod_approved_at" timestamp with time zone, "finance_approved_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH payment_issued_actions AS (
    SELECT DISTINCT
      CASE
        WHEN coalesce(to_status.is_payment_issued, false) = true
          AND cst.action_code LIKE 'finance_%'
          THEN substr(cst.action_code, length('finance_') + 1)
        ELSE cst.action_code
      END AS action_code
    FROM public.claim_status_transitions cst
    JOIN public.claim_statuses to_status ON to_status.id = cst.to_status_id
    WHERE cst.is_active = true
      AND to_status.is_active = true
      AND coalesce(to_status.is_payment_issued, false) = true
  ),
  role_scope AS (
    SELECT
      bool_or(r.is_admin_role) AS is_admin,
      bool_or(r.role_code = 'FINANCE_TEAM') AS is_finance
    FROM public.employees cur
    JOIN public.employee_roles er ON er.employee_id = cur.id
    JOIN public.roles r ON r.id = er.role_id
    WHERE er.is_active = true
      AND lower(cur.employee_email) = current_user_email()
  ),
  latest_actions AS (
    SELECT DISTINCT ON (ah.claim_id)
      ah.id AS action_id,
      ah.claim_id,
      ah.approver_employee_id,
      ah.action,
      ah.approval_level,
      coalesce(ah.allow_resubmit, false) AS allow_resubmit,
      ah.notes,
      ah.acted_at
    FROM public.approval_history ah
    ORDER BY ah.claim_id, ah.acted_at DESC, ah.id DESC
  )
  SELECT
    la.action_id,
    la.claim_id,
    c.claim_number,
    c.claim_date,
    wl.location_name AS work_location,
    c.total_amount,
    cs.status_code AS claim_status,
    cs.status_name AS claim_status_name,
    cs.display_color AS claim_status_display_color,
    owner_emp.employee_name AS owner_name,
    owner_desig.designation_name AS owner_designation,
    actor_emp.employee_email AS actor_email,
    actor_desig.designation_name AS actor_designation,
    la.action,
    la.approval_level,
    la.notes,
    la.acted_at,
    hod_event.hod_approved_at,
    finance_event.finance_approved_at
  FROM latest_actions la
  JOIN public.expense_claims c ON c.id = la.claim_id
  JOIN public.claim_statuses cs ON cs.id = c.status_id
  JOIN public.employees owner_emp ON owner_emp.id = c.employee_id
  LEFT JOIN public.work_locations wl ON wl.id = c.work_location_id
  LEFT JOIN public.designations owner_desig ON owner_desig.id = owner_emp.designation_id
  LEFT JOIN public.employees actor_emp ON actor_emp.id = la.approver_employee_id
  LEFT JOIN public.designations actor_desig ON actor_desig.id = actor_emp.designation_id
  LEFT JOIN LATERAL (
    SELECT ah_hod.acted_at AS hod_approved_at
    FROM public.approval_history ah_hod
    JOIN public.claim_statuses to_status ON to_status.id = ah_hod.new_status_id
    WHERE ah_hod.claim_id = c.id
      AND to_status.approval_level = 3
      AND to_status.is_approval = false
      AND to_status.is_rejection = false
      AND to_status.is_terminal = false
    ORDER BY ah_hod.acted_at DESC
    LIMIT 1
  ) hod_event ON true
  LEFT JOIN LATERAL (
    SELECT fa.acted_at AS finance_approved_at
    FROM public.finance_actions fa
    WHERE fa.claim_id = c.id
      AND EXISTS (
        SELECT 1
        FROM payment_issued_actions pia
        WHERE pia.action_code = CASE
          WHEN fa.action LIKE 'finance_%' THEN substr(fa.action, length('finance_') + 1)
          ELSE fa.action
        END
      )
    ORDER BY fa.acted_at DESC
    LIMIT 1
  ) finance_event ON true
  WHERE
    (
      c.id IN (SELECT public.get_my_approver_acted_claim_ids())
      OR coalesce((SELECT rs.is_admin FROM role_scope rs LIMIT 1), false)
      OR (
        coalesce((SELECT rs.is_finance FROM role_scope rs LIMIT 1), false)
        AND c.status_id IN (SELECT public.get_finance_visible_status_ids())
      )
    )
    AND (
      p_name_search IS NULL
      OR trim(p_name_search) = ''
      OR owner_emp.employee_name ILIKE ('%' || trim(p_name_search) || '%')
    )
    AND (
      p_claim_status_id IS NULL
      OR cs.id = p_claim_status_id
    )
    AND (
      p_claim_allow_resubmit IS NULL
      OR la.allow_resubmit = p_claim_allow_resubmit
    )
    AND (
      p_claim_status IS NULL
      OR trim(p_claim_status) = ''
      OR cs.status_code = trim(p_claim_status)
    )
    AND (
      p_amount_value IS NULL
      OR (
        coalesce(nullif(trim(lower(p_amount_operator)), ''), 'lte') = 'gte'
        AND c.total_amount >= p_amount_value
      )
      OR (
        coalesce(nullif(trim(lower(p_amount_operator)), ''), 'lte') = 'eq'
        AND c.total_amount = p_amount_value
      )
      OR (
        coalesce(nullif(trim(lower(p_amount_operator)), ''), 'lte') = 'lte'
        AND c.total_amount <= p_amount_value
      )
    )
    AND (
      p_location_type IS NULL
      OR trim(p_location_type) = ''
      OR (
        lower(trim(p_location_type)) = 'outstation'
        AND EXISTS (
          SELECT 1
          FROM public.work_locations wlo
          WHERE wlo.id = c.work_location_id
            AND wlo.requires_outstation_details = true
        )
      )
      OR (
        lower(trim(p_location_type)) = 'base'
        AND EXISTS (
          SELECT 1
          FROM public.work_locations wlb
          WHERE wlb.id = c.work_location_id
            AND wlb.requires_outstation_details = false
            AND wlb.requires_vehicle_selection = true
        )
      )
    )
    AND (
      p_claim_date_from IS NULL
      OR c.claim_date >= p_claim_date_from
    )
    AND (
      p_claim_date_to IS NULL
      OR c.claim_date <= p_claim_date_to
    )
    AND (
      p_hod_approved_from IS NULL
      OR hod_event.hod_approved_at >= p_hod_approved_from
    )
    AND (
      p_hod_approved_to IS NULL
      OR hod_event.hod_approved_at <= p_hod_approved_to
    )
    AND (
      p_finance_approved_from IS NULL
      OR finance_event.finance_approved_at >= p_finance_approved_from
    )
    AND (
      p_finance_approved_to IS NULL
      OR finance_event.finance_approved_at <= p_finance_approved_to
    )
    AND (
      p_cursor_acted_at IS NULL
      OR p_cursor_action_id IS NULL
      OR la.acted_at < p_cursor_acted_at
      OR (la.acted_at = p_cursor_acted_at AND la.action_id < p_cursor_action_id)
    )
  ORDER BY la.acted_at DESC, la.action_id DESC
  LIMIT greatest(coalesce(p_limit, 10), 1) + 1;
$$;


ALTER FUNCTION "public"."get_filtered_approval_history"("p_limit" integer, "p_cursor_acted_at" timestamp with time zone, "p_cursor_action_id" "uuid", "p_name_search" "text", "p_actor_filters" "text"[], "p_claim_status" "text", "p_claim_status_id" "uuid", "p_claim_allow_resubmit" boolean, "p_amount_operator" "text", "p_amount_value" numeric, "p_location_type" "text", "p_claim_date_from" "date", "p_claim_date_to" "date", "p_hod_approved_from" timestamp with time zone, "p_hod_approved_to" timestamp with time zone, "p_finance_approved_from" timestamp with time zone, "p_finance_approved_to" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_filtered_approval_history_count"("p_name_search" "text" DEFAULT NULL::"text", "p_actor_filters" "text"[] DEFAULT NULL::"text"[], "p_claim_status" "text" DEFAULT NULL::"text", "p_claim_status_id" "uuid" DEFAULT NULL::"uuid", "p_claim_allow_resubmit" boolean DEFAULT NULL::boolean, "p_amount_operator" "text" DEFAULT 'lte'::"text", "p_amount_value" numeric DEFAULT NULL::numeric, "p_location_type" "text" DEFAULT NULL::"text", "p_claim_date_from" "date" DEFAULT NULL::"date", "p_claim_date_to" "date" DEFAULT NULL::"date", "p_hod_approved_from" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_hod_approved_to" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_finance_approved_from" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_finance_approved_to" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS bigint
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH payment_issued_actions AS (
    SELECT DISTINCT
      CASE
        WHEN coalesce(to_status.is_payment_issued, false) = true
          AND cst.action_code LIKE 'finance_%'
          THEN substr(cst.action_code, length('finance_') + 1)
        ELSE cst.action_code
      END AS action_code
    FROM public.claim_status_transitions cst
    JOIN public.claim_statuses to_status ON to_status.id = cst.to_status_id
    WHERE cst.is_active = true
      AND to_status.is_active = true
      AND coalesce(to_status.is_payment_issued, false) = true
  ),
  role_scope AS (
    SELECT
      bool_or(r.is_admin_role) AS is_admin,
      bool_or(r.role_code = 'FINANCE_TEAM') AS is_finance
    FROM public.employees cur
    JOIN public.employee_roles er ON er.employee_id = cur.id
    JOIN public.roles r ON r.id = er.role_id
    WHERE er.is_active = true
      AND lower(cur.employee_email) = current_user_email()
  ),
  latest_actions AS (
    SELECT DISTINCT ON (ah.claim_id)
      ah.id AS action_id,
      ah.claim_id,
      ah.approver_employee_id,
      ah.action,
      ah.approval_level,
      coalesce(ah.allow_resubmit, false) AS allow_resubmit,
      ah.notes,
      ah.acted_at
    FROM public.approval_history ah
    ORDER BY ah.claim_id, ah.acted_at DESC, ah.id DESC
  )
  SELECT count(*)::bigint
  FROM latest_actions la
  JOIN public.expense_claims c ON c.id = la.claim_id
  JOIN public.claim_statuses cs ON cs.id = c.status_id
  JOIN public.employees owner_emp ON owner_emp.id = c.employee_id
  LEFT JOIN public.work_locations wl ON wl.id = c.work_location_id
  LEFT JOIN public.designations owner_desig ON owner_desig.id = owner_emp.designation_id
  LEFT JOIN public.employees actor_emp ON actor_emp.id = la.approver_employee_id
  LEFT JOIN public.designations actor_desig ON actor_desig.id = actor_emp.designation_id
  LEFT JOIN LATERAL (
    SELECT ah_hod.acted_at AS hod_approved_at
    FROM public.approval_history ah_hod
    JOIN public.claim_statuses to_status ON to_status.id = ah_hod.new_status_id
    WHERE ah_hod.claim_id = c.id
      AND to_status.approval_level = 3
      AND to_status.is_approval = false
      AND to_status.is_rejection = false
      AND to_status.is_terminal = false
    ORDER BY ah_hod.acted_at DESC
    LIMIT 1
  ) hod_event ON true
  LEFT JOIN LATERAL (
    SELECT fa.acted_at AS finance_approved_at
    FROM public.finance_actions fa
    WHERE fa.claim_id = c.id
      AND EXISTS (
        SELECT 1
        FROM payment_issued_actions pia
        WHERE pia.action_code = CASE
          WHEN fa.action LIKE 'finance_%' THEN substr(fa.action, length('finance_') + 1)
          ELSE fa.action
        END
      )
    ORDER BY fa.acted_at DESC
    LIMIT 1
  ) finance_event ON true
  WHERE
    (
      c.id IN (SELECT public.get_my_approver_acted_claim_ids())
      OR coalesce((SELECT rs.is_admin FROM role_scope rs LIMIT 1), false)
      OR (
        coalesce((SELECT rs.is_finance FROM role_scope rs LIMIT 1), false)
        AND c.status_id IN (SELECT public.get_finance_visible_status_ids())
      )
    )
    AND (
      p_name_search IS NULL
      OR trim(p_name_search) = ''
      OR owner_emp.employee_name ILIKE ('%' || trim(p_name_search) || '%')
    )
    AND (
      p_claim_status_id IS NULL
      OR cs.id = p_claim_status_id
    )
    AND (
      p_claim_allow_resubmit IS NULL
      OR la.allow_resubmit = p_claim_allow_resubmit
    )
    AND (
      p_claim_status IS NULL
      OR trim(p_claim_status) = ''
      OR cs.status_code = trim(p_claim_status)
    )
    AND (
      p_amount_value IS NULL
      OR (
        coalesce(nullif(trim(lower(p_amount_operator)), ''), 'lte') = 'gte'
        AND c.total_amount >= p_amount_value
      )
      OR (
        coalesce(nullif(trim(lower(p_amount_operator)), ''), 'lte') = 'eq'
        AND c.total_amount = p_amount_value
      )
      OR (
        coalesce(nullif(trim(lower(p_amount_operator)), ''), 'lte') = 'lte'
        AND c.total_amount <= p_amount_value
      )
    )
    AND (
      p_location_type IS NULL
      OR trim(p_location_type) = ''
      OR (
        lower(trim(p_location_type)) = 'outstation'
        AND EXISTS (
          SELECT 1
          FROM public.work_locations wlo
          WHERE wlo.id = c.work_location_id
            AND wlo.requires_outstation_details = true
        )
      )
      OR (
        lower(trim(p_location_type)) = 'base'
        AND EXISTS (
          SELECT 1
          FROM public.work_locations wlb
          WHERE wlb.id = c.work_location_id
            AND wlb.requires_outstation_details = false
            AND wlb.requires_vehicle_selection = true
        )
      )
    )
    AND (
      p_claim_date_from IS NULL
      OR c.claim_date >= p_claim_date_from
    )
    AND (
      p_claim_date_to IS NULL
      OR c.claim_date <= p_claim_date_to
    )
    AND (
      p_hod_approved_from IS NULL
      OR hod_event.hod_approved_at >= p_hod_approved_from
    )
    AND (
      p_hod_approved_to IS NULL
      OR hod_event.hod_approved_at <= p_hod_approved_to
    )
    AND (
      p_finance_approved_from IS NULL
      OR finance_event.finance_approved_at >= p_finance_approved_from
    )
    AND (
      p_finance_approved_to IS NULL
      OR finance_event.finance_approved_at <= p_finance_approved_to
    );
$$;


ALTER FUNCTION "public"."get_filtered_approval_history_count"("p_name_search" "text", "p_actor_filters" "text"[], "p_claim_status" "text", "p_claim_status_id" "uuid", "p_claim_allow_resubmit" boolean, "p_amount_operator" "text", "p_amount_value" numeric, "p_location_type" "text", "p_claim_date_from" "date", "p_claim_date_to" "date", "p_hod_approved_from" timestamp with time zone, "p_hod_approved_to" timestamp with time zone, "p_finance_approved_from" timestamp with time zone, "p_finance_approved_to" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_finance_history_action_metrics"("p_claim_ids" "uuid"[] DEFAULT NULL::"uuid"[], "p_action_filter" "text" DEFAULT NULL::"text", "p_date_from" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_date_to" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_date_scoped_actions" "text"[] DEFAULT NULL::"text"[], "p_approved_actions" "text"[] DEFAULT NULL::"text"[], "p_rejected_actions" "text"[] DEFAULT NULL::"text"[]) RETURNS TABLE("total_count" integer, "total_amount" numeric, "approved_count" integer, "approved_amount" numeric, "rejected_count" integer, "rejected_amount" numeric, "rejected_without_reclaim_count" integer, "rejected_without_reclaim_amount" numeric, "rejected_allow_reclaim_count" integer, "rejected_allow_reclaim_amount" numeric, "other_count" integer, "other_amount" numeric)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  WITH scoped_actions AS (
    SELECT
      fa.action,
      c.total_amount,
      COALESCE(c.allow_resubmit, false) AS allow_resubmit
    FROM public.finance_actions fa
    JOIN public.expense_claims c ON c.id = fa.claim_id
    WHERE (p_claim_ids IS NULL OR fa.claim_id = ANY(p_claim_ids))
      AND (p_date_from IS NULL OR fa.acted_at >= p_date_from)
      AND (p_date_to IS NULL OR fa.acted_at <= p_date_to)
      AND (
        (
          COALESCE(array_length(p_date_scoped_actions, 1), 0) > 0
          AND fa.action = ANY(p_date_scoped_actions)
        )
        OR (
          COALESCE(array_length(p_date_scoped_actions, 1), 0) = 0
          AND p_action_filter IS NOT NULL
          AND fa.action = p_action_filter
        )
        OR (
          COALESCE(array_length(p_date_scoped_actions, 1), 0) = 0
          AND p_action_filter IS NULL
        )
      )
  )
  SELECT
    COUNT(*)::int AS total_count,
    COALESCE(SUM(sa.total_amount), 0)::numeric AS total_amount,
    COUNT(*) FILTER (
      WHERE COALESCE(array_length(p_approved_actions, 1), 0) > 0
        AND sa.action = ANY(p_approved_actions)
    )::int AS approved_count,
    COALESCE(SUM(sa.total_amount) FILTER (
      WHERE COALESCE(array_length(p_approved_actions, 1), 0) > 0
        AND sa.action = ANY(p_approved_actions)
    ), 0)::numeric AS approved_amount,
    COUNT(*) FILTER (
      WHERE COALESCE(array_length(p_rejected_actions, 1), 0) > 0
        AND sa.action = ANY(p_rejected_actions)
    )::int AS rejected_count,
    COALESCE(SUM(sa.total_amount) FILTER (
      WHERE COALESCE(array_length(p_rejected_actions, 1), 0) > 0
        AND sa.action = ANY(p_rejected_actions)
    ), 0)::numeric AS rejected_amount,
    COUNT(*) FILTER (
      WHERE COALESCE(array_length(p_rejected_actions, 1), 0) > 0
        AND sa.action = ANY(p_rejected_actions)
        AND sa.allow_resubmit = false
    )::int AS rejected_without_reclaim_count,
    COALESCE(SUM(sa.total_amount) FILTER (
      WHERE COALESCE(array_length(p_rejected_actions, 1), 0) > 0
        AND sa.action = ANY(p_rejected_actions)
        AND sa.allow_resubmit = false
    ), 0)::numeric AS rejected_without_reclaim_amount,
    COUNT(*) FILTER (
      WHERE COALESCE(array_length(p_rejected_actions, 1), 0) > 0
        AND sa.action = ANY(p_rejected_actions)
        AND sa.allow_resubmit = true
    )::int AS rejected_allow_reclaim_count,
    COALESCE(SUM(sa.total_amount) FILTER (
      WHERE COALESCE(array_length(p_rejected_actions, 1), 0) > 0
        AND sa.action = ANY(p_rejected_actions)
        AND sa.allow_resubmit = true
    ), 0)::numeric AS rejected_allow_reclaim_amount,
    COUNT(*) FILTER (
      WHERE NOT (
        (
          COALESCE(array_length(p_approved_actions, 1), 0) > 0
          AND sa.action = ANY(p_approved_actions)
        )
        OR (
          COALESCE(array_length(p_rejected_actions, 1), 0) > 0
          AND sa.action = ANY(p_rejected_actions)
        )
      )
    )::int AS other_count,
    COALESCE(SUM(sa.total_amount) FILTER (
      WHERE NOT (
        (
          COALESCE(array_length(p_approved_actions, 1), 0) > 0
          AND sa.action = ANY(p_approved_actions)
        )
        OR (
          COALESCE(array_length(p_rejected_actions, 1), 0) > 0
          AND sa.action = ANY(p_rejected_actions)
        )
      )
    ), 0)::numeric AS other_amount
  FROM scoped_actions sa;
$$;


ALTER FUNCTION "public"."get_finance_history_action_metrics"("p_claim_ids" "uuid"[], "p_action_filter" "text", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone, "p_date_scoped_actions" "text"[], "p_approved_actions" "text"[], "p_rejected_actions" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_finance_pending_dashboard_analytics"("p_date_from" "date" DEFAULT NULL::"date", "p_date_to" "date" DEFAULT NULL::"date", "p_designation_id" "uuid" DEFAULT NULL::"uuid", "p_work_location_id" "uuid" DEFAULT NULL::"uuid", "p_state_id" "uuid" DEFAULT NULL::"uuid", "p_employee_id" "text" DEFAULT NULL::"text", "p_employee_name" "text" DEFAULT NULL::"text", "p_vehicle_code" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_finance_id uuid;
  v_result     jsonb;
BEGIN
  v_finance_id := public.require_finance_actor();

  WITH finance_status AS (
    SELECT cs.id
    FROM public.claim_statuses cs
    WHERE cs.approval_level = 3
      AND cs.is_approval  = false
      AND cs.is_rejection = false
      AND cs.is_terminal  = false
      AND cs.is_active    = true
    LIMIT 1
  ),
  filtered_claims AS (
    SELECT
      c.id,
      c.total_amount,
      c.designation_id,
      c.work_location_id,
      c.vehicle_type_id,
      c.submitted_at,
      c.employee_id
    FROM public.expense_claims c
    JOIN finance_status fs ON c.status_id = fs.id
    JOIN public.employees e ON e.id = c.employee_id
    WHERE true
      AND (p_date_from IS NULL OR c.claim_date >= p_date_from)
      AND (p_date_to   IS NULL OR c.claim_date <= p_date_to)
      AND (p_designation_id  IS NULL OR c.designation_id  = p_designation_id)
      AND (p_work_location_id IS NULL OR c.work_location_id = p_work_location_id)
      AND (p_employee_id IS NULL OR e.employee_id ILIKE '%' || p_employee_id || '%')
      AND (p_employee_name IS NULL OR e.employee_name ILIKE '%' || p_employee_name || '%')
      AND (p_vehicle_code IS NULL OR c.vehicle_type_id = (
        SELECT vt.id FROM public.vehicle_types vt
        WHERE vt.vehicle_code = p_vehicle_code AND vt.is_active = true
        LIMIT 1
      ))
      AND (p_state_id IS NULL OR EXISTS (
        SELECT 1 FROM public.employee_states es
        WHERE es.employee_id = c.employee_id AND es.state_id = p_state_id
      ))
  ),

  -- KPI: overall totals
  kpi AS (
    SELECT
      count(*)::int                                   AS total_count,
      coalesce(sum(fc.total_amount), 0)::numeric      AS total_amount
    FROM filtered_claims fc
  ),

  -- KPI: per-item-type amounts (joined to claim_items)
  item_totals AS (
    SELECT
      lower(ci.item_type::text) AS item_type_key,
      coalesce(sum(ci.amount), 0)::numeric AS total_amount
    FROM filtered_claims fc
    JOIN public.expense_claim_items ci ON ci.claim_id = fc.id
    GROUP BY 1
  ),

  -- By expense type (for breakdown chart)
  expense_breakdown_totals AS (
    SELECT
      CASE
        WHEN lower(ci.item_type::text) = 'food'
          AND upper(coalesce(wl.location_code, '')) = 'FIELD_BASE'
          THEN 'food_base'
        WHEN lower(ci.item_type::text) = 'food'
          AND upper(coalesce(wl.location_code, '')) = 'FIELD_OUTSTATION'
          THEN 'food_outstation'
        ELSE lower(ci.item_type::text)
      END AS expense_type,
      coalesce(sum(ci.amount), 0)::numeric AS total_amount
    FROM filtered_claims fc
    JOIN public.expense_claim_items ci ON ci.claim_id = fc.id
    JOIN public.work_locations wl ON wl.id = fc.work_location_id
    GROUP BY 1
  ),

  by_expense_type AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'expense_type', ebt.expense_type,
        'total_amount', ebt.total_amount
      )
      ORDER BY ebt.total_amount DESC
    ) AS data
    FROM expense_breakdown_totals ebt
  ),

  -- By designation
  by_designation AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'designation_name', d.designation_name,
        'total_amount',     agg.total_amount,
        'avg_amount',       agg.avg_amount,
        'claim_count',      agg.claim_count
      )
      ORDER BY agg.total_amount DESC
    ) AS data
    FROM (
      SELECT
        fc.designation_id,
        coalesce(sum(fc.total_amount), 0)::numeric  AS total_amount,
        coalesce(avg(fc.total_amount), 0)::numeric  AS avg_amount,
        count(*)::int                                AS claim_count
      FROM filtered_claims fc
      GROUP BY fc.designation_id
    ) agg
    JOIN public.designations d ON d.id = agg.designation_id
  ),

  -- By work location
  by_work_location AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'location_name', wl.location_name,
        'total_amount',  agg.total_amount,
        'claim_count',   agg.claim_count
      )
      ORDER BY agg.total_amount DESC
    ) AS data
    FROM (
      SELECT
        fc.work_location_id,
        coalesce(sum(fc.total_amount), 0)::numeric AS total_amount,
        count(*)::int                              AS claim_count
      FROM filtered_claims fc
      GROUP BY fc.work_location_id
    ) agg
    JOIN public.work_locations wl ON wl.id = agg.work_location_id
  ),

  -- By state (via employee_states junction)
  by_state AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'state_name',   s.state_name,
        'total_amount', agg.total_amount,
        'claim_count',  agg.claim_count
      )
      ORDER BY agg.total_amount DESC
    ) AS data
    FROM (
      SELECT
        es.state_id,
        coalesce(sum(fc.total_amount), 0)::numeric AS total_amount,
        count(*)::int                              AS claim_count
      FROM filtered_claims fc
      JOIN public.employee_states es
        ON es.employee_id = fc.employee_id AND es.is_primary = true
      GROUP BY es.state_id
    ) agg
    JOIN public.states s ON s.id = agg.state_id
  ),

  -- By vehicle type
  by_vehicle_type AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'vehicle_name', coalesce(vt.vehicle_name, 'No Vehicle'),
        'total_amount', agg.total_amount,
        'claim_count',  agg.claim_count
      )
      ORDER BY agg.total_amount DESC
    ) AS data
    FROM (
      SELECT
        fc.vehicle_type_id,
        coalesce(sum(fc.total_amount), 0)::numeric AS total_amount,
        count(*)::int                              AS claim_count
      FROM filtered_claims fc
      GROUP BY fc.vehicle_type_id
    ) agg
    LEFT JOIN public.vehicle_types vt ON vt.id = agg.vehicle_type_id
  )

  SELECT jsonb_build_object(
    'kpi', (
      SELECT jsonb_build_object(
        'total_count',  k.total_count,
        'total_amount', k.total_amount,
        'food_amount',              coalesce((SELECT total_amount FROM item_totals WHERE item_type_key = 'food'), 0),
        'fuel_amount',              coalesce((SELECT total_amount FROM item_totals WHERE item_type_key = 'fuel'), 0),
        'intercity_travel_amount',  coalesce((SELECT total_amount FROM item_totals WHERE item_type_key = 'intercity_travel'), 0),
        'intracity_allowance_amount', coalesce((SELECT total_amount FROM item_totals WHERE item_type_key = 'intracity_allowance'), 0)
      ) FROM kpi k
    ),
    'by_expense_type',    coalesce((SELECT data FROM by_expense_type),    '[]'::jsonb),
    'by_designation',     coalesce((SELECT data FROM by_designation),     '[]'::jsonb),
    'by_work_location',   coalesce((SELECT data FROM by_work_location),   '[]'::jsonb),
    'by_state',           coalesce((SELECT data FROM by_state),           '[]'::jsonb),
    'by_vehicle_type',    coalesce((SELECT data FROM by_vehicle_type),    '[]'::jsonb)
  )
  INTO v_result;

  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."get_finance_pending_dashboard_analytics"("p_date_from" "date", "p_date_to" "date", "p_designation_id" "uuid", "p_work_location_id" "uuid", "p_state_id" "uuid", "p_employee_id" "text", "p_employee_name" "text", "p_vehicle_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_finance_pending_dashboard_analytics"("p_date_from" "date" DEFAULT NULL::"date", "p_date_to" "date" DEFAULT NULL::"date", "p_designation_id" "uuid" DEFAULT NULL::"uuid", "p_work_location_id" "uuid" DEFAULT NULL::"uuid", "p_state_id" "uuid" DEFAULT NULL::"uuid", "p_employee_id" "text" DEFAULT NULL::"text", "p_employee_name" "text" DEFAULT NULL::"text", "p_vehicle_code" "text" DEFAULT NULL::"text", "p_date_filter_field" "text" DEFAULT 'travel_date'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_finance_id uuid;
  v_result jsonb;
  v_date_filter_field text;
BEGIN
  v_finance_id := public.require_finance_actor();
  v_date_filter_field := lower(
    coalesce(nullif(trim(p_date_filter_field), ''), 'travel_date')
  );
  IF v_date_filter_field NOT IN ('travel_date', 'submission_date') THEN
    RAISE EXCEPTION 'Invalid date filter field. Expected travel_date or submission_date.';
  END IF;
  WITH finance_status AS (
    SELECT cs.id
    FROM public.claim_statuses cs
    WHERE cs.approval_level = 3
      AND cs.is_approval = false
      AND cs.is_rejection = false
      AND cs.is_terminal = false
      AND cs.is_active = true
    LIMIT 1
  ),
  filtered_claims AS (
    SELECT
      c.id,
      c.total_amount,
      c.designation_id,
      c.work_location_id,
      c.vehicle_type_id,
      c.submitted_at,
      c.employee_id,
      c.claim_date
    FROM public.expense_claims c
    JOIN finance_status fs ON c.status_id = fs.id
    JOIN public.employees e ON e.id = c.employee_id
    WHERE true
      AND (
        p_date_from IS NULL
        OR (
          (v_date_filter_field = 'travel_date' AND c.claim_date >= p_date_from)
          OR (
            v_date_filter_field = 'submission_date'
            AND c.submitted_at::date >= p_date_from
          )
        )
      )
      AND (
        p_date_to IS NULL
        OR (
          (v_date_filter_field = 'travel_date' AND c.claim_date <= p_date_to)
          OR (
            v_date_filter_field = 'submission_date'
            AND c.submitted_at::date <= p_date_to
          )
        )
      )
      AND (p_designation_id IS NULL OR c.designation_id = p_designation_id)
      AND (
        p_work_location_id IS NULL
        OR c.work_location_id = p_work_location_id
      )
      AND (
        p_employee_id IS NULL
        OR e.employee_id ILIKE '%' || p_employee_id || '%'
      )
      AND (
        p_employee_name IS NULL
        OR e.employee_name ILIKE '%' || p_employee_name || '%'
      )
      AND (
        p_vehicle_code IS NULL
        OR c.vehicle_type_id = (
          SELECT vt.id
          FROM public.vehicle_types vt
          WHERE vt.vehicle_code = p_vehicle_code
            AND vt.is_active = true
          LIMIT 1
        )
      )
      AND (
        p_state_id IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.employee_states es
          WHERE es.employee_id = c.employee_id
            AND es.state_id = p_state_id
        )
      )
  ),
  kpi AS (
    SELECT
      count(*)::int AS total_count,
      coalesce(sum(fc.total_amount), 0)::numeric AS total_amount
    FROM filtered_claims fc
  ),
  item_totals AS (
    SELECT
      lower(ci.item_type::text) AS item_type_key,
      coalesce(sum(ci.amount), 0)::numeric AS total_amount
    FROM filtered_claims fc
    JOIN public.expense_claim_items ci ON ci.claim_id = fc.id
    GROUP BY 1
  ),
  expense_breakdown_totals AS (
    SELECT
      CASE
        WHEN lower(ci.item_type::text) = 'food'
          AND upper(coalesce(wl.location_code, '')) = 'FIELD_BASE'
          THEN 'food_base'
        WHEN lower(ci.item_type::text) = 'food'
          AND upper(coalesce(wl.location_code, '')) = 'FIELD_OUTSTATION'
          THEN 'food_outstation'
        ELSE lower(ci.item_type::text)
      END AS expense_type,
      coalesce(sum(ci.amount), 0)::numeric AS total_amount
    FROM filtered_claims fc
    JOIN public.expense_claim_items ci ON ci.claim_id = fc.id
    JOIN public.work_locations wl ON wl.id = fc.work_location_id
    GROUP BY 1
  ),
  by_expense_type AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'expense_type', ebt.expense_type,
        'total_amount', ebt.total_amount
      )
      ORDER BY ebt.total_amount DESC
    ) AS data
    FROM expense_breakdown_totals ebt
  ),
  by_designation AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'designation_name', d.designation_name,
        'total_amount', agg.total_amount,
        'avg_amount', agg.avg_amount,
        'claim_count', agg.claim_count
      )
      ORDER BY agg.total_amount DESC
    ) AS data
    FROM (
      SELECT
        fc.designation_id,
        coalesce(sum(fc.total_amount), 0)::numeric AS total_amount,
        coalesce(avg(fc.total_amount), 0)::numeric AS avg_amount,
        count(*)::int AS claim_count
      FROM filtered_claims fc
      GROUP BY fc.designation_id
    ) agg
    JOIN public.designations d ON d.id = agg.designation_id
  ),
  by_work_location AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'location_name', wl.location_name,
        'total_amount', agg.total_amount,
        'claim_count', agg.claim_count
      )
      ORDER BY agg.total_amount DESC
    ) AS data
    FROM (
      SELECT
        fc.work_location_id,
        coalesce(sum(fc.total_amount), 0)::numeric AS total_amount,
        count(*)::int AS claim_count
      FROM filtered_claims fc
      GROUP BY fc.work_location_id
    ) agg
    JOIN public.work_locations wl ON wl.id = agg.work_location_id
  ),
  by_state AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'state_name', s.state_name,
        'total_amount', agg.total_amount,
        'claim_count', agg.claim_count
      )
      ORDER BY agg.total_amount DESC
    ) AS data
    FROM (
      SELECT
        es.state_id,
        coalesce(sum(fc.total_amount), 0)::numeric AS total_amount,
        count(*)::int AS claim_count
      FROM filtered_claims fc
      JOIN public.employee_states es
        ON es.employee_id = fc.employee_id
       AND es.is_primary = true
      GROUP BY es.state_id
    ) agg
    JOIN public.states s ON s.id = agg.state_id
  ),
  by_vehicle_type AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'vehicle_name', coalesce(vt.vehicle_name, 'No Vehicle'),
        'total_amount', agg.total_amount,
        'claim_count', agg.claim_count
      )
      ORDER BY agg.total_amount DESC
    ) AS data
    FROM (
      SELECT
        fc.vehicle_type_id,
        coalesce(sum(fc.total_amount), 0)::numeric AS total_amount,
        count(*)::int AS claim_count
      FROM filtered_claims fc
      GROUP BY fc.vehicle_type_id
    ) agg
    LEFT JOIN public.vehicle_types vt ON vt.id = agg.vehicle_type_id
  )
  SELECT jsonb_build_object(
    'kpi', (
      SELECT jsonb_build_object(
        'total_count', k.total_count,
        'total_amount', k.total_amount,
        'food_amount', coalesce((SELECT total_amount FROM item_totals WHERE item_type_key = 'food'), 0),
        'fuel_amount', coalesce((SELECT total_amount FROM item_totals WHERE item_type_key = 'fuel'), 0),
        'intercity_travel_amount', coalesce((SELECT total_amount FROM item_totals WHERE item_type_key = 'intercity_travel'), 0),
        'intracity_allowance_amount', coalesce((SELECT total_amount FROM item_totals WHERE item_type_key = 'intracity_allowance'), 0)
      )
      FROM kpi k
    ),
    'by_expense_type', coalesce((SELECT data FROM by_expense_type), '[]'::jsonb),
    'by_designation', coalesce((SELECT data FROM by_designation), '[]'::jsonb),
    'by_work_location', coalesce((SELECT data FROM by_work_location), '[]'::jsonb),
    'by_state', coalesce((SELECT data FROM by_state), '[]'::jsonb),
    'by_vehicle_type', coalesce((SELECT data FROM by_vehicle_type), '[]'::jsonb)
  )
  INTO v_result;
  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."get_finance_pending_dashboard_analytics"("p_date_from" "date", "p_date_to" "date", "p_designation_id" "uuid", "p_work_location_id" "uuid", "p_state_id" "uuid", "p_employee_id" "text", "p_employee_name" "text", "p_vehicle_code" "text", "p_date_filter_field" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_finance_pending_dashboard_analytics"("p_date_from" "date" DEFAULT NULL::"date", "p_date_to" "date" DEFAULT NULL::"date", "p_claim_id" "text" DEFAULT NULL::"text", "p_designation_id" "uuid" DEFAULT NULL::"uuid", "p_work_location_id" "uuid" DEFAULT NULL::"uuid", "p_state_id" "uuid" DEFAULT NULL::"uuid", "p_employee_id" "text" DEFAULT NULL::"text", "p_employee_name" "text" DEFAULT NULL::"text", "p_vehicle_code" "text" DEFAULT NULL::"text", "p_date_filter_field" "text" DEFAULT 'travel_date'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_finance_id uuid;
  v_result jsonb;
  v_date_filter_field text;
BEGIN
  v_finance_id := public.require_finance_actor();
  v_date_filter_field := lower(coalesce(nullif(trim(p_date_filter_field), ''), 'travel_date'));

  IF v_date_filter_field NOT IN ('travel_date', 'submission_date') THEN
    RAISE EXCEPTION 'Invalid date filter field. Expected travel_date or submission_date.';
  END IF;

  WITH finance_status AS (
    SELECT cs.id
    FROM public.claim_statuses cs
    WHERE cs.approval_level = 3
      AND cs.is_approval = false
      AND cs.is_rejection = false
      AND cs.is_terminal = false
      AND cs.is_active = true
    LIMIT 1
  ),
  filtered_claims AS (
    SELECT
      c.id,
      c.total_amount,
      c.designation_id,
      c.work_location_id,
      c.vehicle_type_id,
      c.submitted_at,
      c.employee_id,
      c.claim_date
    FROM public.expense_claims c
    JOIN finance_status fs ON c.status_id = fs.id
    JOIN public.employees e ON e.id = c.employee_id
    WHERE true
      AND (
        p_date_from IS NULL
        OR (
          (v_date_filter_field = 'travel_date' AND c.claim_date >= p_date_from)
          OR (v_date_filter_field = 'submission_date' AND c.submitted_at::date >= p_date_from)
        )
      )
      AND (
        p_date_to IS NULL
        OR (
          (v_date_filter_field = 'travel_date' AND c.claim_date <= p_date_to)
          OR (v_date_filter_field = 'submission_date' AND c.submitted_at::date <= p_date_to)
        )
      )
      AND (
        p_claim_id IS NULL
        OR c.claim_number ILIKE '%' || p_claim_id || '%'
        OR c.id::text ILIKE '%' || p_claim_id || '%'
      )
      AND (p_designation_id IS NULL OR c.designation_id = p_designation_id)
      AND (p_work_location_id IS NULL OR c.work_location_id = p_work_location_id)
      AND (p_employee_id IS NULL OR e.employee_id ILIKE '%' || p_employee_id || '%')
      AND (p_employee_name IS NULL OR e.employee_name ILIKE '%' || p_employee_name || '%')
      AND (
        p_vehicle_code IS NULL
        OR c.vehicle_type_id = (
          SELECT vt.id
          FROM public.vehicle_types vt
          WHERE vt.vehicle_code = p_vehicle_code
            AND vt.is_active = true
          LIMIT 1
        )
      )
      AND (
        p_state_id IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.employee_states es
          WHERE es.employee_id = c.employee_id
            AND es.state_id = p_state_id
        )
      )
  ),
  kpi AS (
    SELECT
      count(*)::int AS total_count,
      coalesce(sum(fc.total_amount), 0)::numeric AS total_amount
    FROM filtered_claims fc
  ),
  item_totals AS (
    SELECT
      lower(ci.item_type::text) AS item_type_key,
      coalesce(sum(ci.amount), 0)::numeric AS total_amount
    FROM filtered_claims fc
    JOIN public.expense_claim_items ci ON ci.claim_id = fc.id
    GROUP BY 1
  ),
  expense_breakdown_totals AS (
    SELECT
      CASE
        WHEN lower(ci.item_type::text) = 'food'
          AND upper(coalesce(wl.location_code, '')) = 'FIELD_BASE'
          THEN 'food_base'
        WHEN lower(ci.item_type::text) = 'food'
          AND upper(coalesce(wl.location_code, '')) = 'FIELD_OUTSTATION'
          THEN 'food_outstation'
        ELSE lower(ci.item_type::text)
      END AS expense_type,
      coalesce(sum(ci.amount), 0)::numeric AS total_amount
    FROM filtered_claims fc
    JOIN public.expense_claim_items ci ON ci.claim_id = fc.id
    JOIN public.work_locations wl ON wl.id = fc.work_location_id
    GROUP BY 1
  ),
  by_expense_type AS (
    SELECT jsonb_agg(
      jsonb_build_object('expense_type', ebt.expense_type, 'total_amount', ebt.total_amount)
      ORDER BY ebt.total_amount DESC
    ) AS data
    FROM expense_breakdown_totals ebt
  ),
  by_designation AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'designation_name', d.designation_name,
        'total_amount', agg.total_amount,
        'avg_amount', agg.avg_amount,
        'claim_count', agg.claim_count
      )
      ORDER BY agg.total_amount DESC
    ) AS data
    FROM (
      SELECT
        fc.designation_id,
        coalesce(sum(fc.total_amount), 0)::numeric AS total_amount,
        coalesce(avg(fc.total_amount), 0)::numeric AS avg_amount,
        count(*)::int AS claim_count
      FROM filtered_claims fc
      GROUP BY fc.designation_id
    ) agg
    JOIN public.designations d ON d.id = agg.designation_id
  ),
  by_work_location AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'location_name', wl.location_name,
        'total_amount', agg.total_amount,
        'claim_count', agg.claim_count
      )
      ORDER BY agg.total_amount DESC
    ) AS data
    FROM (
      SELECT
        fc.work_location_id,
        coalesce(sum(fc.total_amount), 0)::numeric AS total_amount,
        count(*)::int AS claim_count
      FROM filtered_claims fc
      GROUP BY fc.work_location_id
    ) agg
    JOIN public.work_locations wl ON wl.id = agg.work_location_id
  ),
  by_state AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'state_name', s.state_name,
        'total_amount', agg.total_amount,
        'claim_count', agg.claim_count
      )
      ORDER BY agg.total_amount DESC
    ) AS data
    FROM (
      SELECT
        es.state_id,
        coalesce(sum(fc.total_amount), 0)::numeric AS total_amount,
        count(*)::int AS claim_count
      FROM filtered_claims fc
      JOIN public.employee_states es
        ON es.employee_id = fc.employee_id
       AND es.is_primary = true
      GROUP BY es.state_id
    ) agg
    JOIN public.states s ON s.id = agg.state_id
  ),
  by_vehicle_type AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'vehicle_name', coalesce(vt.vehicle_name, 'No Vehicle'),
        'total_amount', agg.total_amount,
        'claim_count', agg.claim_count
      )
      ORDER BY agg.total_amount DESC
    ) AS data
    FROM (
      SELECT
        fc.vehicle_type_id,
        coalesce(sum(fc.total_amount), 0)::numeric AS total_amount,
        count(*)::int AS claim_count
      FROM filtered_claims fc
      GROUP BY fc.vehicle_type_id
    ) agg
    LEFT JOIN public.vehicle_types vt ON vt.id = agg.vehicle_type_id
  )
  SELECT jsonb_build_object(
    'kpi', (
      SELECT jsonb_build_object(
        'total_count', k.total_count,
        'total_amount', k.total_amount,
        'food_amount', coalesce((SELECT total_amount FROM item_totals WHERE item_type_key = 'food'), 0),
        'fuel_amount', coalesce((SELECT total_amount FROM item_totals WHERE item_type_key = 'fuel'), 0),
        'intercity_travel_amount', coalesce((SELECT total_amount FROM item_totals WHERE item_type_key = 'intercity_travel'), 0),
        'intracity_allowance_amount', coalesce((SELECT total_amount FROM item_totals WHERE item_type_key = 'intracity_allowance'), 0)
      )
      FROM kpi k
    ),
    'by_expense_type', coalesce((SELECT data FROM by_expense_type), '[]'::jsonb),
    'by_designation', coalesce((SELECT data FROM by_designation), '[]'::jsonb),
    'by_work_location', coalesce((SELECT data FROM by_work_location), '[]'::jsonb),
    'by_state', coalesce((SELECT data FROM by_state), '[]'::jsonb),
    'by_vehicle_type', coalesce((SELECT data FROM by_vehicle_type), '[]'::jsonb)
  )
  INTO v_result;

  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."get_finance_pending_dashboard_analytics"("p_date_from" "date", "p_date_to" "date", "p_claim_id" "text", "p_designation_id" "uuid", "p_work_location_id" "uuid", "p_state_id" "uuid", "p_employee_id" "text", "p_employee_name" "text", "p_vehicle_code" "text", "p_date_filter_field" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_finance_visible_status_ids"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT cs.id
  FROM public.claim_statuses cs
  WHERE cs.is_active = true
    AND (
      coalesce(cs.approval_level, 0) = 3
      OR coalesce(cs.is_payment_issued, false) = true
      OR (coalesce(cs.is_approval, false) = true AND cs.approval_level IS NULL)
      OR (coalesce(cs.is_rejection, false) = true AND cs.approval_level IS NULL)
    );
$$;


ALTER FUNCTION "public"."get_finance_visible_status_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_latest_finance_action_id"("p_claim_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT fa.id
  FROM public.finance_actions fa
  WHERE fa.claim_id = p_claim_id
  ORDER BY fa.acted_at DESC, fa.id DESC
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_latest_finance_action_id"("p_claim_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_approver_acted_claim_ids"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH RECURSIVE me AS (
    SELECT
      e.id AS employee_id,
      d.designation_code
    FROM public.employees e
    LEFT JOIN public.designations d
      ON d.id = e.designation_id
    WHERE lower(e.employee_email) = current_user_email()
    LIMIT 1
  ),
  inherited_approver_scope AS (
    SELECT me.employee_id AS approver_employee_id
    FROM me
    WHERE me.employee_id IS NOT NULL

    UNION

    SELECT er.old_employee_id AS approver_employee_id
    FROM public.employee_replacements er
    JOIN inherited_approver_scope scope
      ON er.new_employee_id = scope.approver_employee_id
    WHERE er.completed_at IS NOT NULL
  ),
  acted_claim_ids AS (
    SELECT DISTINCT ah.claim_id
    FROM public.approval_history ah
    JOIN inherited_approver_scope scope
      ON scope.approver_employee_id = ah.approver_employee_id
  ),
  zbh_scoped_claim_ids AS (
    SELECT c.id AS claim_id
    FROM public.expense_claims c
    JOIN public.employees owner
      ON owner.id = c.employee_id
    JOIN me
      ON true
    WHERE me.designation_code = 'ZBH'
      AND owner.approval_employee_id_level_2 = me.employee_id
  )
  SELECT claim_id
  FROM acted_claim_ids

  UNION

  SELECT claim_id
  FROM zbh_scoped_claim_ids;
$$;


ALTER FUNCTION "public"."get_my_approver_acted_claim_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_pending_approval_scope_summary"("p_level1_employee_ids" "uuid"[] DEFAULT NULL::"uuid"[], "p_level2_employee_ids" "uuid"[] DEFAULT NULL::"uuid"[], "p_pending_status_ids" "uuid"[] DEFAULT NULL::"uuid"[], "p_allow_resubmit" boolean DEFAULT NULL::boolean, "p_employee_name" "text" DEFAULT NULL::"text", "p_claim_date_from" "date" DEFAULT NULL::"date", "p_claim_date_to" "date" DEFAULT NULL::"date", "p_amount_operator" "text" DEFAULT NULL::"text", "p_amount_value" numeric DEFAULT NULL::numeric, "p_location_ids" "uuid"[] DEFAULT NULL::"uuid"[]) RETURNS TABLE("claim_count" integer, "total_amount" numeric)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  WITH scoped_claims AS (
    SELECT c.total_amount
    FROM public.expense_claims c
    JOIN public.employees e ON e.id = c.employee_id
    WHERE (
      COALESCE(array_length(p_pending_status_ids, 1), 0) = 0
      OR c.status_id = ANY(p_pending_status_ids)
    )
      AND (
        (
          COALESCE(array_length(p_level1_employee_ids, 1), 0) > 0
          AND c.current_approval_level = 1
          AND c.employee_id = ANY(p_level1_employee_ids)
        )
        OR (
          COALESCE(array_length(p_level2_employee_ids, 1), 0) > 0
          AND c.current_approval_level = 2
          AND c.employee_id = ANY(p_level2_employee_ids)
        )
      )
      AND (p_allow_resubmit IS NULL OR c.allow_resubmit = p_allow_resubmit)
      AND (
        p_employee_name IS NULL
        OR e.employee_name ILIKE '%' || p_employee_name || '%'
      )
      AND (p_claim_date_from IS NULL OR c.claim_date >= p_claim_date_from)
      AND (p_claim_date_to IS NULL OR c.claim_date <= p_claim_date_to)
      AND (
        p_amount_value IS NULL
        OR (
          COALESCE(p_amount_operator, 'lte') = 'gte'
          AND c.total_amount >= p_amount_value
        )
        OR (
          COALESCE(p_amount_operator, 'lte') = 'eq'
          AND c.total_amount = p_amount_value
        )
        OR (
          COALESCE(p_amount_operator, 'lte') NOT IN ('gte', 'eq')
          AND c.total_amount <= p_amount_value
        )
      )
      AND (
        COALESCE(array_length(p_location_ids, 1), 0) = 0
        OR c.work_location_id = ANY(p_location_ids)
      )
  )
  SELECT
    COUNT(*)::int AS claim_count,
    COALESCE(SUM(sc.total_amount), 0)::numeric AS total_amount
  FROM scoped_claims sc;
$$;


ALTER FUNCTION "public"."get_pending_approval_scope_summary"("p_level1_employee_ids" "uuid"[], "p_level2_employee_ids" "uuid"[], "p_pending_status_ids" "uuid"[], "p_allow_resubmit" boolean, "p_employee_name" "text", "p_claim_date_from" "date", "p_claim_date_to" "date", "p_amount_operator" "text", "p_amount_value" numeric, "p_location_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_work_location_id"("p_code" character varying) RETURNS "uuid"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT id FROM work_locations WHERE location_code = p_code;
$$;


ALTER FUNCTION "public"."get_work_location_id"("p_code" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reassign_orphaned_approvals"("p_old_approver_id" "uuid", "p_new_approver_id" "uuid", "p_admin_employee_id" "uuid", "p_reason" "text" DEFAULT 'Approver reassignment'::"text") RETURNS TABLE("reassigned_count" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_count INTEGER := 0;
  v_level1_count INTEGER := 0;
  v_level3_count INTEGER := 0;
BEGIN
  -- Verify admin role
  IF NOT EXISTS (
    SELECT 1 FROM employee_roles er
    JOIN roles r ON er.role_id = r.id
    WHERE er.employee_id = p_admin_employee_id
      AND r.role_code = 'ADMIN'
      AND er.is_active = true
  ) THEN
    RAISE EXCEPTION 'Only admin can reassign approvals';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM employees WHERE id = p_old_approver_id) THEN
    RAISE EXCEPTION 'Old approver not found: %', p_old_approver_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM employees WHERE id = p_new_approver_id) THEN
    RAISE EXCEPTION 'New approver not found: %', p_new_approver_id;
  END IF;

  -- Reassign Level 1 approvals
  UPDATE employees
  SET approval_employee_id_level_1 = p_new_approver_id
  WHERE approval_employee_id_level_1 = p_old_approver_id;
  GET DIAGNOSTICS v_level1_count = ROW_COUNT;

  -- Reassign Level 3 (HOD/final) approvals
  UPDATE employees
  SET approval_employee_id_level_3 = p_new_approver_id
  WHERE approval_employee_id_level_3 = p_old_approver_id;
  GET DIAGNOSTICS v_level3_count = ROW_COUNT;

  v_count := v_level1_count + v_level3_count;

  -- Audit log entry
  INSERT INTO employee_designation_history (employee_id, new_designation_id, changed_by, reason)
  VALUES (
    p_old_approver_id,
    (SELECT designation_id FROM employees WHERE id = p_old_approver_id),
    p_admin_employee_id,
    format('Approval reassignment to %s: %s', p_new_approver_id, p_reason)
  );

  RETURN QUERY SELECT v_count;
END;
$$;


ALTER FUNCTION "public"."reassign_orphaned_approvals"("p_old_approver_id" "uuid", "p_new_approver_id" "uuid", "p_admin_employee_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."require_admin_actor"() RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_actor_email text;
  v_admin_id uuid;
BEGIN
  v_actor_email := public.current_user_email();

  IF coalesce(v_actor_email, '') = '' THEN
    RAISE EXCEPTION 'Unauthorized request.';
  END IF;

  SELECT e.id
  INTO v_admin_id
  FROM public.employees e
  WHERE lower(e.employee_email) = v_actor_email;

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Admin access is required.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.employee_roles er
    JOIN public.roles r ON r.id = er.role_id
    WHERE er.employee_id = v_admin_id
      AND er.is_active = true
      AND r.is_admin_role = true
  ) THEN
    RAISE EXCEPTION 'Admin access is required.';
  END IF;

  RETURN v_admin_id;
END;
$$;


ALTER FUNCTION "public"."require_admin_actor"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."require_finance_actor"() RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_actor_email text;
  v_finance_id uuid;
BEGIN
  v_actor_email := public.current_user_email();
  IF coalesce(v_actor_email, '') = '' THEN
    RAISE EXCEPTION 'Unauthorized request.';
  END IF;
  SELECT e.id
  INTO v_finance_id
  FROM public.employees e
  WHERE lower(e.employee_email) = v_actor_email;
  IF v_finance_id IS NULL THEN
    RAISE EXCEPTION 'Finance access is required.';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.employee_roles er
    JOIN public.roles r ON r.id = er.role_id
    WHERE er.employee_id = v_finance_id
      AND er.is_active = true
      AND r.is_finance_role = true
  ) THEN
    RAISE EXCEPTION 'Finance access is required.';
  END IF;
  RETURN v_finance_id;
END;
$$;


ALTER FUNCTION "public"."require_finance_actor"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_claim_allow_resubmit_filter"("p_claim_status_id" "uuid", "p_claim_allow_resubmit" boolean DEFAULT NULL::boolean) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT CASE
    WHEN p_claim_allow_resubmit IS NOT NULL THEN p_claim_allow_resubmit
    WHEN p_claim_status_id IS NULL THEN NULL
    WHEN EXISTS (
      SELECT 1
      FROM public.claim_statuses cs
      WHERE cs.id = p_claim_status_id
        AND NULLIF(BTRIM(COALESCE(cs.allow_resubmit_status_name, '')), '') IS NOT NULL
    ) THEN false
    ELSE NULL
  END;
$$;


ALTER FUNCTION "public"."resolve_claim_allow_resubmit_filter"("p_claim_status_id" "uuid", "p_claim_allow_resubmit" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resubmit_claim_after_rejection_atomic"("p_claim_id" "uuid", "p_notes" "text" DEFAULT NULL::"text") RETURNS TABLE("claim_id" "uuid", "new_status_code" "text", "new_approval_level" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_email text;
  v_claim public.expense_claims%rowtype;
  v_status_code text;
begin
  v_email := public.current_user_email();
  if coalesce(v_email, '') = '' then
    raise exception 'Unauthorized request.';
  end if;

  select c.* into v_claim
  from public.expense_claims c
  join public.employees e on e.id = c.employee_id
  where c.id = p_claim_id
    and lower(e.employee_email) = v_email
  for update;

  if not found then
    raise exception 'Claim not found for current employee.';
  end if;

  select cs.status_code into v_status_code
  from public.claim_statuses cs
  where cs.id = v_claim.status_id;

  if v_status_code not in ('L1_PENDING', 'L2_PENDING', 'L3_PENDING_FINANCE_REVIEW') then
    raise exception 'Claim is not in an active workflow state.';
  end if;

  return query
  select v_claim.id, v_status_code, v_claim.current_approval_level;
end;
$$;


ALTER FUNCTION "public"."resubmit_claim_after_rejection_atomic"("p_claim_id" "uuid", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_claim_number_before_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if coalesce(trim(new.claim_number), '') = '' then
    new.claim_number := public.generate_claim_number(new.employee_id, new.claim_date);
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."set_claim_number_before_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_approval_action_atomic"("p_claim_id" "uuid", "p_action" "text", "p_notes" "text" DEFAULT NULL::"text", "p_allow_resubmit" boolean DEFAULT NULL::boolean) RETURNS TABLE("claim_id" "uuid", "new_status_code" "text", "new_approval_level" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_email text;
  v_actor_employee_id uuid;
  v_claim public.expense_claims%rowtype;
  v_owner public.employees%rowtype;
  v_transition public.claim_status_transitions%rowtype;
  v_notes text;
  v_requested_action text;
  v_level int;
  v_next_status_code text;
  v_next_status_id uuid;
  v_old_status_id uuid;
  v_next_approval_level int;
  v_to_status_approval_level int;
  v_to_status_is_approval boolean;
  v_to_status_is_rejection boolean;
  v_to_status_is_terminal boolean;
BEGIN
  v_requested_action := nullif(trim(coalesce(p_action, '')), '');
  IF v_requested_action IS NULL THEN
    RAISE EXCEPTION 'Unsupported approval action.';
  END IF;

  v_email := public.current_user_email();
  IF coalesce(v_email, '') = '' THEN
    RAISE EXCEPTION 'Unauthorized request.';
  END IF;

  v_notes := nullif(trim(coalesce(p_notes, '')), '');

  SELECT id
  INTO v_actor_employee_id
  FROM public.employees
  WHERE lower(employee_email) = v_email;

  IF v_actor_employee_id IS NULL THEN
    RAISE EXCEPTION 'Employee record not found.';
  END IF;

  SELECT *
  INTO v_claim
  FROM public.expense_claims
  WHERE id = p_claim_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Claim not found.';
  END IF;

  SELECT *
  INTO v_owner
  FROM public.employees
  WHERE id = v_claim.employee_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Claim owner not found.';
  END IF;

  v_level := v_claim.current_approval_level;

  IF v_level = 1 THEN
    IF v_owner.approval_employee_id_level_1 IS DISTINCT FROM v_actor_employee_id THEN
      RAISE EXCEPTION 'You are not the assigned Level 1 approver for this employee.';
    END IF;
  ELSIF v_level = 2 THEN
    IF v_owner.approval_employee_id_level_3 IS DISTINCT FROM v_actor_employee_id THEN
      RAISE EXCEPTION 'You are not the assigned Level 2 (HOD) approver for this employee.';
    END IF;
  ELSE
    RAISE EXCEPTION 'Claim is not at an approver-actionable level (current level = %).', v_level;
  END IF;

  SELECT cst.*
  INTO v_transition
  FROM public.claim_status_transitions cst
  WHERE cst.from_status_id = v_claim.status_id
    AND cst.is_active = true
    AND cst.is_auto_transition = false
    AND cst.action_code = v_requested_action
    AND cst.requires_role_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.employee_roles er
      WHERE er.employee_id = v_actor_employee_id
        AND er.role_id = cst.requires_role_id
        AND er.is_active = true
    )
  ORDER BY cst.created_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No transition configured for this approval action.';
  END IF;

  IF v_transition.requires_comment AND v_notes IS NULL THEN
    RAISE EXCEPTION 'Notes are required for this action.';
  END IF;

  SELECT
    cs.status_code,
    cs.approval_level,
    cs.is_approval,
    cs.is_rejection,
    cs.is_terminal
  INTO
    v_next_status_code,
    v_to_status_approval_level,
    v_to_status_is_approval,
    v_to_status_is_rejection,
    v_to_status_is_terminal
  FROM public.claim_statuses cs
  WHERE cs.id = v_transition.to_status_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Next claim status is not configured.';
  END IF;

  v_next_status_id := v_transition.to_status_id;
  v_old_status_id := v_claim.status_id;
  v_next_approval_level := CASE
    WHEN coalesce(v_to_status_is_terminal, false) = false
      AND coalesce(v_to_status_is_rejection, false) = false
      AND coalesce(v_to_status_is_approval, false) = false
      AND v_to_status_approval_level IS NOT NULL
      AND v_to_status_approval_level <= 2
      THEN v_to_status_approval_level
    ELSE NULL
  END;

  UPDATE public.expense_claims
  SET status_id = v_next_status_id,
      current_approval_level = v_next_approval_level,
      allow_resubmit = CASE
        WHEN coalesce(v_to_status_is_rejection, false)
          THEN coalesce(p_allow_resubmit, false)
        ELSE false
      END,
      last_rejection_notes = CASE
        WHEN coalesce(v_to_status_is_rejection, false)
          THEN v_notes
        ELSE last_rejection_notes
      END,
      last_rejected_by_employee_id = CASE
        WHEN coalesce(v_to_status_is_rejection, false)
          THEN v_actor_employee_id
        ELSE last_rejected_by_employee_id
      END,
      last_rejected_at = CASE
        WHEN coalesce(v_to_status_is_rejection, false)
          THEN now()
        ELSE last_rejected_at
      END,
      updated_at = now()
  WHERE id = v_claim.id;

  INSERT INTO public.approval_history (
    claim_id,
    approver_employee_id,
    approval_level,
    action,
    notes,
    rejection_notes,
    allow_resubmit,
    metadata,
    old_status_id,
    new_status_id
  )
  VALUES (
    v_claim.id,
    v_actor_employee_id,
    v_level,
    v_transition.action_code,
    v_notes,
    CASE WHEN coalesce(v_to_status_is_rejection, false) THEN v_notes ELSE NULL END,
    CASE WHEN coalesce(v_to_status_is_rejection, false) THEN p_allow_resubmit ELSE NULL END,
    jsonb_build_object('transition_id', v_transition.id),
    v_old_status_id,
    v_next_status_id
  );

  RETURN QUERY
  SELECT v_claim.id, v_next_status_code, v_next_approval_level;
END;
$$;


ALTER FUNCTION "public"."submit_approval_action_atomic"("p_claim_id" "uuid", "p_action" "text", "p_notes" "text", "p_allow_resubmit" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_finance_action_atomic"("p_claim_id" "uuid", "p_action" "text", "p_notes" "text" DEFAULT NULL::"text", "p_allow_resubmit" boolean DEFAULT NULL::boolean) RETURNS TABLE("claim_id" "uuid", "new_status_code" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_email text;
  v_actor_employee_id uuid;
  v_notes text;
  v_requested_action text;
  v_claim public.expense_claims%rowtype;
  v_transition public.claim_status_transitions%rowtype;
  v_next_status_code text;
  v_next_status_id uuid;
  v_old_status_id uuid;
  v_history_action text;
  v_finance_action text;
  v_to_status_is_rejection boolean;
  v_to_status_is_payment_issued boolean;
BEGIN
  v_requested_action := nullif(trim(coalesce(p_action, '')), '');
  IF v_requested_action IS NULL THEN
    RAISE EXCEPTION 'Unsupported finance action.';
  END IF;

  v_email := public.current_user_email();
  IF coalesce(v_email, '') = '' THEN
    RAISE EXCEPTION 'Unauthorized request.';
  END IF;

  v_notes := nullif(trim(coalesce(p_notes, '')), '');

  SELECT id
  INTO v_actor_employee_id
  FROM public.employees
  WHERE lower(employee_email) = v_email;

  IF v_actor_employee_id IS NULL THEN
    RAISE EXCEPTION 'Employee record not found.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.employee_roles er
    JOIN public.roles r ON r.id = er.role_id
    WHERE er.employee_id = v_actor_employee_id
      AND er.is_active = true
      AND r.is_finance_role = true
  ) THEN
    RAISE EXCEPTION 'Finance Team access is required.';
  END IF;

  SELECT *
  INTO v_claim
  FROM public.expense_claims
  WHERE id = p_claim_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Claim not found.';
  END IF;

  SELECT cst.*
  INTO v_transition
  FROM public.claim_status_transitions cst
  JOIN public.claim_statuses to_status ON to_status.id = cst.to_status_id
  WHERE cst.from_status_id = v_claim.status_id
    AND cst.is_active = true
    AND cst.is_auto_transition = false
    AND cst.requires_role_id IS NOT NULL
    AND (
      CASE
        WHEN coalesce(to_status.is_payment_issued, false) = true
          AND cst.action_code LIKE 'finance_%'
          THEN substr(cst.action_code, length('finance_') + 1)
        ELSE cst.action_code
      END
    ) = v_requested_action
    AND EXISTS (
      SELECT 1
      FROM public.employee_roles er
      WHERE er.employee_id = v_actor_employee_id
        AND er.role_id = cst.requires_role_id
        AND er.is_active = true
    )
  ORDER BY cst.created_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No transition configured for this finance action.';
  END IF;

  IF v_transition.requires_comment AND v_notes IS NULL THEN
    RAISE EXCEPTION 'Notes are required for this action.';
  END IF;

  SELECT
    cs.status_code,
    cs.is_rejection,
    cs.is_payment_issued
  INTO
    v_next_status_code,
    v_to_status_is_rejection,
    v_to_status_is_payment_issued
  FROM public.claim_statuses cs
  WHERE cs.id = v_transition.to_status_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Next claim status is not configured.';
  END IF;

  v_next_status_id := v_transition.to_status_id;
  v_old_status_id := v_claim.status_id;
  v_history_action := v_transition.action_code;
  v_finance_action := CASE
    WHEN coalesce(v_to_status_is_payment_issued, false) = true
      AND v_transition.action_code LIKE 'finance_%'
      THEN substr(v_transition.action_code, length('finance_') + 1)
    ELSE v_transition.action_code
  END;

  UPDATE public.expense_claims
  SET status_id = v_next_status_id,
      current_approval_level = NULL,
      allow_resubmit = CASE
        WHEN coalesce(v_to_status_is_rejection, false)
          THEN coalesce(p_allow_resubmit, false)
        ELSE false
      END,
      last_rejection_notes = CASE
        WHEN coalesce(v_to_status_is_rejection, false)
          THEN v_notes
        ELSE last_rejection_notes
      END,
      last_rejected_by_employee_id = CASE
        WHEN coalesce(v_to_status_is_rejection, false)
          THEN v_actor_employee_id
        ELSE last_rejected_by_employee_id
      END,
      last_rejected_at = CASE
        WHEN coalesce(v_to_status_is_rejection, false)
          THEN now()
        ELSE last_rejected_at
      END,
      updated_at = now()
  WHERE id = v_claim.id;

  INSERT INTO public.finance_actions (claim_id, actor_employee_id, action, notes)
  VALUES (v_claim.id, v_actor_employee_id, v_finance_action, v_notes);

  INSERT INTO public.approval_history (
    claim_id,
    approver_employee_id,
    approval_level,
    action,
    notes,
    rejection_notes,
    allow_resubmit,
    metadata,
    old_status_id,
    new_status_id
  )
  VALUES (
    v_claim.id,
    v_actor_employee_id,
    NULL,
    v_history_action,
    v_notes,
    CASE WHEN coalesce(v_to_status_is_rejection, false) THEN v_notes ELSE NULL END,
    CASE WHEN coalesce(v_to_status_is_rejection, false) THEN p_allow_resubmit ELSE NULL END,
    jsonb_build_object('transition_id', v_transition.id),
    v_old_status_id,
    v_next_status_id
  );

  RETURN QUERY
  SELECT v_claim.id, v_next_status_code;
END;
$$;


ALTER FUNCTION "public"."submit_finance_action_atomic"("p_claim_id" "uuid", "p_action" "text", "p_notes" "text", "p_allow_resubmit" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."supersede_rejected_claim"("p_claim_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_email text;
  v_employee_id uuid;
  v_claim public.expense_claims%ROWTYPE;
  v_is_rejection boolean;
BEGIN
  v_email := public.current_user_email();
  IF coalesce(v_email, '') = '' THEN
    RAISE EXCEPTION 'Unauthorized.';
  END IF;

  SELECT id
  INTO v_employee_id
  FROM public.employees
  WHERE lower(employee_email) = v_email
  ;

  IF v_employee_id IS NULL THEN
    RAISE EXCEPTION 'Employee record not found.';
  END IF;

  SELECT *
  INTO v_claim
  FROM public.expense_claims
  WHERE id = p_claim_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Claim not found.';
  END IF;

  IF v_claim.employee_id != v_employee_id THEN
    RAISE EXCEPTION 'You can only supersede your own claims.';
  END IF;

  SELECT cs.is_rejection
  INTO v_is_rejection
  FROM public.claim_statuses cs
  WHERE cs.id = v_claim.status_id;

  IF NOT v_is_rejection THEN
    RAISE EXCEPTION 'Only rejected claims can be superseded.';
  END IF;

  IF NOT v_claim.allow_resubmit THEN
    RAISE EXCEPTION 'This claim is permanently closed - no new claim is permitted for this date.';
  END IF;

  UPDATE public.expense_claims
  SET is_superseded = TRUE,
      updated_at = now()
  WHERE id = p_claim_id;
END;
$$;


ALTER FUNCTION "public"."supersede_rejected_claim"("p_claim_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."_backup_approval_history" (
    "id" "uuid",
    "claim_id" "uuid",
    "approver_email" "text",
    "approval_level" integer,
    "action" "text",
    "notes" "text",
    "acted_at" timestamp with time zone,
    "rejection_notes" "text",
    "allow_resubmit" boolean,
    "bypass_reason" "text",
    "skipped_levels" "jsonb",
    "reason" "text",
    "metadata" "jsonb"
);


ALTER TABLE "public"."_backup_approval_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."_backup_expense_claim_items" (
    "id" "uuid",
    "claim_id" "uuid",
    "item_type" "text",
    "description" "text",
    "amount" numeric(10,2),
    "created_at" timestamp with time zone
);


ALTER TABLE "public"."_backup_expense_claim_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."_backup_expense_claims" (
    "id" "uuid",
    "employee_id" "uuid",
    "claim_date" "date",
    "work_location" "text",
    "own_vehicle_used" boolean,
    "vehicle_type" "text",
    "outstation_location" "text",
    "from_city" "text",
    "to_city" "text",
    "km_travelled" numeric(10,2),
    "total_amount" numeric(10,2),
    "status" "text",
    "current_approval_level" integer,
    "submitted_at" timestamp with time zone,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "claim_number" "text",
    "tenant_id" "text",
    "resubmission_count" integer,
    "last_rejection_notes" "text",
    "last_rejected_by_email" "text",
    "last_rejected_at" timestamp with time zone
);


ALTER TABLE "public"."_backup_expense_claims" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."_backup_finance_actions" (
    "id" "uuid",
    "claim_id" "uuid",
    "actor_email" "text",
    "action" "text",
    "notes" "text",
    "acted_at" timestamp with time zone
);


ALTER TABLE "public"."_backup_finance_actions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."_migration_history" (
    "name" "text" NOT NULL,
    "applied_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "checksum" "text"
);


ALTER TABLE "public"."_migration_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "admin_id" "uuid" NOT NULL,
    "action_type" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid",
    "old_value" "jsonb",
    "new_value" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."admin_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."allowed_email_domains" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "domain_name" character varying(255) NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."allowed_email_domains" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."approval_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "claim_id" "uuid" NOT NULL,
    "approval_level" integer,
    "action" "text" NOT NULL,
    "notes" "text",
    "acted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "rejection_notes" "text",
    "allow_resubmit" boolean,
    "bypass_reason" "text",
    "skipped_levels" "jsonb",
    "reason" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "approver_employee_id" "uuid",
    "old_status_id" "uuid" NOT NULL,
    "new_status_id" "uuid" NOT NULL,
    CONSTRAINT "approval_history_approval_level_check" CHECK ((("approval_level" IS NULL) OR (("approval_level" >= 1) AND ("approval_level" <= 3))))
);


ALTER TABLE "public"."approval_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."approval_routing" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "submitter_designation_id" "uuid" NOT NULL,
    "submitter_state_id" "uuid",
    "approval_level" integer NOT NULL,
    "approver_role_id" "uuid" NOT NULL,
    "approver_designation_id" "uuid",
    "approver_state_id" "uuid",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."approval_routing" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."approver_selection_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "approval_level" integer NOT NULL,
    "designation_id" "uuid" NOT NULL,
    "requires_same_state" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "approver_selection_rules_approval_level_check" CHECK ((("approval_level" >= 1) AND ("approval_level" <= 3)))
);


ALTER TABLE "public"."approver_selection_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."archive_claim_expenses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "claim_id" "uuid" NOT NULL,
    "expense_type" character varying(50) NOT NULL,
    "transport_type_id" "uuid",
    "amount" numeric(10,2) NOT NULL,
    "bill_number" character varying(100),
    "bill_date" "date",
    "bill_attachment_url" "text",
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "claim_expenses_amount_check" CHECK (("amount" >= (0)::numeric))
);


ALTER TABLE "public"."archive_claim_expenses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."archive_claim_status_audit" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "claim_id" "uuid" NOT NULL,
    "actor_email" "text" NOT NULL,
    "actor_scope" "text" NOT NULL,
    "trigger_action" "text" NOT NULL,
    "from_status" "text" NOT NULL,
    "to_status" "text" NOT NULL,
    "from_approval_level" integer,
    "to_approval_level" integer,
    "allow_resubmit" boolean,
    "notes" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "changed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actor_employee_id" "uuid"
);


ALTER TABLE "public"."archive_claim_status_audit" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."base_location_day_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "day_type_code" character varying(50) NOT NULL,
    "day_type_label" character varying(120) NOT NULL,
    "include_food_allowance" boolean DEFAULT true NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."base_location_day_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "city_name" character varying(255) NOT NULL,
    "state_id" "uuid" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."cities" OWNER TO "postgres";


COMMENT ON TABLE "public"."cities" IS 'Master table for cities. Used for outstation travel claims.';



CREATE TABLE IF NOT EXISTS "public"."claim_config_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "claim_id" "uuid" NOT NULL,
    "config_version_id" "uuid" NOT NULL,
    "snapshot_data" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."claim_config_snapshots" OWNER TO "postgres";


COMMENT ON TABLE "public"."claim_config_snapshots" IS 'When A New Claim Is created it will lock the current workflow for that Claim, even if the workflow changes in future it will use the old one ! when in progress';



CREATE SEQUENCE IF NOT EXISTS "public"."claim_number_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."claim_number_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."claim_status_transitions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "from_status_id" "uuid" NOT NULL,
    "to_status_id" "uuid" NOT NULL,
    "requires_role_id" "uuid",
    "requires_comment" boolean DEFAULT false,
    "is_auto_transition" boolean DEFAULT false,
    "validation_rules" "jsonb",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "action_code" "text",
    "allow_resubmit" boolean
);


ALTER TABLE "public"."claim_status_transitions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."claim_status_transitions"."action_code" IS 'RPC action code: submit, resubmit, approved, rejected, finance_issued, finance_rejected, reopened';



COMMENT ON COLUMN "public"."claim_status_transitions"."allow_resubmit" IS 'For rejection transitions: true = employee can resubmit (RETURNED), false = terminal rejection';



CREATE TABLE IF NOT EXISTS "public"."claim_statuses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "status_code" character varying(50) NOT NULL,
    "status_name" character varying(100) NOT NULL,
    "status_description" "text",
    "approval_level" integer,
    "is_approval" boolean DEFAULT false,
    "is_rejection" boolean DEFAULT false,
    "is_terminal" boolean DEFAULT false,
    "is_payment_issued" boolean DEFAULT false,
    "requires_comment" boolean DEFAULT false,
    "display_color" character varying(20),
    "display_order" integer,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "allow_resubmit_status_name" character varying(120),
    "allow_resubmit_display_color" character varying(32)
);


ALTER TABLE "public"."claim_statuses" OWNER TO "postgres";


COMMENT ON COLUMN "public"."claim_statuses"."allow_resubmit_status_name" IS 'Display label to use when a claim is in this status and allow_resubmit=true.';



COMMENT ON COLUMN "public"."claim_statuses"."allow_resubmit_display_color" IS 'Display color token to use when a claim is in this status and allow_resubmit=true.';



CREATE TABLE IF NOT EXISTS "public"."config_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "version_number" bigint NOT NULL,
    "source_admin_log_id" "uuid",
    "change_scope" "text" NOT NULL,
    "change_summary" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."config_versions" OWNER TO "postgres";


ALTER TABLE "public"."config_versions" ALTER COLUMN "version_number" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."config_versions_version_number_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."designation_approval_flow" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "designation_id" "uuid" NOT NULL,
    "required_approval_levels" integer[] NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."designation_approval_flow" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."designation_vehicle_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "designation_id" "uuid" NOT NULL,
    "vehicle_type_id" "uuid" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."designation_vehicle_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."designations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "designation_code" character varying(50) NOT NULL,
    "designation_name" character varying(255) NOT NULL,
    "designation_abbreviation" character varying(10),
    "hierarchy_level" integer NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."designations" OWNER TO "postgres";


COMMENT ON TABLE "public"."designations" IS 'Master table for job designations. Business logic references id, not name.';



COMMENT ON COLUMN "public"."designations"."designation_abbreviation" IS 'Short form for display (SRO, BOA, ABH, SBH, ZBH, PM)';



COMMENT ON COLUMN "public"."designations"."hierarchy_level" IS '1=Junior (SRO), 6=Senior (PM). Used for ordering.';



CREATE TABLE IF NOT EXISTS "public"."employee_replacements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "old_employee_id" "uuid" NOT NULL,
    "new_employee_id" "uuid" NOT NULL,
    "replaced_by_admin_id" "uuid" NOT NULL,
    "replacement_reason" "text" NOT NULL,
    "prepared_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "employee_replacements_old_new_diff" CHECK (("old_employee_id" <> "new_employee_id"))
);


ALTER TABLE "public"."employee_replacements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employee_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "role_id" "uuid" NOT NULL,
    "assigned_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "assigned_by" "uuid",
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."employee_roles" OWNER TO "postgres";


COMMENT ON TABLE "public"."employee_roles" IS 'Junction: employees to system roles (RBAC). One employee can have multiple roles.';



CREATE TABLE IF NOT EXISTS "public"."employee_states" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "state_id" "uuid" NOT NULL,
    "is_primary" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."employee_states" OWNER TO "postgres";


COMMENT ON TABLE "public"."employee_states" IS 'Junction table: employees to states (many-to-many)';



COMMENT ON COLUMN "public"."employee_states"."is_primary" IS 'True for the employees primary operating state';



CREATE TABLE IF NOT EXISTS "public"."employee_statuses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "status_code" character varying(50) NOT NULL,
    "status_name" character varying(100) NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."employee_statuses" OWNER TO "postgres";


COMMENT ON TABLE "public"."employee_statuses" IS 'Lookup table for employee statuses (Active, Inactive, etc.)';



CREATE TABLE IF NOT EXISTS "public"."employees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "text" NOT NULL,
    "employee_name" "text" NOT NULL,
    "employee_email" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "designation_id" "uuid" NOT NULL,
    "employee_status_id" "uuid" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "approval_employee_id_level_1" "uuid",
    "approval_employee_id_level_2" "uuid",
    "approval_employee_id_level_3" "uuid"
);


ALTER TABLE "public"."employees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."expense_claim_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "claim_id" "uuid" NOT NULL,
    "item_type" "text" NOT NULL,
    "description" "text",
    "amount" numeric(10,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "expense_claim_items_amount_check" CHECK (("amount" >= (0)::numeric))
);


ALTER TABLE "public"."expense_claim_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."expense_claims" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "claim_date" "date" NOT NULL,
    "own_vehicle_used" boolean,
    "km_travelled" numeric(10,2),
    "total_amount" numeric(10,2) DEFAULT 0 NOT NULL,
    "current_approval_level" integer,
    "submitted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "claim_number" "text" NOT NULL,
    "tenant_id" "text" DEFAULT 'default'::"text" NOT NULL,
    "resubmission_count" integer DEFAULT 0 NOT NULL,
    "last_rejection_notes" "text",
    "last_rejected_at" timestamp with time zone,
    "designation_id" "uuid" NOT NULL,
    "work_location_id" "uuid" NOT NULL,
    "vehicle_type_id" "uuid",
    "status_id" "uuid" NOT NULL,
    "outstation_city_id" "uuid",
    "from_city_id" "uuid",
    "to_city_id" "uuid",
    "last_rejected_by_employee_id" "uuid",
    "accommodation_nights" integer,
    "food_with_principals_amount" numeric,
    "outstation_state_id" "uuid",
    "has_intercity_travel" boolean DEFAULT false NOT NULL,
    "has_intracity_travel" boolean DEFAULT false NOT NULL,
    "intercity_own_vehicle_used" boolean,
    "intracity_own_vehicle_used" boolean,
    "intracity_vehicle_mode" "text",
    "allow_resubmit" boolean DEFAULT false NOT NULL,
    "is_superseded" boolean DEFAULT false NOT NULL,
    "base_location_day_type_code" character varying(50),
    "expense_location_id" "uuid",
    CONSTRAINT "expense_claims_from_city_requires_state" CHECK ((("from_city_id" IS NULL) OR ("outstation_state_id" IS NOT NULL))),
    CONSTRAINT "expense_claims_intercity_intracity_mode_consistent" CHECK ((("has_intercity_travel" = false) OR ("intracity_vehicle_mode" = 'OWN_VEHICLE'::"text"))),
    CONSTRAINT "expense_claims_intercity_requires_route" CHECK ((("has_intercity_travel" = false) OR (("from_city_id" IS NOT NULL) AND ("to_city_id" IS NOT NULL)))),
    CONSTRAINT "expense_claims_intercity_vehicle_flag_consistent" CHECK ((("has_intercity_travel" = true) OR ("intercity_own_vehicle_used" IS NULL))),
    CONSTRAINT "expense_claims_intracity_mode_consistent" CHECK (((("has_intracity_travel" = true) AND ("intracity_vehicle_mode" IS NOT NULL)) OR (("has_intracity_travel" = false) AND ("intracity_vehicle_mode" IS NULL)))),
    CONSTRAINT "expense_claims_intracity_requires_city" CHECK ((("has_intracity_travel" = false) OR ("outstation_city_id" IS NOT NULL))),
    CONSTRAINT "expense_claims_intracity_vehicle_flag_consistent" CHECK ((("has_intracity_travel" = true) OR ("intracity_own_vehicle_used" IS NULL))),
    CONSTRAINT "expense_claims_intracity_vehicle_mode_valid" CHECK ((("intracity_vehicle_mode" IS NULL) OR ("intracity_vehicle_mode" = ANY (ARRAY['OWN_VEHICLE'::"text", 'RENTAL_VEHICLE'::"text"])))),
    CONSTRAINT "expense_claims_km_travelled_check" CHECK (("km_travelled" >= (0)::numeric)),
    CONSTRAINT "expense_claims_outstation_city_requires_state" CHECK ((("outstation_city_id" IS NULL) OR ("outstation_state_id" IS NOT NULL))),
    CONSTRAINT "expense_claims_resubmission_count_check" CHECK (("resubmission_count" >= 0)),
    CONSTRAINT "expense_claims_to_city_requires_state" CHECK ((("to_city_id" IS NULL) OR ("outstation_state_id" IS NOT NULL))),
    CONSTRAINT "expense_claims_total_amount_check" CHECK (("total_amount" >= (0)::numeric))
);


ALTER TABLE "public"."expense_claims" OWNER TO "postgres";


COMMENT ON COLUMN "public"."expense_claims"."allow_resubmit" IS 'True only when the current claim is in a rejection state that allows employee resubmission.';



COMMENT ON COLUMN "public"."expense_claims"."is_superseded" IS 'True when a rejected claim has been superseded by a fresh resubmitted claim for the same date.';



COMMENT ON COLUMN "public"."expense_claims"."base_location_day_type_code" IS 'Base-location day type code selected at claim submission time (for example FULL_DAY or HALF_DAY).';



CREATE TABLE IF NOT EXISTS "public"."expense_locations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "location_name" character varying(150) NOT NULL,
    "region_code" character varying(150) NOT NULL,
    "display_order" integer NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."expense_locations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."expense_rates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "designation_id" "uuid",
    "location_id" "uuid",
    "expense_type" character varying(50) NOT NULL,
    "rate_amount" numeric(10,2) NOT NULL,
    "effective_from" "date" DEFAULT CURRENT_DATE,
    "effective_to" "date",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."expense_rates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."expense_reimbursement_rates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "designation" "text" NOT NULL,
    "vehicle_type" "text",
    "rate_type" "text" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "expense_reimbursement_rates_amount_check" CHECK (("amount" >= (0)::numeric))
);


ALTER TABLE "public"."expense_reimbursement_rates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."expense_type_account_mappings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "expense_item_type" "text" NOT NULL,
    "bal_account_no" character varying(20) NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."expense_type_account_mappings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."finance_actions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "claim_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "notes" "text",
    "acted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actor_employee_id" "uuid" NOT NULL
);


ALTER TABLE "public"."finance_actions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."finance_export_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_code" character varying(80) NOT NULL,
    "account_type" character varying(100) NOT NULL,
    "employee_transaction_type" character varying(100) NOT NULL,
    "bal_account_type" character varying(100) NOT NULL,
    "default_document_no" character varying(100) DEFAULT ''::character varying NOT NULL,
    "program_code" character varying(80) NOT NULL,
    "sub_product_code" character varying(80) NOT NULL,
    "responsible_dep_code" character varying(80) NOT NULL,
    "beneficiary_dep_code" character varying(80) NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "document_type" character varying(100),
    "cash_flow_options" character varying(200),
    "type_of_payment" character varying(200),
    "description" character varying(200),
    "payment_method_code" character varying(40),
    "bal_account_no" character varying(100)
);


ALTER TABLE "public"."finance_export_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "role_code" character varying(50) NOT NULL,
    "role_name" character varying(255) NOT NULL,
    "role_description" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_finance_role" boolean DEFAULT false NOT NULL,
    "is_admin_role" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."roles" OWNER TO "postgres";


COMMENT ON TABLE "public"."roles" IS 'System roles for RBAC. Separate from job designations.';



COMMENT ON COLUMN "public"."roles"."role_code" IS 'Machine-readable code. Used in backend logic.';



COMMENT ON COLUMN "public"."roles"."is_finance_role" IS 'True for roles that grant access to the finance processing queue.';



COMMENT ON COLUMN "public"."roles"."is_admin_role" IS 'True for roles that grant full administrative access.';



CREATE TABLE IF NOT EXISTS "public"."states" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "state_code" character varying(10) NOT NULL,
    "state_name" character varying(100) NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."states" OWNER TO "postgres";


COMMENT ON TABLE "public"."states" IS 'Master table for geographical states';



CREATE TABLE IF NOT EXISTS "public"."system_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "setting_key" character varying(100) NOT NULL,
    "setting_value" "jsonb" NOT NULL,
    "setting_description" "text",
    "data_type" character varying(50) NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."system_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."validation_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "rule_code" character varying(100) NOT NULL,
    "rule_name" character varying(255) NOT NULL,
    "rule_value" "jsonb" NOT NULL,
    "rule_description" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."validation_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vehicle_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "vehicle_code" character varying(50) NOT NULL,
    "vehicle_name" character varying(100) NOT NULL,
    "base_fuel_rate_per_day" numeric(10,2),
    "intercity_rate_per_km" numeric(10,2),
    "max_km_round_trip" integer,
    "display_order" integer,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."vehicle_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."work_locations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "location_code" character varying(50) NOT NULL,
    "location_name" character varying(100) NOT NULL,
    "requires_vehicle_selection" boolean DEFAULT false,
    "requires_outstation_details" boolean DEFAULT false,
    "display_order" integer,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."work_locations" OWNER TO "postgres";


ALTER TABLE ONLY "public"."_migration_history"
    ADD CONSTRAINT "_migration_history_pkey" PRIMARY KEY ("name");



ALTER TABLE ONLY "public"."admin_logs"
    ADD CONSTRAINT "admin_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."allowed_email_domains"
    ADD CONSTRAINT "allowed_email_domains_domain_name_key" UNIQUE ("domain_name");



ALTER TABLE ONLY "public"."allowed_email_domains"
    ADD CONSTRAINT "allowed_email_domains_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."approval_history"
    ADD CONSTRAINT "approval_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."approval_routing"
    ADD CONSTRAINT "approval_routing_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."approver_selection_rules"
    ADD CONSTRAINT "approver_selection_rules_approval_level_designation_id_key" UNIQUE ("approval_level", "designation_id");



ALTER TABLE ONLY "public"."approver_selection_rules"
    ADD CONSTRAINT "approver_selection_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."archive_claim_expenses"
    ADD CONSTRAINT "archive_claim_expenses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."archive_claim_status_audit"
    ADD CONSTRAINT "archive_claim_status_audit_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."base_location_day_types"
    ADD CONSTRAINT "base_location_day_types_day_type_code_key" UNIQUE ("day_type_code");



ALTER TABLE ONLY "public"."base_location_day_types"
    ADD CONSTRAINT "base_location_day_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cities"
    ADD CONSTRAINT "cities_city_name_state_id_key" UNIQUE ("city_name", "state_id");



ALTER TABLE ONLY "public"."cities"
    ADD CONSTRAINT "cities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."claim_config_snapshots"
    ADD CONSTRAINT "claim_config_snapshots_claim_id_key" UNIQUE ("claim_id");



ALTER TABLE ONLY "public"."claim_config_snapshots"
    ADD CONSTRAINT "claim_config_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."claim_status_transitions"
    ADD CONSTRAINT "claim_status_transitions_from_status_id_to_status_id_requir_key" UNIQUE ("from_status_id", "to_status_id", "requires_role_id");



ALTER TABLE ONLY "public"."claim_status_transitions"
    ADD CONSTRAINT "claim_status_transitions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."claim_statuses"
    ADD CONSTRAINT "claim_statuses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."claim_statuses"
    ADD CONSTRAINT "claim_statuses_status_code_key" UNIQUE ("status_code");



ALTER TABLE ONLY "public"."config_versions"
    ADD CONSTRAINT "config_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."config_versions"
    ADD CONSTRAINT "config_versions_version_number_key" UNIQUE ("version_number");



ALTER TABLE ONLY "public"."designation_approval_flow"
    ADD CONSTRAINT "designation_approval_flow_designation_id_key" UNIQUE ("designation_id");



ALTER TABLE ONLY "public"."designation_approval_flow"
    ADD CONSTRAINT "designation_approval_flow_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."designation_vehicle_permissions"
    ADD CONSTRAINT "designation_vehicle_permissio_designation_id_vehicle_type_i_key" UNIQUE ("designation_id", "vehicle_type_id");



ALTER TABLE ONLY "public"."designation_vehicle_permissions"
    ADD CONSTRAINT "designation_vehicle_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."designations"
    ADD CONSTRAINT "designations_designation_code_key" UNIQUE ("designation_code");



ALTER TABLE ONLY "public"."designations"
    ADD CONSTRAINT "designations_designation_name_key" UNIQUE ("designation_name");



ALTER TABLE ONLY "public"."designations"
    ADD CONSTRAINT "designations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_replacements"
    ADD CONSTRAINT "employee_replacements_new_employee_id_key" UNIQUE ("new_employee_id");



ALTER TABLE ONLY "public"."employee_replacements"
    ADD CONSTRAINT "employee_replacements_old_unique" UNIQUE ("old_employee_id");



ALTER TABLE ONLY "public"."employee_replacements"
    ADD CONSTRAINT "employee_replacements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_roles"
    ADD CONSTRAINT "employee_roles_employee_id_role_id_key" UNIQUE ("employee_id", "role_id");



ALTER TABLE ONLY "public"."employee_roles"
    ADD CONSTRAINT "employee_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_states"
    ADD CONSTRAINT "employee_states_employee_id_state_id_key" UNIQUE ("employee_id", "state_id");



ALTER TABLE ONLY "public"."employee_states"
    ADD CONSTRAINT "employee_states_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_statuses"
    ADD CONSTRAINT "employee_statuses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_statuses"
    ADD CONSTRAINT "employee_statuses_status_code_key" UNIQUE ("status_code");



ALTER TABLE ONLY "public"."employee_statuses"
    ADD CONSTRAINT "employee_statuses_status_name_key" UNIQUE ("status_name");



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_employee_email_key" UNIQUE ("employee_email");



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_employee_id_key" UNIQUE ("employee_id");



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expense_claim_items"
    ADD CONSTRAINT "expense_claim_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expense_claims"
    ADD CONSTRAINT "expense_claims_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expense_locations"
    ADD CONSTRAINT "expense_locations_location_name_key" UNIQUE ("location_name");



ALTER TABLE ONLY "public"."expense_locations"
    ADD CONSTRAINT "expense_locations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expense_rates"
    ADD CONSTRAINT "expense_rates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expense_reimbursement_rates"
    ADD CONSTRAINT "expense_reimbursement_rates_designation_vehicle_type_rate_t_key" UNIQUE ("designation", "vehicle_type", "rate_type");



ALTER TABLE ONLY "public"."expense_reimbursement_rates"
    ADD CONSTRAINT "expense_reimbursement_rates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expense_type_account_mappings"
    ADD CONSTRAINT "expense_type_account_mappings_expense_item_type_key" UNIQUE ("expense_item_type");



ALTER TABLE ONLY "public"."expense_type_account_mappings"
    ADD CONSTRAINT "expense_type_account_mappings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."finance_actions"
    ADD CONSTRAINT "finance_actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."finance_export_profiles"
    ADD CONSTRAINT "finance_export_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."finance_export_profiles"
    ADD CONSTRAINT "finance_export_profiles_profile_code_key" UNIQUE ("profile_code");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_role_code_key" UNIQUE ("role_code");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_role_name_key" UNIQUE ("role_name");



ALTER TABLE ONLY "public"."states"
    ADD CONSTRAINT "states_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."states"
    ADD CONSTRAINT "states_state_code_key" UNIQUE ("state_code");



ALTER TABLE ONLY "public"."states"
    ADD CONSTRAINT "states_state_name_key" UNIQUE ("state_name");



ALTER TABLE ONLY "public"."system_settings"
    ADD CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_settings"
    ADD CONSTRAINT "system_settings_setting_key_key" UNIQUE ("setting_key");



ALTER TABLE ONLY "public"."validation_rules"
    ADD CONSTRAINT "validation_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."validation_rules"
    ADD CONSTRAINT "validation_rules_rule_code_key" UNIQUE ("rule_code");



ALTER TABLE ONLY "public"."vehicle_types"
    ADD CONSTRAINT "vehicle_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vehicle_types"
    ADD CONSTRAINT "vehicle_types_vehicle_code_key" UNIQUE ("vehicle_code");



ALTER TABLE ONLY "public"."vehicle_types"
    ADD CONSTRAINT "vehicle_types_vehicle_name_key" UNIQUE ("vehicle_name");



ALTER TABLE ONLY "public"."work_locations"
    ADD CONSTRAINT "work_locations_location_code_key" UNIQUE ("location_code");



ALTER TABLE ONLY "public"."work_locations"
    ADD CONSTRAINT "work_locations_location_name_key" UNIQUE ("location_name");



ALTER TABLE ONLY "public"."work_locations"
    ADD CONSTRAINT "work_locations_pkey" PRIMARY KEY ("id");



CREATE INDEX "archive_claim_expenses_claim_id_idx" ON "public"."archive_claim_expenses" USING "btree" ("claim_id");



CREATE INDEX "archive_claim_expenses_expense_type_idx" ON "public"."archive_claim_expenses" USING "btree" ("expense_type");



CREATE INDEX "archive_claim_status_audit_actor_email_idx" ON "public"."archive_claim_status_audit" USING "btree" ("actor_email");



CREATE INDEX "archive_claim_status_audit_claim_id_actor_scope_trigger_act_idx" ON "public"."archive_claim_status_audit" USING "btree" ("claim_id", "actor_scope", "trigger_action", "changed_at" DESC);



CREATE INDEX "archive_claim_status_audit_claim_id_changed_at_idx" ON "public"."archive_claim_status_audit" USING "btree" ("claim_id", "changed_at" DESC);



CREATE INDEX "archive_claim_status_audit_claim_id_to_status_changed_at_idx" ON "public"."archive_claim_status_audit" USING "btree" ("claim_id", "to_status", "changed_at" DESC);



CREATE UNIQUE INDEX "expense_claims_one_active_per_employee_date" ON "public"."expense_claims" USING "btree" ("employee_id", "claim_date") WHERE (NOT "is_superseded");



CREATE INDEX "idx_admin_logs_admin_id_created_at" ON "public"."admin_logs" USING "btree" ("admin_id", "created_at" DESC);



CREATE INDEX "idx_admin_logs_entity_lookup" ON "public"."admin_logs" USING "btree" ("entity_type", "entity_id", "created_at" DESC);



CREATE INDEX "idx_aed_active" ON "public"."allowed_email_domains" USING "btree" ("is_active");



CREATE INDEX "idx_aed_domain" ON "public"."allowed_email_domains" USING "btree" ("domain_name");



CREATE INDEX "idx_ah_approver_employee" ON "public"."approval_history" USING "btree" ("approver_employee_id");



CREATE INDEX "idx_approval_history_acted_at_id" ON "public"."approval_history" USING "btree" ("acted_at" DESC, "id" DESC);



CREATE INDEX "idx_approval_history_claim_id" ON "public"."approval_history" USING "btree" ("claim_id");



CREATE INDEX "idx_approval_history_new_status_id" ON "public"."approval_history" USING "btree" ("new_status_id");



CREATE INDEX "idx_approval_history_old_status_id" ON "public"."approval_history" USING "btree" ("old_status_id");



CREATE INDEX "idx_approval_routing_approver_designation_id" ON "public"."approval_routing" USING "btree" ("approver_designation_id");



CREATE INDEX "idx_approval_routing_approver_state_id" ON "public"."approval_routing" USING "btree" ("approver_state_id");



CREATE INDEX "idx_approver_selection_rules_designation_id" ON "public"."approver_selection_rules" USING "btree" ("designation_id");



CREATE INDEX "idx_approver_selection_rules_level_active" ON "public"."approver_selection_rules" USING "btree" ("approval_level", "is_active");



CREATE INDEX "idx_ar_active" ON "public"."approval_routing" USING "btree" ("is_active");



CREATE INDEX "idx_ar_approver_role" ON "public"."approval_routing" USING "btree" ("approver_role_id");



CREATE INDEX "idx_ar_level" ON "public"."approval_routing" USING "btree" ("approval_level");



CREATE INDEX "idx_ar_submitter_desg" ON "public"."approval_routing" USING "btree" ("submitter_designation_id");



CREATE INDEX "idx_ar_submitter_state" ON "public"."approval_routing" USING "btree" ("submitter_state_id");



CREATE INDEX "idx_base_location_day_types_active_order" ON "public"."base_location_day_types" USING "btree" ("is_active", "display_order");



CREATE UNIQUE INDEX "idx_base_location_day_types_single_default" ON "public"."base_location_day_types" USING "btree" ("is_default") WHERE (("is_default" = true) AND ("is_active" = true));



CREATE INDEX "idx_cities_active" ON "public"."cities" USING "btree" ("is_active");



CREATE INDEX "idx_cities_name" ON "public"."cities" USING "btree" ("city_name");



CREATE INDEX "idx_cities_state" ON "public"."cities" USING "btree" ("state_id");



CREATE INDEX "idx_claim_config_snapshots_config_version" ON "public"."claim_config_snapshots" USING "btree" ("config_version_id");



CREATE INDEX "idx_claim_statuses_active" ON "public"."claim_statuses" USING "btree" ("is_active");



CREATE INDEX "idx_claim_statuses_code" ON "public"."claim_statuses" USING "btree" ("status_code");



CREATE INDEX "idx_claim_statuses_level" ON "public"."claim_statuses" USING "btree" ("approval_level");



CREATE INDEX "idx_config_versions_created_at" ON "public"."config_versions" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_config_versions_created_by" ON "public"."config_versions" USING "btree" ("created_by");



CREATE INDEX "idx_config_versions_source_admin_log_id" ON "public"."config_versions" USING "btree" ("source_admin_log_id");



CREATE INDEX "idx_cst_active" ON "public"."claim_status_transitions" USING "btree" ("is_active");



CREATE INDEX "idx_cst_from" ON "public"."claim_status_transitions" USING "btree" ("from_status_id");



CREATE INDEX "idx_cst_role" ON "public"."claim_status_transitions" USING "btree" ("requires_role_id");



CREATE INDEX "idx_cst_to" ON "public"."claim_status_transitions" USING "btree" ("to_status_id");



CREATE INDEX "idx_designations_active" ON "public"."designations" USING "btree" ("is_active");



CREATE INDEX "idx_designations_code" ON "public"."designations" USING "btree" ("designation_code");



CREATE INDEX "idx_designations_hierarchy" ON "public"."designations" USING "btree" ("hierarchy_level");



CREATE INDEX "idx_dvp_designation" ON "public"."designation_vehicle_permissions" USING "btree" ("designation_id");



CREATE INDEX "idx_dvp_vehicle" ON "public"."designation_vehicle_permissions" USING "btree" ("vehicle_type_id");



CREATE INDEX "idx_ec_designation_id" ON "public"."expense_claims" USING "btree" ("designation_id");



CREATE INDEX "idx_ec_outstation_city" ON "public"."expense_claims" USING "btree" ("outstation_city_id");



CREATE INDEX "idx_ec_status_id" ON "public"."expense_claims" USING "btree" ("status_id");



CREATE INDEX "idx_ec_vehicle_type_id" ON "public"."expense_claims" USING "btree" ("vehicle_type_id");



CREATE INDEX "idx_ec_work_location_id" ON "public"."expense_claims" USING "btree" ("work_location_id");



CREATE INDEX "idx_employee_replacements_new_employee" ON "public"."employee_replacements" USING "btree" ("new_employee_id");



CREATE INDEX "idx_employee_replacements_old_employee" ON "public"."employee_replacements" USING "btree" ("old_employee_id");



CREATE INDEX "idx_employee_replacements_replaced_by_admin_id" ON "public"."employee_replacements" USING "btree" ("replaced_by_admin_id");



CREATE INDEX "idx_employee_roles_active" ON "public"."employee_roles" USING "btree" ("is_active");



CREATE INDEX "idx_employee_roles_assigned_by" ON "public"."employee_roles" USING "btree" ("assigned_by");



CREATE INDEX "idx_employee_roles_employee" ON "public"."employee_roles" USING "btree" ("employee_id");



CREATE INDEX "idx_employee_roles_role" ON "public"."employee_roles" USING "btree" ("role_id");



CREATE INDEX "idx_employee_states_employee" ON "public"."employee_states" USING "btree" ("employee_id");



CREATE INDEX "idx_employee_states_primary" ON "public"."employee_states" USING "btree" ("employee_id") WHERE ("is_primary" = true);



CREATE INDEX "idx_employee_states_state" ON "public"."employee_states" USING "btree" ("state_id");



CREATE INDEX "idx_employee_statuses_code" ON "public"."employee_statuses" USING "btree" ("status_code");



CREATE INDEX "idx_employees_approver_id_l1" ON "public"."employees" USING "btree" ("approval_employee_id_level_1");



CREATE INDEX "idx_employees_approver_id_l2" ON "public"."employees" USING "btree" ("approval_employee_id_level_2");



CREATE INDEX "idx_employees_approver_id_l3" ON "public"."employees" USING "btree" ("approval_employee_id_level_3");



CREATE INDEX "idx_employees_designation_id" ON "public"."employees" USING "btree" ("designation_id");



CREATE INDEX "idx_employees_employee_email" ON "public"."employees" USING "btree" ("employee_email");



CREATE INDEX "idx_employees_employee_name" ON "public"."employees" USING "btree" ("employee_name");



CREATE INDEX "idx_employees_status_id" ON "public"."employees" USING "btree" ("employee_status_id");



CREATE INDEX "idx_er_active" ON "public"."expense_rates" USING "btree" ("is_active");



CREATE INDEX "idx_er_designation" ON "public"."expense_rates" USING "btree" ("designation_id");



CREATE INDEX "idx_er_effective" ON "public"."expense_rates" USING "btree" ("effective_from", "effective_to");



CREATE INDEX "idx_er_location" ON "public"."expense_rates" USING "btree" ("location_id");



CREATE INDEX "idx_er_type" ON "public"."expense_rates" USING "btree" ("expense_type");



CREATE INDEX "idx_expense_claim_items_claim_id" ON "public"."expense_claim_items" USING "btree" ("claim_id");



CREATE INDEX "idx_expense_claim_items_claim_item_type" ON "public"."expense_claim_items" USING "btree" ("claim_id", "item_type");



CREATE INDEX "idx_expense_claims_approval_level" ON "public"."expense_claims" USING "btree" ("current_approval_level");



CREATE INDEX "idx_expense_claims_base_location_day_type_code" ON "public"."expense_claims" USING "btree" ("base_location_day_type_code");



CREATE INDEX "idx_expense_claims_claim_date" ON "public"."expense_claims" USING "btree" ("claim_date");



CREATE UNIQUE INDEX "idx_expense_claims_claim_number_unique" ON "public"."expense_claims" USING "btree" ("claim_number");



CREATE INDEX "idx_expense_claims_created_at_id" ON "public"."expense_claims" USING "btree" ("created_at" DESC, "id" DESC);



CREATE INDEX "idx_expense_claims_employee_id" ON "public"."expense_claims" USING "btree" ("employee_id");



CREATE INDEX "idx_expense_claims_expense_location_id" ON "public"."expense_claims" USING "btree" ("expense_location_id");



CREATE INDEX "idx_expense_claims_from_city_id" ON "public"."expense_claims" USING "btree" ("from_city_id");



CREATE INDEX "idx_expense_claims_has_intercity" ON "public"."expense_claims" USING "btree" ("has_intercity_travel");



CREATE INDEX "idx_expense_claims_has_intracity" ON "public"."expense_claims" USING "btree" ("has_intracity_travel");



CREATE INDEX "idx_expense_claims_intracity_vehicle_mode" ON "public"."expense_claims" USING "btree" ("intracity_vehicle_mode") WHERE ("has_intracity_travel" = true);



CREATE INDEX "idx_expense_claims_last_rejected_by_employee_id" ON "public"."expense_claims" USING "btree" ("last_rejected_by_employee_id");



CREATE INDEX "idx_expense_claims_outstation_state_id" ON "public"."expense_claims" USING "btree" ("outstation_state_id");



CREATE INDEX "idx_expense_claims_status_allow_resubmit" ON "public"."expense_claims" USING "btree" ("status_id", "allow_resubmit");



CREATE INDEX "idx_expense_claims_to_city_id" ON "public"."expense_claims" USING "btree" ("to_city_id");



CREATE INDEX "idx_expense_locations_active_order" ON "public"."expense_locations" USING "btree" ("is_active", "display_order");



CREATE INDEX "idx_expense_locations_region_code" ON "public"."expense_locations" USING "btree" ("region_code");



CREATE INDEX "idx_expense_type_account_mappings_active_type" ON "public"."expense_type_account_mappings" USING "btree" ("is_active", "expense_item_type");



CREATE INDEX "idx_fa_actor_employee" ON "public"."finance_actions" USING "btree" ("actor_employee_id");



CREATE INDEX "idx_finance_actions_acted_at_id" ON "public"."finance_actions" USING "btree" ("acted_at" DESC, "id" DESC);



CREATE INDEX "idx_finance_actions_claim_id" ON "public"."finance_actions" USING "btree" ("claim_id");



CREATE INDEX "idx_finance_actions_claim_latest" ON "public"."finance_actions" USING "btree" ("claim_id", "acted_at" DESC, "id" DESC);



CREATE INDEX "idx_finance_export_profiles_active_code" ON "public"."finance_export_profiles" USING "btree" ("is_active", "profile_code");



CREATE INDEX "idx_roles_active" ON "public"."roles" USING "btree" ("is_active");



CREATE INDEX "idx_roles_admin" ON "public"."roles" USING "btree" ("is_admin_role") WHERE ("is_admin_role" = true);



CREATE INDEX "idx_roles_code" ON "public"."roles" USING "btree" ("role_code");



CREATE INDEX "idx_roles_finance" ON "public"."roles" USING "btree" ("is_finance_role") WHERE ("is_finance_role" = true);



CREATE INDEX "idx_ss_active" ON "public"."system_settings" USING "btree" ("is_active");



CREATE INDEX "idx_ss_key" ON "public"."system_settings" USING "btree" ("setting_key");



CREATE INDEX "idx_states_active" ON "public"."states" USING "btree" ("is_active");



CREATE INDEX "idx_states_code" ON "public"."states" USING "btree" ("state_code");



CREATE INDEX "idx_vr_active" ON "public"."validation_rules" USING "btree" ("is_active");



CREATE INDEX "idx_vr_code" ON "public"."validation_rules" USING "btree" ("rule_code");



CREATE INDEX "idx_vt_active" ON "public"."vehicle_types" USING "btree" ("is_active");



CREATE INDEX "idx_vt_code" ON "public"."vehicle_types" USING "btree" ("vehicle_code");



CREATE INDEX "idx_wl_active" ON "public"."work_locations" USING "btree" ("is_active");



CREATE INDEX "idx_wl_code" ON "public"."work_locations" USING "btree" ("location_code");



CREATE OR REPLACE TRIGGER "trg_admin_logs_bump_config_version" AFTER INSERT ON "public"."admin_logs" FOR EACH ROW EXECUTE FUNCTION "public"."bump_config_version_from_admin_log"();



CREATE OR REPLACE TRIGGER "trg_expense_claims_capture_config_snapshot" AFTER INSERT ON "public"."expense_claims" FOR EACH ROW EXECUTE FUNCTION "public"."capture_claim_config_snapshot_on_insert"();



CREATE OR REPLACE TRIGGER "trg_expense_claims_claim_number" BEFORE INSERT ON "public"."expense_claims" FOR EACH ROW EXECUTE FUNCTION "public"."set_claim_number_before_insert"();



CREATE OR REPLACE TRIGGER "trg_expense_claims_updated_at" BEFORE UPDATE ON "public"."expense_claims" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."admin_logs"
    ADD CONSTRAINT "admin_logs_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."approval_history"
    ADD CONSTRAINT "approval_history_approver_employee_id_fkey" FOREIGN KEY ("approver_employee_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."approval_history"
    ADD CONSTRAINT "approval_history_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "public"."expense_claims"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."approval_history"
    ADD CONSTRAINT "approval_history_new_status_id_fkey" FOREIGN KEY ("new_status_id") REFERENCES "public"."claim_statuses"("id");



ALTER TABLE ONLY "public"."approval_history"
    ADD CONSTRAINT "approval_history_old_status_id_fkey" FOREIGN KEY ("old_status_id") REFERENCES "public"."claim_statuses"("id");



ALTER TABLE ONLY "public"."approval_routing"
    ADD CONSTRAINT "approval_routing_approver_designation_id_fkey" FOREIGN KEY ("approver_designation_id") REFERENCES "public"."designations"("id");



ALTER TABLE ONLY "public"."approval_routing"
    ADD CONSTRAINT "approval_routing_approver_role_id_fkey" FOREIGN KEY ("approver_role_id") REFERENCES "public"."roles"("id");



ALTER TABLE ONLY "public"."approval_routing"
    ADD CONSTRAINT "approval_routing_approver_state_id_fkey" FOREIGN KEY ("approver_state_id") REFERENCES "public"."states"("id");



ALTER TABLE ONLY "public"."approval_routing"
    ADD CONSTRAINT "approval_routing_submitter_designation_id_fkey" FOREIGN KEY ("submitter_designation_id") REFERENCES "public"."designations"("id");



ALTER TABLE ONLY "public"."approval_routing"
    ADD CONSTRAINT "approval_routing_submitter_state_id_fkey" FOREIGN KEY ("submitter_state_id") REFERENCES "public"."states"("id");



ALTER TABLE ONLY "public"."approver_selection_rules"
    ADD CONSTRAINT "approver_selection_rules_designation_id_fkey" FOREIGN KEY ("designation_id") REFERENCES "public"."designations"("id");



ALTER TABLE ONLY "public"."cities"
    ADD CONSTRAINT "cities_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "public"."states"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."claim_config_snapshots"
    ADD CONSTRAINT "claim_config_snapshots_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "public"."expense_claims"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."claim_config_snapshots"
    ADD CONSTRAINT "claim_config_snapshots_config_version_id_fkey" FOREIGN KEY ("config_version_id") REFERENCES "public"."config_versions"("id");



ALTER TABLE ONLY "public"."claim_status_transitions"
    ADD CONSTRAINT "claim_status_transitions_from_status_id_fkey" FOREIGN KEY ("from_status_id") REFERENCES "public"."claim_statuses"("id");



ALTER TABLE ONLY "public"."claim_status_transitions"
    ADD CONSTRAINT "claim_status_transitions_requires_role_id_fkey" FOREIGN KEY ("requires_role_id") REFERENCES "public"."roles"("id");



ALTER TABLE ONLY "public"."claim_status_transitions"
    ADD CONSTRAINT "claim_status_transitions_to_status_id_fkey" FOREIGN KEY ("to_status_id") REFERENCES "public"."claim_statuses"("id");



ALTER TABLE ONLY "public"."config_versions"
    ADD CONSTRAINT "config_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."employees"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."config_versions"
    ADD CONSTRAINT "config_versions_source_admin_log_id_fkey" FOREIGN KEY ("source_admin_log_id") REFERENCES "public"."admin_logs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."designation_approval_flow"
    ADD CONSTRAINT "designation_approval_flow_designation_id_fkey" FOREIGN KEY ("designation_id") REFERENCES "public"."designations"("id");



ALTER TABLE ONLY "public"."designation_vehicle_permissions"
    ADD CONSTRAINT "designation_vehicle_permissions_designation_id_fkey" FOREIGN KEY ("designation_id") REFERENCES "public"."designations"("id");



ALTER TABLE ONLY "public"."designation_vehicle_permissions"
    ADD CONSTRAINT "designation_vehicle_permissions_vehicle_type_id_fkey" FOREIGN KEY ("vehicle_type_id") REFERENCES "public"."vehicle_types"("id");



ALTER TABLE ONLY "public"."employee_replacements"
    ADD CONSTRAINT "employee_replacements_new_employee_id_fkey" FOREIGN KEY ("new_employee_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."employee_replacements"
    ADD CONSTRAINT "employee_replacements_old_employee_id_fkey" FOREIGN KEY ("old_employee_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."employee_replacements"
    ADD CONSTRAINT "employee_replacements_replaced_by_admin_id_fkey" FOREIGN KEY ("replaced_by_admin_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."employee_roles"
    ADD CONSTRAINT "employee_roles_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."employee_roles"
    ADD CONSTRAINT "employee_roles_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_roles"
    ADD CONSTRAINT "employee_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_states"
    ADD CONSTRAINT "employee_states_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_states"
    ADD CONSTRAINT "employee_states_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "public"."states"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_approval_employee_id_level_1_fkey" FOREIGN KEY ("approval_employee_id_level_1") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_approval_employee_id_level_2_fkey" FOREIGN KEY ("approval_employee_id_level_2") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_approval_employee_id_level_3_fkey" FOREIGN KEY ("approval_employee_id_level_3") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_designation_id_fkey" FOREIGN KEY ("designation_id") REFERENCES "public"."designations"("id");



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_employee_status_id_fkey" FOREIGN KEY ("employee_status_id") REFERENCES "public"."employee_statuses"("id");



ALTER TABLE ONLY "public"."expense_claim_items"
    ADD CONSTRAINT "expense_claim_items_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "public"."expense_claims"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expense_claims"
    ADD CONSTRAINT "expense_claims_base_location_day_type_code_fkey" FOREIGN KEY ("base_location_day_type_code") REFERENCES "public"."base_location_day_types"("day_type_code");



ALTER TABLE ONLY "public"."expense_claims"
    ADD CONSTRAINT "expense_claims_designation_id_fkey" FOREIGN KEY ("designation_id") REFERENCES "public"."designations"("id");



ALTER TABLE ONLY "public"."expense_claims"
    ADD CONSTRAINT "expense_claims_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."expense_claims"
    ADD CONSTRAINT "expense_claims_expense_location_id_fkey" FOREIGN KEY ("expense_location_id") REFERENCES "public"."expense_locations"("id");



ALTER TABLE ONLY "public"."expense_claims"
    ADD CONSTRAINT "expense_claims_from_city_id_fkey" FOREIGN KEY ("from_city_id") REFERENCES "public"."cities"("id");



ALTER TABLE ONLY "public"."expense_claims"
    ADD CONSTRAINT "expense_claims_last_rejected_by_employee_id_fkey" FOREIGN KEY ("last_rejected_by_employee_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."expense_claims"
    ADD CONSTRAINT "expense_claims_outstation_city_id_fkey" FOREIGN KEY ("outstation_city_id") REFERENCES "public"."cities"("id");



ALTER TABLE ONLY "public"."expense_claims"
    ADD CONSTRAINT "expense_claims_outstation_state_id_fkey" FOREIGN KEY ("outstation_state_id") REFERENCES "public"."states"("id");



ALTER TABLE ONLY "public"."expense_claims"
    ADD CONSTRAINT "expense_claims_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "public"."claim_statuses"("id");



ALTER TABLE ONLY "public"."expense_claims"
    ADD CONSTRAINT "expense_claims_to_city_id_fkey" FOREIGN KEY ("to_city_id") REFERENCES "public"."cities"("id");



ALTER TABLE ONLY "public"."expense_claims"
    ADD CONSTRAINT "expense_claims_vehicle_type_id_fkey" FOREIGN KEY ("vehicle_type_id") REFERENCES "public"."vehicle_types"("id");



ALTER TABLE ONLY "public"."expense_claims"
    ADD CONSTRAINT "expense_claims_work_location_id_fkey" FOREIGN KEY ("work_location_id") REFERENCES "public"."work_locations"("id");



ALTER TABLE ONLY "public"."expense_rates"
    ADD CONSTRAINT "expense_rates_designation_id_fkey" FOREIGN KEY ("designation_id") REFERENCES "public"."designations"("id");



ALTER TABLE ONLY "public"."expense_rates"
    ADD CONSTRAINT "expense_rates_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."work_locations"("id");



ALTER TABLE ONLY "public"."finance_actions"
    ADD CONSTRAINT "finance_actions_actor_employee_id_fkey" FOREIGN KEY ("actor_employee_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."finance_actions"
    ADD CONSTRAINT "finance_actions_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "public"."expense_claims"("id") ON DELETE CASCADE;



ALTER TABLE "public"."_backup_approval_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."_backup_expense_claim_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."_backup_expense_claims" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."_backup_finance_actions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."_migration_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin reads all approval history" ON "public"."approval_history" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (("public"."employees" "cur"
     JOIN "public"."employee_roles" "er" ON ((("er"."employee_id" = "cur"."id") AND ("er"."is_active" = true))))
     JOIN "public"."roles" "r" ON (("r"."id" = "er"."role_id")))
  WHERE (("lower"("cur"."employee_email") = "public"."current_user_email"()) AND (("r"."role_code")::"text" = 'ADMIN'::"text")))));



CREATE POLICY "admin reads all claim items" ON "public"."expense_claim_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (("public"."employees" "cur"
     JOIN "public"."employee_roles" "er" ON ((("er"."employee_id" = "cur"."id") AND ("er"."is_active" = true))))
     JOIN "public"."roles" "r" ON (("r"."id" = "er"."role_id")))
  WHERE (("lower"("cur"."employee_email") = "public"."current_user_email"()) AND (("r"."role_code")::"text" = 'ADMIN'::"text")))));



CREATE POLICY "admin reads all claims" ON "public"."expense_claims" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (("public"."employees" "cur"
     JOIN "public"."employee_roles" "er" ON ((("er"."employee_id" = "cur"."id") AND ("er"."is_active" = true))))
     JOIN "public"."roles" "r" ON (("r"."id" = "er"."role_id")))
  WHERE (("lower"("cur"."employee_email") = "public"."current_user_email"()) AND (("r"."role_code")::"text" = 'ADMIN'::"text")))));



ALTER TABLE "public"."admin_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_logs_read_admin_only" ON "public"."admin_logs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."employees" "current_emp"
     JOIN "public"."employee_roles" "er" ON (("er"."employee_id" = "current_emp"."id")))
     JOIN "public"."roles" "r" ON (("r"."id" = "er"."role_id")))
  WHERE (("lower"("current_emp"."employee_email") = "public"."current_user_email"()) AND ("er"."is_active" = true) AND ("r"."is_admin_role" = true)))));



CREATE POLICY "aed_read_all" ON "public"."allowed_email_domains" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "aed_write_service" ON "public"."allowed_email_domains" TO "service_role" USING (true);



ALTER TABLE "public"."allowed_email_domains" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."approval_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."approval_routing" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "approver reads approval history" ON "public"."approval_history" FOR SELECT TO "authenticated" USING (("claim_id" IN ( SELECT "public"."get_my_approver_acted_claim_ids"() AS "get_my_approver_acted_claim_ids")));



CREATE POLICY "approver reads claim items for historically actioned claims" ON "public"."expense_claim_items" FOR SELECT USING (("claim_id" IN ( SELECT "public"."get_my_approver_acted_claim_ids"() AS "get_my_approver_acted_claim_ids")));



CREATE POLICY "approver reads historically actioned claims" ON "public"."expense_claims" FOR SELECT USING (("id" IN ( SELECT "public"."get_my_approver_acted_claim_ids"() AS "get_my_approver_acted_claim_ids")));



CREATE POLICY "approver reads pending claim items" ON "public"."expense_claim_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."expense_claims" "c"
     JOIN "public"."employees" "approver" ON (("lower"("approver"."employee_email") = "public"."current_user_email"())))
  WHERE (("c"."id" = "expense_claim_items"."claim_id") AND ((("c"."current_approval_level" = 1) AND (EXISTS ( SELECT 1
           FROM "public"."employees" "owner"
          WHERE (("owner"."id" = "c"."employee_id") AND ("owner"."approval_employee_id_level_1" = "approver"."id"))))) OR (("c"."current_approval_level" = 2) AND (EXISTS ( SELECT 1
           FROM "public"."employees" "owner"
          WHERE (("owner"."id" = "c"."employee_id") AND ("owner"."approval_employee_id_level_3" = "approver"."id"))))))))));



CREATE POLICY "approver reads pending claims" ON "public"."expense_claims" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."employees" "approver"
  WHERE (("lower"("approver"."employee_email") = "public"."current_user_email"()) AND ((("expense_claims"."current_approval_level" = 1) AND (EXISTS ( SELECT 1
           FROM "public"."employees" "owner"
          WHERE (("owner"."id" = "expense_claims"."employee_id") AND ("owner"."approval_employee_id_level_1" = "approver"."id"))))) OR (("expense_claims"."current_approval_level" = 2) AND (EXISTS ( SELECT 1
           FROM "public"."employees" "owner"
          WHERE (("owner"."id" = "expense_claims"."employee_id") AND ("owner"."approval_employee_id_level_3" = "approver"."id"))))))))));



CREATE POLICY "approver reads pending-routed claim history" ON "public"."approval_history" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."get_claim_available_actions"("approval_history"."claim_id") "actions"("action", "display_label", "require_notes", "supports_allow_resubmit", "actor_scope")
  WHERE ("actions"."actor_scope" = 'approver'::"text"))));



ALTER TABLE "public"."approver_selection_rules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "approver_selection_rules_admin_write" ON "public"."approver_selection_rules" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."employees" "current_emp"
     JOIN "public"."employee_roles" "er" ON (("er"."employee_id" = "current_emp"."id")))
     JOIN "public"."roles" "r" ON (("r"."id" = "er"."role_id")))
  WHERE (("lower"("current_emp"."employee_email") = "public"."current_user_email"()) AND ("er"."is_active" = true) AND ("r"."is_admin_role" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."employees" "current_emp"
     JOIN "public"."employee_roles" "er" ON (("er"."employee_id" = "current_emp"."id")))
     JOIN "public"."roles" "r" ON (("r"."id" = "er"."role_id")))
  WHERE (("lower"("current_emp"."employee_email") = "public"."current_user_email"()) AND ("er"."is_active" = true) AND ("r"."is_admin_role" = true)))));



CREATE POLICY "approver_selection_rules_read_all" ON "public"."approver_selection_rules" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "ar_read_all" ON "public"."approval_routing" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "ar_write_service" ON "public"."approval_routing" TO "service_role" USING (true);



ALTER TABLE "public"."archive_claim_expenses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."archive_claim_status_audit" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "authenticated users can read employees" ON "public"."employees" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "authenticated users can read rates" ON "public"."expense_reimbursement_rates" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."base_location_day_types" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "base_location_day_types_read_all" ON "public"."base_location_day_types" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "base_location_day_types_write_service" ON "public"."base_location_day_types" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."cities" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cities_admin_write" ON "public"."cities" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "cities_read_all" ON "public"."cities" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."claim_config_snapshots" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "claim_config_snapshots_read_via_claim_access" ON "public"."claim_config_snapshots" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."expense_claims" "c"
  WHERE ("c"."id" = "claim_config_snapshots"."claim_id"))));



ALTER TABLE "public"."claim_status_transitions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."claim_statuses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "claim_statuses_read_all" ON "public"."claim_statuses" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "claim_statuses_write_service" ON "public"."claim_statuses" TO "service_role" USING (true);



ALTER TABLE "public"."config_versions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "config_versions_admin_write" ON "public"."config_versions" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."employees" "current_emp"
     JOIN "public"."employee_roles" "er" ON (("er"."employee_id" = "current_emp"."id")))
     JOIN "public"."roles" "r" ON (("r"."id" = "er"."role_id")))
  WHERE (("lower"("current_emp"."employee_email") = "public"."current_user_email"()) AND ("er"."is_active" = true) AND ("r"."is_admin_role" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."employees" "current_emp"
     JOIN "public"."employee_roles" "er" ON (("er"."employee_id" = "current_emp"."id")))
     JOIN "public"."roles" "r" ON (("r"."id" = "er"."role_id")))
  WHERE (("lower"("current_emp"."employee_email") = "public"."current_user_email"()) AND ("er"."is_active" = true) AND ("r"."is_admin_role" = true)))));



CREATE POLICY "config_versions_read_all" ON "public"."config_versions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "cst_read_all" ON "public"."claim_status_transitions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "cst_write_service" ON "public"."claim_status_transitions" TO "service_role" USING (true);



CREATE POLICY "daf_read_all" ON "public"."designation_approval_flow" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "daf_write_service" ON "public"."designation_approval_flow" TO "service_role" USING (true);



ALTER TABLE "public"."designation_approval_flow" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."designation_vehicle_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."designations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "designations_admin_write" ON "public"."designations" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "designations_read_all" ON "public"."designations" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "dvp_read_all" ON "public"."designation_vehicle_permissions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "dvp_write_service" ON "public"."designation_vehicle_permissions" TO "service_role" USING (true);



CREATE POLICY "employee deletes own claim items" ON "public"."expense_claim_items" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM (("public"."expense_claims" "c"
     JOIN "public"."employees" "e" ON (("e"."id" = "c"."employee_id")))
     JOIN "public"."claim_statuses" "cs" ON (("cs"."id" = "c"."status_id")))
  WHERE (("c"."id" = "expense_claim_items"."claim_id") AND ("lower"("e"."employee_email") = "public"."current_user_email"()) AND (("cs"."status_code")::"text" = ANY ((ARRAY['DRAFT'::character varying, 'RETURNED_FOR_MODIFICATION'::character varying])::"text"[]))))));



CREATE POLICY "employee inserts own claim" ON "public"."expense_claims" FOR INSERT TO "authenticated" WITH CHECK (("employee_id" = ( SELECT "e"."id"
   FROM "public"."employees" "e"
  WHERE ("lower"("e"."employee_email") = "public"."current_user_email"()))));



CREATE POLICY "employee reads own claim history" ON "public"."approval_history" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."expense_claims" "c"
     JOIN "public"."employees" "e" ON (("e"."id" = "c"."employee_id")))
  WHERE (("c"."id" = "approval_history"."claim_id") AND ("lower"("e"."employee_email") = "public"."current_user_email"())))));



CREATE POLICY "employee reads own claim items" ON "public"."expense_claim_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."expense_claims" "c"
     JOIN "public"."employees" "e" ON (("e"."id" = "c"."employee_id")))
  WHERE (("c"."id" = "expense_claim_items"."claim_id") AND ("lower"("e"."employee_email") = "public"."current_user_email"())))));



CREATE POLICY "employee reads own claims" ON "public"."expense_claims" FOR SELECT USING (("employee_id" = ( SELECT "e"."id"
   FROM "public"."employees" "e"
  WHERE ("lower"("e"."employee_email") = "public"."current_user_email"()))));



CREATE POLICY "employee updates own claim items" ON "public"."expense_claim_items" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM (("public"."expense_claims" "c"
     JOIN "public"."employees" "e" ON (("e"."id" = "c"."employee_id")))
     JOIN "public"."claim_statuses" "cs" ON (("cs"."id" = "c"."status_id")))
  WHERE (("c"."id" = "expense_claim_items"."claim_id") AND ("lower"("e"."employee_email") = "public"."current_user_email"()) AND (("cs"."status_code")::"text" = ANY ((ARRAY['DRAFT'::character varying, 'RETURNED_FOR_MODIFICATION'::character varying])::"text"[]))))));



CREATE POLICY "employee updates own draft or returned claims" ON "public"."expense_claims" FOR UPDATE USING ((("employee_id" = ( SELECT "e"."id"
   FROM "public"."employees" "e"
  WHERE ("lower"("e"."employee_email") = "public"."current_user_email"()))) AND ("status_id" IN ( SELECT "cs"."id"
   FROM "public"."claim_statuses" "cs"
  WHERE ((("cs"."status_code")::"text" = 'DRAFT'::"text") OR (("cs"."status_code")::"text" = 'RETURNED_FOR_MODIFICATION'::"text") OR ("cs"."is_rejection" = true)))))) WITH CHECK (("employee_id" = ( SELECT "e"."id"
   FROM "public"."employees" "e"
  WHERE ("lower"("e"."employee_email") = "public"."current_user_email"()))));



ALTER TABLE "public"."employee_replacements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "employee_replacements_read_authenticated" ON "public"."employee_replacements" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."employee_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "employee_roles_admin_write" ON "public"."employee_roles" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "employee_roles_read_all" ON "public"."employee_roles" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."employee_states" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "employee_states_admin_write" ON "public"."employee_states" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "employee_states_read_all" ON "public"."employee_states" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."employee_statuses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "employee_statuses_admin_write" ON "public"."employee_statuses" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "employee_statuses_read_all" ON "public"."employee_statuses" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."employees" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "er_read_all" ON "public"."expense_rates" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "er_write_service" ON "public"."expense_rates" TO "service_role" USING (true);



ALTER TABLE "public"."expense_claim_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."expense_claims" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."expense_locations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "expense_locations_read_all" ON "public"."expense_locations" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "expense_locations_write_service" ON "public"."expense_locations" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."expense_rates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."expense_reimbursement_rates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."expense_type_account_mappings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "expense_type_account_mappings_read_all" ON "public"."expense_type_account_mappings" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "expense_type_account_mappings_write_service" ON "public"."expense_type_account_mappings" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "finance can insert finance actions" ON "public"."finance_actions" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."employees" "current_emp"
     JOIN "public"."employee_roles" "er" ON ((("er"."employee_id" = "current_emp"."id") AND ("er"."is_active" = true))))
     JOIN "public"."roles" "r" ON (("r"."id" = "er"."role_id")))
  WHERE (("lower"("current_emp"."employee_email") = "public"."current_user_email"()) AND ("r"."is_finance_role" = true) AND ("r"."is_active" = true)))));



CREATE POLICY "finance can read claim history" ON "public"."approval_history" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM (("public"."employees" "cur"
     JOIN "public"."employee_roles" "er" ON ((("er"."employee_id" = "cur"."id") AND ("er"."is_active" = true))))
     JOIN "public"."roles" "r" ON (("r"."id" = "er"."role_id")))
  WHERE (("lower"("cur"."employee_email") = "public"."current_user_email"()) AND (("r"."role_code")::"text" = 'FINANCE_TEAM'::"text")))) AND (EXISTS ( SELECT 1
   FROM "public"."expense_claims" "c"
  WHERE (("c"."id" = "approval_history"."claim_id") AND ("c"."status_id" IN ( SELECT "public"."get_finance_visible_status_ids"() AS "get_finance_visible_status_ids")))))));



CREATE POLICY "finance can read claim items" ON "public"."expense_claim_items" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM (("public"."employees" "cur"
     JOIN "public"."employee_roles" "er" ON ((("er"."employee_id" = "cur"."id") AND ("er"."is_active" = true))))
     JOIN "public"."roles" "r" ON (("r"."id" = "er"."role_id")))
  WHERE (("lower"("cur"."employee_email") = "public"."current_user_email"()) AND (("r"."role_code")::"text" = 'FINANCE_TEAM'::"text")))) AND (EXISTS ( SELECT 1
   FROM ("public"."expense_claims" "c"
     JOIN "public"."claim_statuses" "cs" ON (("cs"."id" = "c"."status_id")))
  WHERE (("c"."id" = "expense_claim_items"."claim_id") AND (("cs"."status_code")::"text" = ANY ((ARRAY['L3_PENDING_FINANCE_REVIEW'::character varying, 'APPROVED'::character varying, 'L3_REJECTED_FINANCE'::character varying, 'RETURNED_FOR_MODIFICATION'::character varying])::"text"[])))))));



CREATE POLICY "finance can read finance claims" ON "public"."expense_claims" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM (("public"."employees" "cur"
     JOIN "public"."employee_roles" "er" ON ((("er"."employee_id" = "cur"."id") AND ("er"."is_active" = true))))
     JOIN "public"."roles" "r" ON (("r"."id" = "er"."role_id")))
  WHERE (("lower"("cur"."employee_email") = "public"."current_user_email"()) AND (("r"."role_code")::"text" = 'FINANCE_TEAM'::"text")))) AND ("status_id" IN ( SELECT "public"."get_finance_visible_status_ids"() AS "get_finance_visible_status_ids"))));



CREATE POLICY "finance can update finance review claims" ON "public"."expense_claims" FOR UPDATE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM (("public"."employees" "cur"
     JOIN "public"."employee_roles" "er" ON ((("er"."employee_id" = "cur"."id") AND ("er"."is_active" = true))))
     JOIN "public"."roles" "r" ON (("r"."id" = "er"."role_id")))
  WHERE (("lower"("cur"."employee_email") = "public"."current_user_email"()) AND (("r"."role_code")::"text" = 'FINANCE_TEAM'::"text")))) AND ("status_id" = ( SELECT "claim_statuses"."id"
   FROM "public"."claim_statuses"
  WHERE (("claim_statuses"."status_code")::"text" = 'L3_PENDING_FINANCE_REVIEW'::"text"))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM (("public"."employees" "cur"
     JOIN "public"."employee_roles" "er" ON ((("er"."employee_id" = "cur"."id") AND ("er"."is_active" = true))))
     JOIN "public"."roles" "r" ON (("r"."id" = "er"."role_id")))
  WHERE (("lower"("cur"."employee_email") = "public"."current_user_email"()) AND (("r"."role_code")::"text" = 'FINANCE_TEAM'::"text")))) AND ("status_id" IN ( SELECT "claim_statuses"."id"
   FROM "public"."claim_statuses"
  WHERE (("claim_statuses"."status_code")::"text" = ANY ((ARRAY['APPROVED'::character varying, 'L3_REJECTED_FINANCE'::character varying, 'RETURNED_FOR_MODIFICATION'::character varying])::"text"[])))) AND ("current_approval_level" IS NULL)));



CREATE POLICY "finance or owner can read finance actions" ON "public"."finance_actions" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM (("public"."expense_claims" "c"
     JOIN "public"."employees" "owner_emp" ON (("owner_emp"."id" = "c"."employee_id")))
     LEFT JOIN "public"."employees" "current_emp" ON (("lower"("current_emp"."employee_email") = "public"."current_user_email"())))
  WHERE (("c"."id" = "finance_actions"."claim_id") AND (("lower"("owner_emp"."employee_email") = "public"."current_user_email"()) OR (EXISTS ( SELECT 1
           FROM ("public"."employee_roles" "er"
             JOIN "public"."roles" "r" ON (("r"."id" = "er"."role_id")))
          WHERE (("er"."employee_id" = "current_emp"."id") AND ("er"."is_active" = true) AND ("r"."is_finance_role" = true) AND ("r"."is_active" = true)))))))) AND ("id" = ( SELECT "public"."get_latest_finance_action_id"("finance_actions"."claim_id") AS "get_latest_finance_action_id"))));



ALTER TABLE "public"."finance_actions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."finance_export_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "finance_export_profiles_read_all" ON "public"."finance_export_profiles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "finance_export_profiles_write_service" ON "public"."finance_export_profiles" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "owner can insert claim items" ON "public"."expense_claim_items" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."expense_claims" "c"
     JOIN "public"."employees" "e" ON (("e"."id" = "c"."employee_id")))
  WHERE (("c"."id" = "expense_claim_items"."claim_id") AND ("lower"("e"."employee_email") = "public"."current_user_email"())))));



ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "roles_admin_write" ON "public"."roles" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "roles_read_all" ON "public"."roles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "ss_read_all" ON "public"."system_settings" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "ss_write_service" ON "public"."system_settings" TO "service_role" USING (true);



ALTER TABLE "public"."states" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "states_admin_write" ON "public"."states" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "states_read_all" ON "public"."states" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."system_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."validation_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vehicle_types" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "vr_read_all" ON "public"."validation_rules" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "vr_write_service" ON "public"."validation_rules" TO "service_role" USING (true);



CREATE POLICY "vt_read_all" ON "public"."vehicle_types" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "vt_write_service" ON "public"."vehicle_types" TO "service_role" USING (true);



CREATE POLICY "wl_read_all" ON "public"."work_locations" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "wl_write_service" ON "public"."work_locations" TO "service_role" USING (true);



ALTER TABLE "public"."work_locations" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";


























































































































































































GRANT ALL ON FUNCTION "public"."admin_change_claim_status_with_audit_atomic"("p_claim_id" "uuid", "p_target_status_id" "uuid", "p_reason" "text", "p_confirmation" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_change_claim_status_with_audit_atomic"("p_claim_id" "uuid", "p_target_status_id" "uuid", "p_reason" "text", "p_confirmation" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_change_claim_status_with_audit_atomic"("p_claim_id" "uuid", "p_target_status_id" "uuid", "p_reason" "text", "p_confirmation" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_create_employee_atomic"("p_employee_id" "text", "p_employee_name" "text", "p_employee_email" "text", "p_designation_id" "uuid", "p_employee_status_id" "uuid", "p_role_id" "uuid", "p_state_id" "uuid", "p_approval_employee_id_level_1" "uuid", "p_approval_employee_id_level_2" "uuid", "p_approval_employee_id_level_3" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_create_employee_atomic"("p_employee_id" "text", "p_employee_name" "text", "p_employee_email" "text", "p_designation_id" "uuid", "p_employee_status_id" "uuid", "p_role_id" "uuid", "p_state_id" "uuid", "p_approval_employee_id_level_1" "uuid", "p_approval_employee_id_level_2" "uuid", "p_approval_employee_id_level_3" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_create_employee_atomic"("p_employee_id" "text", "p_employee_name" "text", "p_employee_email" "text", "p_designation_id" "uuid", "p_employee_status_id" "uuid", "p_role_id" "uuid", "p_state_id" "uuid", "p_approval_employee_id_level_1" "uuid", "p_approval_employee_id_level_2" "uuid", "p_approval_employee_id_level_3" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_finalize_employee_replacement_atomic"("p_old_employee_id" "uuid", "p_new_employee_id" "uuid", "p_reason" "text", "p_confirmation" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_finalize_employee_replacement_atomic"("p_old_employee_id" "uuid", "p_new_employee_id" "uuid", "p_reason" "text", "p_confirmation" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_finalize_employee_replacement_atomic"("p_old_employee_id" "uuid", "p_new_employee_id" "uuid", "p_reason" "text", "p_confirmation" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_prepare_employee_replacement_atomic"("p_employee_id" "uuid", "p_reason" "text", "p_confirmation" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_prepare_employee_replacement_atomic"("p_employee_id" "uuid", "p_reason" "text", "p_confirmation" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_prepare_employee_replacement_atomic"("p_employee_id" "uuid", "p_reason" "text", "p_confirmation" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_reassign_employee_approvers_atomic"("p_employee_id" "uuid", "p_level_1" "text", "p_level_2" "text", "p_level_3" "text", "p_reason" "text", "p_confirmation" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_reassign_employee_approvers_atomic"("p_employee_id" "uuid", "p_level_1" "text", "p_level_2" "text", "p_level_3" "text", "p_reason" "text", "p_confirmation" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_reassign_employee_approvers_atomic"("p_employee_id" "uuid", "p_level_1" "text", "p_level_2" "text", "p_level_3" "text", "p_reason" "text", "p_confirmation" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_reassign_employee_approvers_with_audit_atomic"("p_employee_id" "uuid", "p_level_1" "text", "p_level_2" "text", "p_level_3" "text", "p_reason" "text", "p_confirmation" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_reassign_employee_approvers_with_audit_atomic"("p_employee_id" "uuid", "p_level_1" "text", "p_level_2" "text", "p_level_3" "text", "p_reason" "text", "p_confirmation" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_reassign_employee_approvers_with_audit_atomic"("p_employee_id" "uuid", "p_level_1" "text", "p_level_2" "text", "p_level_3" "text", "p_reason" "text", "p_confirmation" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_rollback_claim_atomic"("p_claim_id" "uuid", "p_reason" "text", "p_confirmation" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_rollback_claim_atomic"("p_claim_id" "uuid", "p_reason" "text", "p_confirmation" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_rollback_claim_atomic"("p_claim_id" "uuid", "p_reason" "text", "p_confirmation" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_toggle_designation_active_atomic"("p_id" "uuid", "p_is_active" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_toggle_designation_active_atomic"("p_id" "uuid", "p_is_active" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_toggle_designation_active_atomic"("p_id" "uuid", "p_is_active" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_toggle_expense_rate_active_atomic"("p_id" "uuid", "p_is_active" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_toggle_expense_rate_active_atomic"("p_id" "uuid", "p_is_active" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_toggle_expense_rate_active_atomic"("p_id" "uuid", "p_is_active" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_toggle_vehicle_type_active_atomic"("p_id" "uuid", "p_is_active" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_toggle_vehicle_type_active_atomic"("p_id" "uuid", "p_is_active" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_toggle_vehicle_type_active_atomic"("p_id" "uuid", "p_is_active" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_toggle_work_location_active_atomic"("p_id" "uuid", "p_is_active" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_toggle_work_location_active_atomic"("p_id" "uuid", "p_is_active" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_toggle_work_location_active_atomic"("p_id" "uuid", "p_is_active" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_update_expense_rate_amount_atomic"("p_id" "uuid", "p_rate_amount" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_update_expense_rate_amount_atomic"("p_id" "uuid", "p_rate_amount" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_update_expense_rate_amount_atomic"("p_id" "uuid", "p_rate_amount" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_update_vehicle_rates_atomic"("p_id" "uuid", "p_base_fuel_rate_per_day" numeric, "p_intercity_rate_per_km" numeric, "p_max_km_round_trip" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_update_vehicle_rates_atomic"("p_id" "uuid", "p_base_fuel_rate_per_day" numeric, "p_intercity_rate_per_km" numeric, "p_max_km_round_trip" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_update_vehicle_rates_atomic"("p_id" "uuid", "p_base_fuel_rate_per_day" numeric, "p_intercity_rate_per_km" numeric, "p_max_km_round_trip" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_upsert_approver_selection_rule_atomic"("p_approval_level" integer, "p_designation_id" "uuid", "p_requires_same_state" boolean, "p_is_active" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_upsert_approver_selection_rule_atomic"("p_approval_level" integer, "p_designation_id" "uuid", "p_requires_same_state" boolean, "p_is_active" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_upsert_approver_selection_rule_atomic"("p_approval_level" integer, "p_designation_id" "uuid", "p_requires_same_state" boolean, "p_is_active" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."auth_user_has_elevated_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."auth_user_has_elevated_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auth_user_has_elevated_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."bulk_finance_actions_atomic"("p_claim_ids" "uuid"[], "p_action" "text", "p_notes" "text", "p_allow_resubmit" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."bulk_finance_actions_atomic"("p_claim_ids" "uuid"[], "p_action" "text", "p_notes" "text", "p_allow_resubmit" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."bulk_finance_actions_atomic"("p_claim_ids" "uuid"[], "p_action" "text", "p_notes" "text", "p_allow_resubmit" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."bulk_issue_claims_atomic"("p_claim_ids" "uuid"[], "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."bulk_issue_claims_atomic"("p_claim_ids" "uuid"[], "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bulk_issue_claims_atomic"("p_claim_ids" "uuid"[], "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."bump_config_version_from_admin_log"() TO "anon";
GRANT ALL ON FUNCTION "public"."bump_config_version_from_admin_log"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."bump_config_version_from_admin_log"() TO "service_role";



GRANT ALL ON FUNCTION "public"."capture_claim_config_snapshot_on_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."capture_claim_config_snapshot_on_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."capture_claim_config_snapshot_on_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."current_user_email"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_user_email"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_user_email"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_claim_number"("p_employee_uuid" "uuid", "p_claim_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_claim_number"("p_employee_uuid" "uuid", "p_claim_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_claim_number"("p_employee_uuid" "uuid", "p_claim_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_admin_approver_options_by_state"("p_state_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_admin_approver_options_by_state"("p_state_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_admin_approver_options_by_state"("p_state_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_admin_dashboard_analytics"("p_date_from" "date", "p_date_to" "date", "p_date_filter_field" "text", "p_designation_id" "uuid", "p_work_location_id" "uuid", "p_state_id" "uuid", "p_employee_id" "text", "p_employee_name" "text", "p_vehicle_code" "text", "p_claim_status_id" "uuid", "p_pending_only" boolean, "p_top_claims_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_admin_dashboard_analytics"("p_date_from" "date", "p_date_to" "date", "p_date_filter_field" "text", "p_designation_id" "uuid", "p_work_location_id" "uuid", "p_state_id" "uuid", "p_employee_id" "text", "p_employee_name" "text", "p_vehicle_code" "text", "p_claim_status_id" "uuid", "p_pending_only" boolean, "p_top_claims_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_admin_dashboard_analytics"("p_date_from" "date", "p_date_to" "date", "p_date_filter_field" "text", "p_designation_id" "uuid", "p_work_location_id" "uuid", "p_state_id" "uuid", "p_employee_id" "text", "p_employee_name" "text", "p_vehicle_code" "text", "p_claim_status_id" "uuid", "p_pending_only" boolean, "p_top_claims_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_admin_dashboard_analytics"("p_date_from" "date", "p_date_to" "date", "p_claim_id" "text", "p_date_filter_field" "text", "p_designation_id" "uuid", "p_work_location_id" "uuid", "p_state_id" "uuid", "p_employee_id" "text", "p_employee_name" "text", "p_vehicle_code" "text", "p_claim_status_id" "uuid", "p_pending_only" boolean, "p_top_claims_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_admin_dashboard_analytics"("p_date_from" "date", "p_date_to" "date", "p_claim_id" "text", "p_date_filter_field" "text", "p_designation_id" "uuid", "p_work_location_id" "uuid", "p_state_id" "uuid", "p_employee_id" "text", "p_employee_name" "text", "p_vehicle_code" "text", "p_claim_status_id" "uuid", "p_pending_only" boolean, "p_top_claims_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_admin_dashboard_analytics"("p_date_from" "date", "p_date_to" "date", "p_claim_id" "text", "p_date_filter_field" "text", "p_designation_id" "uuid", "p_work_location_id" "uuid", "p_state_id" "uuid", "p_employee_id" "text", "p_employee_name" "text", "p_vehicle_code" "text", "p_claim_status_id" "uuid", "p_pending_only" boolean, "p_top_claims_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_admin_finance_overview_metrics"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_admin_finance_overview_metrics"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_admin_finance_overview_metrics"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_admin_summary_counts"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_admin_summary_counts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_admin_summary_counts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_approval_employee_name_suggestions"("p_name_search" "text", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_approval_employee_name_suggestions"("p_name_search" "text", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_approval_employee_name_suggestions"("p_name_search" "text", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_approval_history_analytics"("p_name_search" "text", "p_claim_status_id" "uuid", "p_claim_allow_resubmit" boolean, "p_amount_operator" "text", "p_amount_value" numeric, "p_location_type" "text", "p_claim_date_from" "date", "p_claim_date_to" "date", "p_hod_approved_from" timestamp with time zone, "p_hod_approved_to" timestamp with time zone, "p_finance_approved_from" timestamp with time zone, "p_finance_approved_to" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_approval_history_analytics"("p_name_search" "text", "p_claim_status_id" "uuid", "p_claim_allow_resubmit" boolean, "p_amount_operator" "text", "p_amount_value" numeric, "p_location_type" "text", "p_claim_date_from" "date", "p_claim_date_to" "date", "p_hod_approved_from" timestamp with time zone, "p_hod_approved_to" timestamp with time zone, "p_finance_approved_from" timestamp with time zone, "p_finance_approved_to" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_approval_history_analytics"("p_name_search" "text", "p_claim_status_id" "uuid", "p_claim_allow_resubmit" boolean, "p_amount_operator" "text", "p_amount_value" numeric, "p_location_type" "text", "p_claim_date_from" "date", "p_claim_date_to" "date", "p_hod_approved_from" timestamp with time zone, "p_hod_approved_to" timestamp with time zone, "p_finance_approved_from" timestamp with time zone, "p_finance_approved_to" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_claim_available_actions"("p_claim_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_claim_available_actions"("p_claim_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_claim_available_actions"("p_claim_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_claim_available_actions_bulk"("p_claim_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_claim_available_actions_bulk"("p_claim_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_claim_available_actions_bulk"("p_claim_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_claim_bucket_metrics"("p_claim_ids" "uuid"[], "p_pending_status_ids" "uuid"[], "p_approved_status_ids" "uuid"[], "p_rejected_status_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_claim_bucket_metrics"("p_claim_ids" "uuid"[], "p_pending_status_ids" "uuid"[], "p_approved_status_ids" "uuid"[], "p_rejected_status_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_claim_bucket_metrics"("p_claim_ids" "uuid"[], "p_pending_status_ids" "uuid"[], "p_approved_status_ids" "uuid"[], "p_rejected_status_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_claim_status_id"("p_code" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."get_claim_status_id"("p_code" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_claim_status_id"("p_code" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_designation_id"("p_code" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."get_designation_id"("p_code" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_designation_id"("p_code" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_employee_claim_metrics"("p_employee_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_employee_claim_metrics"("p_employee_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_employee_claim_metrics"("p_employee_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_filtered_approval_history"("p_limit" integer, "p_cursor_acted_at" timestamp with time zone, "p_cursor_action_id" "uuid", "p_name_search" "text", "p_actor_filters" "text"[], "p_claim_status" "text", "p_claim_status_id" "uuid", "p_claim_allow_resubmit" boolean, "p_claim_date_from" "date", "p_claim_date_to" "date", "p_hod_approved_from" timestamp with time zone, "p_hod_approved_to" timestamp with time zone, "p_finance_approved_from" timestamp with time zone, "p_finance_approved_to" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_filtered_approval_history"("p_limit" integer, "p_cursor_acted_at" timestamp with time zone, "p_cursor_action_id" "uuid", "p_name_search" "text", "p_actor_filters" "text"[], "p_claim_status" "text", "p_claim_status_id" "uuid", "p_claim_allow_resubmit" boolean, "p_claim_date_from" "date", "p_claim_date_to" "date", "p_hod_approved_from" timestamp with time zone, "p_hod_approved_to" timestamp with time zone, "p_finance_approved_from" timestamp with time zone, "p_finance_approved_to" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_filtered_approval_history"("p_limit" integer, "p_cursor_acted_at" timestamp with time zone, "p_cursor_action_id" "uuid", "p_name_search" "text", "p_actor_filters" "text"[], "p_claim_status" "text", "p_claim_status_id" "uuid", "p_claim_allow_resubmit" boolean, "p_claim_date_from" "date", "p_claim_date_to" "date", "p_hod_approved_from" timestamp with time zone, "p_hod_approved_to" timestamp with time zone, "p_finance_approved_from" timestamp with time zone, "p_finance_approved_to" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_filtered_approval_history"("p_limit" integer, "p_cursor_acted_at" timestamp with time zone, "p_cursor_action_id" "uuid", "p_name_search" "text", "p_actor_filters" "text"[], "p_claim_status" "text", "p_claim_status_id" "uuid", "p_claim_allow_resubmit" boolean, "p_amount_operator" "text", "p_amount_value" numeric, "p_location_type" "text", "p_claim_date_from" "date", "p_claim_date_to" "date", "p_hod_approved_from" timestamp with time zone, "p_hod_approved_to" timestamp with time zone, "p_finance_approved_from" timestamp with time zone, "p_finance_approved_to" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_filtered_approval_history"("p_limit" integer, "p_cursor_acted_at" timestamp with time zone, "p_cursor_action_id" "uuid", "p_name_search" "text", "p_actor_filters" "text"[], "p_claim_status" "text", "p_claim_status_id" "uuid", "p_claim_allow_resubmit" boolean, "p_amount_operator" "text", "p_amount_value" numeric, "p_location_type" "text", "p_claim_date_from" "date", "p_claim_date_to" "date", "p_hod_approved_from" timestamp with time zone, "p_hod_approved_to" timestamp with time zone, "p_finance_approved_from" timestamp with time zone, "p_finance_approved_to" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_filtered_approval_history"("p_limit" integer, "p_cursor_acted_at" timestamp with time zone, "p_cursor_action_id" "uuid", "p_name_search" "text", "p_actor_filters" "text"[], "p_claim_status" "text", "p_claim_status_id" "uuid", "p_claim_allow_resubmit" boolean, "p_amount_operator" "text", "p_amount_value" numeric, "p_location_type" "text", "p_claim_date_from" "date", "p_claim_date_to" "date", "p_hod_approved_from" timestamp with time zone, "p_hod_approved_to" timestamp with time zone, "p_finance_approved_from" timestamp with time zone, "p_finance_approved_to" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_filtered_approval_history_count"("p_name_search" "text", "p_actor_filters" "text"[], "p_claim_status" "text", "p_claim_status_id" "uuid", "p_claim_allow_resubmit" boolean, "p_amount_operator" "text", "p_amount_value" numeric, "p_location_type" "text", "p_claim_date_from" "date", "p_claim_date_to" "date", "p_hod_approved_from" timestamp with time zone, "p_hod_approved_to" timestamp with time zone, "p_finance_approved_from" timestamp with time zone, "p_finance_approved_to" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_filtered_approval_history_count"("p_name_search" "text", "p_actor_filters" "text"[], "p_claim_status" "text", "p_claim_status_id" "uuid", "p_claim_allow_resubmit" boolean, "p_amount_operator" "text", "p_amount_value" numeric, "p_location_type" "text", "p_claim_date_from" "date", "p_claim_date_to" "date", "p_hod_approved_from" timestamp with time zone, "p_hod_approved_to" timestamp with time zone, "p_finance_approved_from" timestamp with time zone, "p_finance_approved_to" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_filtered_approval_history_count"("p_name_search" "text", "p_actor_filters" "text"[], "p_claim_status" "text", "p_claim_status_id" "uuid", "p_claim_allow_resubmit" boolean, "p_amount_operator" "text", "p_amount_value" numeric, "p_location_type" "text", "p_claim_date_from" "date", "p_claim_date_to" "date", "p_hod_approved_from" timestamp with time zone, "p_hod_approved_to" timestamp with time zone, "p_finance_approved_from" timestamp with time zone, "p_finance_approved_to" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_finance_history_action_metrics"("p_claim_ids" "uuid"[], "p_action_filter" "text", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone, "p_date_scoped_actions" "text"[], "p_approved_actions" "text"[], "p_rejected_actions" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_finance_history_action_metrics"("p_claim_ids" "uuid"[], "p_action_filter" "text", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone, "p_date_scoped_actions" "text"[], "p_approved_actions" "text"[], "p_rejected_actions" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_finance_history_action_metrics"("p_claim_ids" "uuid"[], "p_action_filter" "text", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone, "p_date_scoped_actions" "text"[], "p_approved_actions" "text"[], "p_rejected_actions" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_finance_pending_dashboard_analytics"("p_date_from" "date", "p_date_to" "date", "p_designation_id" "uuid", "p_work_location_id" "uuid", "p_state_id" "uuid", "p_employee_id" "text", "p_employee_name" "text", "p_vehicle_code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_finance_pending_dashboard_analytics"("p_date_from" "date", "p_date_to" "date", "p_designation_id" "uuid", "p_work_location_id" "uuid", "p_state_id" "uuid", "p_employee_id" "text", "p_employee_name" "text", "p_vehicle_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_finance_pending_dashboard_analytics"("p_date_from" "date", "p_date_to" "date", "p_designation_id" "uuid", "p_work_location_id" "uuid", "p_state_id" "uuid", "p_employee_id" "text", "p_employee_name" "text", "p_vehicle_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_finance_pending_dashboard_analytics"("p_date_from" "date", "p_date_to" "date", "p_designation_id" "uuid", "p_work_location_id" "uuid", "p_state_id" "uuid", "p_employee_id" "text", "p_employee_name" "text", "p_vehicle_code" "text", "p_date_filter_field" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_finance_pending_dashboard_analytics"("p_date_from" "date", "p_date_to" "date", "p_designation_id" "uuid", "p_work_location_id" "uuid", "p_state_id" "uuid", "p_employee_id" "text", "p_employee_name" "text", "p_vehicle_code" "text", "p_date_filter_field" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_finance_pending_dashboard_analytics"("p_date_from" "date", "p_date_to" "date", "p_designation_id" "uuid", "p_work_location_id" "uuid", "p_state_id" "uuid", "p_employee_id" "text", "p_employee_name" "text", "p_vehicle_code" "text", "p_date_filter_field" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_finance_pending_dashboard_analytics"("p_date_from" "date", "p_date_to" "date", "p_claim_id" "text", "p_designation_id" "uuid", "p_work_location_id" "uuid", "p_state_id" "uuid", "p_employee_id" "text", "p_employee_name" "text", "p_vehicle_code" "text", "p_date_filter_field" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_finance_pending_dashboard_analytics"("p_date_from" "date", "p_date_to" "date", "p_claim_id" "text", "p_designation_id" "uuid", "p_work_location_id" "uuid", "p_state_id" "uuid", "p_employee_id" "text", "p_employee_name" "text", "p_vehicle_code" "text", "p_date_filter_field" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_finance_pending_dashboard_analytics"("p_date_from" "date", "p_date_to" "date", "p_claim_id" "text", "p_designation_id" "uuid", "p_work_location_id" "uuid", "p_state_id" "uuid", "p_employee_id" "text", "p_employee_name" "text", "p_vehicle_code" "text", "p_date_filter_field" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_finance_visible_status_ids"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_finance_visible_status_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_finance_visible_status_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_finance_visible_status_ids"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_latest_finance_action_id"("p_claim_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_latest_finance_action_id"("p_claim_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_latest_finance_action_id"("p_claim_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_latest_finance_action_id"("p_claim_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_approver_acted_claim_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_approver_acted_claim_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_approver_acted_claim_ids"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_pending_approval_scope_summary"("p_level1_employee_ids" "uuid"[], "p_level2_employee_ids" "uuid"[], "p_pending_status_ids" "uuid"[], "p_allow_resubmit" boolean, "p_employee_name" "text", "p_claim_date_from" "date", "p_claim_date_to" "date", "p_amount_operator" "text", "p_amount_value" numeric, "p_location_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_pending_approval_scope_summary"("p_level1_employee_ids" "uuid"[], "p_level2_employee_ids" "uuid"[], "p_pending_status_ids" "uuid"[], "p_allow_resubmit" boolean, "p_employee_name" "text", "p_claim_date_from" "date", "p_claim_date_to" "date", "p_amount_operator" "text", "p_amount_value" numeric, "p_location_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_pending_approval_scope_summary"("p_level1_employee_ids" "uuid"[], "p_level2_employee_ids" "uuid"[], "p_pending_status_ids" "uuid"[], "p_allow_resubmit" boolean, "p_employee_name" "text", "p_claim_date_from" "date", "p_claim_date_to" "date", "p_amount_operator" "text", "p_amount_value" numeric, "p_location_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_work_location_id"("p_code" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."get_work_location_id"("p_code" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_work_location_id"("p_code" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."reassign_orphaned_approvals"("p_old_approver_id" "uuid", "p_new_approver_id" "uuid", "p_admin_employee_id" "uuid", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."reassign_orphaned_approvals"("p_old_approver_id" "uuid", "p_new_approver_id" "uuid", "p_admin_employee_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reassign_orphaned_approvals"("p_old_approver_id" "uuid", "p_new_approver_id" "uuid", "p_admin_employee_id" "uuid", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."require_admin_actor"() TO "anon";
GRANT ALL ON FUNCTION "public"."require_admin_actor"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."require_admin_actor"() TO "service_role";



GRANT ALL ON FUNCTION "public"."require_finance_actor"() TO "anon";
GRANT ALL ON FUNCTION "public"."require_finance_actor"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."require_finance_actor"() TO "service_role";



GRANT ALL ON FUNCTION "public"."resolve_claim_allow_resubmit_filter"("p_claim_status_id" "uuid", "p_claim_allow_resubmit" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."resolve_claim_allow_resubmit_filter"("p_claim_status_id" "uuid", "p_claim_allow_resubmit" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_claim_allow_resubmit_filter"("p_claim_status_id" "uuid", "p_claim_allow_resubmit" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."resubmit_claim_after_rejection_atomic"("p_claim_id" "uuid", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."resubmit_claim_after_rejection_atomic"("p_claim_id" "uuid", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resubmit_claim_after_rejection_atomic"("p_claim_id" "uuid", "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_claim_number_before_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_claim_number_before_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_claim_number_before_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."submit_approval_action_atomic"("p_claim_id" "uuid", "p_action" "text", "p_notes" "text", "p_allow_resubmit" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."submit_approval_action_atomic"("p_claim_id" "uuid", "p_action" "text", "p_notes" "text", "p_allow_resubmit" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_approval_action_atomic"("p_claim_id" "uuid", "p_action" "text", "p_notes" "text", "p_allow_resubmit" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."submit_finance_action_atomic"("p_claim_id" "uuid", "p_action" "text", "p_notes" "text", "p_allow_resubmit" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."submit_finance_action_atomic"("p_claim_id" "uuid", "p_action" "text", "p_notes" "text", "p_allow_resubmit" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_finance_action_atomic"("p_claim_id" "uuid", "p_action" "text", "p_notes" "text", "p_allow_resubmit" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."supersede_rejected_claim"("p_claim_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."supersede_rejected_claim"("p_claim_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."supersede_rejected_claim"("p_claim_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";
























GRANT ALL ON TABLE "public"."_backup_approval_history" TO "anon";
GRANT ALL ON TABLE "public"."_backup_approval_history" TO "authenticated";
GRANT ALL ON TABLE "public"."_backup_approval_history" TO "service_role";



GRANT ALL ON TABLE "public"."_backup_expense_claim_items" TO "anon";
GRANT ALL ON TABLE "public"."_backup_expense_claim_items" TO "authenticated";
GRANT ALL ON TABLE "public"."_backup_expense_claim_items" TO "service_role";



GRANT ALL ON TABLE "public"."_backup_expense_claims" TO "anon";
GRANT ALL ON TABLE "public"."_backup_expense_claims" TO "authenticated";
GRANT ALL ON TABLE "public"."_backup_expense_claims" TO "service_role";



GRANT ALL ON TABLE "public"."_backup_finance_actions" TO "anon";
GRANT ALL ON TABLE "public"."_backup_finance_actions" TO "authenticated";
GRANT ALL ON TABLE "public"."_backup_finance_actions" TO "service_role";



GRANT ALL ON TABLE "public"."_migration_history" TO "anon";
GRANT ALL ON TABLE "public"."_migration_history" TO "authenticated";
GRANT ALL ON TABLE "public"."_migration_history" TO "service_role";



GRANT ALL ON TABLE "public"."admin_logs" TO "anon";
GRANT ALL ON TABLE "public"."admin_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_logs" TO "service_role";



GRANT ALL ON TABLE "public"."allowed_email_domains" TO "anon";
GRANT ALL ON TABLE "public"."allowed_email_domains" TO "authenticated";
GRANT ALL ON TABLE "public"."allowed_email_domains" TO "service_role";



GRANT ALL ON TABLE "public"."approval_history" TO "anon";
GRANT ALL ON TABLE "public"."approval_history" TO "authenticated";
GRANT ALL ON TABLE "public"."approval_history" TO "service_role";



GRANT ALL ON TABLE "public"."approval_routing" TO "anon";
GRANT ALL ON TABLE "public"."approval_routing" TO "authenticated";
GRANT ALL ON TABLE "public"."approval_routing" TO "service_role";



GRANT ALL ON TABLE "public"."approver_selection_rules" TO "anon";
GRANT ALL ON TABLE "public"."approver_selection_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."approver_selection_rules" TO "service_role";



GRANT ALL ON TABLE "public"."archive_claim_expenses" TO "anon";
GRANT ALL ON TABLE "public"."archive_claim_expenses" TO "authenticated";
GRANT ALL ON TABLE "public"."archive_claim_expenses" TO "service_role";



GRANT ALL ON TABLE "public"."archive_claim_status_audit" TO "anon";
GRANT ALL ON TABLE "public"."archive_claim_status_audit" TO "authenticated";
GRANT ALL ON TABLE "public"."archive_claim_status_audit" TO "service_role";



GRANT ALL ON TABLE "public"."base_location_day_types" TO "anon";
GRANT ALL ON TABLE "public"."base_location_day_types" TO "authenticated";
GRANT ALL ON TABLE "public"."base_location_day_types" TO "service_role";



GRANT ALL ON TABLE "public"."cities" TO "anon";
GRANT ALL ON TABLE "public"."cities" TO "authenticated";
GRANT ALL ON TABLE "public"."cities" TO "service_role";



GRANT ALL ON TABLE "public"."claim_config_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."claim_config_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."claim_config_snapshots" TO "service_role";



GRANT ALL ON SEQUENCE "public"."claim_number_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."claim_number_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."claim_number_seq" TO "service_role";



GRANT ALL ON TABLE "public"."claim_status_transitions" TO "anon";
GRANT ALL ON TABLE "public"."claim_status_transitions" TO "authenticated";
GRANT ALL ON TABLE "public"."claim_status_transitions" TO "service_role";



GRANT ALL ON TABLE "public"."claim_statuses" TO "anon";
GRANT ALL ON TABLE "public"."claim_statuses" TO "authenticated";
GRANT ALL ON TABLE "public"."claim_statuses" TO "service_role";



GRANT ALL ON TABLE "public"."config_versions" TO "anon";
GRANT ALL ON TABLE "public"."config_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."config_versions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."config_versions_version_number_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."config_versions_version_number_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."config_versions_version_number_seq" TO "service_role";



GRANT ALL ON TABLE "public"."designation_approval_flow" TO "anon";
GRANT ALL ON TABLE "public"."designation_approval_flow" TO "authenticated";
GRANT ALL ON TABLE "public"."designation_approval_flow" TO "service_role";



GRANT ALL ON TABLE "public"."designation_vehicle_permissions" TO "anon";
GRANT ALL ON TABLE "public"."designation_vehicle_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."designation_vehicle_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."designations" TO "anon";
GRANT ALL ON TABLE "public"."designations" TO "authenticated";
GRANT ALL ON TABLE "public"."designations" TO "service_role";



GRANT ALL ON TABLE "public"."employee_replacements" TO "anon";
GRANT ALL ON TABLE "public"."employee_replacements" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_replacements" TO "service_role";



GRANT ALL ON TABLE "public"."employee_roles" TO "anon";
GRANT ALL ON TABLE "public"."employee_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_roles" TO "service_role";



GRANT ALL ON TABLE "public"."employee_states" TO "anon";
GRANT ALL ON TABLE "public"."employee_states" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_states" TO "service_role";



GRANT ALL ON TABLE "public"."employee_statuses" TO "anon";
GRANT ALL ON TABLE "public"."employee_statuses" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_statuses" TO "service_role";



GRANT ALL ON TABLE "public"."employees" TO "anon";
GRANT ALL ON TABLE "public"."employees" TO "authenticated";
GRANT ALL ON TABLE "public"."employees" TO "service_role";



GRANT ALL ON TABLE "public"."expense_claim_items" TO "anon";
GRANT ALL ON TABLE "public"."expense_claim_items" TO "authenticated";
GRANT ALL ON TABLE "public"."expense_claim_items" TO "service_role";



GRANT ALL ON TABLE "public"."expense_claims" TO "anon";
GRANT ALL ON TABLE "public"."expense_claims" TO "authenticated";
GRANT ALL ON TABLE "public"."expense_claims" TO "service_role";



GRANT ALL ON TABLE "public"."expense_locations" TO "anon";
GRANT ALL ON TABLE "public"."expense_locations" TO "authenticated";
GRANT ALL ON TABLE "public"."expense_locations" TO "service_role";



GRANT ALL ON TABLE "public"."expense_rates" TO "anon";
GRANT ALL ON TABLE "public"."expense_rates" TO "authenticated";
GRANT ALL ON TABLE "public"."expense_rates" TO "service_role";



GRANT ALL ON TABLE "public"."expense_reimbursement_rates" TO "anon";
GRANT ALL ON TABLE "public"."expense_reimbursement_rates" TO "authenticated";
GRANT ALL ON TABLE "public"."expense_reimbursement_rates" TO "service_role";



GRANT ALL ON TABLE "public"."expense_type_account_mappings" TO "anon";
GRANT ALL ON TABLE "public"."expense_type_account_mappings" TO "authenticated";
GRANT ALL ON TABLE "public"."expense_type_account_mappings" TO "service_role";



GRANT ALL ON TABLE "public"."finance_actions" TO "anon";
GRANT ALL ON TABLE "public"."finance_actions" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_actions" TO "service_role";



GRANT ALL ON TABLE "public"."finance_export_profiles" TO "anon";
GRANT ALL ON TABLE "public"."finance_export_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_export_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."roles" TO "anon";
GRANT ALL ON TABLE "public"."roles" TO "authenticated";
GRANT ALL ON TABLE "public"."roles" TO "service_role";



GRANT ALL ON TABLE "public"."states" TO "anon";
GRANT ALL ON TABLE "public"."states" TO "authenticated";
GRANT ALL ON TABLE "public"."states" TO "service_role";



GRANT ALL ON TABLE "public"."system_settings" TO "anon";
GRANT ALL ON TABLE "public"."system_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."system_settings" TO "service_role";



GRANT ALL ON TABLE "public"."validation_rules" TO "anon";
GRANT ALL ON TABLE "public"."validation_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."validation_rules" TO "service_role";



GRANT ALL ON TABLE "public"."vehicle_types" TO "anon";
GRANT ALL ON TABLE "public"."vehicle_types" TO "authenticated";
GRANT ALL ON TABLE "public"."vehicle_types" TO "service_role";



GRANT ALL ON TABLE "public"."work_locations" TO "anon";
GRANT ALL ON TABLE "public"."work_locations" TO "authenticated";
GRANT ALL ON TABLE "public"."work_locations" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































