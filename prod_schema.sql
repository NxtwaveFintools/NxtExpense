--
-- PostgreSQL database dump
--

\restrict 2mw4gXOJ0ls3c94dO89VsBwppVn7rqyhYsrDcFgW3yUK7xTyAaNV7hklME5IfWb

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA auth;


ALTER SCHEMA auth OWNER TO supabase_admin;

--
-- Name: extensions; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA extensions;


ALTER SCHEMA extensions OWNER TO postgres;

--
-- Name: graphql; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA graphql;


ALTER SCHEMA graphql OWNER TO supabase_admin;

--
-- Name: graphql_public; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA graphql_public;


ALTER SCHEMA graphql_public OWNER TO supabase_admin;

--
-- Name: pgbouncer; Type: SCHEMA; Schema: -; Owner: pgbouncer
--

CREATE SCHEMA pgbouncer;


ALTER SCHEMA pgbouncer OWNER TO pgbouncer;

--
-- Name: realtime; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA realtime;


ALTER SCHEMA realtime OWNER TO supabase_admin;

--
-- Name: storage; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA storage;


ALTER SCHEMA storage OWNER TO supabase_admin;

--
-- Name: supabase_migrations; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA supabase_migrations;


ALTER SCHEMA supabase_migrations OWNER TO postgres;

--
-- Name: vault; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA vault;


ALTER SCHEMA vault OWNER TO supabase_admin;

--
-- Name: pg_graphql; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_graphql WITH SCHEMA graphql;


--
-- Name: EXTENSION pg_graphql; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_graphql IS 'pg_graphql: GraphQL support';


--
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;


--
-- Name: EXTENSION pg_stat_statements; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_stat_statements IS 'track planning and execution statistics of all SQL statements executed';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: supabase_vault; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;


--
-- Name: EXTENSION supabase_vault; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION supabase_vault IS 'Supabase Vault Extension';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: aal_level; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.aal_level AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


ALTER TYPE auth.aal_level OWNER TO supabase_auth_admin;

--
-- Name: code_challenge_method; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.code_challenge_method AS ENUM (
    's256',
    'plain'
);


ALTER TYPE auth.code_challenge_method OWNER TO supabase_auth_admin;

--
-- Name: factor_status; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.factor_status AS ENUM (
    'unverified',
    'verified'
);


ALTER TYPE auth.factor_status OWNER TO supabase_auth_admin;

--
-- Name: factor_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.factor_type AS ENUM (
    'totp',
    'webauthn',
    'phone'
);


ALTER TYPE auth.factor_type OWNER TO supabase_auth_admin;

--
-- Name: oauth_authorization_status; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.oauth_authorization_status AS ENUM (
    'pending',
    'approved',
    'denied',
    'expired'
);


ALTER TYPE auth.oauth_authorization_status OWNER TO supabase_auth_admin;

--
-- Name: oauth_client_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.oauth_client_type AS ENUM (
    'public',
    'confidential'
);


ALTER TYPE auth.oauth_client_type OWNER TO supabase_auth_admin;

--
-- Name: oauth_registration_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.oauth_registration_type AS ENUM (
    'dynamic',
    'manual'
);


ALTER TYPE auth.oauth_registration_type OWNER TO supabase_auth_admin;

--
-- Name: oauth_response_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.oauth_response_type AS ENUM (
    'code'
);


ALTER TYPE auth.oauth_response_type OWNER TO supabase_auth_admin;

--
-- Name: one_time_token_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.one_time_token_type AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


ALTER TYPE auth.one_time_token_type OWNER TO supabase_auth_admin;

--
-- Name: action; Type: TYPE; Schema: realtime; Owner: supabase_admin
--

CREATE TYPE realtime.action AS ENUM (
    'INSERT',
    'UPDATE',
    'DELETE',
    'TRUNCATE',
    'ERROR'
);


ALTER TYPE realtime.action OWNER TO supabase_admin;

--
-- Name: equality_op; Type: TYPE; Schema: realtime; Owner: supabase_admin
--

CREATE TYPE realtime.equality_op AS ENUM (
    'eq',
    'neq',
    'lt',
    'lte',
    'gt',
    'gte',
    'in'
);


ALTER TYPE realtime.equality_op OWNER TO supabase_admin;

--
-- Name: user_defined_filter; Type: TYPE; Schema: realtime; Owner: supabase_admin
--

CREATE TYPE realtime.user_defined_filter AS (
	column_name text,
	op realtime.equality_op,
	value text
);


ALTER TYPE realtime.user_defined_filter OWNER TO supabase_admin;

--
-- Name: wal_column; Type: TYPE; Schema: realtime; Owner: supabase_admin
--

CREATE TYPE realtime.wal_column AS (
	name text,
	type_name text,
	type_oid oid,
	value jsonb,
	is_pkey boolean,
	is_selectable boolean
);


ALTER TYPE realtime.wal_column OWNER TO supabase_admin;

--
-- Name: wal_rls; Type: TYPE; Schema: realtime; Owner: supabase_admin
--

CREATE TYPE realtime.wal_rls AS (
	wal jsonb,
	is_rls_enabled boolean,
	subscription_ids uuid[],
	errors text[]
);


ALTER TYPE realtime.wal_rls OWNER TO supabase_admin;

--
-- Name: buckettype; Type: TYPE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TYPE storage.buckettype AS ENUM (
    'STANDARD',
    'ANALYTICS',
    'VECTOR'
);


ALTER TYPE storage.buckettype OWNER TO supabase_storage_admin;

--
-- Name: email(); Type: FUNCTION; Schema: auth; Owner: supabase_auth_admin
--

CREATE FUNCTION auth.email() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;


ALTER FUNCTION auth.email() OWNER TO supabase_auth_admin;

--
-- Name: FUNCTION email(); Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON FUNCTION auth.email() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';


--
-- Name: jwt(); Type: FUNCTION; Schema: auth; Owner: supabase_auth_admin
--

CREATE FUNCTION auth.jwt() RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;


ALTER FUNCTION auth.jwt() OWNER TO supabase_auth_admin;

--
-- Name: role(); Type: FUNCTION; Schema: auth; Owner: supabase_auth_admin
--

CREATE FUNCTION auth.role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;


ALTER FUNCTION auth.role() OWNER TO supabase_auth_admin;

--
-- Name: FUNCTION role(); Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON FUNCTION auth.role() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';


--
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: supabase_auth_admin
--

CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;


ALTER FUNCTION auth.uid() OWNER TO supabase_auth_admin;

--
-- Name: FUNCTION uid(); Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON FUNCTION auth.uid() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';


--
-- Name: grant_pg_cron_access(); Type: FUNCTION; Schema: extensions; Owner: supabase_admin
--

CREATE FUNCTION extensions.grant_pg_cron_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_cron'
  )
  THEN
    grant usage on schema cron to postgres with grant option;

    alter default privileges in schema cron grant all on tables to postgres with grant option;
    alter default privileges in schema cron grant all on functions to postgres with grant option;
    alter default privileges in schema cron grant all on sequences to postgres with grant option;

    alter default privileges for user supabase_admin in schema cron grant all
        on sequences to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on tables to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on functions to postgres with grant option;

    grant all privileges on all tables in schema cron to postgres with grant option;
    revoke all on table cron.job from postgres;
    grant select on table cron.job to postgres with grant option;
  END IF;
END;
$$;


ALTER FUNCTION extensions.grant_pg_cron_access() OWNER TO supabase_admin;

--
-- Name: FUNCTION grant_pg_cron_access(); Type: COMMENT; Schema: extensions; Owner: supabase_admin
--

COMMENT ON FUNCTION extensions.grant_pg_cron_access() IS 'Grants access to pg_cron';


--
-- Name: grant_pg_graphql_access(); Type: FUNCTION; Schema: extensions; Owner: supabase_admin
--

CREATE FUNCTION extensions.grant_pg_graphql_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $_$
DECLARE
    func_is_graphql_resolve bool;
BEGIN
    func_is_graphql_resolve = (
        SELECT n.proname = 'resolve'
        FROM pg_event_trigger_ddl_commands() AS ev
        LEFT JOIN pg_catalog.pg_proc AS n
        ON ev.objid = n.oid
    );

    IF func_is_graphql_resolve
    THEN
        -- Update public wrapper to pass all arguments through to the pg_graphql resolve func
        DROP FUNCTION IF EXISTS graphql_public.graphql;
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language sql
        as $$
            select graphql.resolve(
                query := query,
                variables := coalesce(variables, '{}'),
                "operationName" := "operationName",
                extensions := extensions
            );
        $$;

        -- This hook executes when `graphql.resolve` is created. That is not necessarily the last
        -- function in the extension so we need to grant permissions on existing entities AND
        -- update default permissions to any others that are created after `graphql.resolve`
        grant usage on schema graphql to postgres, anon, authenticated, service_role;
        grant select on all tables in schema graphql to postgres, anon, authenticated, service_role;
        grant execute on all functions in schema graphql to postgres, anon, authenticated, service_role;
        grant all on all sequences in schema graphql to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on tables to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on functions to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on sequences to postgres, anon, authenticated, service_role;

        -- Allow postgres role to allow granting usage on graphql and graphql_public schemas to custom roles
        grant usage on schema graphql_public to postgres with grant option;
        grant usage on schema graphql to postgres with grant option;
    END IF;

END;
$_$;


ALTER FUNCTION extensions.grant_pg_graphql_access() OWNER TO supabase_admin;

--
-- Name: FUNCTION grant_pg_graphql_access(); Type: COMMENT; Schema: extensions; Owner: supabase_admin
--

COMMENT ON FUNCTION extensions.grant_pg_graphql_access() IS 'Grants access to pg_graphql';


--
-- Name: grant_pg_net_access(); Type: FUNCTION; Schema: extensions; Owner: supabase_admin
--

CREATE FUNCTION extensions.grant_pg_net_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_net'
  )
  THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_roles
      WHERE rolname = 'supabase_functions_admin'
    )
    THEN
      CREATE USER supabase_functions_admin NOINHERIT CREATEROLE LOGIN NOREPLICATION;
    END IF;

    GRANT USAGE ON SCHEMA net TO supabase_functions_admin, postgres, anon, authenticated, service_role;

    IF EXISTS (
      SELECT FROM pg_extension
      WHERE extname = 'pg_net'
      -- all versions in use on existing projects as of 2025-02-20
      -- version 0.12.0 onwards don't need these applied
      AND extversion IN ('0.2', '0.6', '0.7', '0.7.1', '0.8', '0.10.0', '0.11.0')
    ) THEN
      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;

      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;

      REVOKE ALL ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;
      REVOKE ALL ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;

      GRANT EXECUTE ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
      GRANT EXECUTE ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
    END IF;
  END IF;
END;
$$;


ALTER FUNCTION extensions.grant_pg_net_access() OWNER TO supabase_admin;

--
-- Name: FUNCTION grant_pg_net_access(); Type: COMMENT; Schema: extensions; Owner: supabase_admin
--

COMMENT ON FUNCTION extensions.grant_pg_net_access() IS 'Grants access to pg_net';


--
-- Name: pgrst_ddl_watch(); Type: FUNCTION; Schema: extensions; Owner: supabase_admin
--

CREATE FUNCTION extensions.pgrst_ddl_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN SELECT * FROM pg_event_trigger_ddl_commands()
  LOOP
    IF cmd.command_tag IN (
      'CREATE SCHEMA', 'ALTER SCHEMA'
    , 'CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO', 'ALTER TABLE'
    , 'CREATE FOREIGN TABLE', 'ALTER FOREIGN TABLE'
    , 'CREATE VIEW', 'ALTER VIEW'
    , 'CREATE MATERIALIZED VIEW', 'ALTER MATERIALIZED VIEW'
    , 'CREATE FUNCTION', 'ALTER FUNCTION'
    , 'CREATE TRIGGER'
    , 'CREATE TYPE', 'ALTER TYPE'
    , 'CREATE RULE'
    , 'COMMENT'
    )
    -- don't notify in case of CREATE TEMP table or other objects created on pg_temp
    AND cmd.schema_name is distinct from 'pg_temp'
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


ALTER FUNCTION extensions.pgrst_ddl_watch() OWNER TO supabase_admin;

--
-- Name: pgrst_drop_watch(); Type: FUNCTION; Schema: extensions; Owner: supabase_admin
--

CREATE FUNCTION extensions.pgrst_drop_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  obj record;
BEGIN
  FOR obj IN SELECT * FROM pg_event_trigger_dropped_objects()
  LOOP
    IF obj.object_type IN (
      'schema'
    , 'table'
    , 'foreign table'
    , 'view'
    , 'materialized view'
    , 'function'
    , 'trigger'
    , 'type'
    , 'rule'
    )
    AND obj.is_temporary IS false -- no pg_temp objects
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


ALTER FUNCTION extensions.pgrst_drop_watch() OWNER TO supabase_admin;

--
-- Name: set_graphql_placeholder(); Type: FUNCTION; Schema: extensions; Owner: supabase_admin
--

CREATE FUNCTION extensions.set_graphql_placeholder() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $_$
    DECLARE
    graphql_is_dropped bool;
    BEGIN
    graphql_is_dropped = (
        SELECT ev.schema_name = 'graphql_public'
        FROM pg_event_trigger_dropped_objects() AS ev
        WHERE ev.schema_name = 'graphql_public'
    );

    IF graphql_is_dropped
    THEN
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language plpgsql
        as $$
            DECLARE
                server_version float;
            BEGIN
                server_version = (SELECT (SPLIT_PART((select version()), ' ', 2))::float);

                IF server_version >= 14 THEN
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql extension is not enabled.'
                            )
                        )
                    );
                ELSE
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql is only available on projects running Postgres 14 onwards.'
                            )
                        )
                    );
                END IF;
            END;
        $$;
    END IF;

    END;
$_$;


ALTER FUNCTION extensions.set_graphql_placeholder() OWNER TO supabase_admin;

--
-- Name: FUNCTION set_graphql_placeholder(); Type: COMMENT; Schema: extensions; Owner: supabase_admin
--

COMMENT ON FUNCTION extensions.set_graphql_placeholder() IS 'Reintroduces placeholder function for graphql_public.graphql';


--
-- Name: get_auth(text); Type: FUNCTION; Schema: pgbouncer; Owner: supabase_admin
--

CREATE FUNCTION pgbouncer.get_auth(p_usename text) RETURNS TABLE(username text, password text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
  BEGIN
      RAISE DEBUG 'PgBouncer auth request: %', p_usename;

      RETURN QUERY
      SELECT
          rolname::text,
          CASE WHEN rolvaliduntil < now()
              THEN null
              ELSE rolpassword::text
          END
      FROM pg_authid
      WHERE rolname=$1 and rolcanlogin;
  END;
  $_$;


ALTER FUNCTION pgbouncer.get_auth(p_usename text) OWNER TO supabase_admin;

--
-- Name: admin_change_claim_status_with_audit_atomic(uuid, uuid, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_change_claim_status_with_audit_atomic(p_claim_id uuid, p_target_status_id uuid, p_reason text, p_confirmation text DEFAULT 'CONFIRM'::text) RETURNS TABLE(claim_id uuid, previous_status_code text, updated_status_code text, updated_approval_level integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.admin_change_claim_status_with_audit_atomic(p_claim_id uuid, p_target_status_id uuid, p_reason text, p_confirmation text) OWNER TO postgres;

--
-- Name: admin_create_employee_atomic(text, text, text, uuid, uuid, uuid, uuid, uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_create_employee_atomic(p_employee_id text, p_employee_name text, p_employee_email text, p_designation_id uuid, p_employee_status_id uuid, p_role_id uuid, p_state_id uuid, p_approval_employee_id_level_1 uuid DEFAULT NULL::uuid, p_approval_employee_id_level_2 uuid DEFAULT NULL::uuid, p_approval_employee_id_level_3 uuid DEFAULT NULL::uuid) RETURNS TABLE(id uuid, employee_id text, employee_name text, employee_email text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.admin_create_employee_atomic(p_employee_id text, p_employee_name text, p_employee_email text, p_designation_id uuid, p_employee_status_id uuid, p_role_id uuid, p_state_id uuid, p_approval_employee_id_level_1 uuid, p_approval_employee_id_level_2 uuid, p_approval_employee_id_level_3 uuid) OWNER TO postgres;

--
-- Name: admin_finalize_employee_replacement_atomic(uuid, uuid, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_finalize_employee_replacement_atomic(p_old_employee_id uuid, p_new_employee_id uuid, p_reason text, p_confirmation text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.admin_finalize_employee_replacement_atomic(p_old_employee_id uuid, p_new_employee_id uuid, p_reason text, p_confirmation text) OWNER TO postgres;

--
-- Name: admin_prepare_employee_replacement_atomic(uuid, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_prepare_employee_replacement_atomic(p_employee_id uuid, p_reason text, p_confirmation text) RETURNS TABLE(old_employee_id uuid, old_employee_name text, default_designation_id uuid, default_role_id uuid, default_state_id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.admin_prepare_employee_replacement_atomic(p_employee_id uuid, p_reason text, p_confirmation text) OWNER TO postgres;

--
-- Name: admin_reassign_employee_approvers_atomic(uuid, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_reassign_employee_approvers_atomic(p_employee_id uuid, p_level_1 text DEFAULT NULL::text, p_level_2 text DEFAULT NULL::text, p_level_3 text DEFAULT NULL::text, p_reason text DEFAULT NULL::text, p_confirmation text DEFAULT NULL::text) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
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


ALTER FUNCTION public.admin_reassign_employee_approvers_atomic(p_employee_id uuid, p_level_1 text, p_level_2 text, p_level_3 text, p_reason text, p_confirmation text) OWNER TO postgres;

--
-- Name: admin_reassign_employee_approvers_with_audit_atomic(uuid, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_reassign_employee_approvers_with_audit_atomic(p_employee_id uuid, p_level_1 text, p_level_2 text, p_level_3 text, p_reason text, p_confirmation text) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.admin_reassign_employee_approvers_with_audit_atomic(p_employee_id uuid, p_level_1 text, p_level_2 text, p_level_3 text, p_reason text, p_confirmation text) OWNER TO postgres;

--
-- Name: admin_rollback_claim_atomic(uuid, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_rollback_claim_atomic(p_claim_id uuid, p_reason text, p_confirmation text DEFAULT NULL::text) RETURNS TABLE(claim_id uuid, rolled_back_to_status_code text, rolled_back_to_level integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.admin_rollback_claim_atomic(p_claim_id uuid, p_reason text, p_confirmation text) OWNER TO postgres;

--
-- Name: admin_toggle_designation_active_atomic(uuid, boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_toggle_designation_active_atomic(p_id uuid, p_is_active boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.admin_toggle_designation_active_atomic(p_id uuid, p_is_active boolean) OWNER TO postgres;

--
-- Name: admin_toggle_expense_rate_active_atomic(uuid, boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_toggle_expense_rate_active_atomic(p_id uuid, p_is_active boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.admin_toggle_expense_rate_active_atomic(p_id uuid, p_is_active boolean) OWNER TO postgres;

--
-- Name: admin_toggle_vehicle_type_active_atomic(uuid, boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_toggle_vehicle_type_active_atomic(p_id uuid, p_is_active boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.admin_toggle_vehicle_type_active_atomic(p_id uuid, p_is_active boolean) OWNER TO postgres;

--
-- Name: admin_toggle_work_location_active_atomic(uuid, boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_toggle_work_location_active_atomic(p_id uuid, p_is_active boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.admin_toggle_work_location_active_atomic(p_id uuid, p_is_active boolean) OWNER TO postgres;

--
-- Name: admin_update_expense_rate_amount_atomic(uuid, numeric); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_update_expense_rate_amount_atomic(p_id uuid, p_rate_amount numeric) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.admin_update_expense_rate_amount_atomic(p_id uuid, p_rate_amount numeric) OWNER TO postgres;

--
-- Name: admin_update_vehicle_rates_atomic(uuid, numeric, numeric, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_update_vehicle_rates_atomic(p_id uuid, p_base_fuel_rate_per_day numeric, p_intercity_rate_per_km numeric, p_max_km_round_trip integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.admin_update_vehicle_rates_atomic(p_id uuid, p_base_fuel_rate_per_day numeric, p_intercity_rate_per_km numeric, p_max_km_round_trip integer) OWNER TO postgres;

--
-- Name: admin_upsert_approver_selection_rule_atomic(integer, uuid, boolean, boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_upsert_approver_selection_rule_atomic(p_approval_level integer, p_designation_id uuid, p_requires_same_state boolean, p_is_active boolean) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.admin_upsert_approver_selection_rule_atomic(p_approval_level integer, p_designation_id uuid, p_requires_same_state boolean, p_is_active boolean) OWNER TO postgres;

--
-- Name: auth_user_has_elevated_role(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.auth_user_has_elevated_role() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.auth_user_has_elevated_role() OWNER TO postgres;

--
-- Name: bulk_finance_actions_atomic(uuid[], text, text, boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.bulk_finance_actions_atomic(p_claim_ids uuid[], p_action text, p_notes text DEFAULT NULL::text, p_allow_resubmit boolean DEFAULT false) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.bulk_finance_actions_atomic(p_claim_ids uuid[], p_action text, p_notes text, p_allow_resubmit boolean) OWNER TO postgres;

--
-- Name: bulk_issue_claims_atomic(uuid[], text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.bulk_issue_claims_atomic(p_claim_ids uuid[], p_notes text DEFAULT NULL::text) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
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


ALTER FUNCTION public.bulk_issue_claims_atomic(p_claim_ids uuid[], p_notes text) OWNER TO postgres;

--
-- Name: bump_config_version_from_admin_log(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.bump_config_version_from_admin_log() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.bump_config_version_from_admin_log() OWNER TO postgres;

--
-- Name: capture_claim_config_snapshot_on_insert(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.capture_claim_config_snapshot_on_insert() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.capture_claim_config_snapshot_on_insert() OWNER TO postgres;

--
-- Name: current_user_email(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.current_user_email() RETURNS text
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$

  select lower(coalesce(auth.jwt() ->> 'email', ''));

$$;


ALTER FUNCTION public.current_user_email() OWNER TO postgres;

--
-- Name: generate_claim_number(uuid, date); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.generate_claim_number(p_employee_uuid uuid, p_claim_date date) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.generate_claim_number(p_employee_uuid uuid, p_claim_date date) OWNER TO postgres;

--
-- Name: get_admin_approver_options_by_state(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_admin_approver_options_by_state(p_state_id uuid) RETURNS TABLE(approval_level integer, employee_id uuid, employee_name text, employee_email text, designation_id uuid, designation_name text, state_id uuid, state_name text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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

    es.state_id::uuid,

    s.state_name::text

  FROM public.approver_selection_rules r

  JOIN public.employees e

    ON e.designation_id = r.designation_id

  JOIN public.designations d

    ON d.id = e.designation_id

  LEFT JOIN public.employee_states es

    ON es.employee_id = e.id

   AND es.is_primary = true

  LEFT JOIN public.states s

    ON s.id = es.state_id

  WHERE r.is_active = true

    AND d.is_active = true

    AND (

      r.requires_same_state = false

      OR es.state_id = p_state_id

    )

  ORDER BY r.approval_level ASC, e.employee_name ASC;

END;

$$;


ALTER FUNCTION public.get_admin_approver_options_by_state(p_state_id uuid) OWNER TO postgres;

--
-- Name: get_admin_dashboard_analytics(date, date, text, uuid, uuid, uuid, text, text, text, uuid, boolean, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_admin_dashboard_analytics(p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_date_filter_field text DEFAULT 'travel_date'::text, p_designation_id uuid DEFAULT NULL::uuid, p_work_location_id uuid DEFAULT NULL::uuid, p_state_id uuid DEFAULT NULL::uuid, p_employee_id text DEFAULT NULL::text, p_employee_name text DEFAULT NULL::text, p_vehicle_code text DEFAULT NULL::text, p_claim_status_id uuid DEFAULT NULL::uuid, p_pending_only boolean DEFAULT false, p_top_claims_limit integer DEFAULT 10) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.get_admin_dashboard_analytics(p_date_from date, p_date_to date, p_date_filter_field text, p_designation_id uuid, p_work_location_id uuid, p_state_id uuid, p_employee_id text, p_employee_name text, p_vehicle_code text, p_claim_status_id uuid, p_pending_only boolean, p_top_claims_limit integer) OWNER TO postgres;

--
-- Name: get_admin_dashboard_analytics(date, date, text, text, uuid, uuid, uuid, text, text, text, uuid, boolean, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_admin_dashboard_analytics(p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_claim_id text DEFAULT NULL::text, p_date_filter_field text DEFAULT 'travel_date'::text, p_designation_id uuid DEFAULT NULL::uuid, p_work_location_id uuid DEFAULT NULL::uuid, p_state_id uuid DEFAULT NULL::uuid, p_employee_id text DEFAULT NULL::text, p_employee_name text DEFAULT NULL::text, p_vehicle_code text DEFAULT NULL::text, p_claim_status_id uuid DEFAULT NULL::uuid, p_pending_only boolean DEFAULT false, p_top_claims_limit integer DEFAULT 10) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.get_admin_dashboard_analytics(p_date_from date, p_date_to date, p_claim_id text, p_date_filter_field text, p_designation_id uuid, p_work_location_id uuid, p_state_id uuid, p_employee_id text, p_employee_name text, p_vehicle_code text, p_claim_status_id uuid, p_pending_only boolean, p_top_claims_limit integer) OWNER TO postgres;

--
-- Name: get_admin_finance_overview_metrics(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_admin_finance_overview_metrics() RETURNS TABLE(total_claims_count bigint, total_claims_amount numeric, pending_finance_count bigint, pending_finance_amount numeric, payment_issued_count bigint, payment_issued_amount numeric, rejected_count bigint, rejected_amount numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.get_admin_finance_overview_metrics() OWNER TO postgres;

--
-- Name: get_admin_summary_counts(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_admin_summary_counts() RETURNS TABLE(total_employees bigint, total_claims bigint, pending_claims bigint, designation_count bigint, work_location_count bigint, vehicle_type_count bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.get_admin_summary_counts() OWNER TO postgres;

--
-- Name: get_approval_employee_name_suggestions(text, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_approval_employee_name_suggestions(p_name_search text DEFAULT NULL::text, p_limit integer DEFAULT 50) RETURNS TABLE(employee_name text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.get_approval_employee_name_suggestions(p_name_search text, p_limit integer) OWNER TO postgres;

--
-- Name: get_claim_available_actions(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_claim_available_actions(p_claim_id uuid) RETURNS TABLE(action text, display_label text, require_notes boolean, supports_allow_resubmit boolean, actor_scope text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$

DECLARE

  v_email text;

  v_claim public.expense_claims%rowtype;

  v_owner public.employees%rowtype;

  v_current public.employees%rowtype;

  v_actor text;

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


ALTER FUNCTION public.get_claim_available_actions(p_claim_id uuid) OWNER TO postgres;

--
-- Name: get_claim_available_actions_bulk(uuid[]); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_claim_available_actions_bulk(p_claim_ids uuid[]) RETURNS TABLE(claim_id uuid, action text, display_label text, require_notes boolean, supports_allow_resubmit boolean, actor_scope text)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.get_claim_available_actions_bulk(p_claim_ids uuid[]) OWNER TO postgres;

--
-- Name: get_claim_bucket_metrics(uuid[], uuid[], uuid[], uuid[]); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_claim_bucket_metrics(p_claim_ids uuid[] DEFAULT NULL::uuid[], p_pending_status_ids uuid[] DEFAULT NULL::uuid[], p_approved_status_ids uuid[] DEFAULT NULL::uuid[], p_rejected_status_ids uuid[] DEFAULT NULL::uuid[]) RETURNS TABLE(total_count integer, total_amount numeric, pending_count integer, pending_amount numeric, approved_count integer, approved_amount numeric, rejected_count integer, rejected_amount numeric)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
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


ALTER FUNCTION public.get_claim_bucket_metrics(p_claim_ids uuid[], p_pending_status_ids uuid[], p_approved_status_ids uuid[], p_rejected_status_ids uuid[]) OWNER TO postgres;

--
-- Name: get_claim_status_id(character varying); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_claim_status_id(p_code character varying) RETURNS uuid
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$

  SELECT id FROM claim_statuses WHERE status_code = p_code;

$$;


ALTER FUNCTION public.get_claim_status_id(p_code character varying) OWNER TO postgres;

--
-- Name: get_designation_id(character varying); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_designation_id(p_code character varying) RETURNS uuid
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$

  SELECT id FROM designations WHERE designation_code = p_code;

$$;


ALTER FUNCTION public.get_designation_id(p_code character varying) OWNER TO postgres;

--
-- Name: get_employee_claim_metrics(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_employee_claim_metrics(p_employee_id uuid) RETURNS TABLE(total_count integer, total_amount numeric, pending_count integer, pending_amount numeric, approved_count integer, approved_amount numeric, rejected_count integer, rejected_amount numeric, rejected_allow_reclaim_count integer, rejected_allow_reclaim_amount numeric)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
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


ALTER FUNCTION public.get_employee_claim_metrics(p_employee_id uuid) OWNER TO postgres;

--
-- Name: get_filtered_approval_history(integer, timestamp with time zone, uuid, text, text[], text, uuid, boolean, date, date, timestamp with time zone, timestamp with time zone, timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_filtered_approval_history(p_limit integer DEFAULT 10, p_cursor_acted_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_cursor_action_id uuid DEFAULT NULL::uuid, p_name_search text DEFAULT NULL::text, p_actor_filters text[] DEFAULT NULL::text[], p_claim_status text DEFAULT NULL::text, p_claim_status_id uuid DEFAULT NULL::uuid, p_claim_allow_resubmit boolean DEFAULT NULL::boolean, p_claim_date_from date DEFAULT NULL::date, p_claim_date_to date DEFAULT NULL::date, p_hod_approved_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_hod_approved_to timestamp with time zone DEFAULT NULL::timestamp with time zone, p_finance_approved_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_finance_approved_to timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE(action_id uuid, claim_id uuid, claim_number text, claim_date date, work_location text, total_amount numeric, claim_status text, claim_status_name text, claim_status_display_color text, owner_name text, owner_designation text, actor_email text, actor_designation text, action text, approval_level integer, notes text, acted_at timestamp with time zone, hod_approved_at timestamp with time zone, finance_approved_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.get_filtered_approval_history(p_limit integer, p_cursor_acted_at timestamp with time zone, p_cursor_action_id uuid, p_name_search text, p_actor_filters text[], p_claim_status text, p_claim_status_id uuid, p_claim_allow_resubmit boolean, p_claim_date_from date, p_claim_date_to date, p_hod_approved_from timestamp with time zone, p_hod_approved_to timestamp with time zone, p_finance_approved_from timestamp with time zone, p_finance_approved_to timestamp with time zone) OWNER TO postgres;

--
-- Name: get_filtered_approval_history(integer, timestamp with time zone, uuid, text, text[], text, uuid, boolean, text, numeric, text, date, date, timestamp with time zone, timestamp with time zone, timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_filtered_approval_history(p_limit integer DEFAULT 10, p_cursor_acted_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_cursor_action_id uuid DEFAULT NULL::uuid, p_name_search text DEFAULT NULL::text, p_actor_filters text[] DEFAULT NULL::text[], p_claim_status text DEFAULT NULL::text, p_claim_status_id uuid DEFAULT NULL::uuid, p_claim_allow_resubmit boolean DEFAULT NULL::boolean, p_amount_operator text DEFAULT 'lte'::text, p_amount_value numeric DEFAULT NULL::numeric, p_location_type text DEFAULT NULL::text, p_claim_date_from date DEFAULT NULL::date, p_claim_date_to date DEFAULT NULL::date, p_hod_approved_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_hod_approved_to timestamp with time zone DEFAULT NULL::timestamp with time zone, p_finance_approved_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_finance_approved_to timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE(action_id uuid, claim_id uuid, claim_number text, claim_date date, work_location text, total_amount numeric, claim_status text, claim_status_name text, claim_status_display_color text, owner_name text, owner_designation text, actor_email text, actor_designation text, action text, approval_level integer, notes text, acted_at timestamp with time zone, hod_approved_at timestamp with time zone, finance_approved_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.get_filtered_approval_history(p_limit integer, p_cursor_acted_at timestamp with time zone, p_cursor_action_id uuid, p_name_search text, p_actor_filters text[], p_claim_status text, p_claim_status_id uuid, p_claim_allow_resubmit boolean, p_amount_operator text, p_amount_value numeric, p_location_type text, p_claim_date_from date, p_claim_date_to date, p_hod_approved_from timestamp with time zone, p_hod_approved_to timestamp with time zone, p_finance_approved_from timestamp with time zone, p_finance_approved_to timestamp with time zone) OWNER TO postgres;

--
-- Name: get_filtered_approval_history_count(text, text[], text, uuid, boolean, text, numeric, text, date, date, timestamp with time zone, timestamp with time zone, timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_filtered_approval_history_count(p_name_search text DEFAULT NULL::text, p_actor_filters text[] DEFAULT NULL::text[], p_claim_status text DEFAULT NULL::text, p_claim_status_id uuid DEFAULT NULL::uuid, p_claim_allow_resubmit boolean DEFAULT NULL::boolean, p_amount_operator text DEFAULT 'lte'::text, p_amount_value numeric DEFAULT NULL::numeric, p_location_type text DEFAULT NULL::text, p_claim_date_from date DEFAULT NULL::date, p_claim_date_to date DEFAULT NULL::date, p_hod_approved_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_hod_approved_to timestamp with time zone DEFAULT NULL::timestamp with time zone, p_finance_approved_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_finance_approved_to timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS bigint
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.get_filtered_approval_history_count(p_name_search text, p_actor_filters text[], p_claim_status text, p_claim_status_id uuid, p_claim_allow_resubmit boolean, p_amount_operator text, p_amount_value numeric, p_location_type text, p_claim_date_from date, p_claim_date_to date, p_hod_approved_from timestamp with time zone, p_hod_approved_to timestamp with time zone, p_finance_approved_from timestamp with time zone, p_finance_approved_to timestamp with time zone) OWNER TO postgres;

--
-- Name: get_finance_history_action_metrics(uuid[], text, timestamp with time zone, timestamp with time zone, text[], text[], text[]); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_finance_history_action_metrics(p_claim_ids uuid[] DEFAULT NULL::uuid[], p_action_filter text DEFAULT NULL::text, p_date_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_date_to timestamp with time zone DEFAULT NULL::timestamp with time zone, p_date_scoped_actions text[] DEFAULT NULL::text[], p_approved_actions text[] DEFAULT NULL::text[], p_rejected_actions text[] DEFAULT NULL::text[]) RETURNS TABLE(total_count integer, total_amount numeric, approved_count integer, approved_amount numeric, rejected_count integer, rejected_amount numeric, other_count integer, other_amount numeric)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$

  WITH scoped_actions AS (

    SELECT

      fa.action,

      c.total_amount

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


ALTER FUNCTION public.get_finance_history_action_metrics(p_claim_ids uuid[], p_action_filter text, p_date_from timestamp with time zone, p_date_to timestamp with time zone, p_date_scoped_actions text[], p_approved_actions text[], p_rejected_actions text[]) OWNER TO postgres;

--
-- Name: get_finance_pending_dashboard_analytics(date, date, uuid, uuid, uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_finance_pending_dashboard_analytics(p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_designation_id uuid DEFAULT NULL::uuid, p_work_location_id uuid DEFAULT NULL::uuid, p_state_id uuid DEFAULT NULL::uuid, p_employee_id text DEFAULT NULL::text, p_employee_name text DEFAULT NULL::text, p_vehicle_code text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.get_finance_pending_dashboard_analytics(p_date_from date, p_date_to date, p_designation_id uuid, p_work_location_id uuid, p_state_id uuid, p_employee_id text, p_employee_name text, p_vehicle_code text) OWNER TO postgres;

--
-- Name: get_finance_pending_dashboard_analytics(date, date, uuid, uuid, uuid, text, text, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_finance_pending_dashboard_analytics(p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_designation_id uuid DEFAULT NULL::uuid, p_work_location_id uuid DEFAULT NULL::uuid, p_state_id uuid DEFAULT NULL::uuid, p_employee_id text DEFAULT NULL::text, p_employee_name text DEFAULT NULL::text, p_vehicle_code text DEFAULT NULL::text, p_date_filter_field text DEFAULT 'travel_date'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.get_finance_pending_dashboard_analytics(p_date_from date, p_date_to date, p_designation_id uuid, p_work_location_id uuid, p_state_id uuid, p_employee_id text, p_employee_name text, p_vehicle_code text, p_date_filter_field text) OWNER TO postgres;

--
-- Name: get_finance_pending_dashboard_analytics(date, date, text, uuid, uuid, uuid, text, text, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_finance_pending_dashboard_analytics(p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_claim_id text DEFAULT NULL::text, p_designation_id uuid DEFAULT NULL::uuid, p_work_location_id uuid DEFAULT NULL::uuid, p_state_id uuid DEFAULT NULL::uuid, p_employee_id text DEFAULT NULL::text, p_employee_name text DEFAULT NULL::text, p_vehicle_code text DEFAULT NULL::text, p_date_filter_field text DEFAULT 'travel_date'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.get_finance_pending_dashboard_analytics(p_date_from date, p_date_to date, p_claim_id text, p_designation_id uuid, p_work_location_id uuid, p_state_id uuid, p_employee_id text, p_employee_name text, p_vehicle_code text, p_date_filter_field text) OWNER TO postgres;

--
-- Name: get_finance_visible_status_ids(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_finance_visible_status_ids() RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.get_finance_visible_status_ids() OWNER TO postgres;

--
-- Name: get_latest_finance_action_id(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_latest_finance_action_id(p_claim_id uuid) RETURNS uuid
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$

  SELECT fa.id

  FROM public.finance_actions fa

  WHERE fa.claim_id = p_claim_id

  ORDER BY fa.acted_at DESC, fa.id DESC

  LIMIT 1;

$$;


ALTER FUNCTION public.get_latest_finance_action_id(p_claim_id uuid) OWNER TO postgres;

--
-- Name: get_my_approver_acted_claim_ids(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_my_approver_acted_claim_ids() RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$

  SELECT DISTINCT ah.claim_id

  FROM   public.approval_history ah

  JOIN   public.employees         e  ON e.id = ah.approver_employee_id

  WHERE  lower(e.employee_email) = current_user_email();

$$;


ALTER FUNCTION public.get_my_approver_acted_claim_ids() OWNER TO postgres;

--
-- Name: get_pending_approval_scope_summary(uuid[], uuid[], uuid[], boolean, text, date, date, text, numeric, uuid[]); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_pending_approval_scope_summary(p_level1_employee_ids uuid[] DEFAULT NULL::uuid[], p_level2_employee_ids uuid[] DEFAULT NULL::uuid[], p_pending_status_ids uuid[] DEFAULT NULL::uuid[], p_allow_resubmit boolean DEFAULT NULL::boolean, p_employee_name text DEFAULT NULL::text, p_claim_date_from date DEFAULT NULL::date, p_claim_date_to date DEFAULT NULL::date, p_amount_operator text DEFAULT NULL::text, p_amount_value numeric DEFAULT NULL::numeric, p_location_ids uuid[] DEFAULT NULL::uuid[]) RETURNS TABLE(claim_count integer, total_amount numeric)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
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


ALTER FUNCTION public.get_pending_approval_scope_summary(p_level1_employee_ids uuid[], p_level2_employee_ids uuid[], p_pending_status_ids uuid[], p_allow_resubmit boolean, p_employee_name text, p_claim_date_from date, p_claim_date_to date, p_amount_operator text, p_amount_value numeric, p_location_ids uuid[]) OWNER TO postgres;

--
-- Name: get_work_location_id(character varying); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_work_location_id(p_code character varying) RETURNS uuid
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$

  SELECT id FROM work_locations WHERE location_code = p_code;

$$;


ALTER FUNCTION public.get_work_location_id(p_code character varying) OWNER TO postgres;

--
-- Name: reassign_orphaned_approvals(uuid, uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.reassign_orphaned_approvals(p_old_approver_id uuid, p_new_approver_id uuid, p_admin_employee_id uuid, p_reason text DEFAULT 'Approver reassignment'::text) RETURNS TABLE(reassigned_count integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.reassign_orphaned_approvals(p_old_approver_id uuid, p_new_approver_id uuid, p_admin_employee_id uuid, p_reason text) OWNER TO postgres;

--
-- Name: require_admin_actor(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.require_admin_actor() RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.require_admin_actor() OWNER TO postgres;

--
-- Name: require_finance_actor(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.require_finance_actor() RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.require_finance_actor() OWNER TO postgres;

--
-- Name: resolve_claim_allow_resubmit_filter(uuid, boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.resolve_claim_allow_resubmit_filter(p_claim_status_id uuid, p_claim_allow_resubmit boolean DEFAULT NULL::boolean) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.resolve_claim_allow_resubmit_filter(p_claim_status_id uuid, p_claim_allow_resubmit boolean) OWNER TO postgres;

--
-- Name: resubmit_claim_after_rejection_atomic(uuid, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.resubmit_claim_after_rejection_atomic(p_claim_id uuid, p_notes text DEFAULT NULL::text) RETURNS TABLE(claim_id uuid, new_status_code text, new_approval_level integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.resubmit_claim_after_rejection_atomic(p_claim_id uuid, p_notes text) OWNER TO postgres;

--
-- Name: set_claim_number_before_insert(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_claim_number_before_insert() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$

begin

  if coalesce(trim(new.claim_number), '') = '' then

    new.claim_number := public.generate_claim_number(new.employee_id, new.claim_date);

  end if;



  return new;

end;

$$;


ALTER FUNCTION public.set_claim_number_before_insert() OWNER TO postgres;

--
-- Name: submit_approval_action_atomic(uuid, text, text, boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.submit_approval_action_atomic(p_claim_id uuid, p_action text, p_notes text DEFAULT NULL::text, p_allow_resubmit boolean DEFAULT NULL::boolean) RETURNS TABLE(claim_id uuid, new_status_code text, new_approval_level integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.submit_approval_action_atomic(p_claim_id uuid, p_action text, p_notes text, p_allow_resubmit boolean) OWNER TO postgres;

--
-- Name: submit_finance_action_atomic(uuid, text, text, boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.submit_finance_action_atomic(p_claim_id uuid, p_action text, p_notes text DEFAULT NULL::text, p_allow_resubmit boolean DEFAULT NULL::boolean) RETURNS TABLE(claim_id uuid, new_status_code text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.submit_finance_action_atomic(p_claim_id uuid, p_action text, p_notes text, p_allow_resubmit boolean) OWNER TO postgres;

--
-- Name: supersede_rejected_claim(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.supersede_rejected_claim(p_claim_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
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


ALTER FUNCTION public.supersede_rejected_claim(p_claim_id uuid) OWNER TO postgres;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$

begin

  new.updated_at = now();

  return new;

end;

$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

--
-- Name: apply_rls(jsonb, integer); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer DEFAULT (1024 * 1024)) RETURNS SETOF realtime.wal_rls
    LANGUAGE plpgsql
    AS $$
declare
-- Regclass of the table e.g. public.notes
entity_ regclass = (quote_ident(wal ->> 'schema') || '.' || quote_ident(wal ->> 'table'))::regclass;

-- I, U, D, T: insert, update ...
action realtime.action = (
    case wal ->> 'action'
        when 'I' then 'INSERT'
        when 'U' then 'UPDATE'
        when 'D' then 'DELETE'
        else 'ERROR'
    end
);

-- Is row level security enabled for the table
is_rls_enabled bool = relrowsecurity from pg_class where oid = entity_;

subscriptions realtime.subscription[] = array_agg(subs)
    from
        realtime.subscription subs
    where
        subs.entity = entity_
        -- Filter by action early - only get subscriptions interested in this action
        -- action_filter column can be: '*' (all), 'INSERT', 'UPDATE', or 'DELETE'
        and (subs.action_filter = '*' or subs.action_filter = action::text);

-- Subscription vars
roles regrole[] = array_agg(distinct us.claims_role::text)
    from
        unnest(subscriptions) us;

working_role regrole;
claimed_role regrole;
claims jsonb;

subscription_id uuid;
subscription_has_access bool;
visible_to_subscription_ids uuid[] = '{}';

-- structured info for wal's columns
columns realtime.wal_column[];
-- previous identity values for update/delete
old_columns realtime.wal_column[];

error_record_exceeds_max_size boolean = octet_length(wal::text) > max_record_bytes;

-- Primary jsonb output for record
output jsonb;

begin
perform set_config('role', null, true);

columns =
    array_agg(
        (
            x->>'name',
            x->>'type',
            x->>'typeoid',
            realtime.cast(
                (x->'value') #>> '{}',
                coalesce(
                    (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                    (x->>'type')::regtype
                )
            ),
            (pks ->> 'name') is not null,
            true
        )::realtime.wal_column
    )
    from
        jsonb_array_elements(wal -> 'columns') x
        left join jsonb_array_elements(wal -> 'pk') pks
            on (x ->> 'name') = (pks ->> 'name');

old_columns =
    array_agg(
        (
            x->>'name',
            x->>'type',
            x->>'typeoid',
            realtime.cast(
                (x->'value') #>> '{}',
                coalesce(
                    (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                    (x->>'type')::regtype
                )
            ),
            (pks ->> 'name') is not null,
            true
        )::realtime.wal_column
    )
    from
        jsonb_array_elements(wal -> 'identity') x
        left join jsonb_array_elements(wal -> 'pk') pks
            on (x ->> 'name') = (pks ->> 'name');

for working_role in select * from unnest(roles) loop

    -- Update `is_selectable` for columns and old_columns
    columns =
        array_agg(
            (
                c.name,
                c.type_name,
                c.type_oid,
                c.value,
                c.is_pkey,
                pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
            )::realtime.wal_column
        )
        from
            unnest(columns) c;

    old_columns =
            array_agg(
                (
                    c.name,
                    c.type_name,
                    c.type_oid,
                    c.value,
                    c.is_pkey,
                    pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
                )::realtime.wal_column
            )
            from
                unnest(old_columns) c;

    if action <> 'DELETE' and count(1) = 0 from unnest(columns) c where c.is_pkey then
        return next (
            jsonb_build_object(
                'schema', wal ->> 'schema',
                'table', wal ->> 'table',
                'type', action
            ),
            is_rls_enabled,
            -- subscriptions is already filtered by entity
            (select array_agg(s.subscription_id) from unnest(subscriptions) as s where claims_role = working_role),
            array['Error 400: Bad Request, no primary key']
        )::realtime.wal_rls;

    -- The claims role does not have SELECT permission to the primary key of entity
    elsif action <> 'DELETE' and sum(c.is_selectable::int) <> count(1) from unnest(columns) c where c.is_pkey then
        return next (
            jsonb_build_object(
                'schema', wal ->> 'schema',
                'table', wal ->> 'table',
                'type', action
            ),
            is_rls_enabled,
            (select array_agg(s.subscription_id) from unnest(subscriptions) as s where claims_role = working_role),
            array['Error 401: Unauthorized']
        )::realtime.wal_rls;

    else
        output = jsonb_build_object(
            'schema', wal ->> 'schema',
            'table', wal ->> 'table',
            'type', action,
            'commit_timestamp', to_char(
                ((wal ->> 'timestamp')::timestamptz at time zone 'utc'),
                'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
            ),
            'columns', (
                select
                    jsonb_agg(
                        jsonb_build_object(
                            'name', pa.attname,
                            'type', pt.typname
                        )
                        order by pa.attnum asc
                    )
                from
                    pg_attribute pa
                    join pg_type pt
                        on pa.atttypid = pt.oid
                where
                    attrelid = entity_
                    and attnum > 0
                    and pg_catalog.has_column_privilege(working_role, entity_, pa.attname, 'SELECT')
            )
        )
        -- Add "record" key for insert and update
        || case
            when action in ('INSERT', 'UPDATE') then
                jsonb_build_object(
                    'record',
                    (
                        select
                            jsonb_object_agg(
                                -- if unchanged toast, get column name and value from old record
                                coalesce((c).name, (oc).name),
                                case
                                    when (c).name is null then (oc).value
                                    else (c).value
                                end
                            )
                        from
                            unnest(columns) c
                            full outer join unnest(old_columns) oc
                                on (c).name = (oc).name
                        where
                            coalesce((c).is_selectable, (oc).is_selectable)
                            and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                    )
                )
            else '{}'::jsonb
        end
        -- Add "old_record" key for update and delete
        || case
            when action = 'UPDATE' then
                jsonb_build_object(
                        'old_record',
                        (
                            select jsonb_object_agg((c).name, (c).value)
                            from unnest(old_columns) c
                            where
                                (c).is_selectable
                                and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                        )
                    )
            when action = 'DELETE' then
                jsonb_build_object(
                    'old_record',
                    (
                        select jsonb_object_agg((c).name, (c).value)
                        from unnest(old_columns) c
                        where
                            (c).is_selectable
                            and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                            and ( not is_rls_enabled or (c).is_pkey ) -- if RLS enabled, we can't secure deletes so filter to pkey
                    )
                )
            else '{}'::jsonb
        end;

        -- Create the prepared statement
        if is_rls_enabled and action <> 'DELETE' then
            if (select 1 from pg_prepared_statements where name = 'walrus_rls_stmt' limit 1) > 0 then
                deallocate walrus_rls_stmt;
            end if;
            execute realtime.build_prepared_statement_sql('walrus_rls_stmt', entity_, columns);
        end if;

        visible_to_subscription_ids = '{}';

        for subscription_id, claims in (
                select
                    subs.subscription_id,
                    subs.claims
                from
                    unnest(subscriptions) subs
                where
                    subs.entity = entity_
                    and subs.claims_role = working_role
                    and (
                        realtime.is_visible_through_filters(columns, subs.filters)
                        or (
                          action = 'DELETE'
                          and realtime.is_visible_through_filters(old_columns, subs.filters)
                        )
                    )
        ) loop

            if not is_rls_enabled or action = 'DELETE' then
                visible_to_subscription_ids = visible_to_subscription_ids || subscription_id;
            else
                -- Check if RLS allows the role to see the record
                perform
                    -- Trim leading and trailing quotes from working_role because set_config
                    -- doesn't recognize the role as valid if they are included
                    set_config('role', trim(both '"' from working_role::text), true),
                    set_config('request.jwt.claims', claims::text, true);

                execute 'execute walrus_rls_stmt' into subscription_has_access;

                if subscription_has_access then
                    visible_to_subscription_ids = visible_to_subscription_ids || subscription_id;
                end if;
            end if;
        end loop;

        perform set_config('role', null, true);

        return next (
            output,
            is_rls_enabled,
            visible_to_subscription_ids,
            case
                when error_record_exceeds_max_size then array['Error 413: Payload Too Large']
                else '{}'
            end
        )::realtime.wal_rls;

    end if;
end loop;

perform set_config('role', null, true);
end;
$$;


ALTER FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) OWNER TO supabase_admin;

--
-- Name: broadcast_changes(text, text, text, text, text, record, record, text); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text DEFAULT 'ROW'::text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    -- Declare a variable to hold the JSONB representation of the row
    row_data jsonb := '{}'::jsonb;
BEGIN
    IF level = 'STATEMENT' THEN
        RAISE EXCEPTION 'function can only be triggered for each row, not for each statement';
    END IF;
    -- Check the operation type and handle accordingly
    IF operation = 'INSERT' OR operation = 'UPDATE' OR operation = 'DELETE' THEN
        row_data := jsonb_build_object('old_record', OLD, 'record', NEW, 'operation', operation, 'table', table_name, 'schema', table_schema);
        PERFORM realtime.send (row_data, event_name, topic_name);
    ELSE
        RAISE EXCEPTION 'Unexpected operation type: %', operation;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to process the row: %', SQLERRM;
END;

$$;


ALTER FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text) OWNER TO supabase_admin;

--
-- Name: build_prepared_statement_sql(text, regclass, realtime.wal_column[]); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) RETURNS text
    LANGUAGE sql
    AS $$
      /*
      Builds a sql string that, if executed, creates a prepared statement to
      tests retrive a row from *entity* by its primary key columns.
      Example
          select realtime.build_prepared_statement_sql('public.notes', '{"id"}'::text[], '{"bigint"}'::text[])
      */
          select
      'prepare ' || prepared_statement_name || ' as
          select
              exists(
                  select
                      1
                  from
                      ' || entity || '
                  where
                      ' || string_agg(quote_ident(pkc.name) || '=' || quote_nullable(pkc.value #>> '{}') , ' and ') || '
              )'
          from
              unnest(columns) pkc
          where
              pkc.is_pkey
          group by
              entity
      $$;


ALTER FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) OWNER TO supabase_admin;

--
-- Name: cast(text, regtype); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime."cast"(val text, type_ regtype) RETURNS jsonb
    LANGUAGE plpgsql IMMUTABLE
    AS $$
declare
  res jsonb;
begin
  if type_::text = 'bytea' then
    return to_jsonb(val);
  end if;
  execute format('select to_jsonb(%L::'|| type_::text || ')', val) into res;
  return res;
end
$$;


ALTER FUNCTION realtime."cast"(val text, type_ regtype) OWNER TO supabase_admin;

--
-- Name: check_equality_op(realtime.equality_op, regtype, text, text); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    AS $$
      /*
      Casts *val_1* and *val_2* as type *type_* and check the *op* condition for truthiness
      */
      declare
          op_symbol text = (
              case
                  when op = 'eq' then '='
                  when op = 'neq' then '!='
                  when op = 'lt' then '<'
                  when op = 'lte' then '<='
                  when op = 'gt' then '>'
                  when op = 'gte' then '>='
                  when op = 'in' then '= any'
                  else 'UNKNOWN OP'
              end
          );
          res boolean;
      begin
          execute format(
              'select %L::'|| type_::text || ' ' || op_symbol
              || ' ( %L::'
              || (
                  case
                      when op = 'in' then type_::text || '[]'
                      else type_::text end
              )
              || ')', val_1, val_2) into res;
          return res;
      end;
      $$;


ALTER FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) OWNER TO supabase_admin;

--
-- Name: is_visible_through_filters(realtime.wal_column[], realtime.user_defined_filter[]); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $_$
    /*
    Should the record be visible (true) or filtered out (false) after *filters* are applied
    */
        select
            -- Default to allowed when no filters present
            $2 is null -- no filters. this should not happen because subscriptions has a default
            or array_length($2, 1) is null -- array length of an empty array is null
            or bool_and(
                coalesce(
                    realtime.check_equality_op(
                        op:=f.op,
                        type_:=coalesce(
                            col.type_oid::regtype, -- null when wal2json version <= 2.4
                            col.type_name::regtype
                        ),
                        -- cast jsonb to text
                        val_1:=col.value #>> '{}',
                        val_2:=f.value
                    ),
                    false -- if null, filter does not match
                )
            )
        from
            unnest(filters) f
            join unnest(columns) col
                on f.column_name = col.name;
    $_$;


ALTER FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) OWNER TO supabase_admin;

--
-- Name: list_changes(name, name, integer, integer); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) RETURNS SETOF realtime.wal_rls
    LANGUAGE sql
    SET log_min_messages TO 'fatal'
    AS $$
      with pub as (
        select
          concat_ws(
            ',',
            case when bool_or(pubinsert) then 'insert' else null end,
            case when bool_or(pubupdate) then 'update' else null end,
            case when bool_or(pubdelete) then 'delete' else null end
          ) as w2j_actions,
          coalesce(
            string_agg(
              realtime.quote_wal2json(format('%I.%I', schemaname, tablename)::regclass),
              ','
            ) filter (where ppt.tablename is not null and ppt.tablename not like '% %'),
            ''
          ) w2j_add_tables
        from
          pg_publication pp
          left join pg_publication_tables ppt
            on pp.pubname = ppt.pubname
        where
          pp.pubname = publication
        group by
          pp.pubname
        limit 1
      ),
      w2j as (
        select
          x.*, pub.w2j_add_tables
        from
          pub,
          pg_logical_slot_get_changes(
            slot_name, null, max_changes,
            'include-pk', 'true',
            'include-transaction', 'false',
            'include-timestamp', 'true',
            'include-type-oids', 'true',
            'format-version', '2',
            'actions', pub.w2j_actions,
            'add-tables', pub.w2j_add_tables
          ) x
      )
      select
        xyz.wal,
        xyz.is_rls_enabled,
        xyz.subscription_ids,
        xyz.errors
      from
        w2j,
        realtime.apply_rls(
          wal := w2j.data::jsonb,
          max_record_bytes := max_record_bytes
        ) xyz(wal, is_rls_enabled, subscription_ids, errors)
      where
        w2j.w2j_add_tables <> ''
        and xyz.subscription_ids[1] is not null
    $$;


ALTER FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) OWNER TO supabase_admin;

--
-- Name: quote_wal2json(regclass); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.quote_wal2json(entity regclass) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
      select
        (
          select string_agg('' || ch,'')
          from unnest(string_to_array(nsp.nspname::text, null)) with ordinality x(ch, idx)
          where
            not (x.idx = 1 and x.ch = '"')
            and not (
              x.idx = array_length(string_to_array(nsp.nspname::text, null), 1)
              and x.ch = '"'
            )
        )
        || '.'
        || (
          select string_agg('' || ch,'')
          from unnest(string_to_array(pc.relname::text, null)) with ordinality x(ch, idx)
          where
            not (x.idx = 1 and x.ch = '"')
            and not (
              x.idx = array_length(string_to_array(nsp.nspname::text, null), 1)
              and x.ch = '"'
            )
          )
      from
        pg_class pc
        join pg_namespace nsp
          on pc.relnamespace = nsp.oid
      where
        pc.oid = entity
    $$;


ALTER FUNCTION realtime.quote_wal2json(entity regclass) OWNER TO supabase_admin;

--
-- Name: send(jsonb, text, text, boolean); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean DEFAULT true) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  generated_id uuid;
  final_payload jsonb;
BEGIN
  BEGIN
    -- Generate a new UUID for the id
    generated_id := gen_random_uuid();

    -- Check if payload has an 'id' key, if not, add the generated UUID
    IF payload ? 'id' THEN
      final_payload := payload;
    ELSE
      final_payload := jsonb_set(payload, '{id}', to_jsonb(generated_id));
    END IF;

    -- Set the topic configuration
    EXECUTE format('SET LOCAL realtime.topic TO %L', topic);

    -- Attempt to insert the message
    INSERT INTO realtime.messages (id, payload, event, topic, private, extension)
    VALUES (generated_id, final_payload, event, topic, private, 'broadcast');
  EXCEPTION
    WHEN OTHERS THEN
      -- Capture and notify the error
      RAISE WARNING 'ErrorSendingBroadcastMessage: %', SQLERRM;
  END;
END;
$$;


ALTER FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean) OWNER TO supabase_admin;

--
-- Name: subscription_check_filters(); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.subscription_check_filters() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    /*
    Validates that the user defined filters for a subscription:
    - refer to valid columns that the claimed role may access
    - values are coercable to the correct column type
    */
    declare
        col_names text[] = coalesce(
                array_agg(c.column_name order by c.ordinal_position),
                '{}'::text[]
            )
            from
                information_schema.columns c
            where
                format('%I.%I', c.table_schema, c.table_name)::regclass = new.entity
                and pg_catalog.has_column_privilege(
                    (new.claims ->> 'role'),
                    format('%I.%I', c.table_schema, c.table_name)::regclass,
                    c.column_name,
                    'SELECT'
                );
        filter realtime.user_defined_filter;
        col_type regtype;

        in_val jsonb;
    begin
        for filter in select * from unnest(new.filters) loop
            -- Filtered column is valid
            if not filter.column_name = any(col_names) then
                raise exception 'invalid column for filter %', filter.column_name;
            end if;

            -- Type is sanitized and safe for string interpolation
            col_type = (
                select atttypid::regtype
                from pg_catalog.pg_attribute
                where attrelid = new.entity
                      and attname = filter.column_name
            );
            if col_type is null then
                raise exception 'failed to lookup type for column %', filter.column_name;
            end if;

            -- Set maximum number of entries for in filter
            if filter.op = 'in'::realtime.equality_op then
                in_val = realtime.cast(filter.value, (col_type::text || '[]')::regtype);
                if coalesce(jsonb_array_length(in_val), 0) > 100 then
                    raise exception 'too many values for `in` filter. Maximum 100';
                end if;
            else
                -- raises an exception if value is not coercable to type
                perform realtime.cast(filter.value, col_type);
            end if;

        end loop;

        -- Apply consistent order to filters so the unique constraint on
        -- (subscription_id, entity, filters) can't be tricked by a different filter order
        new.filters = coalesce(
            array_agg(f order by f.column_name, f.op, f.value),
            '{}'
        ) from unnest(new.filters) f;

        return new;
    end;
    $$;


ALTER FUNCTION realtime.subscription_check_filters() OWNER TO supabase_admin;

--
-- Name: to_regrole(text); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.to_regrole(role_name text) RETURNS regrole
    LANGUAGE sql IMMUTABLE
    AS $$ select role_name::regrole $$;


ALTER FUNCTION realtime.to_regrole(role_name text) OWNER TO supabase_admin;

--
-- Name: topic(); Type: FUNCTION; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE FUNCTION realtime.topic() RETURNS text
    LANGUAGE sql STABLE
    AS $$
select nullif(current_setting('realtime.topic', true), '')::text;
$$;


ALTER FUNCTION realtime.topic() OWNER TO supabase_realtime_admin;

--
-- Name: allow_any_operation(text[]); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.allow_any_operation(expected_operations text[]) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  WITH current_operation AS (
    SELECT storage.operation() AS raw_operation
  ),
  normalized AS (
    SELECT CASE
      WHEN raw_operation LIKE 'storage.%' THEN substr(raw_operation, 9)
      ELSE raw_operation
    END AS current_operation
    FROM current_operation
  )
  SELECT EXISTS (
    SELECT 1
    FROM normalized n
    CROSS JOIN LATERAL unnest(expected_operations) AS expected_operation
    WHERE expected_operation IS NOT NULL
      AND expected_operation <> ''
      AND n.current_operation = CASE
        WHEN expected_operation LIKE 'storage.%' THEN substr(expected_operation, 9)
        ELSE expected_operation
      END
  );
$$;


ALTER FUNCTION storage.allow_any_operation(expected_operations text[]) OWNER TO supabase_storage_admin;

--
-- Name: allow_only_operation(text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.allow_only_operation(expected_operation text) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  WITH current_operation AS (
    SELECT storage.operation() AS raw_operation
  ),
  normalized AS (
    SELECT
      CASE
        WHEN raw_operation LIKE 'storage.%' THEN substr(raw_operation, 9)
        ELSE raw_operation
      END AS current_operation,
      CASE
        WHEN expected_operation LIKE 'storage.%' THEN substr(expected_operation, 9)
        ELSE expected_operation
      END AS requested_operation
    FROM current_operation
  )
  SELECT CASE
    WHEN requested_operation IS NULL OR requested_operation = '' THEN FALSE
    ELSE COALESCE(current_operation = requested_operation, FALSE)
  END
  FROM normalized;
$$;


ALTER FUNCTION storage.allow_only_operation(expected_operation text) OWNER TO supabase_storage_admin;

--
-- Name: can_insert_object(text, text, uuid, jsonb); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.can_insert_object(bucketid text, name text, owner uuid, metadata jsonb) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "storage"."objects" ("bucket_id", "name", "owner", "metadata") VALUES (bucketid, name, owner, metadata);
  -- hack to rollback the successful insert
  RAISE sqlstate 'PT200' using
  message = 'ROLLBACK',
  detail = 'rollback successful insert';
END
$$;


ALTER FUNCTION storage.can_insert_object(bucketid text, name text, owner uuid, metadata jsonb) OWNER TO supabase_storage_admin;

--
-- Name: enforce_bucket_name_length(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.enforce_bucket_name_length() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
    if length(new.name) > 100 then
        raise exception 'bucket name "%" is too long (% characters). Max is 100.', new.name, length(new.name);
    end if;
    return new;
end;
$$;


ALTER FUNCTION storage.enforce_bucket_name_length() OWNER TO supabase_storage_admin;

--
-- Name: extension(text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.extension(name text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];
_filename text;
BEGIN
	select string_to_array(name, '/') into _parts;
	select _parts[array_length(_parts,1)] into _filename;
	-- @todo return the last part instead of 2
	return reverse(split_part(reverse(_filename), '.', 1));
END
$$;


ALTER FUNCTION storage.extension(name text) OWNER TO supabase_storage_admin;

--
-- Name: filename(text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.filename(name text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[array_length(_parts,1)];
END
$$;


ALTER FUNCTION storage.filename(name text) OWNER TO supabase_storage_admin;

--
-- Name: foldername(text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.foldername(name text) RETURNS text[]
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[1:array_length(_parts,1)-1];
END
$$;


ALTER FUNCTION storage.foldername(name text) OWNER TO supabase_storage_admin;

--
-- Name: get_common_prefix(text, text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.get_common_prefix(p_key text, p_prefix text, p_delimiter text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
SELECT CASE
    WHEN position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)) > 0
    THEN left(p_key, length(p_prefix) + position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)))
    ELSE NULL
END;
$$;


ALTER FUNCTION storage.get_common_prefix(p_key text, p_prefix text, p_delimiter text) OWNER TO supabase_storage_admin;

--
-- Name: get_size_by_bucket(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.get_size_by_bucket() RETURNS TABLE(size bigint, bucket_id text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    return query
        select sum((metadata->>'size')::int) as size, obj.bucket_id
        from "storage".objects as obj
        group by obj.bucket_id;
END
$$;


ALTER FUNCTION storage.get_size_by_bucket() OWNER TO supabase_storage_admin;

--
-- Name: list_multipart_uploads_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.list_multipart_uploads_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, next_key_token text DEFAULT ''::text, next_upload_token text DEFAULT ''::text) RETURNS TABLE(key text, id text, created_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(key COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                        substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1)))
                    ELSE
                        key
                END AS key, id, created_at
            FROM
                storage.s3_multipart_uploads
            WHERE
                bucket_id = $5 AND
                key ILIKE $1 || ''%'' AND
                CASE
                    WHEN $4 != '''' AND $6 = '''' THEN
                        CASE
                            WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                                substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                key COLLATE "C" > $4
                            END
                    ELSE
                        true
                END AND
                CASE
                    WHEN $6 != '''' THEN
                        id COLLATE "C" > $6
                    ELSE
                        true
                    END
            ORDER BY
                key COLLATE "C" ASC, created_at ASC) as e order by key COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_key_token, bucket_id, next_upload_token;
END;
$_$;


ALTER FUNCTION storage.list_multipart_uploads_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer, next_key_token text, next_upload_token text) OWNER TO supabase_storage_admin;

--
-- Name: list_objects_with_delimiter(text, text, text, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.list_objects_with_delimiter(_bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, start_after text DEFAULT ''::text, next_token text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, metadata jsonb, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;

    -- Configuration
    v_is_asc BOOLEAN;
    v_prefix TEXT;
    v_start TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_is_asc := lower(coalesce(sort_order, 'asc')) = 'asc';
    v_prefix := coalesce(prefix_param, '');
    v_start := CASE WHEN coalesce(next_token, '') <> '' THEN next_token ELSE coalesce(start_after, '') END;
    v_file_batch_size := LEAST(GREATEST(max_keys * 2, 100), 1000);

    -- Calculate upper bound for prefix filtering (bytewise, using COLLATE "C")
    IF v_prefix = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix, 1) = delimiter_param THEN
        v_upper_bound := left(v_prefix, -1) || chr(ascii(delimiter_param) + 1);
    ELSE
        v_upper_bound := left(v_prefix, -1) || chr(ascii(right(v_prefix, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'AND o.name COLLATE "C" < $3 ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'AND o.name COLLATE "C" >= $3 ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- ========================================================================
    -- SEEK INITIALIZATION: Determine starting position
    -- ========================================================================
    IF v_start = '' THEN
        IF v_is_asc THEN
            v_next_seek := v_prefix;
        ELSE
            -- DESC without cursor: find the last item in range
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;

            IF v_next_seek IS NOT NULL THEN
                v_next_seek := v_next_seek || delimiter_param;
            ELSE
                RETURN;
            END IF;
        END IF;
    ELSE
        -- Cursor provided: determine if it refers to a folder or leaf
        IF EXISTS (
            SELECT 1 FROM storage.objects o
            WHERE o.bucket_id = _bucket_id
              AND o.name COLLATE "C" LIKE v_start || delimiter_param || '%'
            LIMIT 1
        ) THEN
            -- Cursor refers to a folder
            IF v_is_asc THEN
                v_next_seek := v_start || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_start || delimiter_param;
            END IF;
        ELSE
            -- Cursor refers to a leaf object
            IF v_is_asc THEN
                v_next_seek := v_start || delimiter_param;
            ELSE
                v_next_seek := v_start;
            END IF;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= max_keys;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(v_peek_name, v_prefix, delimiter_param);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Emit and skip to next folder (no heap access needed)
            name := rtrim(v_common_prefix, delimiter_param);
            id := NULL;
            updated_at := NULL;
            created_at := NULL;
            last_accessed_at := NULL;
            metadata := NULL;
            RETURN NEXT;
            v_count := v_count + 1;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := left(v_common_prefix, -1) || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_common_prefix;
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query USING _bucket_id, v_next_seek,
                CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix) ELSE v_prefix END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(v_current.name, v_prefix, delimiter_param);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := v_current.name;
                    EXIT;
                END IF;

                -- Emit file
                name := v_current.name;
                id := v_current.id;
                updated_at := v_current.updated_at;
                created_at := v_current.created_at;
                last_accessed_at := v_current.last_accessed_at;
                metadata := v_current.metadata;
                RETURN NEXT;
                v_count := v_count + 1;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := v_current.name || delimiter_param;
                ELSE
                    v_next_seek := v_current.name;
                END IF;

                EXIT WHEN v_count >= max_keys;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


ALTER FUNCTION storage.list_objects_with_delimiter(_bucket_id text, prefix_param text, delimiter_param text, max_keys integer, start_after text, next_token text, sort_order text) OWNER TO supabase_storage_admin;

--
-- Name: operation(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.operation() RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$;


ALTER FUNCTION storage.operation() OWNER TO supabase_storage_admin;

--
-- Name: protect_delete(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.protect_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Check if storage.allow_delete_query is set to 'true'
    IF COALESCE(current_setting('storage.allow_delete_query', true), 'false') != 'true' THEN
        RAISE EXCEPTION 'Direct deletion from storage tables is not allowed. Use the Storage API instead.'
            USING HINT = 'This prevents accidental data loss from orphaned objects.',
                  ERRCODE = '42501';
    END IF;
    RETURN NULL;
END;
$$;


ALTER FUNCTION storage.protect_delete() OWNER TO supabase_storage_admin;

--
-- Name: search(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.search(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;
    v_delimiter CONSTANT TEXT := '/';

    -- Configuration
    v_limit INT;
    v_prefix TEXT;
    v_prefix_lower TEXT;
    v_is_asc BOOLEAN;
    v_order_by TEXT;
    v_sort_order TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;
    v_skipped INT := 0;
BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_limit := LEAST(coalesce(limits, 100), 1500);
    v_prefix := coalesce(prefix, '') || coalesce(search, '');
    v_prefix_lower := lower(v_prefix);
    v_is_asc := lower(coalesce(sortorder, 'asc')) = 'asc';
    v_file_batch_size := LEAST(GREATEST(v_limit * 2, 100), 1000);

    -- Validate sort column
    CASE lower(coalesce(sortcolumn, 'name'))
        WHEN 'name' THEN v_order_by := 'name';
        WHEN 'updated_at' THEN v_order_by := 'updated_at';
        WHEN 'created_at' THEN v_order_by := 'created_at';
        WHEN 'last_accessed_at' THEN v_order_by := 'last_accessed_at';
        ELSE v_order_by := 'name';
    END CASE;

    v_sort_order := CASE WHEN v_is_asc THEN 'asc' ELSE 'desc' END;

    -- ========================================================================
    -- NON-NAME SORTING: Use path_tokens approach (unchanged)
    -- ========================================================================
    IF v_order_by != 'name' THEN
        RETURN QUERY EXECUTE format(
            $sql$
            WITH folders AS (
                SELECT path_tokens[$1] AS folder
                FROM storage.objects
                WHERE objects.name ILIKE $2 || '%%'
                  AND bucket_id = $3
                  AND array_length(objects.path_tokens, 1) <> $1
                GROUP BY folder
                ORDER BY folder %s
            )
            (SELECT folder AS "name",
                   NULL::uuid AS id,
                   NULL::timestamptz AS updated_at,
                   NULL::timestamptz AS created_at,
                   NULL::timestamptz AS last_accessed_at,
                   NULL::jsonb AS metadata FROM folders)
            UNION ALL
            (SELECT path_tokens[$1] AS "name",
                   id, updated_at, created_at, last_accessed_at, metadata
             FROM storage.objects
             WHERE objects.name ILIKE $2 || '%%'
               AND bucket_id = $3
               AND array_length(objects.path_tokens, 1) = $1
             ORDER BY %I %s)
            LIMIT $4 OFFSET $5
            $sql$, v_sort_order, v_order_by, v_sort_order
        ) USING levels, v_prefix, bucketname, v_limit, offsets;
        RETURN;
    END IF;

    -- ========================================================================
    -- NAME SORTING: Hybrid skip-scan with batch optimization
    -- ========================================================================

    -- Calculate upper bound for prefix filtering
    IF v_prefix_lower = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix_lower, 1) = v_delimiter THEN
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(v_delimiter) + 1);
    ELSE
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(right(v_prefix_lower, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'AND lower(o.name) COLLATE "C" < $3 ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'AND lower(o.name) COLLATE "C" >= $3 ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- Initialize seek position
    IF v_is_asc THEN
        v_next_seek := v_prefix_lower;
    ELSE
        -- DESC: find the last item in range first (static SQL)
        IF v_upper_bound IS NOT NULL THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower AND lower(o.name) COLLATE "C" < v_upper_bound
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSIF v_prefix_lower <> '' THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSE
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        END IF;

        IF v_peek_name IS NOT NULL THEN
            v_next_seek := lower(v_peek_name) || v_delimiter;
        ELSE
            RETURN;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= v_limit;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek AND lower(o.name) COLLATE "C" < v_upper_bound
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix_lower <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(lower(v_peek_name), v_prefix_lower, v_delimiter);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Handle offset, emit if needed, skip to next folder
            IF v_skipped < offsets THEN
                v_skipped := v_skipped + 1;
            ELSE
                name := split_part(rtrim(storage.get_common_prefix(v_peek_name, v_prefix, v_delimiter), v_delimiter), v_delimiter, levels);
                id := NULL;
                updated_at := NULL;
                created_at := NULL;
                last_accessed_at := NULL;
                metadata := NULL;
                RETURN NEXT;
                v_count := v_count + 1;
            END IF;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := lower(left(v_common_prefix, -1)) || chr(ascii(v_delimiter) + 1);
            ELSE
                v_next_seek := lower(v_common_prefix);
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix_lower is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query
                USING bucketname, v_next_seek,
                    CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix_lower) ELSE v_prefix_lower END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(lower(v_current.name), v_prefix_lower, v_delimiter);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := lower(v_current.name);
                    EXIT;
                END IF;

                -- Handle offset skipping
                IF v_skipped < offsets THEN
                    v_skipped := v_skipped + 1;
                ELSE
                    -- Emit file
                    name := split_part(v_current.name, v_delimiter, levels);
                    id := v_current.id;
                    updated_at := v_current.updated_at;
                    created_at := v_current.created_at;
                    last_accessed_at := v_current.last_accessed_at;
                    metadata := v_current.metadata;
                    RETURN NEXT;
                    v_count := v_count + 1;
                END IF;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := lower(v_current.name) || v_delimiter;
                ELSE
                    v_next_seek := lower(v_current.name);
                END IF;

                EXIT WHEN v_count >= v_limit;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


ALTER FUNCTION storage.search(prefix text, bucketname text, limits integer, levels integer, offsets integer, search text, sortcolumn text, sortorder text) OWNER TO supabase_storage_admin;

--
-- Name: search_by_timestamp(text, text, integer, integer, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.search_by_timestamp(p_prefix text, p_bucket_id text, p_limit integer, p_level integer, p_start_after text, p_sort_order text, p_sort_column text, p_sort_column_after text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_cursor_op text;
    v_query text;
    v_prefix text;
BEGIN
    v_prefix := coalesce(p_prefix, '');

    IF p_sort_order = 'asc' THEN
        v_cursor_op := '>';
    ELSE
        v_cursor_op := '<';
    END IF;

    v_query := format($sql$
        WITH raw_objects AS (
            SELECT
                o.name AS obj_name,
                o.id AS obj_id,
                o.updated_at AS obj_updated_at,
                o.created_at AS obj_created_at,
                o.last_accessed_at AS obj_last_accessed_at,
                o.metadata AS obj_metadata,
                storage.get_common_prefix(o.name, $1, '/') AS common_prefix
            FROM storage.objects o
            WHERE o.bucket_id = $2
              AND o.name COLLATE "C" LIKE $1 || '%%'
        ),
        -- Aggregate common prefixes (folders)
        -- Both created_at and updated_at use MIN(obj_created_at) to match the old prefixes table behavior
        aggregated_prefixes AS (
            SELECT
                rtrim(common_prefix, '/') AS name,
                NULL::uuid AS id,
                MIN(obj_created_at) AS updated_at,
                MIN(obj_created_at) AS created_at,
                NULL::timestamptz AS last_accessed_at,
                NULL::jsonb AS metadata,
                TRUE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NOT NULL
            GROUP BY common_prefix
        ),
        leaf_objects AS (
            SELECT
                obj_name AS name,
                obj_id AS id,
                obj_updated_at AS updated_at,
                obj_created_at AS created_at,
                obj_last_accessed_at AS last_accessed_at,
                obj_metadata AS metadata,
                FALSE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NULL
        ),
        combined AS (
            SELECT * FROM aggregated_prefixes
            UNION ALL
            SELECT * FROM leaf_objects
        ),
        filtered AS (
            SELECT *
            FROM combined
            WHERE (
                $5 = ''
                OR ROW(
                    date_trunc('milliseconds', %I),
                    name COLLATE "C"
                ) %s ROW(
                    COALESCE(NULLIF($6, '')::timestamptz, 'epoch'::timestamptz),
                    $5
                )
            )
        )
        SELECT
            split_part(name, '/', $3) AS key,
            name,
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
        FROM filtered
        ORDER BY
            COALESCE(date_trunc('milliseconds', %I), 'epoch'::timestamptz) %s,
            name COLLATE "C" %s
        LIMIT $4
    $sql$,
        p_sort_column,
        v_cursor_op,
        p_sort_column,
        p_sort_order,
        p_sort_order
    );

    RETURN QUERY EXECUTE v_query
    USING v_prefix, p_bucket_id, p_level, p_limit, p_start_after, p_sort_column_after;
END;
$_$;


ALTER FUNCTION storage.search_by_timestamp(p_prefix text, p_bucket_id text, p_limit integer, p_level integer, p_start_after text, p_sort_order text, p_sort_column text, p_sort_column_after text) OWNER TO supabase_storage_admin;

--
-- Name: search_v2(text, text, integer, integer, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.search_v2(prefix text, bucket_name text, limits integer DEFAULT 100, levels integer DEFAULT 1, start_after text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text, sort_column text DEFAULT 'name'::text, sort_column_after text DEFAULT ''::text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
    v_sort_col text;
    v_sort_ord text;
    v_limit int;
BEGIN
    -- Cap limit to maximum of 1500 records
    v_limit := LEAST(coalesce(limits, 100), 1500);

    -- Validate and normalize sort_order
    v_sort_ord := lower(coalesce(sort_order, 'asc'));
    IF v_sort_ord NOT IN ('asc', 'desc') THEN
        v_sort_ord := 'asc';
    END IF;

    -- Validate and normalize sort_column
    v_sort_col := lower(coalesce(sort_column, 'name'));
    IF v_sort_col NOT IN ('name', 'updated_at', 'created_at') THEN
        v_sort_col := 'name';
    END IF;

    -- Route to appropriate implementation
    IF v_sort_col = 'name' THEN
        -- Use list_objects_with_delimiter for name sorting (most efficient: O(k * log n))
        RETURN QUERY
        SELECT
            split_part(l.name, '/', levels) AS key,
            l.name AS name,
            l.id,
            l.updated_at,
            l.created_at,
            l.last_accessed_at,
            l.metadata
        FROM storage.list_objects_with_delimiter(
            bucket_name,
            coalesce(prefix, ''),
            '/',
            v_limit,
            start_after,
            '',
            v_sort_ord
        ) l;
    ELSE
        -- Use aggregation approach for timestamp sorting
        -- Not efficient for large datasets but supports correct pagination
        RETURN QUERY SELECT * FROM storage.search_by_timestamp(
            prefix, bucket_name, v_limit, levels, start_after,
            v_sort_ord, v_sort_col, sort_column_after
        );
    END IF;
END;
$$;


ALTER FUNCTION storage.search_v2(prefix text, bucket_name text, limits integer, levels integer, start_after text, sort_order text, sort_column text, sort_column_after text) OWNER TO supabase_storage_admin;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$;


ALTER FUNCTION storage.update_updated_at_column() OWNER TO supabase_storage_admin;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_log_entries; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.audit_log_entries (
    instance_id uuid,
    id uuid NOT NULL,
    payload json,
    created_at timestamp with time zone,
    ip_address character varying(64) DEFAULT ''::character varying NOT NULL
);


ALTER TABLE auth.audit_log_entries OWNER TO supabase_auth_admin;

--
-- Name: TABLE audit_log_entries; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.audit_log_entries IS 'Auth: Audit trail for user actions.';


--
-- Name: custom_oauth_providers; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.custom_oauth_providers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_type text NOT NULL,
    identifier text NOT NULL,
    name text NOT NULL,
    client_id text NOT NULL,
    client_secret text NOT NULL,
    acceptable_client_ids text[] DEFAULT '{}'::text[] NOT NULL,
    scopes text[] DEFAULT '{}'::text[] NOT NULL,
    pkce_enabled boolean DEFAULT true NOT NULL,
    attribute_mapping jsonb DEFAULT '{}'::jsonb NOT NULL,
    authorization_params jsonb DEFAULT '{}'::jsonb NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    email_optional boolean DEFAULT false NOT NULL,
    issuer text,
    discovery_url text,
    skip_nonce_check boolean DEFAULT false NOT NULL,
    cached_discovery jsonb,
    discovery_cached_at timestamp with time zone,
    authorization_url text,
    token_url text,
    userinfo_url text,
    jwks_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT custom_oauth_providers_authorization_url_https CHECK (((authorization_url IS NULL) OR (authorization_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_authorization_url_length CHECK (((authorization_url IS NULL) OR (char_length(authorization_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_client_id_length CHECK (((char_length(client_id) >= 1) AND (char_length(client_id) <= 512))),
    CONSTRAINT custom_oauth_providers_discovery_url_length CHECK (((discovery_url IS NULL) OR (char_length(discovery_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_identifier_format CHECK ((identifier ~ '^[a-z0-9][a-z0-9:-]{0,48}[a-z0-9]$'::text)),
    CONSTRAINT custom_oauth_providers_issuer_length CHECK (((issuer IS NULL) OR ((char_length(issuer) >= 1) AND (char_length(issuer) <= 2048)))),
    CONSTRAINT custom_oauth_providers_jwks_uri_https CHECK (((jwks_uri IS NULL) OR (jwks_uri ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_jwks_uri_length CHECK (((jwks_uri IS NULL) OR (char_length(jwks_uri) <= 2048))),
    CONSTRAINT custom_oauth_providers_name_length CHECK (((char_length(name) >= 1) AND (char_length(name) <= 100))),
    CONSTRAINT custom_oauth_providers_oauth2_requires_endpoints CHECK (((provider_type <> 'oauth2'::text) OR ((authorization_url IS NOT NULL) AND (token_url IS NOT NULL) AND (userinfo_url IS NOT NULL)))),
    CONSTRAINT custom_oauth_providers_oidc_discovery_url_https CHECK (((provider_type <> 'oidc'::text) OR (discovery_url IS NULL) OR (discovery_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_oidc_issuer_https CHECK (((provider_type <> 'oidc'::text) OR (issuer IS NULL) OR (issuer ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_oidc_requires_issuer CHECK (((provider_type <> 'oidc'::text) OR (issuer IS NOT NULL))),
    CONSTRAINT custom_oauth_providers_provider_type_check CHECK ((provider_type = ANY (ARRAY['oauth2'::text, 'oidc'::text]))),
    CONSTRAINT custom_oauth_providers_token_url_https CHECK (((token_url IS NULL) OR (token_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_token_url_length CHECK (((token_url IS NULL) OR (char_length(token_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_userinfo_url_https CHECK (((userinfo_url IS NULL) OR (userinfo_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_userinfo_url_length CHECK (((userinfo_url IS NULL) OR (char_length(userinfo_url) <= 2048)))
);


ALTER TABLE auth.custom_oauth_providers OWNER TO supabase_auth_admin;

--
-- Name: flow_state; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.flow_state (
    id uuid NOT NULL,
    user_id uuid,
    auth_code text,
    code_challenge_method auth.code_challenge_method,
    code_challenge text,
    provider_type text NOT NULL,
    provider_access_token text,
    provider_refresh_token text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    authentication_method text NOT NULL,
    auth_code_issued_at timestamp with time zone,
    invite_token text,
    referrer text,
    oauth_client_state_id uuid,
    linking_target_id uuid,
    email_optional boolean DEFAULT false NOT NULL
);


ALTER TABLE auth.flow_state OWNER TO supabase_auth_admin;

--
-- Name: TABLE flow_state; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.flow_state IS 'Stores metadata for all OAuth/SSO login flows';


--
-- Name: identities; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.identities (
    provider_id text NOT NULL,
    user_id uuid NOT NULL,
    identity_data jsonb NOT NULL,
    provider text NOT NULL,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    email text GENERATED ALWAYS AS (lower((identity_data ->> 'email'::text))) STORED,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE auth.identities OWNER TO supabase_auth_admin;

--
-- Name: TABLE identities; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.identities IS 'Auth: Stores identities associated to a user.';


--
-- Name: COLUMN identities.email; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.identities.email IS 'Auth: Email is a generated column that references the optional email property in the identity_data';


--
-- Name: instances; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.instances (
    id uuid NOT NULL,
    uuid uuid,
    raw_base_config text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


ALTER TABLE auth.instances OWNER TO supabase_auth_admin;

--
-- Name: TABLE instances; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.instances IS 'Auth: Manages users across multiple sites.';


--
-- Name: mfa_amr_claims; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.mfa_amr_claims (
    session_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    authentication_method text NOT NULL,
    id uuid NOT NULL
);


ALTER TABLE auth.mfa_amr_claims OWNER TO supabase_auth_admin;

--
-- Name: TABLE mfa_amr_claims; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.mfa_amr_claims IS 'auth: stores authenticator method reference claims for multi factor authentication';


--
-- Name: mfa_challenges; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.mfa_challenges (
    id uuid NOT NULL,
    factor_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    ip_address inet NOT NULL,
    otp_code text,
    web_authn_session_data jsonb
);


ALTER TABLE auth.mfa_challenges OWNER TO supabase_auth_admin;

--
-- Name: TABLE mfa_challenges; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.mfa_challenges IS 'auth: stores metadata about challenge requests made';


--
-- Name: mfa_factors; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.mfa_factors (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    friendly_name text,
    factor_type auth.factor_type NOT NULL,
    status auth.factor_status NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    secret text,
    phone text,
    last_challenged_at timestamp with time zone,
    web_authn_credential jsonb,
    web_authn_aaguid uuid,
    last_webauthn_challenge_data jsonb
);


ALTER TABLE auth.mfa_factors OWNER TO supabase_auth_admin;

--
-- Name: TABLE mfa_factors; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.mfa_factors IS 'auth: stores metadata about factors';


--
-- Name: COLUMN mfa_factors.last_webauthn_challenge_data; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.mfa_factors.last_webauthn_challenge_data IS 'Stores the latest WebAuthn challenge data including attestation/assertion for customer verification';


--
-- Name: oauth_authorizations; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.oauth_authorizations (
    id uuid NOT NULL,
    authorization_id text NOT NULL,
    client_id uuid NOT NULL,
    user_id uuid,
    redirect_uri text NOT NULL,
    scope text NOT NULL,
    state text,
    resource text,
    code_challenge text,
    code_challenge_method auth.code_challenge_method,
    response_type auth.oauth_response_type DEFAULT 'code'::auth.oauth_response_type NOT NULL,
    status auth.oauth_authorization_status DEFAULT 'pending'::auth.oauth_authorization_status NOT NULL,
    authorization_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:03:00'::interval) NOT NULL,
    approved_at timestamp with time zone,
    nonce text,
    CONSTRAINT oauth_authorizations_authorization_code_length CHECK ((char_length(authorization_code) <= 255)),
    CONSTRAINT oauth_authorizations_code_challenge_length CHECK ((char_length(code_challenge) <= 128)),
    CONSTRAINT oauth_authorizations_expires_at_future CHECK ((expires_at > created_at)),
    CONSTRAINT oauth_authorizations_nonce_length CHECK ((char_length(nonce) <= 255)),
    CONSTRAINT oauth_authorizations_redirect_uri_length CHECK ((char_length(redirect_uri) <= 2048)),
    CONSTRAINT oauth_authorizations_resource_length CHECK ((char_length(resource) <= 2048)),
    CONSTRAINT oauth_authorizations_scope_length CHECK ((char_length(scope) <= 4096)),
    CONSTRAINT oauth_authorizations_state_length CHECK ((char_length(state) <= 4096))
);


ALTER TABLE auth.oauth_authorizations OWNER TO supabase_auth_admin;

--
-- Name: oauth_client_states; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.oauth_client_states (
    id uuid NOT NULL,
    provider_type text NOT NULL,
    code_verifier text,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE auth.oauth_client_states OWNER TO supabase_auth_admin;

--
-- Name: TABLE oauth_client_states; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.oauth_client_states IS 'Stores OAuth states for third-party provider authentication flows where Supabase acts as the OAuth client.';


--
-- Name: oauth_clients; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.oauth_clients (
    id uuid NOT NULL,
    client_secret_hash text,
    registration_type auth.oauth_registration_type NOT NULL,
    redirect_uris text NOT NULL,
    grant_types text NOT NULL,
    client_name text,
    client_uri text,
    logo_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    client_type auth.oauth_client_type DEFAULT 'confidential'::auth.oauth_client_type NOT NULL,
    token_endpoint_auth_method text NOT NULL,
    CONSTRAINT oauth_clients_client_name_length CHECK ((char_length(client_name) <= 1024)),
    CONSTRAINT oauth_clients_client_uri_length CHECK ((char_length(client_uri) <= 2048)),
    CONSTRAINT oauth_clients_logo_uri_length CHECK ((char_length(logo_uri) <= 2048)),
    CONSTRAINT oauth_clients_token_endpoint_auth_method_check CHECK ((token_endpoint_auth_method = ANY (ARRAY['client_secret_basic'::text, 'client_secret_post'::text, 'none'::text])))
);


ALTER TABLE auth.oauth_clients OWNER TO supabase_auth_admin;

--
-- Name: oauth_consents; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.oauth_consents (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    client_id uuid NOT NULL,
    scopes text NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    CONSTRAINT oauth_consents_revoked_after_granted CHECK (((revoked_at IS NULL) OR (revoked_at >= granted_at))),
    CONSTRAINT oauth_consents_scopes_length CHECK ((char_length(scopes) <= 2048)),
    CONSTRAINT oauth_consents_scopes_not_empty CHECK ((char_length(TRIM(BOTH FROM scopes)) > 0))
);


ALTER TABLE auth.oauth_consents OWNER TO supabase_auth_admin;

--
-- Name: one_time_tokens; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.one_time_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_type auth.one_time_token_type NOT NULL,
    token_hash text NOT NULL,
    relates_to text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT one_time_tokens_token_hash_check CHECK ((char_length(token_hash) > 0))
);


ALTER TABLE auth.one_time_tokens OWNER TO supabase_auth_admin;

--
-- Name: refresh_tokens; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.refresh_tokens (
    instance_id uuid,
    id bigint NOT NULL,
    token character varying(255),
    user_id character varying(255),
    revoked boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    parent character varying(255),
    session_id uuid
);


ALTER TABLE auth.refresh_tokens OWNER TO supabase_auth_admin;

--
-- Name: TABLE refresh_tokens; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.refresh_tokens IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: auth; Owner: supabase_auth_admin
--

CREATE SEQUENCE auth.refresh_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE auth.refresh_tokens_id_seq OWNER TO supabase_auth_admin;

--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: auth; Owner: supabase_auth_admin
--

ALTER SEQUENCE auth.refresh_tokens_id_seq OWNED BY auth.refresh_tokens.id;


--
-- Name: saml_providers; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.saml_providers (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    entity_id text NOT NULL,
    metadata_xml text NOT NULL,
    metadata_url text,
    attribute_mapping jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    name_id_format text,
    CONSTRAINT "entity_id not empty" CHECK ((char_length(entity_id) > 0)),
    CONSTRAINT "metadata_url not empty" CHECK (((metadata_url = NULL::text) OR (char_length(metadata_url) > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK ((char_length(metadata_xml) > 0))
);


ALTER TABLE auth.saml_providers OWNER TO supabase_auth_admin;

--
-- Name: TABLE saml_providers; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.saml_providers IS 'Auth: Manages SAML Identity Provider connections.';


--
-- Name: saml_relay_states; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.saml_relay_states (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    request_id text NOT NULL,
    for_email text,
    redirect_to text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    flow_state_id uuid,
    CONSTRAINT "request_id not empty" CHECK ((char_length(request_id) > 0))
);


ALTER TABLE auth.saml_relay_states OWNER TO supabase_auth_admin;

--
-- Name: TABLE saml_relay_states; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.saml_relay_states IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';


--
-- Name: schema_migrations; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.schema_migrations (
    version character varying(255) NOT NULL
);


ALTER TABLE auth.schema_migrations OWNER TO supabase_auth_admin;

--
-- Name: TABLE schema_migrations; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.schema_migrations IS 'Auth: Manages updates to the auth system.';


--
-- Name: sessions; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    factor_id uuid,
    aal auth.aal_level,
    not_after timestamp with time zone,
    refreshed_at timestamp without time zone,
    user_agent text,
    ip inet,
    tag text,
    oauth_client_id uuid,
    refresh_token_hmac_key text,
    refresh_token_counter bigint,
    scopes text,
    CONSTRAINT sessions_scopes_length CHECK ((char_length(scopes) <= 4096))
);


ALTER TABLE auth.sessions OWNER TO supabase_auth_admin;

--
-- Name: TABLE sessions; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.sessions IS 'Auth: Stores session data associated to a user.';


--
-- Name: COLUMN sessions.not_after; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.sessions.not_after IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';


--
-- Name: COLUMN sessions.refresh_token_hmac_key; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.sessions.refresh_token_hmac_key IS 'Holds a HMAC-SHA256 key used to sign refresh tokens for this session.';


--
-- Name: COLUMN sessions.refresh_token_counter; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.sessions.refresh_token_counter IS 'Holds the ID (counter) of the last issued refresh token.';


--
-- Name: sso_domains; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.sso_domains (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    domain text NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK ((char_length(domain) > 0))
);


ALTER TABLE auth.sso_domains OWNER TO supabase_auth_admin;

--
-- Name: TABLE sso_domains; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.sso_domains IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';


--
-- Name: sso_providers; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.sso_providers (
    id uuid NOT NULL,
    resource_id text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    disabled boolean,
    CONSTRAINT "resource_id not empty" CHECK (((resource_id = NULL::text) OR (char_length(resource_id) > 0)))
);


ALTER TABLE auth.sso_providers OWNER TO supabase_auth_admin;

--
-- Name: TABLE sso_providers; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.sso_providers IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';


--
-- Name: COLUMN sso_providers.resource_id; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.sso_providers.resource_id IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';


--
-- Name: users; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.users (
    instance_id uuid,
    id uuid NOT NULL,
    aud character varying(255),
    role character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone text DEFAULT NULL::character varying,
    phone_confirmed_at timestamp with time zone,
    phone_change text DEFAULT ''::character varying,
    phone_change_token character varying(255) DEFAULT ''::character varying,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current character varying(255) DEFAULT ''::character varying,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT ''::character varying,
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    is_anonymous boolean DEFAULT false NOT NULL,
    CONSTRAINT users_email_change_confirm_status_check CHECK (((email_change_confirm_status >= 0) AND (email_change_confirm_status <= 2)))
);


ALTER TABLE auth.users OWNER TO supabase_auth_admin;

--
-- Name: TABLE users; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.users IS 'Auth: Stores user login data within a secure schema.';


--
-- Name: COLUMN users.is_sso_user; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.users.is_sso_user IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';


--
-- Name: webauthn_challenges; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.webauthn_challenges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    challenge_type text NOT NULL,
    session_data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    CONSTRAINT webauthn_challenges_challenge_type_check CHECK ((challenge_type = ANY (ARRAY['signup'::text, 'registration'::text, 'authentication'::text])))
);


ALTER TABLE auth.webauthn_challenges OWNER TO supabase_auth_admin;

--
-- Name: webauthn_credentials; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.webauthn_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    credential_id bytea NOT NULL,
    public_key bytea NOT NULL,
    attestation_type text DEFAULT ''::text NOT NULL,
    aaguid uuid,
    sign_count bigint DEFAULT 0 NOT NULL,
    transports jsonb DEFAULT '[]'::jsonb NOT NULL,
    backup_eligible boolean DEFAULT false NOT NULL,
    backed_up boolean DEFAULT false NOT NULL,
    friendly_name text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_used_at timestamp with time zone
);


ALTER TABLE auth.webauthn_credentials OWNER TO supabase_auth_admin;

--
-- Name: _backup_approval_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._backup_approval_history (
    id uuid,
    claim_id uuid,
    approver_email text,
    approval_level integer,
    action text,
    notes text,
    acted_at timestamp with time zone,
    rejection_notes text,
    allow_resubmit boolean,
    bypass_reason text,
    skipped_levels jsonb,
    reason text,
    metadata jsonb
);


ALTER TABLE public._backup_approval_history OWNER TO postgres;

--
-- Name: _backup_expense_claim_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._backup_expense_claim_items (
    id uuid,
    claim_id uuid,
    item_type text,
    description text,
    amount numeric(10,2),
    created_at timestamp with time zone
);


ALTER TABLE public._backup_expense_claim_items OWNER TO postgres;

--
-- Name: _backup_expense_claims; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._backup_expense_claims (
    id uuid,
    employee_id uuid,
    claim_date date,
    work_location text,
    own_vehicle_used boolean,
    vehicle_type text,
    outstation_location text,
    from_city text,
    to_city text,
    km_travelled numeric(10,2),
    total_amount numeric(10,2),
    status text,
    current_approval_level integer,
    submitted_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    claim_number text,
    tenant_id text,
    resubmission_count integer,
    last_rejection_notes text,
    last_rejected_by_email text,
    last_rejected_at timestamp with time zone
);


ALTER TABLE public._backup_expense_claims OWNER TO postgres;

--
-- Name: _backup_finance_actions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._backup_finance_actions (
    id uuid,
    claim_id uuid,
    actor_email text,
    action text,
    notes text,
    acted_at timestamp with time zone
);


ALTER TABLE public._backup_finance_actions OWNER TO postgres;

--
-- Name: _migration_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._migration_history (
    name text NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL,
    checksum text
);


ALTER TABLE public._migration_history OWNER TO postgres;

--
-- Name: admin_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.admin_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    admin_id uuid NOT NULL,
    action_type text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid,
    old_value jsonb,
    new_value jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.admin_logs OWNER TO postgres;

--
-- Name: allowed_email_domains; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.allowed_email_domains (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    domain_name character varying(255) NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.allowed_email_domains OWNER TO postgres;

--
-- Name: approval_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.approval_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    claim_id uuid NOT NULL,
    approval_level integer,
    action text NOT NULL,
    notes text,
    acted_at timestamp with time zone DEFAULT now() NOT NULL,
    rejection_notes text,
    allow_resubmit boolean,
    bypass_reason text,
    skipped_levels jsonb,
    reason text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    approver_employee_id uuid,
    old_status_id uuid NOT NULL,
    new_status_id uuid NOT NULL,
    CONSTRAINT approval_history_approval_level_check CHECK (((approval_level IS NULL) OR ((approval_level >= 1) AND (approval_level <= 3))))
);


ALTER TABLE public.approval_history OWNER TO postgres;

--
-- Name: approval_routing; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.approval_routing (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    submitter_designation_id uuid NOT NULL,
    submitter_state_id uuid,
    approval_level integer NOT NULL,
    approver_role_id uuid NOT NULL,
    approver_designation_id uuid,
    approver_state_id uuid,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.approval_routing OWNER TO postgres;

--
-- Name: approver_selection_rules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.approver_selection_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    approval_level integer NOT NULL,
    designation_id uuid NOT NULL,
    requires_same_state boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT approver_selection_rules_approval_level_check CHECK (((approval_level >= 1) AND (approval_level <= 3)))
);


ALTER TABLE public.approver_selection_rules OWNER TO postgres;

--
-- Name: archive_claim_expenses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.archive_claim_expenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    claim_id uuid NOT NULL,
    expense_type character varying(50) NOT NULL,
    transport_type_id uuid,
    amount numeric(10,2) NOT NULL,
    bill_number character varying(100),
    bill_date date,
    bill_attachment_url text,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT claim_expenses_amount_check CHECK ((amount >= (0)::numeric))
);


ALTER TABLE public.archive_claim_expenses OWNER TO postgres;

--
-- Name: archive_claim_status_audit; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.archive_claim_status_audit (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    claim_id uuid NOT NULL,
    actor_email text NOT NULL,
    actor_scope text NOT NULL,
    trigger_action text NOT NULL,
    from_status text NOT NULL,
    to_status text NOT NULL,
    from_approval_level integer,
    to_approval_level integer,
    allow_resubmit boolean,
    notes text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    actor_employee_id uuid
);


ALTER TABLE public.archive_claim_status_audit OWNER TO postgres;

--
-- Name: base_location_day_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.base_location_day_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    day_type_code character varying(50) NOT NULL,
    day_type_label character varying(120) NOT NULL,
    include_food_allowance boolean DEFAULT true NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.base_location_day_types OWNER TO postgres;

--
-- Name: cities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    city_name character varying(255) NOT NULL,
    state_id uuid NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.cities OWNER TO postgres;

--
-- Name: TABLE cities; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.cities IS 'Master table for cities. Used for outstation travel claims.';


--
-- Name: claim_config_snapshots; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.claim_config_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    claim_id uuid NOT NULL,
    config_version_id uuid NOT NULL,
    snapshot_data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.claim_config_snapshots OWNER TO postgres;

--
-- Name: claim_number_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.claim_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.claim_number_seq OWNER TO postgres;

--
-- Name: claim_status_transitions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.claim_status_transitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    from_status_id uuid NOT NULL,
    to_status_id uuid NOT NULL,
    requires_role_id uuid,
    requires_comment boolean DEFAULT false,
    is_auto_transition boolean DEFAULT false,
    validation_rules jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    action_code text,
    allow_resubmit boolean
);


ALTER TABLE public.claim_status_transitions OWNER TO postgres;

--
-- Name: COLUMN claim_status_transitions.action_code; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.claim_status_transitions.action_code IS 'RPC action code: submit, resubmit, approved, rejected, finance_issued, finance_rejected, reopened';


--
-- Name: COLUMN claim_status_transitions.allow_resubmit; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.claim_status_transitions.allow_resubmit IS 'For rejection transitions: true = employee can resubmit (RETURNED), false = terminal rejection';


--
-- Name: claim_statuses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.claim_statuses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    status_code character varying(50) NOT NULL,
    status_name character varying(100) NOT NULL,
    status_description text,
    approval_level integer,
    is_approval boolean DEFAULT false,
    is_rejection boolean DEFAULT false,
    is_terminal boolean DEFAULT false,
    is_payment_issued boolean DEFAULT false,
    requires_comment boolean DEFAULT false,
    display_color character varying(20),
    display_order integer,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    allow_resubmit_status_name character varying(120),
    allow_resubmit_display_color character varying(32)
);


ALTER TABLE public.claim_statuses OWNER TO postgres;

--
-- Name: COLUMN claim_statuses.allow_resubmit_status_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.claim_statuses.allow_resubmit_status_name IS 'Display label to use when a claim is in this status and allow_resubmit=true.';


--
-- Name: COLUMN claim_statuses.allow_resubmit_display_color; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.claim_statuses.allow_resubmit_display_color IS 'Display color token to use when a claim is in this status and allow_resubmit=true.';


--
-- Name: config_versions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.config_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    version_number bigint NOT NULL,
    source_admin_log_id uuid,
    change_scope text NOT NULL,
    change_summary text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.config_versions OWNER TO postgres;

--
-- Name: config_versions_version_number_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.config_versions ALTER COLUMN version_number ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.config_versions_version_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: designation_approval_flow; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.designation_approval_flow (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    designation_id uuid NOT NULL,
    required_approval_levels integer[] NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.designation_approval_flow OWNER TO postgres;

--
-- Name: designation_vehicle_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.designation_vehicle_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    designation_id uuid NOT NULL,
    vehicle_type_id uuid NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.designation_vehicle_permissions OWNER TO postgres;

--
-- Name: designations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.designations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    designation_code character varying(50) NOT NULL,
    designation_name character varying(255) NOT NULL,
    designation_abbreviation character varying(10),
    hierarchy_level integer NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.designations OWNER TO postgres;

--
-- Name: TABLE designations; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.designations IS 'Master table for job designations. Business logic references id, not name.';


--
-- Name: COLUMN designations.designation_abbreviation; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.designations.designation_abbreviation IS 'Short form for display (SRO, BOA, ABH, SBH, ZBH, PM)';


--
-- Name: COLUMN designations.hierarchy_level; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.designations.hierarchy_level IS '1=Junior (SRO), 6=Senior (PM). Used for ordering.';


--
-- Name: employee_replacements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.employee_replacements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    old_employee_id uuid NOT NULL,
    new_employee_id uuid NOT NULL,
    replaced_by_admin_id uuid NOT NULL,
    replacement_reason text NOT NULL,
    prepared_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT employee_replacements_old_new_diff CHECK ((old_employee_id <> new_employee_id))
);


ALTER TABLE public.employee_replacements OWNER TO postgres;

--
-- Name: employee_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.employee_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    role_id uuid NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    assigned_by uuid,
    is_active boolean DEFAULT true NOT NULL
);


ALTER TABLE public.employee_roles OWNER TO postgres;

--
-- Name: TABLE employee_roles; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.employee_roles IS 'Junction: employees to system roles (RBAC). One employee can have multiple roles.';


--
-- Name: employee_states; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.employee_states (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    state_id uuid NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.employee_states OWNER TO postgres;

--
-- Name: TABLE employee_states; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.employee_states IS 'Junction table: employees to states (many-to-many)';


--
-- Name: COLUMN employee_states.is_primary; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.employee_states.is_primary IS 'True for the employees primary operating state';


--
-- Name: employee_statuses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.employee_statuses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    status_code character varying(50) NOT NULL,
    status_name character varying(100) NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.employee_statuses OWNER TO postgres;

--
-- Name: TABLE employee_statuses; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.employee_statuses IS 'Lookup table for employee statuses (Active, Inactive, etc.)';


--
-- Name: employees; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.employees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id text NOT NULL,
    employee_name text NOT NULL,
    employee_email text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    designation_id uuid NOT NULL,
    employee_status_id uuid NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    approval_employee_id_level_1 uuid,
    approval_employee_id_level_2 uuid,
    approval_employee_id_level_3 uuid
);


ALTER TABLE public.employees OWNER TO postgres;

--
-- Name: expense_claim_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.expense_claim_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    claim_id uuid NOT NULL,
    item_type text NOT NULL,
    description text,
    amount numeric(10,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT expense_claim_items_amount_check CHECK ((amount >= (0)::numeric))
);


ALTER TABLE public.expense_claim_items OWNER TO postgres;

--
-- Name: expense_claims; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.expense_claims (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    claim_date date NOT NULL,
    own_vehicle_used boolean,
    km_travelled numeric(10,2),
    total_amount numeric(10,2) DEFAULT 0 NOT NULL,
    current_approval_level integer,
    submitted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    claim_number text NOT NULL,
    tenant_id text DEFAULT 'default'::text NOT NULL,
    resubmission_count integer DEFAULT 0 NOT NULL,
    last_rejection_notes text,
    last_rejected_at timestamp with time zone,
    designation_id uuid NOT NULL,
    work_location_id uuid NOT NULL,
    vehicle_type_id uuid,
    status_id uuid NOT NULL,
    outstation_city_id uuid,
    from_city_id uuid,
    to_city_id uuid,
    last_rejected_by_employee_id uuid,
    accommodation_nights integer,
    food_with_principals_amount numeric,
    outstation_state_id uuid,
    has_intercity_travel boolean DEFAULT false NOT NULL,
    has_intracity_travel boolean DEFAULT false NOT NULL,
    intercity_own_vehicle_used boolean,
    intracity_own_vehicle_used boolean,
    intracity_vehicle_mode text,
    allow_resubmit boolean DEFAULT false NOT NULL,
    is_superseded boolean DEFAULT false NOT NULL,
    base_location_day_type_code character varying(50),
    CONSTRAINT expense_claims_from_city_requires_state CHECK (((from_city_id IS NULL) OR (outstation_state_id IS NOT NULL))),
    CONSTRAINT expense_claims_intercity_intracity_mode_consistent CHECK (((has_intercity_travel = false) OR (intracity_vehicle_mode = 'OWN_VEHICLE'::text))),
    CONSTRAINT expense_claims_intercity_requires_route CHECK (((has_intercity_travel = false) OR ((from_city_id IS NOT NULL) AND (to_city_id IS NOT NULL)))),
    CONSTRAINT expense_claims_intercity_vehicle_flag_consistent CHECK (((has_intercity_travel = true) OR (intercity_own_vehicle_used IS NULL))),
    CONSTRAINT expense_claims_intracity_mode_consistent CHECK ((((has_intracity_travel = true) AND (intracity_vehicle_mode IS NOT NULL)) OR ((has_intracity_travel = false) AND (intracity_vehicle_mode IS NULL)))),
    CONSTRAINT expense_claims_intracity_requires_city CHECK (((has_intracity_travel = false) OR (outstation_city_id IS NOT NULL))),
    CONSTRAINT expense_claims_intracity_vehicle_flag_consistent CHECK (((has_intracity_travel = true) OR (intracity_own_vehicle_used IS NULL))),
    CONSTRAINT expense_claims_intracity_vehicle_mode_valid CHECK (((intracity_vehicle_mode IS NULL) OR (intracity_vehicle_mode = ANY (ARRAY['OWN_VEHICLE'::text, 'RENTAL_VEHICLE'::text])))),
    CONSTRAINT expense_claims_km_travelled_check CHECK ((km_travelled >= (0)::numeric)),
    CONSTRAINT expense_claims_outstation_city_requires_state CHECK (((outstation_city_id IS NULL) OR (outstation_state_id IS NOT NULL))),
    CONSTRAINT expense_claims_resubmission_count_check CHECK ((resubmission_count >= 0)),
    CONSTRAINT expense_claims_to_city_requires_state CHECK (((to_city_id IS NULL) OR (outstation_state_id IS NOT NULL))),
    CONSTRAINT expense_claims_total_amount_check CHECK ((total_amount >= (0)::numeric))
);


ALTER TABLE public.expense_claims OWNER TO postgres;

--
-- Name: COLUMN expense_claims.allow_resubmit; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.expense_claims.allow_resubmit IS 'True only when the current claim is in a rejection state that allows employee resubmission.';


--
-- Name: COLUMN expense_claims.is_superseded; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.expense_claims.is_superseded IS 'True when a rejected claim has been superseded by a fresh resubmitted claim for the same date.';


--
-- Name: COLUMN expense_claims.base_location_day_type_code; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.expense_claims.base_location_day_type_code IS 'Base-location day type code selected at claim submission time (for example FULL_DAY or HALF_DAY).';


--
-- Name: expense_rates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.expense_rates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    designation_id uuid,
    location_id uuid,
    expense_type character varying(50) NOT NULL,
    rate_amount numeric(10,2) NOT NULL,
    effective_from date DEFAULT CURRENT_DATE,
    effective_to date,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.expense_rates OWNER TO postgres;

--
-- Name: expense_reimbursement_rates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.expense_reimbursement_rates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    designation text NOT NULL,
    vehicle_type text,
    rate_type text NOT NULL,
    amount numeric(10,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT expense_reimbursement_rates_amount_check CHECK ((amount >= (0)::numeric))
);


ALTER TABLE public.expense_reimbursement_rates OWNER TO postgres;

--
-- Name: finance_actions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.finance_actions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    claim_id uuid NOT NULL,
    action text NOT NULL,
    notes text,
    acted_at timestamp with time zone DEFAULT now() NOT NULL,
    actor_employee_id uuid NOT NULL
);


ALTER TABLE public.finance_actions OWNER TO postgres;

--
-- Name: roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role_code character varying(50) NOT NULL,
    role_name character varying(255) NOT NULL,
    role_description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_finance_role boolean DEFAULT false NOT NULL,
    is_admin_role boolean DEFAULT false NOT NULL
);


ALTER TABLE public.roles OWNER TO postgres;

--
-- Name: TABLE roles; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.roles IS 'System roles for RBAC. Separate from job designations.';


--
-- Name: COLUMN roles.role_code; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.roles.role_code IS 'Machine-readable code. Used in backend logic.';


--
-- Name: COLUMN roles.is_finance_role; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.roles.is_finance_role IS 'True for roles that grant access to the finance processing queue.';


--
-- Name: COLUMN roles.is_admin_role; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.roles.is_admin_role IS 'True for roles that grant full administrative access.';


--
-- Name: states; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.states (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    state_code character varying(10) NOT NULL,
    state_name character varying(100) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.states OWNER TO postgres;

--
-- Name: TABLE states; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.states IS 'Master table for geographical states';


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.system_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    setting_key character varying(100) NOT NULL,
    setting_value jsonb NOT NULL,
    setting_description text,
    data_type character varying(50) NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.system_settings OWNER TO postgres;

--
-- Name: validation_rules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.validation_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rule_code character varying(100) NOT NULL,
    rule_name character varying(255) NOT NULL,
    rule_value jsonb NOT NULL,
    rule_description text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.validation_rules OWNER TO postgres;

--
-- Name: vehicle_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vehicle_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vehicle_code character varying(50) NOT NULL,
    vehicle_name character varying(100) NOT NULL,
    base_fuel_rate_per_day numeric(10,2),
    intercity_rate_per_km numeric(10,2),
    max_km_round_trip integer,
    display_order integer,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.vehicle_types OWNER TO postgres;

--
-- Name: work_locations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.work_locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    location_code character varying(50) NOT NULL,
    location_name character varying(100) NOT NULL,
    requires_vehicle_selection boolean DEFAULT false,
    requires_outstation_details boolean DEFAULT false,
    display_order integer,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.work_locations OWNER TO postgres;

--
-- Name: messages; Type: TABLE; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE TABLE realtime.messages (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
)
PARTITION BY RANGE (inserted_at);


ALTER TABLE realtime.messages OWNER TO supabase_realtime_admin;

--
-- Name: schema_migrations; Type: TABLE; Schema: realtime; Owner: supabase_admin
--

CREATE TABLE realtime.schema_migrations (
    version bigint NOT NULL,
    inserted_at timestamp(0) without time zone
);


ALTER TABLE realtime.schema_migrations OWNER TO supabase_admin;

--
-- Name: subscription; Type: TABLE; Schema: realtime; Owner: supabase_admin
--

CREATE TABLE realtime.subscription (
    id bigint NOT NULL,
    subscription_id uuid NOT NULL,
    entity regclass NOT NULL,
    filters realtime.user_defined_filter[] DEFAULT '{}'::realtime.user_defined_filter[] NOT NULL,
    claims jsonb NOT NULL,
    claims_role regrole GENERATED ALWAYS AS (realtime.to_regrole((claims ->> 'role'::text))) STORED NOT NULL,
    created_at timestamp without time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    action_filter text DEFAULT '*'::text,
    CONSTRAINT subscription_action_filter_check CHECK ((action_filter = ANY (ARRAY['*'::text, 'INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


ALTER TABLE realtime.subscription OWNER TO supabase_admin;

--
-- Name: subscription_id_seq; Type: SEQUENCE; Schema: realtime; Owner: supabase_admin
--

ALTER TABLE realtime.subscription ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME realtime.subscription_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: buckets; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.buckets (
    id text NOT NULL,
    name text NOT NULL,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    public boolean DEFAULT false,
    avif_autodetection boolean DEFAULT false,
    file_size_limit bigint,
    allowed_mime_types text[],
    owner_id text,
    type storage.buckettype DEFAULT 'STANDARD'::storage.buckettype NOT NULL
);


ALTER TABLE storage.buckets OWNER TO supabase_storage_admin;

--
-- Name: COLUMN buckets.owner; Type: COMMENT; Schema: storage; Owner: supabase_storage_admin
--

COMMENT ON COLUMN storage.buckets.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: buckets_analytics; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.buckets_analytics (
    name text NOT NULL,
    type storage.buckettype DEFAULT 'ANALYTICS'::storage.buckettype NOT NULL,
    format text DEFAULT 'ICEBERG'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    deleted_at timestamp with time zone
);


ALTER TABLE storage.buckets_analytics OWNER TO supabase_storage_admin;

--
-- Name: buckets_vectors; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.buckets_vectors (
    id text NOT NULL,
    type storage.buckettype DEFAULT 'VECTOR'::storage.buckettype NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE storage.buckets_vectors OWNER TO supabase_storage_admin;

--
-- Name: migrations; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.migrations (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    hash character varying(40) NOT NULL,
    executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE storage.migrations OWNER TO supabase_storage_admin;

--
-- Name: objects; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.objects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket_id text,
    name text,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_accessed_at timestamp with time zone DEFAULT now(),
    metadata jsonb,
    path_tokens text[] GENERATED ALWAYS AS (string_to_array(name, '/'::text)) STORED,
    version text,
    owner_id text,
    user_metadata jsonb
);


ALTER TABLE storage.objects OWNER TO supabase_storage_admin;

--
-- Name: COLUMN objects.owner; Type: COMMENT; Schema: storage; Owner: supabase_storage_admin
--

COMMENT ON COLUMN storage.objects.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: s3_multipart_uploads; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.s3_multipart_uploads (
    id text NOT NULL,
    in_progress_size bigint DEFAULT 0 NOT NULL,
    upload_signature text NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    version text NOT NULL,
    owner_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_metadata jsonb,
    metadata jsonb
);


ALTER TABLE storage.s3_multipart_uploads OWNER TO supabase_storage_admin;

--
-- Name: s3_multipart_uploads_parts; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.s3_multipart_uploads_parts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    upload_id text NOT NULL,
    size bigint DEFAULT 0 NOT NULL,
    part_number integer NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    etag text NOT NULL,
    owner_id text,
    version text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE storage.s3_multipart_uploads_parts OWNER TO supabase_storage_admin;

--
-- Name: vector_indexes; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.vector_indexes (
    id text DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL COLLATE pg_catalog."C",
    bucket_id text NOT NULL,
    data_type text NOT NULL,
    dimension integer NOT NULL,
    distance_metric text NOT NULL,
    metadata_configuration jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE storage.vector_indexes OWNER TO supabase_storage_admin;

--
-- Name: schema_migrations; Type: TABLE; Schema: supabase_migrations; Owner: postgres
--

CREATE TABLE supabase_migrations.schema_migrations (
    version text NOT NULL,
    statements text[],
    name text,
    created_by text,
    idempotency_key text,
    rollback text[]
);


ALTER TABLE supabase_migrations.schema_migrations OWNER TO postgres;

--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('auth.refresh_tokens_id_seq'::regclass);


--
-- Name: mfa_amr_claims amr_id_pk; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT amr_id_pk PRIMARY KEY (id);


--
-- Name: audit_log_entries audit_log_entries_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.audit_log_entries
    ADD CONSTRAINT audit_log_entries_pkey PRIMARY KEY (id);


--
-- Name: custom_oauth_providers custom_oauth_providers_identifier_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.custom_oauth_providers
    ADD CONSTRAINT custom_oauth_providers_identifier_key UNIQUE (identifier);


--
-- Name: custom_oauth_providers custom_oauth_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.custom_oauth_providers
    ADD CONSTRAINT custom_oauth_providers_pkey PRIMARY KEY (id);


--
-- Name: flow_state flow_state_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.flow_state
    ADD CONSTRAINT flow_state_pkey PRIMARY KEY (id);


--
-- Name: identities identities_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_pkey PRIMARY KEY (id);


--
-- Name: identities identities_provider_id_provider_unique; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_provider_id_provider_unique UNIQUE (provider_id, provider);


--
-- Name: instances instances_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.instances
    ADD CONSTRAINT instances_pkey PRIMARY KEY (id);


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_authentication_method_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_authentication_method_pkey UNIQUE (session_id, authentication_method);


--
-- Name: mfa_challenges mfa_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_pkey PRIMARY KEY (id);


--
-- Name: mfa_factors mfa_factors_last_challenged_at_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_last_challenged_at_key UNIQUE (last_challenged_at);


--
-- Name: mfa_factors mfa_factors_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_pkey PRIMARY KEY (id);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_code_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_code_key UNIQUE (authorization_code);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_id_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_id_key UNIQUE (authorization_id);


--
-- Name: oauth_authorizations oauth_authorizations_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_pkey PRIMARY KEY (id);


--
-- Name: oauth_client_states oauth_client_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_client_states
    ADD CONSTRAINT oauth_client_states_pkey PRIMARY KEY (id);


--
-- Name: oauth_clients oauth_clients_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_clients
    ADD CONSTRAINT oauth_clients_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_user_client_unique; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_client_unique UNIQUE (user_id, client_id);


--
-- Name: one_time_tokens one_time_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_unique; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_unique UNIQUE (token);


--
-- Name: saml_providers saml_providers_entity_id_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_entity_id_key UNIQUE (entity_id);


--
-- Name: saml_providers saml_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_pkey PRIMARY KEY (id);


--
-- Name: saml_relay_states saml_relay_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sso_domains sso_domains_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_pkey PRIMARY KEY (id);


--
-- Name: sso_providers sso_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sso_providers
    ADD CONSTRAINT sso_providers_pkey PRIMARY KEY (id);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: webauthn_challenges webauthn_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.webauthn_challenges
    ADD CONSTRAINT webauthn_challenges_pkey PRIMARY KEY (id);


--
-- Name: webauthn_credentials webauthn_credentials_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.webauthn_credentials
    ADD CONSTRAINT webauthn_credentials_pkey PRIMARY KEY (id);


--
-- Name: _migration_history _migration_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._migration_history
    ADD CONSTRAINT _migration_history_pkey PRIMARY KEY (name);


--
-- Name: admin_logs admin_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_logs
    ADD CONSTRAINT admin_logs_pkey PRIMARY KEY (id);


--
-- Name: allowed_email_domains allowed_email_domains_domain_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.allowed_email_domains
    ADD CONSTRAINT allowed_email_domains_domain_name_key UNIQUE (domain_name);


--
-- Name: allowed_email_domains allowed_email_domains_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.allowed_email_domains
    ADD CONSTRAINT allowed_email_domains_pkey PRIMARY KEY (id);


--
-- Name: approval_history approval_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.approval_history
    ADD CONSTRAINT approval_history_pkey PRIMARY KEY (id);


--
-- Name: approval_routing approval_routing_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.approval_routing
    ADD CONSTRAINT approval_routing_pkey PRIMARY KEY (id);


--
-- Name: approver_selection_rules approver_selection_rules_approval_level_designation_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.approver_selection_rules
    ADD CONSTRAINT approver_selection_rules_approval_level_designation_id_key UNIQUE (approval_level, designation_id);


--
-- Name: approver_selection_rules approver_selection_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.approver_selection_rules
    ADD CONSTRAINT approver_selection_rules_pkey PRIMARY KEY (id);


--
-- Name: archive_claim_expenses archive_claim_expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.archive_claim_expenses
    ADD CONSTRAINT archive_claim_expenses_pkey PRIMARY KEY (id);


--
-- Name: archive_claim_status_audit archive_claim_status_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.archive_claim_status_audit
    ADD CONSTRAINT archive_claim_status_audit_pkey PRIMARY KEY (id);


--
-- Name: base_location_day_types base_location_day_types_day_type_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.base_location_day_types
    ADD CONSTRAINT base_location_day_types_day_type_code_key UNIQUE (day_type_code);


--
-- Name: base_location_day_types base_location_day_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.base_location_day_types
    ADD CONSTRAINT base_location_day_types_pkey PRIMARY KEY (id);


--
-- Name: cities cities_city_name_state_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cities
    ADD CONSTRAINT cities_city_name_state_id_key UNIQUE (city_name, state_id);


--
-- Name: cities cities_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cities
    ADD CONSTRAINT cities_pkey PRIMARY KEY (id);


--
-- Name: claim_config_snapshots claim_config_snapshots_claim_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.claim_config_snapshots
    ADD CONSTRAINT claim_config_snapshots_claim_id_key UNIQUE (claim_id);


--
-- Name: claim_config_snapshots claim_config_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.claim_config_snapshots
    ADD CONSTRAINT claim_config_snapshots_pkey PRIMARY KEY (id);


--
-- Name: claim_status_transitions claim_status_transitions_from_status_id_to_status_id_requir_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.claim_status_transitions
    ADD CONSTRAINT claim_status_transitions_from_status_id_to_status_id_requir_key UNIQUE (from_status_id, to_status_id, requires_role_id);


--
-- Name: claim_status_transitions claim_status_transitions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.claim_status_transitions
    ADD CONSTRAINT claim_status_transitions_pkey PRIMARY KEY (id);


--
-- Name: claim_statuses claim_statuses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.claim_statuses
    ADD CONSTRAINT claim_statuses_pkey PRIMARY KEY (id);


--
-- Name: claim_statuses claim_statuses_status_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.claim_statuses
    ADD CONSTRAINT claim_statuses_status_code_key UNIQUE (status_code);


--
-- Name: config_versions config_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.config_versions
    ADD CONSTRAINT config_versions_pkey PRIMARY KEY (id);


--
-- Name: config_versions config_versions_version_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.config_versions
    ADD CONSTRAINT config_versions_version_number_key UNIQUE (version_number);


--
-- Name: designation_approval_flow designation_approval_flow_designation_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.designation_approval_flow
    ADD CONSTRAINT designation_approval_flow_designation_id_key UNIQUE (designation_id);


--
-- Name: designation_approval_flow designation_approval_flow_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.designation_approval_flow
    ADD CONSTRAINT designation_approval_flow_pkey PRIMARY KEY (id);


--
-- Name: designation_vehicle_permissions designation_vehicle_permissio_designation_id_vehicle_type_i_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.designation_vehicle_permissions
    ADD CONSTRAINT designation_vehicle_permissio_designation_id_vehicle_type_i_key UNIQUE (designation_id, vehicle_type_id);


--
-- Name: designation_vehicle_permissions designation_vehicle_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.designation_vehicle_permissions
    ADD CONSTRAINT designation_vehicle_permissions_pkey PRIMARY KEY (id);


--
-- Name: designations designations_designation_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.designations
    ADD CONSTRAINT designations_designation_code_key UNIQUE (designation_code);


--
-- Name: designations designations_designation_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.designations
    ADD CONSTRAINT designations_designation_name_key UNIQUE (designation_name);


--
-- Name: designations designations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.designations
    ADD CONSTRAINT designations_pkey PRIMARY KEY (id);


--
-- Name: employee_replacements employee_replacements_new_employee_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_replacements
    ADD CONSTRAINT employee_replacements_new_employee_id_key UNIQUE (new_employee_id);


--
-- Name: employee_replacements employee_replacements_old_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_replacements
    ADD CONSTRAINT employee_replacements_old_unique UNIQUE (old_employee_id);


--
-- Name: employee_replacements employee_replacements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_replacements
    ADD CONSTRAINT employee_replacements_pkey PRIMARY KEY (id);


--
-- Name: employee_roles employee_roles_employee_id_role_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_roles
    ADD CONSTRAINT employee_roles_employee_id_role_id_key UNIQUE (employee_id, role_id);


--
-- Name: employee_roles employee_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_roles
    ADD CONSTRAINT employee_roles_pkey PRIMARY KEY (id);


--
-- Name: employee_states employee_states_employee_id_state_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_states
    ADD CONSTRAINT employee_states_employee_id_state_id_key UNIQUE (employee_id, state_id);


--
-- Name: employee_states employee_states_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_states
    ADD CONSTRAINT employee_states_pkey PRIMARY KEY (id);


--
-- Name: employee_statuses employee_statuses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_statuses
    ADD CONSTRAINT employee_statuses_pkey PRIMARY KEY (id);


--
-- Name: employee_statuses employee_statuses_status_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_statuses
    ADD CONSTRAINT employee_statuses_status_code_key UNIQUE (status_code);


--
-- Name: employee_statuses employee_statuses_status_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_statuses
    ADD CONSTRAINT employee_statuses_status_name_key UNIQUE (status_name);


--
-- Name: employees employees_employee_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_employee_email_key UNIQUE (employee_email);


--
-- Name: employees employees_employee_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_employee_id_key UNIQUE (employee_id);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: expense_claim_items expense_claim_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expense_claim_items
    ADD CONSTRAINT expense_claim_items_pkey PRIMARY KEY (id);


--
-- Name: expense_claims expense_claims_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expense_claims
    ADD CONSTRAINT expense_claims_pkey PRIMARY KEY (id);


--
-- Name: expense_rates expense_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expense_rates
    ADD CONSTRAINT expense_rates_pkey PRIMARY KEY (id);


--
-- Name: expense_reimbursement_rates expense_reimbursement_rates_designation_vehicle_type_rate_t_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expense_reimbursement_rates
    ADD CONSTRAINT expense_reimbursement_rates_designation_vehicle_type_rate_t_key UNIQUE (designation, vehicle_type, rate_type);


--
-- Name: expense_reimbursement_rates expense_reimbursement_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expense_reimbursement_rates
    ADD CONSTRAINT expense_reimbursement_rates_pkey PRIMARY KEY (id);


--
-- Name: finance_actions finance_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_actions
    ADD CONSTRAINT finance_actions_pkey PRIMARY KEY (id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: roles roles_role_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_role_code_key UNIQUE (role_code);


--
-- Name: roles roles_role_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_role_name_key UNIQUE (role_name);


--
-- Name: states states_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.states
    ADD CONSTRAINT states_pkey PRIMARY KEY (id);


--
-- Name: states states_state_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.states
    ADD CONSTRAINT states_state_code_key UNIQUE (state_code);


--
-- Name: states states_state_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.states
    ADD CONSTRAINT states_state_name_key UNIQUE (state_name);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_setting_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_setting_key_key UNIQUE (setting_key);


--
-- Name: validation_rules validation_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.validation_rules
    ADD CONSTRAINT validation_rules_pkey PRIMARY KEY (id);


--
-- Name: validation_rules validation_rules_rule_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.validation_rules
    ADD CONSTRAINT validation_rules_rule_code_key UNIQUE (rule_code);


--
-- Name: vehicle_types vehicle_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehicle_types
    ADD CONSTRAINT vehicle_types_pkey PRIMARY KEY (id);


--
-- Name: vehicle_types vehicle_types_vehicle_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehicle_types
    ADD CONSTRAINT vehicle_types_vehicle_code_key UNIQUE (vehicle_code);


--
-- Name: vehicle_types vehicle_types_vehicle_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehicle_types
    ADD CONSTRAINT vehicle_types_vehicle_name_key UNIQUE (vehicle_name);


--
-- Name: work_locations work_locations_location_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_locations
    ADD CONSTRAINT work_locations_location_code_key UNIQUE (location_code);


--
-- Name: work_locations work_locations_location_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_locations
    ADD CONSTRAINT work_locations_location_name_key UNIQUE (location_name);


--
-- Name: work_locations work_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_locations
    ADD CONSTRAINT work_locations_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: realtime; Owner: supabase_realtime_admin
--

ALTER TABLE ONLY realtime.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: subscription pk_subscription; Type: CONSTRAINT; Schema: realtime; Owner: supabase_admin
--

ALTER TABLE ONLY realtime.subscription
    ADD CONSTRAINT pk_subscription PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: realtime; Owner: supabase_admin
--

ALTER TABLE ONLY realtime.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: buckets_analytics buckets_analytics_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.buckets_analytics
    ADD CONSTRAINT buckets_analytics_pkey PRIMARY KEY (id);


--
-- Name: buckets buckets_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.buckets
    ADD CONSTRAINT buckets_pkey PRIMARY KEY (id);


--
-- Name: buckets_vectors buckets_vectors_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.buckets_vectors
    ADD CONSTRAINT buckets_vectors_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_name_key; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_name_key UNIQUE (name);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: objects objects_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT objects_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_pkey PRIMARY KEY (id);


--
-- Name: vector_indexes vector_indexes_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_idempotency_key_key; Type: CONSTRAINT; Schema: supabase_migrations; Owner: postgres
--

ALTER TABLE ONLY supabase_migrations.schema_migrations
    ADD CONSTRAINT schema_migrations_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: supabase_migrations; Owner: postgres
--

ALTER TABLE ONLY supabase_migrations.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: audit_logs_instance_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX audit_logs_instance_id_idx ON auth.audit_log_entries USING btree (instance_id);


--
-- Name: confirmation_token_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX confirmation_token_idx ON auth.users USING btree (confirmation_token) WHERE ((confirmation_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: custom_oauth_providers_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX custom_oauth_providers_created_at_idx ON auth.custom_oauth_providers USING btree (created_at);


--
-- Name: custom_oauth_providers_enabled_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX custom_oauth_providers_enabled_idx ON auth.custom_oauth_providers USING btree (enabled);


--
-- Name: custom_oauth_providers_identifier_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX custom_oauth_providers_identifier_idx ON auth.custom_oauth_providers USING btree (identifier);


--
-- Name: custom_oauth_providers_provider_type_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX custom_oauth_providers_provider_type_idx ON auth.custom_oauth_providers USING btree (provider_type);


--
-- Name: email_change_token_current_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX email_change_token_current_idx ON auth.users USING btree (email_change_token_current) WHERE ((email_change_token_current)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_new_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX email_change_token_new_idx ON auth.users USING btree (email_change_token_new) WHERE ((email_change_token_new)::text !~ '^[0-9 ]*$'::text);


--
-- Name: factor_id_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX factor_id_created_at_idx ON auth.mfa_factors USING btree (user_id, created_at);


--
-- Name: flow_state_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX flow_state_created_at_idx ON auth.flow_state USING btree (created_at DESC);


--
-- Name: identities_email_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX identities_email_idx ON auth.identities USING btree (email text_pattern_ops);


--
-- Name: INDEX identities_email_idx; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON INDEX auth.identities_email_idx IS 'Auth: Ensures indexed queries on the email column';


--
-- Name: identities_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX identities_user_id_idx ON auth.identities USING btree (user_id);


--
-- Name: idx_auth_code; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX idx_auth_code ON auth.flow_state USING btree (auth_code);


--
-- Name: idx_oauth_client_states_created_at; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX idx_oauth_client_states_created_at ON auth.oauth_client_states USING btree (created_at);


--
-- Name: idx_user_id_auth_method; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX idx_user_id_auth_method ON auth.flow_state USING btree (user_id, authentication_method);


--
-- Name: mfa_challenge_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX mfa_challenge_created_at_idx ON auth.mfa_challenges USING btree (created_at DESC);


--
-- Name: mfa_factors_user_friendly_name_unique; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX mfa_factors_user_friendly_name_unique ON auth.mfa_factors USING btree (friendly_name, user_id) WHERE (TRIM(BOTH FROM friendly_name) <> ''::text);


--
-- Name: mfa_factors_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX mfa_factors_user_id_idx ON auth.mfa_factors USING btree (user_id);


--
-- Name: oauth_auth_pending_exp_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX oauth_auth_pending_exp_idx ON auth.oauth_authorizations USING btree (expires_at) WHERE (status = 'pending'::auth.oauth_authorization_status);


--
-- Name: oauth_clients_deleted_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX oauth_clients_deleted_at_idx ON auth.oauth_clients USING btree (deleted_at);


--
-- Name: oauth_consents_active_client_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX oauth_consents_active_client_idx ON auth.oauth_consents USING btree (client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_active_user_client_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX oauth_consents_active_user_client_idx ON auth.oauth_consents USING btree (user_id, client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_user_order_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX oauth_consents_user_order_idx ON auth.oauth_consents USING btree (user_id, granted_at DESC);


--
-- Name: one_time_tokens_relates_to_hash_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX one_time_tokens_relates_to_hash_idx ON auth.one_time_tokens USING hash (relates_to);


--
-- Name: one_time_tokens_token_hash_hash_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX one_time_tokens_token_hash_hash_idx ON auth.one_time_tokens USING hash (token_hash);


--
-- Name: one_time_tokens_user_id_token_type_key; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX one_time_tokens_user_id_token_type_key ON auth.one_time_tokens USING btree (user_id, token_type);


--
-- Name: reauthentication_token_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX reauthentication_token_idx ON auth.users USING btree (reauthentication_token) WHERE ((reauthentication_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: recovery_token_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX recovery_token_idx ON auth.users USING btree (recovery_token) WHERE ((recovery_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: refresh_tokens_instance_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX refresh_tokens_instance_id_idx ON auth.refresh_tokens USING btree (instance_id);


--
-- Name: refresh_tokens_instance_id_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX refresh_tokens_instance_id_user_id_idx ON auth.refresh_tokens USING btree (instance_id, user_id);


--
-- Name: refresh_tokens_parent_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX refresh_tokens_parent_idx ON auth.refresh_tokens USING btree (parent);


--
-- Name: refresh_tokens_session_id_revoked_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX refresh_tokens_session_id_revoked_idx ON auth.refresh_tokens USING btree (session_id, revoked);


--
-- Name: refresh_tokens_updated_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX refresh_tokens_updated_at_idx ON auth.refresh_tokens USING btree (updated_at DESC);


--
-- Name: saml_providers_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX saml_providers_sso_provider_id_idx ON auth.saml_providers USING btree (sso_provider_id);


--
-- Name: saml_relay_states_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX saml_relay_states_created_at_idx ON auth.saml_relay_states USING btree (created_at DESC);


--
-- Name: saml_relay_states_for_email_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX saml_relay_states_for_email_idx ON auth.saml_relay_states USING btree (for_email);


--
-- Name: saml_relay_states_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX saml_relay_states_sso_provider_id_idx ON auth.saml_relay_states USING btree (sso_provider_id);


--
-- Name: sessions_not_after_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX sessions_not_after_idx ON auth.sessions USING btree (not_after DESC);


--
-- Name: sessions_oauth_client_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX sessions_oauth_client_id_idx ON auth.sessions USING btree (oauth_client_id);


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX sessions_user_id_idx ON auth.sessions USING btree (user_id);


--
-- Name: sso_domains_domain_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX sso_domains_domain_idx ON auth.sso_domains USING btree (lower(domain));


--
-- Name: sso_domains_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX sso_domains_sso_provider_id_idx ON auth.sso_domains USING btree (sso_provider_id);


--
-- Name: sso_providers_resource_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX sso_providers_resource_id_idx ON auth.sso_providers USING btree (lower(resource_id));


--
-- Name: sso_providers_resource_id_pattern_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX sso_providers_resource_id_pattern_idx ON auth.sso_providers USING btree (resource_id text_pattern_ops);


--
-- Name: unique_phone_factor_per_user; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX unique_phone_factor_per_user ON auth.mfa_factors USING btree (user_id, phone);


--
-- Name: user_id_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX user_id_created_at_idx ON auth.sessions USING btree (user_id, created_at);


--
-- Name: users_email_partial_key; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX users_email_partial_key ON auth.users USING btree (email) WHERE (is_sso_user = false);


--
-- Name: INDEX users_email_partial_key; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON INDEX auth.users_email_partial_key IS 'Auth: A partial unique index that applies only when is_sso_user is false';


--
-- Name: users_instance_id_email_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX users_instance_id_email_idx ON auth.users USING btree (instance_id, lower((email)::text));


--
-- Name: users_instance_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX users_instance_id_idx ON auth.users USING btree (instance_id);


--
-- Name: users_is_anonymous_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX users_is_anonymous_idx ON auth.users USING btree (is_anonymous);


--
-- Name: webauthn_challenges_expires_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX webauthn_challenges_expires_at_idx ON auth.webauthn_challenges USING btree (expires_at);


--
-- Name: webauthn_challenges_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX webauthn_challenges_user_id_idx ON auth.webauthn_challenges USING btree (user_id);


--
-- Name: webauthn_credentials_credential_id_key; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX webauthn_credentials_credential_id_key ON auth.webauthn_credentials USING btree (credential_id);


--
-- Name: webauthn_credentials_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX webauthn_credentials_user_id_idx ON auth.webauthn_credentials USING btree (user_id);


--
-- Name: archive_claim_expenses_claim_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX archive_claim_expenses_claim_id_idx ON public.archive_claim_expenses USING btree (claim_id);


--
-- Name: archive_claim_expenses_expense_type_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX archive_claim_expenses_expense_type_idx ON public.archive_claim_expenses USING btree (expense_type);


--
-- Name: archive_claim_status_audit_actor_email_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX archive_claim_status_audit_actor_email_idx ON public.archive_claim_status_audit USING btree (actor_email);


--
-- Name: archive_claim_status_audit_claim_id_actor_scope_trigger_act_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX archive_claim_status_audit_claim_id_actor_scope_trigger_act_idx ON public.archive_claim_status_audit USING btree (claim_id, actor_scope, trigger_action, changed_at DESC);


--
-- Name: archive_claim_status_audit_claim_id_changed_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX archive_claim_status_audit_claim_id_changed_at_idx ON public.archive_claim_status_audit USING btree (claim_id, changed_at DESC);


--
-- Name: archive_claim_status_audit_claim_id_to_status_changed_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX archive_claim_status_audit_claim_id_to_status_changed_at_idx ON public.archive_claim_status_audit USING btree (claim_id, to_status, changed_at DESC);


--
-- Name: expense_claims_one_active_per_employee_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX expense_claims_one_active_per_employee_date ON public.expense_claims USING btree (employee_id, claim_date) WHERE (NOT is_superseded);


--
-- Name: idx_admin_logs_admin_id_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_admin_logs_admin_id_created_at ON public.admin_logs USING btree (admin_id, created_at DESC);


--
-- Name: idx_admin_logs_entity_lookup; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_admin_logs_entity_lookup ON public.admin_logs USING btree (entity_type, entity_id, created_at DESC);


--
-- Name: idx_aed_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_aed_active ON public.allowed_email_domains USING btree (is_active);


--
-- Name: idx_aed_domain; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_aed_domain ON public.allowed_email_domains USING btree (domain_name);


--
-- Name: idx_ah_approver_employee; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ah_approver_employee ON public.approval_history USING btree (approver_employee_id);


--
-- Name: idx_approval_history_acted_at_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_approval_history_acted_at_id ON public.approval_history USING btree (acted_at DESC, id DESC);


--
-- Name: idx_approval_history_claim_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_approval_history_claim_id ON public.approval_history USING btree (claim_id);


--
-- Name: idx_approval_history_new_status_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_approval_history_new_status_id ON public.approval_history USING btree (new_status_id);


--
-- Name: idx_approval_history_old_status_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_approval_history_old_status_id ON public.approval_history USING btree (old_status_id);


--
-- Name: idx_approval_routing_approver_designation_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_approval_routing_approver_designation_id ON public.approval_routing USING btree (approver_designation_id);


--
-- Name: idx_approval_routing_approver_state_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_approval_routing_approver_state_id ON public.approval_routing USING btree (approver_state_id);


--
-- Name: idx_approver_selection_rules_designation_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_approver_selection_rules_designation_id ON public.approver_selection_rules USING btree (designation_id);


--
-- Name: idx_approver_selection_rules_level_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_approver_selection_rules_level_active ON public.approver_selection_rules USING btree (approval_level, is_active);


--
-- Name: idx_ar_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ar_active ON public.approval_routing USING btree (is_active);


--
-- Name: idx_ar_approver_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ar_approver_role ON public.approval_routing USING btree (approver_role_id);


--
-- Name: idx_ar_level; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ar_level ON public.approval_routing USING btree (approval_level);


--
-- Name: idx_ar_submitter_desg; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ar_submitter_desg ON public.approval_routing USING btree (submitter_designation_id);


--
-- Name: idx_ar_submitter_state; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ar_submitter_state ON public.approval_routing USING btree (submitter_state_id);


--
-- Name: idx_base_location_day_types_active_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_base_location_day_types_active_order ON public.base_location_day_types USING btree (is_active, display_order);


--
-- Name: idx_base_location_day_types_single_default; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_base_location_day_types_single_default ON public.base_location_day_types USING btree (is_default) WHERE ((is_default = true) AND (is_active = true));


--
-- Name: idx_cities_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cities_active ON public.cities USING btree (is_active);


--
-- Name: idx_cities_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cities_name ON public.cities USING btree (city_name);


--
-- Name: idx_cities_state; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cities_state ON public.cities USING btree (state_id);


--
-- Name: idx_claim_config_snapshots_config_version; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_claim_config_snapshots_config_version ON public.claim_config_snapshots USING btree (config_version_id);


--
-- Name: idx_claim_statuses_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_claim_statuses_active ON public.claim_statuses USING btree (is_active);


--
-- Name: idx_claim_statuses_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_claim_statuses_code ON public.claim_statuses USING btree (status_code);


--
-- Name: idx_claim_statuses_level; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_claim_statuses_level ON public.claim_statuses USING btree (approval_level);


--
-- Name: idx_config_versions_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_config_versions_created_at ON public.config_versions USING btree (created_at DESC);


--
-- Name: idx_config_versions_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_config_versions_created_by ON public.config_versions USING btree (created_by);


--
-- Name: idx_config_versions_source_admin_log_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_config_versions_source_admin_log_id ON public.config_versions USING btree (source_admin_log_id);


--
-- Name: idx_cst_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cst_active ON public.claim_status_transitions USING btree (is_active);


--
-- Name: idx_cst_from; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cst_from ON public.claim_status_transitions USING btree (from_status_id);


--
-- Name: idx_cst_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cst_role ON public.claim_status_transitions USING btree (requires_role_id);


--
-- Name: idx_cst_to; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cst_to ON public.claim_status_transitions USING btree (to_status_id);


--
-- Name: idx_designations_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_designations_active ON public.designations USING btree (is_active);


--
-- Name: idx_designations_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_designations_code ON public.designations USING btree (designation_code);


--
-- Name: idx_designations_hierarchy; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_designations_hierarchy ON public.designations USING btree (hierarchy_level);


--
-- Name: idx_dvp_designation; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dvp_designation ON public.designation_vehicle_permissions USING btree (designation_id);


--
-- Name: idx_dvp_vehicle; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dvp_vehicle ON public.designation_vehicle_permissions USING btree (vehicle_type_id);


--
-- Name: idx_ec_designation_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ec_designation_id ON public.expense_claims USING btree (designation_id);


--
-- Name: idx_ec_outstation_city; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ec_outstation_city ON public.expense_claims USING btree (outstation_city_id);


--
-- Name: idx_ec_status_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ec_status_id ON public.expense_claims USING btree (status_id);


--
-- Name: idx_ec_vehicle_type_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ec_vehicle_type_id ON public.expense_claims USING btree (vehicle_type_id);


--
-- Name: idx_ec_work_location_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ec_work_location_id ON public.expense_claims USING btree (work_location_id);


--
-- Name: idx_employee_replacements_new_employee; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_employee_replacements_new_employee ON public.employee_replacements USING btree (new_employee_id);


--
-- Name: idx_employee_replacements_old_employee; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_employee_replacements_old_employee ON public.employee_replacements USING btree (old_employee_id);


--
-- Name: idx_employee_replacements_replaced_by_admin_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_employee_replacements_replaced_by_admin_id ON public.employee_replacements USING btree (replaced_by_admin_id);


--
-- Name: idx_employee_roles_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_employee_roles_active ON public.employee_roles USING btree (is_active);


--
-- Name: idx_employee_roles_assigned_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_employee_roles_assigned_by ON public.employee_roles USING btree (assigned_by);


--
-- Name: idx_employee_roles_employee; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_employee_roles_employee ON public.employee_roles USING btree (employee_id);


--
-- Name: idx_employee_roles_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_employee_roles_role ON public.employee_roles USING btree (role_id);


--
-- Name: idx_employee_states_employee; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_employee_states_employee ON public.employee_states USING btree (employee_id);


--
-- Name: idx_employee_states_primary; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_employee_states_primary ON public.employee_states USING btree (employee_id) WHERE (is_primary = true);


--
-- Name: idx_employee_states_state; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_employee_states_state ON public.employee_states USING btree (state_id);


--
-- Name: idx_employee_statuses_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_employee_statuses_code ON public.employee_statuses USING btree (status_code);


--
-- Name: idx_employees_approver_id_l1; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_employees_approver_id_l1 ON public.employees USING btree (approval_employee_id_level_1);


--
-- Name: idx_employees_approver_id_l2; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_employees_approver_id_l2 ON public.employees USING btree (approval_employee_id_level_2);


--
-- Name: idx_employees_approver_id_l3; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_employees_approver_id_l3 ON public.employees USING btree (approval_employee_id_level_3);


--
-- Name: idx_employees_designation_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_employees_designation_id ON public.employees USING btree (designation_id);


--
-- Name: idx_employees_employee_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_employees_employee_email ON public.employees USING btree (employee_email);


--
-- Name: idx_employees_employee_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_employees_employee_name ON public.employees USING btree (employee_name);


--
-- Name: idx_employees_status_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_employees_status_id ON public.employees USING btree (employee_status_id);


--
-- Name: idx_er_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_er_active ON public.expense_rates USING btree (is_active);


--
-- Name: idx_er_designation; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_er_designation ON public.expense_rates USING btree (designation_id);


--
-- Name: idx_er_effective; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_er_effective ON public.expense_rates USING btree (effective_from, effective_to);


--
-- Name: idx_er_location; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_er_location ON public.expense_rates USING btree (location_id);


--
-- Name: idx_er_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_er_type ON public.expense_rates USING btree (expense_type);


--
-- Name: idx_expense_claim_items_claim_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_expense_claim_items_claim_id ON public.expense_claim_items USING btree (claim_id);


--
-- Name: idx_expense_claims_approval_level; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_expense_claims_approval_level ON public.expense_claims USING btree (current_approval_level);


--
-- Name: idx_expense_claims_base_location_day_type_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_expense_claims_base_location_day_type_code ON public.expense_claims USING btree (base_location_day_type_code);


--
-- Name: idx_expense_claims_claim_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_expense_claims_claim_date ON public.expense_claims USING btree (claim_date);


--
-- Name: idx_expense_claims_claim_number_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_expense_claims_claim_number_unique ON public.expense_claims USING btree (claim_number);


--
-- Name: idx_expense_claims_employee_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_expense_claims_employee_id ON public.expense_claims USING btree (employee_id);


--
-- Name: idx_expense_claims_from_city_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_expense_claims_from_city_id ON public.expense_claims USING btree (from_city_id);


--
-- Name: idx_expense_claims_has_intercity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_expense_claims_has_intercity ON public.expense_claims USING btree (has_intercity_travel);


--
-- Name: idx_expense_claims_has_intracity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_expense_claims_has_intracity ON public.expense_claims USING btree (has_intracity_travel);


--
-- Name: idx_expense_claims_intracity_vehicle_mode; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_expense_claims_intracity_vehicle_mode ON public.expense_claims USING btree (intracity_vehicle_mode) WHERE (has_intracity_travel = true);


--
-- Name: idx_expense_claims_last_rejected_by_employee_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_expense_claims_last_rejected_by_employee_id ON public.expense_claims USING btree (last_rejected_by_employee_id);


--
-- Name: idx_expense_claims_outstation_state_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_expense_claims_outstation_state_id ON public.expense_claims USING btree (outstation_state_id);


--
-- Name: idx_expense_claims_status_allow_resubmit; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_expense_claims_status_allow_resubmit ON public.expense_claims USING btree (status_id, allow_resubmit);


--
-- Name: idx_expense_claims_to_city_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_expense_claims_to_city_id ON public.expense_claims USING btree (to_city_id);


--
-- Name: idx_fa_actor_employee; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_fa_actor_employee ON public.finance_actions USING btree (actor_employee_id);


--
-- Name: idx_finance_actions_claim_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_finance_actions_claim_id ON public.finance_actions USING btree (claim_id);


--
-- Name: idx_finance_actions_claim_latest; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_finance_actions_claim_latest ON public.finance_actions USING btree (claim_id, acted_at DESC, id DESC);


--
-- Name: idx_roles_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_roles_active ON public.roles USING btree (is_active);


--
-- Name: idx_roles_admin; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_roles_admin ON public.roles USING btree (is_admin_role) WHERE (is_admin_role = true);


--
-- Name: idx_roles_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_roles_code ON public.roles USING btree (role_code);


--
-- Name: idx_roles_finance; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_roles_finance ON public.roles USING btree (is_finance_role) WHERE (is_finance_role = true);


--
-- Name: idx_ss_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ss_active ON public.system_settings USING btree (is_active);


--
-- Name: idx_ss_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ss_key ON public.system_settings USING btree (setting_key);


--
-- Name: idx_states_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_states_active ON public.states USING btree (is_active);


--
-- Name: idx_states_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_states_code ON public.states USING btree (state_code);


--
-- Name: idx_vr_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_vr_active ON public.validation_rules USING btree (is_active);


--
-- Name: idx_vr_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_vr_code ON public.validation_rules USING btree (rule_code);


--
-- Name: idx_vt_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_vt_active ON public.vehicle_types USING btree (is_active);


--
-- Name: idx_vt_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_vt_code ON public.vehicle_types USING btree (vehicle_code);


--
-- Name: idx_wl_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wl_active ON public.work_locations USING btree (is_active);


--
-- Name: idx_wl_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wl_code ON public.work_locations USING btree (location_code);


--
-- Name: ix_realtime_subscription_entity; Type: INDEX; Schema: realtime; Owner: supabase_admin
--

CREATE INDEX ix_realtime_subscription_entity ON realtime.subscription USING btree (entity);


--
-- Name: messages_inserted_at_topic_index; Type: INDEX; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE INDEX messages_inserted_at_topic_index ON ONLY realtime.messages USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: subscription_subscription_id_entity_filters_action_filter_key; Type: INDEX; Schema: realtime; Owner: supabase_admin
--

CREATE UNIQUE INDEX subscription_subscription_id_entity_filters_action_filter_key ON realtime.subscription USING btree (subscription_id, entity, filters, action_filter);


--
-- Name: bname; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE UNIQUE INDEX bname ON storage.buckets USING btree (name);


--
-- Name: bucketid_objname; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE UNIQUE INDEX bucketid_objname ON storage.objects USING btree (bucket_id, name);


--
-- Name: buckets_analytics_unique_name_idx; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE UNIQUE INDEX buckets_analytics_unique_name_idx ON storage.buckets_analytics USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: idx_multipart_uploads_list; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE INDEX idx_multipart_uploads_list ON storage.s3_multipart_uploads USING btree (bucket_id, key, created_at);


--
-- Name: idx_objects_bucket_id_name; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE INDEX idx_objects_bucket_id_name ON storage.objects USING btree (bucket_id, name COLLATE "C");


--
-- Name: idx_objects_bucket_id_name_lower; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE INDEX idx_objects_bucket_id_name_lower ON storage.objects USING btree (bucket_id, lower(name) COLLATE "C");


--
-- Name: name_prefix_search; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE INDEX name_prefix_search ON storage.objects USING btree (name text_pattern_ops);


--
-- Name: vector_indexes_name_bucket_id_idx; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE UNIQUE INDEX vector_indexes_name_bucket_id_idx ON storage.vector_indexes USING btree (name, bucket_id);


--
-- Name: admin_logs trg_admin_logs_bump_config_version; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_admin_logs_bump_config_version AFTER INSERT ON public.admin_logs FOR EACH ROW EXECUTE FUNCTION public.bump_config_version_from_admin_log();


--
-- Name: expense_claims trg_expense_claims_capture_config_snapshot; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_expense_claims_capture_config_snapshot AFTER INSERT ON public.expense_claims FOR EACH ROW EXECUTE FUNCTION public.capture_claim_config_snapshot_on_insert();


--
-- Name: expense_claims trg_expense_claims_claim_number; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_expense_claims_claim_number BEFORE INSERT ON public.expense_claims FOR EACH ROW EXECUTE FUNCTION public.set_claim_number_before_insert();


--
-- Name: expense_claims trg_expense_claims_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_expense_claims_updated_at BEFORE UPDATE ON public.expense_claims FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: subscription tr_check_filters; Type: TRIGGER; Schema: realtime; Owner: supabase_admin
--

CREATE TRIGGER tr_check_filters BEFORE INSERT OR UPDATE ON realtime.subscription FOR EACH ROW EXECUTE FUNCTION realtime.subscription_check_filters();


--
-- Name: buckets enforce_bucket_name_length_trigger; Type: TRIGGER; Schema: storage; Owner: supabase_storage_admin
--

CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE OF name ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length();


--
-- Name: buckets protect_buckets_delete; Type: TRIGGER; Schema: storage; Owner: supabase_storage_admin
--

CREATE TRIGGER protect_buckets_delete BEFORE DELETE ON storage.buckets FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();


--
-- Name: objects protect_objects_delete; Type: TRIGGER; Schema: storage; Owner: supabase_storage_admin
--

CREATE TRIGGER protect_objects_delete BEFORE DELETE ON storage.objects FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();


--
-- Name: objects update_objects_updated_at; Type: TRIGGER; Schema: storage; Owner: supabase_storage_admin
--

CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();


--
-- Name: identities identities_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: mfa_challenges mfa_challenges_auth_factor_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_auth_factor_id_fkey FOREIGN KEY (factor_id) REFERENCES auth.mfa_factors(id) ON DELETE CASCADE;


--
-- Name: mfa_factors mfa_factors_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: one_time_tokens one_time_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: saml_providers saml_providers_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_flow_state_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_flow_state_id_fkey FOREIGN KEY (flow_state_id) REFERENCES auth.flow_state(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_oauth_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_oauth_client_id_fkey FOREIGN KEY (oauth_client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sso_domains sso_domains_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: webauthn_challenges webauthn_challenges_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.webauthn_challenges
    ADD CONSTRAINT webauthn_challenges_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: webauthn_credentials webauthn_credentials_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.webauthn_credentials
    ADD CONSTRAINT webauthn_credentials_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: admin_logs admin_logs_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_logs
    ADD CONSTRAINT admin_logs_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.employees(id);


--
-- Name: approval_history approval_history_approver_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.approval_history
    ADD CONSTRAINT approval_history_approver_employee_id_fkey FOREIGN KEY (approver_employee_id) REFERENCES public.employees(id);


--
-- Name: approval_history approval_history_claim_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.approval_history
    ADD CONSTRAINT approval_history_claim_id_fkey FOREIGN KEY (claim_id) REFERENCES public.expense_claims(id) ON DELETE CASCADE;


--
-- Name: approval_history approval_history_new_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.approval_history
    ADD CONSTRAINT approval_history_new_status_id_fkey FOREIGN KEY (new_status_id) REFERENCES public.claim_statuses(id);


--
-- Name: approval_history approval_history_old_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.approval_history
    ADD CONSTRAINT approval_history_old_status_id_fkey FOREIGN KEY (old_status_id) REFERENCES public.claim_statuses(id);


--
-- Name: approval_routing approval_routing_approver_designation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.approval_routing
    ADD CONSTRAINT approval_routing_approver_designation_id_fkey FOREIGN KEY (approver_designation_id) REFERENCES public.designations(id);


--
-- Name: approval_routing approval_routing_approver_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.approval_routing
    ADD CONSTRAINT approval_routing_approver_role_id_fkey FOREIGN KEY (approver_role_id) REFERENCES public.roles(id);


--
-- Name: approval_routing approval_routing_approver_state_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.approval_routing
    ADD CONSTRAINT approval_routing_approver_state_id_fkey FOREIGN KEY (approver_state_id) REFERENCES public.states(id);


--
-- Name: approval_routing approval_routing_submitter_designation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.approval_routing
    ADD CONSTRAINT approval_routing_submitter_designation_id_fkey FOREIGN KEY (submitter_designation_id) REFERENCES public.designations(id);


--
-- Name: approval_routing approval_routing_submitter_state_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.approval_routing
    ADD CONSTRAINT approval_routing_submitter_state_id_fkey FOREIGN KEY (submitter_state_id) REFERENCES public.states(id);


--
-- Name: approver_selection_rules approver_selection_rules_designation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.approver_selection_rules
    ADD CONSTRAINT approver_selection_rules_designation_id_fkey FOREIGN KEY (designation_id) REFERENCES public.designations(id);


--
-- Name: cities cities_state_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cities
    ADD CONSTRAINT cities_state_id_fkey FOREIGN KEY (state_id) REFERENCES public.states(id) ON DELETE CASCADE;


--
-- Name: claim_config_snapshots claim_config_snapshots_claim_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.claim_config_snapshots
    ADD CONSTRAINT claim_config_snapshots_claim_id_fkey FOREIGN KEY (claim_id) REFERENCES public.expense_claims(id) ON DELETE CASCADE;


--
-- Name: claim_config_snapshots claim_config_snapshots_config_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.claim_config_snapshots
    ADD CONSTRAINT claim_config_snapshots_config_version_id_fkey FOREIGN KEY (config_version_id) REFERENCES public.config_versions(id);


--
-- Name: claim_status_transitions claim_status_transitions_from_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.claim_status_transitions
    ADD CONSTRAINT claim_status_transitions_from_status_id_fkey FOREIGN KEY (from_status_id) REFERENCES public.claim_statuses(id);


--
-- Name: claim_status_transitions claim_status_transitions_requires_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.claim_status_transitions
    ADD CONSTRAINT claim_status_transitions_requires_role_id_fkey FOREIGN KEY (requires_role_id) REFERENCES public.roles(id);


--
-- Name: claim_status_transitions claim_status_transitions_to_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.claim_status_transitions
    ADD CONSTRAINT claim_status_transitions_to_status_id_fkey FOREIGN KEY (to_status_id) REFERENCES public.claim_statuses(id);


--
-- Name: config_versions config_versions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.config_versions
    ADD CONSTRAINT config_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: config_versions config_versions_source_admin_log_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.config_versions
    ADD CONSTRAINT config_versions_source_admin_log_id_fkey FOREIGN KEY (source_admin_log_id) REFERENCES public.admin_logs(id) ON DELETE SET NULL;


--
-- Name: designation_approval_flow designation_approval_flow_designation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.designation_approval_flow
    ADD CONSTRAINT designation_approval_flow_designation_id_fkey FOREIGN KEY (designation_id) REFERENCES public.designations(id);


--
-- Name: designation_vehicle_permissions designation_vehicle_permissions_designation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.designation_vehicle_permissions
    ADD CONSTRAINT designation_vehicle_permissions_designation_id_fkey FOREIGN KEY (designation_id) REFERENCES public.designations(id);


--
-- Name: designation_vehicle_permissions designation_vehicle_permissions_vehicle_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.designation_vehicle_permissions
    ADD CONSTRAINT designation_vehicle_permissions_vehicle_type_id_fkey FOREIGN KEY (vehicle_type_id) REFERENCES public.vehicle_types(id);


--
-- Name: employee_replacements employee_replacements_new_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_replacements
    ADD CONSTRAINT employee_replacements_new_employee_id_fkey FOREIGN KEY (new_employee_id) REFERENCES public.employees(id);


--
-- Name: employee_replacements employee_replacements_old_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_replacements
    ADD CONSTRAINT employee_replacements_old_employee_id_fkey FOREIGN KEY (old_employee_id) REFERENCES public.employees(id);


--
-- Name: employee_replacements employee_replacements_replaced_by_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_replacements
    ADD CONSTRAINT employee_replacements_replaced_by_admin_id_fkey FOREIGN KEY (replaced_by_admin_id) REFERENCES public.employees(id);


--
-- Name: employee_roles employee_roles_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_roles
    ADD CONSTRAINT employee_roles_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.employees(id);


--
-- Name: employee_roles employee_roles_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_roles
    ADD CONSTRAINT employee_roles_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: employee_roles employee_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_roles
    ADD CONSTRAINT employee_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: employee_states employee_states_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_states
    ADD CONSTRAINT employee_states_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: employee_states employee_states_state_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_states
    ADD CONSTRAINT employee_states_state_id_fkey FOREIGN KEY (state_id) REFERENCES public.states(id) ON DELETE CASCADE;


--
-- Name: employees employees_approval_employee_id_level_1_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_approval_employee_id_level_1_fkey FOREIGN KEY (approval_employee_id_level_1) REFERENCES public.employees(id);


--
-- Name: employees employees_approval_employee_id_level_2_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_approval_employee_id_level_2_fkey FOREIGN KEY (approval_employee_id_level_2) REFERENCES public.employees(id);


--
-- Name: employees employees_approval_employee_id_level_3_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_approval_employee_id_level_3_fkey FOREIGN KEY (approval_employee_id_level_3) REFERENCES public.employees(id);


--
-- Name: employees employees_designation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_designation_id_fkey FOREIGN KEY (designation_id) REFERENCES public.designations(id);


--
-- Name: employees employees_employee_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_employee_status_id_fkey FOREIGN KEY (employee_status_id) REFERENCES public.employee_statuses(id);


--
-- Name: expense_claim_items expense_claim_items_claim_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expense_claim_items
    ADD CONSTRAINT expense_claim_items_claim_id_fkey FOREIGN KEY (claim_id) REFERENCES public.expense_claims(id) ON DELETE CASCADE;


--
-- Name: expense_claims expense_claims_base_location_day_type_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expense_claims
    ADD CONSTRAINT expense_claims_base_location_day_type_code_fkey FOREIGN KEY (base_location_day_type_code) REFERENCES public.base_location_day_types(day_type_code);


--
-- Name: expense_claims expense_claims_designation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expense_claims
    ADD CONSTRAINT expense_claims_designation_id_fkey FOREIGN KEY (designation_id) REFERENCES public.designations(id);


--
-- Name: expense_claims expense_claims_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expense_claims
    ADD CONSTRAINT expense_claims_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: expense_claims expense_claims_from_city_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expense_claims
    ADD CONSTRAINT expense_claims_from_city_id_fkey FOREIGN KEY (from_city_id) REFERENCES public.cities(id);


--
-- Name: expense_claims expense_claims_last_rejected_by_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expense_claims
    ADD CONSTRAINT expense_claims_last_rejected_by_employee_id_fkey FOREIGN KEY (last_rejected_by_employee_id) REFERENCES public.employees(id);


--
-- Name: expense_claims expense_claims_outstation_city_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expense_claims
    ADD CONSTRAINT expense_claims_outstation_city_id_fkey FOREIGN KEY (outstation_city_id) REFERENCES public.cities(id);


--
-- Name: expense_claims expense_claims_outstation_state_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expense_claims
    ADD CONSTRAINT expense_claims_outstation_state_id_fkey FOREIGN KEY (outstation_state_id) REFERENCES public.states(id);


--
-- Name: expense_claims expense_claims_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expense_claims
    ADD CONSTRAINT expense_claims_status_id_fkey FOREIGN KEY (status_id) REFERENCES public.claim_statuses(id);


--
-- Name: expense_claims expense_claims_to_city_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expense_claims
    ADD CONSTRAINT expense_claims_to_city_id_fkey FOREIGN KEY (to_city_id) REFERENCES public.cities(id);


--
-- Name: expense_claims expense_claims_vehicle_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expense_claims
    ADD CONSTRAINT expense_claims_vehicle_type_id_fkey FOREIGN KEY (vehicle_type_id) REFERENCES public.vehicle_types(id);


--
-- Name: expense_claims expense_claims_work_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expense_claims
    ADD CONSTRAINT expense_claims_work_location_id_fkey FOREIGN KEY (work_location_id) REFERENCES public.work_locations(id);


--
-- Name: expense_rates expense_rates_designation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expense_rates
    ADD CONSTRAINT expense_rates_designation_id_fkey FOREIGN KEY (designation_id) REFERENCES public.designations(id);


--
-- Name: expense_rates expense_rates_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expense_rates
    ADD CONSTRAINT expense_rates_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.work_locations(id);


--
-- Name: finance_actions finance_actions_actor_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_actions
    ADD CONSTRAINT finance_actions_actor_employee_id_fkey FOREIGN KEY (actor_employee_id) REFERENCES public.employees(id);


--
-- Name: finance_actions finance_actions_claim_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_actions
    ADD CONSTRAINT finance_actions_claim_id_fkey FOREIGN KEY (claim_id) REFERENCES public.expense_claims(id) ON DELETE CASCADE;


--
-- Name: objects objects_bucketId_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_upload_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES storage.s3_multipart_uploads(id) ON DELETE CASCADE;


--
-- Name: vector_indexes vector_indexes_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets_vectors(id);


--
-- Name: audit_log_entries; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.audit_log_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: flow_state; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.flow_state ENABLE ROW LEVEL SECURITY;

--
-- Name: identities; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.identities ENABLE ROW LEVEL SECURITY;

--
-- Name: instances; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.instances ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_amr_claims; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.mfa_amr_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_challenges; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.mfa_challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_factors; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.mfa_factors ENABLE ROW LEVEL SECURITY;

--
-- Name: one_time_tokens; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.one_time_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: refresh_tokens; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.refresh_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_providers; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.saml_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_relay_states; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.saml_relay_states ENABLE ROW LEVEL SECURITY;

--
-- Name: schema_migrations; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.schema_migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_domains; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.sso_domains ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_providers; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.sso_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

--
-- Name: _backup_approval_history; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public._backup_approval_history ENABLE ROW LEVEL SECURITY;

--
-- Name: _backup_expense_claim_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public._backup_expense_claim_items ENABLE ROW LEVEL SECURITY;

--
-- Name: _backup_expense_claims; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public._backup_expense_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: _backup_finance_actions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public._backup_finance_actions ENABLE ROW LEVEL SECURITY;

--
-- Name: _migration_history; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public._migration_history ENABLE ROW LEVEL SECURITY;

--
-- Name: approval_history admin reads all approval history; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "admin reads all approval history" ON public.approval_history FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ((public.employees cur
     JOIN public.employee_roles er ON (((er.employee_id = cur.id) AND (er.is_active = true))))
     JOIN public.roles r ON ((r.id = er.role_id)))
  WHERE ((lower(cur.employee_email) = public.current_user_email()) AND ((r.role_code)::text = 'ADMIN'::text)))));


--
-- Name: expense_claim_items admin reads all claim items; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "admin reads all claim items" ON public.expense_claim_items FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ((public.employees cur
     JOIN public.employee_roles er ON (((er.employee_id = cur.id) AND (er.is_active = true))))
     JOIN public.roles r ON ((r.id = er.role_id)))
  WHERE ((lower(cur.employee_email) = public.current_user_email()) AND ((r.role_code)::text = 'ADMIN'::text)))));


--
-- Name: expense_claims admin reads all claims; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "admin reads all claims" ON public.expense_claims FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ((public.employees cur
     JOIN public.employee_roles er ON (((er.employee_id = cur.id) AND (er.is_active = true))))
     JOIN public.roles r ON ((r.id = er.role_id)))
  WHERE ((lower(cur.employee_email) = public.current_user_email()) AND ((r.role_code)::text = 'ADMIN'::text)))));


--
-- Name: admin_logs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_logs admin_logs_read_admin_only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY admin_logs_read_admin_only ON public.admin_logs FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM ((public.employees current_emp
     JOIN public.employee_roles er ON ((er.employee_id = current_emp.id)))
     JOIN public.roles r ON ((r.id = er.role_id)))
  WHERE ((lower(current_emp.employee_email) = public.current_user_email()) AND (er.is_active = true) AND (r.is_admin_role = true)))));


--
-- Name: allowed_email_domains aed_read_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY aed_read_all ON public.allowed_email_domains FOR SELECT TO authenticated USING (true);


--
-- Name: allowed_email_domains aed_write_service; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY aed_write_service ON public.allowed_email_domains TO service_role USING (true);


--
-- Name: allowed_email_domains; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.allowed_email_domains ENABLE ROW LEVEL SECURITY;

--
-- Name: approval_history; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.approval_history ENABLE ROW LEVEL SECURITY;

--
-- Name: approval_routing; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.approval_routing ENABLE ROW LEVEL SECURITY;

--
-- Name: approval_history approver reads approval history; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "approver reads approval history" ON public.approval_history FOR SELECT TO authenticated USING ((claim_id IN ( SELECT public.get_my_approver_acted_claim_ids() AS get_my_approver_acted_claim_ids)));


--
-- Name: expense_claim_items approver reads claim items for historically actioned claims; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "approver reads claim items for historically actioned claims" ON public.expense_claim_items FOR SELECT USING ((claim_id IN ( SELECT public.get_my_approver_acted_claim_ids() AS get_my_approver_acted_claim_ids)));


--
-- Name: expense_claims approver reads historically actioned claims; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "approver reads historically actioned claims" ON public.expense_claims FOR SELECT USING ((id IN ( SELECT public.get_my_approver_acted_claim_ids() AS get_my_approver_acted_claim_ids)));


--
-- Name: expense_claim_items approver reads pending claim items; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "approver reads pending claim items" ON public.expense_claim_items FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.expense_claims c
     JOIN public.employees approver ON ((lower(approver.employee_email) = public.current_user_email())))
  WHERE ((c.id = expense_claim_items.claim_id) AND (((c.current_approval_level = 1) AND (EXISTS ( SELECT 1
           FROM public.employees owner
          WHERE ((owner.id = c.employee_id) AND (owner.approval_employee_id_level_1 = approver.id))))) OR ((c.current_approval_level = 2) AND (EXISTS ( SELECT 1
           FROM public.employees owner
          WHERE ((owner.id = c.employee_id) AND (owner.approval_employee_id_level_3 = approver.id))))))))));


--
-- Name: expense_claims approver reads pending claims; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "approver reads pending claims" ON public.expense_claims FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.employees approver
  WHERE ((lower(approver.employee_email) = public.current_user_email()) AND (((expense_claims.current_approval_level = 1) AND (EXISTS ( SELECT 1
           FROM public.employees owner
          WHERE ((owner.id = expense_claims.employee_id) AND (owner.approval_employee_id_level_1 = approver.id))))) OR ((expense_claims.current_approval_level = 2) AND (EXISTS ( SELECT 1
           FROM public.employees owner
          WHERE ((owner.id = expense_claims.employee_id) AND (owner.approval_employee_id_level_3 = approver.id))))))))));


--
-- Name: approval_history approver reads pending-routed claim history; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "approver reads pending-routed claim history" ON public.approval_history FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.get_claim_available_actions(approval_history.claim_id) actions(action, display_label, require_notes, supports_allow_resubmit, actor_scope)
  WHERE (actions.actor_scope = 'approver'::text))));


--
-- Name: approver_selection_rules; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.approver_selection_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: approver_selection_rules approver_selection_rules_admin_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY approver_selection_rules_admin_write ON public.approver_selection_rules TO authenticated USING ((EXISTS ( SELECT 1
   FROM ((public.employees current_emp
     JOIN public.employee_roles er ON ((er.employee_id = current_emp.id)))
     JOIN public.roles r ON ((r.id = er.role_id)))
  WHERE ((lower(current_emp.employee_email) = public.current_user_email()) AND (er.is_active = true) AND (r.is_admin_role = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ((public.employees current_emp
     JOIN public.employee_roles er ON ((er.employee_id = current_emp.id)))
     JOIN public.roles r ON ((r.id = er.role_id)))
  WHERE ((lower(current_emp.employee_email) = public.current_user_email()) AND (er.is_active = true) AND (r.is_admin_role = true)))));


--
-- Name: approver_selection_rules approver_selection_rules_read_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY approver_selection_rules_read_all ON public.approver_selection_rules FOR SELECT TO authenticated USING (true);


--
-- Name: approval_routing ar_read_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY ar_read_all ON public.approval_routing FOR SELECT TO authenticated USING (true);


--
-- Name: approval_routing ar_write_service; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY ar_write_service ON public.approval_routing TO service_role USING (true);


--
-- Name: archive_claim_expenses; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.archive_claim_expenses ENABLE ROW LEVEL SECURITY;

--
-- Name: archive_claim_status_audit; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.archive_claim_status_audit ENABLE ROW LEVEL SECURITY;

--
-- Name: employees authenticated users can read employees; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "authenticated users can read employees" ON public.employees FOR SELECT TO authenticated USING (true);


--
-- Name: expense_reimbursement_rates authenticated users can read rates; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "authenticated users can read rates" ON public.expense_reimbursement_rates FOR SELECT TO authenticated USING (true);


--
-- Name: base_location_day_types; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.base_location_day_types ENABLE ROW LEVEL SECURITY;

--
-- Name: base_location_day_types base_location_day_types_read_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY base_location_day_types_read_all ON public.base_location_day_types FOR SELECT TO authenticated USING (true);


--
-- Name: base_location_day_types base_location_day_types_write_service; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY base_location_day_types_write_service ON public.base_location_day_types TO service_role USING (true) WITH CHECK (true);


--
-- Name: cities; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;

--
-- Name: cities cities_admin_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY cities_admin_write ON public.cities TO service_role USING (true) WITH CHECK (true);


--
-- Name: cities cities_read_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY cities_read_all ON public.cities FOR SELECT TO authenticated USING (true);


--
-- Name: claim_config_snapshots; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.claim_config_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: claim_config_snapshots claim_config_snapshots_read_via_claim_access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY claim_config_snapshots_read_via_claim_access ON public.claim_config_snapshots FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.expense_claims c
  WHERE (c.id = claim_config_snapshots.claim_id))));


--
-- Name: claim_status_transitions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.claim_status_transitions ENABLE ROW LEVEL SECURITY;

--
-- Name: claim_statuses; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.claim_statuses ENABLE ROW LEVEL SECURITY;

--
-- Name: claim_statuses claim_statuses_read_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY claim_statuses_read_all ON public.claim_statuses FOR SELECT TO authenticated USING (true);


--
-- Name: claim_statuses claim_statuses_write_service; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY claim_statuses_write_service ON public.claim_statuses TO service_role USING (true);


--
-- Name: config_versions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.config_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: config_versions config_versions_admin_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY config_versions_admin_write ON public.config_versions TO authenticated USING ((EXISTS ( SELECT 1
   FROM ((public.employees current_emp
     JOIN public.employee_roles er ON ((er.employee_id = current_emp.id)))
     JOIN public.roles r ON ((r.id = er.role_id)))
  WHERE ((lower(current_emp.employee_email) = public.current_user_email()) AND (er.is_active = true) AND (r.is_admin_role = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ((public.employees current_emp
     JOIN public.employee_roles er ON ((er.employee_id = current_emp.id)))
     JOIN public.roles r ON ((r.id = er.role_id)))
  WHERE ((lower(current_emp.employee_email) = public.current_user_email()) AND (er.is_active = true) AND (r.is_admin_role = true)))));


--
-- Name: config_versions config_versions_read_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY config_versions_read_all ON public.config_versions FOR SELECT TO authenticated USING (true);


--
-- Name: claim_status_transitions cst_read_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY cst_read_all ON public.claim_status_transitions FOR SELECT TO authenticated USING (true);


--
-- Name: claim_status_transitions cst_write_service; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY cst_write_service ON public.claim_status_transitions TO service_role USING (true);


--
-- Name: designation_approval_flow daf_read_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY daf_read_all ON public.designation_approval_flow FOR SELECT TO authenticated USING (true);


--
-- Name: designation_approval_flow daf_write_service; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY daf_write_service ON public.designation_approval_flow TO service_role USING (true);


--
-- Name: designation_approval_flow; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.designation_approval_flow ENABLE ROW LEVEL SECURITY;

--
-- Name: designation_vehicle_permissions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.designation_vehicle_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: designations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.designations ENABLE ROW LEVEL SECURITY;

--
-- Name: designations designations_admin_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY designations_admin_write ON public.designations TO service_role USING (true) WITH CHECK (true);


--
-- Name: designations designations_read_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY designations_read_all ON public.designations FOR SELECT TO authenticated USING (true);


--
-- Name: designation_vehicle_permissions dvp_read_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY dvp_read_all ON public.designation_vehicle_permissions FOR SELECT TO authenticated USING (true);


--
-- Name: designation_vehicle_permissions dvp_write_service; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY dvp_write_service ON public.designation_vehicle_permissions TO service_role USING (true);


--
-- Name: expense_claim_items employee deletes own claim items; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "employee deletes own claim items" ON public.expense_claim_items FOR DELETE USING ((EXISTS ( SELECT 1
   FROM ((public.expense_claims c
     JOIN public.employees e ON ((e.id = c.employee_id)))
     JOIN public.claim_statuses cs ON ((cs.id = c.status_id)))
  WHERE ((c.id = expense_claim_items.claim_id) AND (lower(e.employee_email) = public.current_user_email()) AND ((cs.status_code)::text = ANY ((ARRAY['DRAFT'::character varying, 'RETURNED_FOR_MODIFICATION'::character varying])::text[]))))));


--
-- Name: expense_claims employee inserts own claim; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "employee inserts own claim" ON public.expense_claims FOR INSERT TO authenticated WITH CHECK ((employee_id = ( SELECT e.id
   FROM public.employees e
  WHERE (lower(e.employee_email) = public.current_user_email()))));


--
-- Name: approval_history employee reads own claim history; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "employee reads own claim history" ON public.approval_history FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.expense_claims c
     JOIN public.employees e ON ((e.id = c.employee_id)))
  WHERE ((c.id = approval_history.claim_id) AND (lower(e.employee_email) = public.current_user_email())))));


--
-- Name: expense_claim_items employee reads own claim items; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "employee reads own claim items" ON public.expense_claim_items FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.expense_claims c
     JOIN public.employees e ON ((e.id = c.employee_id)))
  WHERE ((c.id = expense_claim_items.claim_id) AND (lower(e.employee_email) = public.current_user_email())))));


--
-- Name: expense_claims employee reads own claims; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "employee reads own claims" ON public.expense_claims FOR SELECT USING ((employee_id = ( SELECT e.id
   FROM public.employees e
  WHERE (lower(e.employee_email) = public.current_user_email()))));


--
-- Name: expense_claim_items employee updates own claim items; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "employee updates own claim items" ON public.expense_claim_items FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ((public.expense_claims c
     JOIN public.employees e ON ((e.id = c.employee_id)))
     JOIN public.claim_statuses cs ON ((cs.id = c.status_id)))
  WHERE ((c.id = expense_claim_items.claim_id) AND (lower(e.employee_email) = public.current_user_email()) AND ((cs.status_code)::text = ANY ((ARRAY['DRAFT'::character varying, 'RETURNED_FOR_MODIFICATION'::character varying])::text[]))))));


--
-- Name: expense_claims employee updates own draft or returned claims; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "employee updates own draft or returned claims" ON public.expense_claims FOR UPDATE USING (((employee_id = ( SELECT e.id
   FROM public.employees e
  WHERE (lower(e.employee_email) = public.current_user_email()))) AND (status_id IN ( SELECT cs.id
   FROM public.claim_statuses cs
  WHERE (((cs.status_code)::text = 'DRAFT'::text) OR ((cs.status_code)::text = 'RETURNED_FOR_MODIFICATION'::text) OR (cs.is_rejection = true)))))) WITH CHECK ((employee_id = ( SELECT e.id
   FROM public.employees e
  WHERE (lower(e.employee_email) = public.current_user_email()))));


--
-- Name: employee_replacements; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.employee_replacements ENABLE ROW LEVEL SECURITY;

--
-- Name: employee_replacements employee_replacements_read_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY employee_replacements_read_authenticated ON public.employee_replacements FOR SELECT TO authenticated USING (true);


--
-- Name: employee_roles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.employee_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: employee_roles employee_roles_admin_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY employee_roles_admin_write ON public.employee_roles TO service_role USING (true) WITH CHECK (true);


--
-- Name: employee_roles employee_roles_read_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY employee_roles_read_all ON public.employee_roles FOR SELECT TO authenticated USING (true);


--
-- Name: employee_states; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.employee_states ENABLE ROW LEVEL SECURITY;

--
-- Name: employee_states employee_states_admin_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY employee_states_admin_write ON public.employee_states TO service_role USING (true) WITH CHECK (true);


--
-- Name: employee_states employee_states_read_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY employee_states_read_all ON public.employee_states FOR SELECT TO authenticated USING (true);


--
-- Name: employee_statuses; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.employee_statuses ENABLE ROW LEVEL SECURITY;

--
-- Name: employee_statuses employee_statuses_admin_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY employee_statuses_admin_write ON public.employee_statuses TO service_role USING (true) WITH CHECK (true);


--
-- Name: employee_statuses employee_statuses_read_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY employee_statuses_read_all ON public.employee_statuses FOR SELECT TO authenticated USING (true);


--
-- Name: employees; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

--
-- Name: expense_rates er_read_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY er_read_all ON public.expense_rates FOR SELECT TO authenticated USING (true);


--
-- Name: expense_rates er_write_service; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY er_write_service ON public.expense_rates TO service_role USING (true);


--
-- Name: expense_claim_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.expense_claim_items ENABLE ROW LEVEL SECURITY;

--
-- Name: expense_claims; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.expense_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: expense_rates; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.expense_rates ENABLE ROW LEVEL SECURITY;

--
-- Name: expense_reimbursement_rates; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.expense_reimbursement_rates ENABLE ROW LEVEL SECURITY;

--
-- Name: finance_actions finance can insert finance actions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "finance can insert finance actions" ON public.finance_actions FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM ((public.employees current_emp
     JOIN public.employee_roles er ON (((er.employee_id = current_emp.id) AND (er.is_active = true))))
     JOIN public.roles r ON ((r.id = er.role_id)))
  WHERE ((lower(current_emp.employee_email) = public.current_user_email()) AND (r.is_finance_role = true) AND (r.is_active = true)))));


--
-- Name: approval_history finance can read claim history; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "finance can read claim history" ON public.approval_history FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM ((public.employees cur
     JOIN public.employee_roles er ON (((er.employee_id = cur.id) AND (er.is_active = true))))
     JOIN public.roles r ON ((r.id = er.role_id)))
  WHERE ((lower(cur.employee_email) = public.current_user_email()) AND ((r.role_code)::text = 'FINANCE_TEAM'::text)))) AND (EXISTS ( SELECT 1
   FROM public.expense_claims c
  WHERE ((c.id = approval_history.claim_id) AND (c.status_id IN ( SELECT public.get_finance_visible_status_ids() AS get_finance_visible_status_ids)))))));


--
-- Name: expense_claim_items finance can read claim items; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "finance can read claim items" ON public.expense_claim_items FOR SELECT USING (((EXISTS ( SELECT 1
   FROM ((public.employees cur
     JOIN public.employee_roles er ON (((er.employee_id = cur.id) AND (er.is_active = true))))
     JOIN public.roles r ON ((r.id = er.role_id)))
  WHERE ((lower(cur.employee_email) = public.current_user_email()) AND ((r.role_code)::text = 'FINANCE_TEAM'::text)))) AND (EXISTS ( SELECT 1
   FROM (public.expense_claims c
     JOIN public.claim_statuses cs ON ((cs.id = c.status_id)))
  WHERE ((c.id = expense_claim_items.claim_id) AND ((cs.status_code)::text = ANY ((ARRAY['L3_PENDING_FINANCE_REVIEW'::character varying, 'APPROVED'::character varying, 'L3_REJECTED_FINANCE'::character varying, 'RETURNED_FOR_MODIFICATION'::character varying])::text[])))))));


--
-- Name: expense_claims finance can read finance claims; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "finance can read finance claims" ON public.expense_claims FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM ((public.employees cur
     JOIN public.employee_roles er ON (((er.employee_id = cur.id) AND (er.is_active = true))))
     JOIN public.roles r ON ((r.id = er.role_id)))
  WHERE ((lower(cur.employee_email) = public.current_user_email()) AND ((r.role_code)::text = 'FINANCE_TEAM'::text)))) AND (status_id IN ( SELECT public.get_finance_visible_status_ids() AS get_finance_visible_status_ids))));


--
-- Name: expense_claims finance can update finance review claims; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "finance can update finance review claims" ON public.expense_claims FOR UPDATE TO authenticated USING (((EXISTS ( SELECT 1
   FROM ((public.employees cur
     JOIN public.employee_roles er ON (((er.employee_id = cur.id) AND (er.is_active = true))))
     JOIN public.roles r ON ((r.id = er.role_id)))
  WHERE ((lower(cur.employee_email) = public.current_user_email()) AND ((r.role_code)::text = 'FINANCE_TEAM'::text)))) AND (status_id = ( SELECT claim_statuses.id
   FROM public.claim_statuses
  WHERE ((claim_statuses.status_code)::text = 'L3_PENDING_FINANCE_REVIEW'::text))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM ((public.employees cur
     JOIN public.employee_roles er ON (((er.employee_id = cur.id) AND (er.is_active = true))))
     JOIN public.roles r ON ((r.id = er.role_id)))
  WHERE ((lower(cur.employee_email) = public.current_user_email()) AND ((r.role_code)::text = 'FINANCE_TEAM'::text)))) AND (status_id IN ( SELECT claim_statuses.id
   FROM public.claim_statuses
  WHERE ((claim_statuses.status_code)::text = ANY ((ARRAY['APPROVED'::character varying, 'L3_REJECTED_FINANCE'::character varying, 'RETURNED_FOR_MODIFICATION'::character varying])::text[])))) AND (current_approval_level IS NULL)));


--
-- Name: finance_actions finance or owner can read finance actions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "finance or owner can read finance actions" ON public.finance_actions FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM ((public.expense_claims c
     JOIN public.employees owner_emp ON ((owner_emp.id = c.employee_id)))
     LEFT JOIN public.employees current_emp ON ((lower(current_emp.employee_email) = public.current_user_email())))
  WHERE ((c.id = finance_actions.claim_id) AND ((lower(owner_emp.employee_email) = public.current_user_email()) OR (EXISTS ( SELECT 1
           FROM (public.employee_roles er
             JOIN public.roles r ON ((r.id = er.role_id)))
          WHERE ((er.employee_id = current_emp.id) AND (er.is_active = true) AND (r.is_finance_role = true) AND (r.is_active = true)))))))) AND (id = ( SELECT public.get_latest_finance_action_id(finance_actions.claim_id) AS get_latest_finance_action_id))));


--
-- Name: finance_actions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.finance_actions ENABLE ROW LEVEL SECURITY;

--
-- Name: expense_claim_items owner can insert claim items; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "owner can insert claim items" ON public.expense_claim_items FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.expense_claims c
     JOIN public.employees e ON ((e.id = c.employee_id)))
  WHERE ((c.id = expense_claim_items.claim_id) AND (lower(e.employee_email) = public.current_user_email())))));


--
-- Name: roles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

--
-- Name: roles roles_admin_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY roles_admin_write ON public.roles TO service_role USING (true) WITH CHECK (true);


--
-- Name: roles roles_read_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY roles_read_all ON public.roles FOR SELECT TO authenticated USING (true);


--
-- Name: system_settings ss_read_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY ss_read_all ON public.system_settings FOR SELECT TO authenticated USING (true);


--
-- Name: system_settings ss_write_service; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY ss_write_service ON public.system_settings TO service_role USING (true);


--
-- Name: states; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.states ENABLE ROW LEVEL SECURITY;

--
-- Name: states states_admin_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY states_admin_write ON public.states TO service_role USING (true) WITH CHECK (true);


--
-- Name: states states_read_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY states_read_all ON public.states FOR SELECT TO authenticated USING (true);


--
-- Name: system_settings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: validation_rules; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.validation_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: vehicle_types; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.vehicle_types ENABLE ROW LEVEL SECURITY;

--
-- Name: validation_rules vr_read_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY vr_read_all ON public.validation_rules FOR SELECT TO authenticated USING (true);


--
-- Name: validation_rules vr_write_service; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY vr_write_service ON public.validation_rules TO service_role USING (true);


--
-- Name: vehicle_types vt_read_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY vt_read_all ON public.vehicle_types FOR SELECT TO authenticated USING (true);


--
-- Name: vehicle_types vt_write_service; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY vt_write_service ON public.vehicle_types TO service_role USING (true);


--
-- Name: work_locations wl_read_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY wl_read_all ON public.work_locations FOR SELECT TO authenticated USING (true);


--
-- Name: work_locations wl_write_service; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY wl_write_service ON public.work_locations TO service_role USING (true);


--
-- Name: work_locations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.work_locations ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: realtime; Owner: supabase_realtime_admin
--

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_analytics; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.buckets_analytics ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_vectors; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.buckets_vectors ENABLE ROW LEVEL SECURITY;

--
-- Name: migrations; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: objects; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.s3_multipart_uploads ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads_parts; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.s3_multipart_uploads_parts ENABLE ROW LEVEL SECURITY;

--
-- Name: vector_indexes; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.vector_indexes ENABLE ROW LEVEL SECURITY;

--
-- Name: supabase_realtime; Type: PUBLICATION; Schema: -; Owner: postgres
--

CREATE PUBLICATION supabase_realtime WITH (publish = 'insert, update, delete, truncate');


ALTER PUBLICATION supabase_realtime OWNER TO postgres;

--
-- Name: SCHEMA auth; Type: ACL; Schema: -; Owner: supabase_admin
--

GRANT USAGE ON SCHEMA auth TO anon;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT USAGE ON SCHEMA auth TO service_role;
GRANT ALL ON SCHEMA auth TO supabase_auth_admin;
GRANT ALL ON SCHEMA auth TO dashboard_user;
GRANT USAGE ON SCHEMA auth TO postgres;


--
-- Name: SCHEMA extensions; Type: ACL; Schema: -; Owner: postgres
--

GRANT USAGE ON SCHEMA extensions TO anon;
GRANT USAGE ON SCHEMA extensions TO authenticated;
GRANT USAGE ON SCHEMA extensions TO service_role;
GRANT ALL ON SCHEMA extensions TO dashboard_user;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: SCHEMA realtime; Type: ACL; Schema: -; Owner: supabase_admin
--

GRANT USAGE ON SCHEMA realtime TO postgres;
GRANT USAGE ON SCHEMA realtime TO anon;
GRANT USAGE ON SCHEMA realtime TO authenticated;
GRANT USAGE ON SCHEMA realtime TO service_role;
GRANT ALL ON SCHEMA realtime TO supabase_realtime_admin;


--
-- Name: SCHEMA storage; Type: ACL; Schema: -; Owner: supabase_admin
--

GRANT USAGE ON SCHEMA storage TO postgres WITH GRANT OPTION;
GRANT USAGE ON SCHEMA storage TO anon;
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT USAGE ON SCHEMA storage TO service_role;
GRANT ALL ON SCHEMA storage TO supabase_storage_admin WITH GRANT OPTION;
GRANT ALL ON SCHEMA storage TO dashboard_user;


--
-- Name: SCHEMA vault; Type: ACL; Schema: -; Owner: supabase_admin
--

GRANT USAGE ON SCHEMA vault TO postgres WITH GRANT OPTION;
GRANT USAGE ON SCHEMA vault TO service_role;


--
-- Name: FUNCTION email(); Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON FUNCTION auth.email() TO dashboard_user;


--
-- Name: FUNCTION jwt(); Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON FUNCTION auth.jwt() TO postgres;
GRANT ALL ON FUNCTION auth.jwt() TO dashboard_user;


--
-- Name: FUNCTION role(); Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON FUNCTION auth.role() TO dashboard_user;


--
-- Name: FUNCTION uid(); Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON FUNCTION auth.uid() TO dashboard_user;


--
-- Name: FUNCTION armor(bytea); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.armor(bytea) FROM postgres;
GRANT ALL ON FUNCTION extensions.armor(bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.armor(bytea) TO dashboard_user;


--
-- Name: FUNCTION armor(bytea, text[], text[]); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.armor(bytea, text[], text[]) FROM postgres;
GRANT ALL ON FUNCTION extensions.armor(bytea, text[], text[]) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.armor(bytea, text[], text[]) TO dashboard_user;


--
-- Name: FUNCTION crypt(text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.crypt(text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.crypt(text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.crypt(text, text) TO dashboard_user;


--
-- Name: FUNCTION dearmor(text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.dearmor(text) FROM postgres;
GRANT ALL ON FUNCTION extensions.dearmor(text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.dearmor(text) TO dashboard_user;


--
-- Name: FUNCTION decrypt(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.decrypt(bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.decrypt(bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.decrypt(bytea, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION decrypt_iv(bytea, bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.decrypt_iv(bytea, bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.decrypt_iv(bytea, bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.decrypt_iv(bytea, bytea, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION digest(bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.digest(bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.digest(bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.digest(bytea, text) TO dashboard_user;


--
-- Name: FUNCTION digest(text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.digest(text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.digest(text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.digest(text, text) TO dashboard_user;


--
-- Name: FUNCTION encrypt(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.encrypt(bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.encrypt(bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.encrypt(bytea, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION encrypt_iv(bytea, bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.encrypt_iv(bytea, bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.encrypt_iv(bytea, bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.encrypt_iv(bytea, bytea, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION gen_random_bytes(integer); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.gen_random_bytes(integer) FROM postgres;
GRANT ALL ON FUNCTION extensions.gen_random_bytes(integer) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.gen_random_bytes(integer) TO dashboard_user;


--
-- Name: FUNCTION gen_random_uuid(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.gen_random_uuid() FROM postgres;
GRANT ALL ON FUNCTION extensions.gen_random_uuid() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.gen_random_uuid() TO dashboard_user;


--
-- Name: FUNCTION gen_salt(text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.gen_salt(text) FROM postgres;
GRANT ALL ON FUNCTION extensions.gen_salt(text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.gen_salt(text) TO dashboard_user;


--
-- Name: FUNCTION gen_salt(text, integer); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.gen_salt(text, integer) FROM postgres;
GRANT ALL ON FUNCTION extensions.gen_salt(text, integer) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.gen_salt(text, integer) TO dashboard_user;


--
-- Name: FUNCTION grant_pg_cron_access(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

REVOKE ALL ON FUNCTION extensions.grant_pg_cron_access() FROM supabase_admin;
GRANT ALL ON FUNCTION extensions.grant_pg_cron_access() TO supabase_admin WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.grant_pg_cron_access() TO dashboard_user;


--
-- Name: FUNCTION grant_pg_graphql_access(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.grant_pg_graphql_access() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION grant_pg_net_access(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

REVOKE ALL ON FUNCTION extensions.grant_pg_net_access() FROM supabase_admin;
GRANT ALL ON FUNCTION extensions.grant_pg_net_access() TO supabase_admin WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.grant_pg_net_access() TO dashboard_user;


--
-- Name: FUNCTION hmac(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.hmac(bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.hmac(bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.hmac(bytea, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION hmac(text, text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.hmac(text, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.hmac(text, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.hmac(text, text, text) TO dashboard_user;


--
-- Name: FUNCTION pg_stat_statements(showtext boolean, OUT userid oid, OUT dbid oid, OUT toplevel boolean, OUT queryid bigint, OUT query text, OUT plans bigint, OUT total_plan_time double precision, OUT min_plan_time double precision, OUT max_plan_time double precision, OUT mean_plan_time double precision, OUT stddev_plan_time double precision, OUT calls bigint, OUT total_exec_time double precision, OUT min_exec_time double precision, OUT max_exec_time double precision, OUT mean_exec_time double precision, OUT stddev_exec_time double precision, OUT rows bigint, OUT shared_blks_hit bigint, OUT shared_blks_read bigint, OUT shared_blks_dirtied bigint, OUT shared_blks_written bigint, OUT local_blks_hit bigint, OUT local_blks_read bigint, OUT local_blks_dirtied bigint, OUT local_blks_written bigint, OUT temp_blks_read bigint, OUT temp_blks_written bigint, OUT shared_blk_read_time double precision, OUT shared_blk_write_time double precision, OUT local_blk_read_time double precision, OUT local_blk_write_time double precision, OUT temp_blk_read_time double precision, OUT temp_blk_write_time double precision, OUT wal_records bigint, OUT wal_fpi bigint, OUT wal_bytes numeric, OUT jit_functions bigint, OUT jit_generation_time double precision, OUT jit_inlining_count bigint, OUT jit_inlining_time double precision, OUT jit_optimization_count bigint, OUT jit_optimization_time double precision, OUT jit_emission_count bigint, OUT jit_emission_time double precision, OUT jit_deform_count bigint, OUT jit_deform_time double precision, OUT stats_since timestamp with time zone, OUT minmax_stats_since timestamp with time zone); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pg_stat_statements(showtext boolean, OUT userid oid, OUT dbid oid, OUT toplevel boolean, OUT queryid bigint, OUT query text, OUT plans bigint, OUT total_plan_time double precision, OUT min_plan_time double precision, OUT max_plan_time double precision, OUT mean_plan_time double precision, OUT stddev_plan_time double precision, OUT calls bigint, OUT total_exec_time double precision, OUT min_exec_time double precision, OUT max_exec_time double precision, OUT mean_exec_time double precision, OUT stddev_exec_time double precision, OUT rows bigint, OUT shared_blks_hit bigint, OUT shared_blks_read bigint, OUT shared_blks_dirtied bigint, OUT shared_blks_written bigint, OUT local_blks_hit bigint, OUT local_blks_read bigint, OUT local_blks_dirtied bigint, OUT local_blks_written bigint, OUT temp_blks_read bigint, OUT temp_blks_written bigint, OUT shared_blk_read_time double precision, OUT shared_blk_write_time double precision, OUT local_blk_read_time double precision, OUT local_blk_write_time double precision, OUT temp_blk_read_time double precision, OUT temp_blk_write_time double precision, OUT wal_records bigint, OUT wal_fpi bigint, OUT wal_bytes numeric, OUT jit_functions bigint, OUT jit_generation_time double precision, OUT jit_inlining_count bigint, OUT jit_inlining_time double precision, OUT jit_optimization_count bigint, OUT jit_optimization_time double precision, OUT jit_emission_count bigint, OUT jit_emission_time double precision, OUT jit_deform_count bigint, OUT jit_deform_time double precision, OUT stats_since timestamp with time zone, OUT minmax_stats_since timestamp with time zone) FROM postgres;
GRANT ALL ON FUNCTION extensions.pg_stat_statements(showtext boolean, OUT userid oid, OUT dbid oid, OUT toplevel boolean, OUT queryid bigint, OUT query text, OUT plans bigint, OUT total_plan_time double precision, OUT min_plan_time double precision, OUT max_plan_time double precision, OUT mean_plan_time double precision, OUT stddev_plan_time double precision, OUT calls bigint, OUT total_exec_time double precision, OUT min_exec_time double precision, OUT max_exec_time double precision, OUT mean_exec_time double precision, OUT stddev_exec_time double precision, OUT rows bigint, OUT shared_blks_hit bigint, OUT shared_blks_read bigint, OUT shared_blks_dirtied bigint, OUT shared_blks_written bigint, OUT local_blks_hit bigint, OUT local_blks_read bigint, OUT local_blks_dirtied bigint, OUT local_blks_written bigint, OUT temp_blks_read bigint, OUT temp_blks_written bigint, OUT shared_blk_read_time double precision, OUT shared_blk_write_time double precision, OUT local_blk_read_time double precision, OUT local_blk_write_time double precision, OUT temp_blk_read_time double precision, OUT temp_blk_write_time double precision, OUT wal_records bigint, OUT wal_fpi bigint, OUT wal_bytes numeric, OUT jit_functions bigint, OUT jit_generation_time double precision, OUT jit_inlining_count bigint, OUT jit_inlining_time double precision, OUT jit_optimization_count bigint, OUT jit_optimization_time double precision, OUT jit_emission_count bigint, OUT jit_emission_time double precision, OUT jit_deform_count bigint, OUT jit_deform_time double precision, OUT stats_since timestamp with time zone, OUT minmax_stats_since timestamp with time zone) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pg_stat_statements(showtext boolean, OUT userid oid, OUT dbid oid, OUT toplevel boolean, OUT queryid bigint, OUT query text, OUT plans bigint, OUT total_plan_time double precision, OUT min_plan_time double precision, OUT max_plan_time double precision, OUT mean_plan_time double precision, OUT stddev_plan_time double precision, OUT calls bigint, OUT total_exec_time double precision, OUT min_exec_time double precision, OUT max_exec_time double precision, OUT mean_exec_time double precision, OUT stddev_exec_time double precision, OUT rows bigint, OUT shared_blks_hit bigint, OUT shared_blks_read bigint, OUT shared_blks_dirtied bigint, OUT shared_blks_written bigint, OUT local_blks_hit bigint, OUT local_blks_read bigint, OUT local_blks_dirtied bigint, OUT local_blks_written bigint, OUT temp_blks_read bigint, OUT temp_blks_written bigint, OUT shared_blk_read_time double precision, OUT shared_blk_write_time double precision, OUT local_blk_read_time double precision, OUT local_blk_write_time double precision, OUT temp_blk_read_time double precision, OUT temp_blk_write_time double precision, OUT wal_records bigint, OUT wal_fpi bigint, OUT wal_bytes numeric, OUT jit_functions bigint, OUT jit_generation_time double precision, OUT jit_inlining_count bigint, OUT jit_inlining_time double precision, OUT jit_optimization_count bigint, OUT jit_optimization_time double precision, OUT jit_emission_count bigint, OUT jit_emission_time double precision, OUT jit_deform_count bigint, OUT jit_deform_time double precision, OUT stats_since timestamp with time zone, OUT minmax_stats_since timestamp with time zone) TO dashboard_user;


--
-- Name: FUNCTION pg_stat_statements_info(OUT dealloc bigint, OUT stats_reset timestamp with time zone); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pg_stat_statements_info(OUT dealloc bigint, OUT stats_reset timestamp with time zone) FROM postgres;
GRANT ALL ON FUNCTION extensions.pg_stat_statements_info(OUT dealloc bigint, OUT stats_reset timestamp with time zone) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pg_stat_statements_info(OUT dealloc bigint, OUT stats_reset timestamp with time zone) TO dashboard_user;


--
-- Name: FUNCTION pg_stat_statements_reset(userid oid, dbid oid, queryid bigint, minmax_only boolean); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pg_stat_statements_reset(userid oid, dbid oid, queryid bigint, minmax_only boolean) FROM postgres;
GRANT ALL ON FUNCTION extensions.pg_stat_statements_reset(userid oid, dbid oid, queryid bigint, minmax_only boolean) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pg_stat_statements_reset(userid oid, dbid oid, queryid bigint, minmax_only boolean) TO dashboard_user;


--
-- Name: FUNCTION pgp_armor_headers(text, OUT key text, OUT value text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_armor_headers(text, OUT key text, OUT value text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_armor_headers(text, OUT key text, OUT value text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_armor_headers(text, OUT key text, OUT value text) TO dashboard_user;


--
-- Name: FUNCTION pgp_key_id(bytea); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_key_id(bytea) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_key_id(bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_key_id(bytea) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_decrypt(bytea, bytea); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_decrypt(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_decrypt(bytea, bytea, text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_decrypt_bytea(bytea, bytea); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_decrypt_bytea(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_decrypt_bytea(bytea, bytea, text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_encrypt(text, bytea); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_encrypt(text, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_encrypt_bytea(bytea, bytea); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_encrypt_bytea(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_sym_decrypt(bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_sym_decrypt(bytea, text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_sym_decrypt_bytea(bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_sym_decrypt_bytea(bytea, text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_sym_encrypt(text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_sym_encrypt(text, text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_sym_encrypt_bytea(bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_sym_encrypt_bytea(bytea, text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text, text) TO dashboard_user;


--
-- Name: FUNCTION pgrst_ddl_watch(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.pgrst_ddl_watch() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION pgrst_drop_watch(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.pgrst_drop_watch() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION set_graphql_placeholder(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.set_graphql_placeholder() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION uuid_generate_v1(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_generate_v1() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_generate_v1() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_generate_v1() TO dashboard_user;


--
-- Name: FUNCTION uuid_generate_v1mc(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_generate_v1mc() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_generate_v1mc() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_generate_v1mc() TO dashboard_user;


--
-- Name: FUNCTION uuid_generate_v3(namespace uuid, name text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_generate_v3(namespace uuid, name text) FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_generate_v3(namespace uuid, name text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_generate_v3(namespace uuid, name text) TO dashboard_user;


--
-- Name: FUNCTION uuid_generate_v4(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_generate_v4() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_generate_v4() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_generate_v4() TO dashboard_user;


--
-- Name: FUNCTION uuid_generate_v5(namespace uuid, name text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_generate_v5(namespace uuid, name text) FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_generate_v5(namespace uuid, name text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_generate_v5(namespace uuid, name text) TO dashboard_user;


--
-- Name: FUNCTION uuid_nil(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_nil() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_nil() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_nil() TO dashboard_user;


--
-- Name: FUNCTION uuid_ns_dns(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_ns_dns() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_ns_dns() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_ns_dns() TO dashboard_user;


--
-- Name: FUNCTION uuid_ns_oid(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_ns_oid() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_ns_oid() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_ns_oid() TO dashboard_user;


--
-- Name: FUNCTION uuid_ns_url(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_ns_url() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_ns_url() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_ns_url() TO dashboard_user;


--
-- Name: FUNCTION uuid_ns_x500(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_ns_x500() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_ns_x500() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_ns_x500() TO dashboard_user;


--
-- Name: FUNCTION graphql("operationName" text, query text, variables jsonb, extensions jsonb); Type: ACL; Schema: graphql_public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) TO postgres;
GRANT ALL ON FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) TO anon;
GRANT ALL ON FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) TO authenticated;
GRANT ALL ON FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) TO service_role;


--
-- Name: FUNCTION pg_reload_conf(); Type: ACL; Schema: pg_catalog; Owner: supabase_admin
--

GRANT ALL ON FUNCTION pg_catalog.pg_reload_conf() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION get_auth(p_usename text); Type: ACL; Schema: pgbouncer; Owner: supabase_admin
--

REVOKE ALL ON FUNCTION pgbouncer.get_auth(p_usename text) FROM PUBLIC;
GRANT ALL ON FUNCTION pgbouncer.get_auth(p_usename text) TO pgbouncer;


--
-- Name: FUNCTION admin_change_claim_status_with_audit_atomic(p_claim_id uuid, p_target_status_id uuid, p_reason text, p_confirmation text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.admin_change_claim_status_with_audit_atomic(p_claim_id uuid, p_target_status_id uuid, p_reason text, p_confirmation text) TO anon;
GRANT ALL ON FUNCTION public.admin_change_claim_status_with_audit_atomic(p_claim_id uuid, p_target_status_id uuid, p_reason text, p_confirmation text) TO authenticated;
GRANT ALL ON FUNCTION public.admin_change_claim_status_with_audit_atomic(p_claim_id uuid, p_target_status_id uuid, p_reason text, p_confirmation text) TO service_role;


--
-- Name: FUNCTION admin_create_employee_atomic(p_employee_id text, p_employee_name text, p_employee_email text, p_designation_id uuid, p_employee_status_id uuid, p_role_id uuid, p_state_id uuid, p_approval_employee_id_level_1 uuid, p_approval_employee_id_level_2 uuid, p_approval_employee_id_level_3 uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.admin_create_employee_atomic(p_employee_id text, p_employee_name text, p_employee_email text, p_designation_id uuid, p_employee_status_id uuid, p_role_id uuid, p_state_id uuid, p_approval_employee_id_level_1 uuid, p_approval_employee_id_level_2 uuid, p_approval_employee_id_level_3 uuid) TO anon;
GRANT ALL ON FUNCTION public.admin_create_employee_atomic(p_employee_id text, p_employee_name text, p_employee_email text, p_designation_id uuid, p_employee_status_id uuid, p_role_id uuid, p_state_id uuid, p_approval_employee_id_level_1 uuid, p_approval_employee_id_level_2 uuid, p_approval_employee_id_level_3 uuid) TO authenticated;
GRANT ALL ON FUNCTION public.admin_create_employee_atomic(p_employee_id text, p_employee_name text, p_employee_email text, p_designation_id uuid, p_employee_status_id uuid, p_role_id uuid, p_state_id uuid, p_approval_employee_id_level_1 uuid, p_approval_employee_id_level_2 uuid, p_approval_employee_id_level_3 uuid) TO service_role;


--
-- Name: FUNCTION admin_finalize_employee_replacement_atomic(p_old_employee_id uuid, p_new_employee_id uuid, p_reason text, p_confirmation text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.admin_finalize_employee_replacement_atomic(p_old_employee_id uuid, p_new_employee_id uuid, p_reason text, p_confirmation text) TO anon;
GRANT ALL ON FUNCTION public.admin_finalize_employee_replacement_atomic(p_old_employee_id uuid, p_new_employee_id uuid, p_reason text, p_confirmation text) TO authenticated;
GRANT ALL ON FUNCTION public.admin_finalize_employee_replacement_atomic(p_old_employee_id uuid, p_new_employee_id uuid, p_reason text, p_confirmation text) TO service_role;


--
-- Name: FUNCTION admin_prepare_employee_replacement_atomic(p_employee_id uuid, p_reason text, p_confirmation text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.admin_prepare_employee_replacement_atomic(p_employee_id uuid, p_reason text, p_confirmation text) TO anon;
GRANT ALL ON FUNCTION public.admin_prepare_employee_replacement_atomic(p_employee_id uuid, p_reason text, p_confirmation text) TO authenticated;
GRANT ALL ON FUNCTION public.admin_prepare_employee_replacement_atomic(p_employee_id uuid, p_reason text, p_confirmation text) TO service_role;


--
-- Name: FUNCTION admin_reassign_employee_approvers_atomic(p_employee_id uuid, p_level_1 text, p_level_2 text, p_level_3 text, p_reason text, p_confirmation text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.admin_reassign_employee_approvers_atomic(p_employee_id uuid, p_level_1 text, p_level_2 text, p_level_3 text, p_reason text, p_confirmation text) TO anon;
GRANT ALL ON FUNCTION public.admin_reassign_employee_approvers_atomic(p_employee_id uuid, p_level_1 text, p_level_2 text, p_level_3 text, p_reason text, p_confirmation text) TO authenticated;
GRANT ALL ON FUNCTION public.admin_reassign_employee_approvers_atomic(p_employee_id uuid, p_level_1 text, p_level_2 text, p_level_3 text, p_reason text, p_confirmation text) TO service_role;


--
-- Name: FUNCTION admin_reassign_employee_approvers_with_audit_atomic(p_employee_id uuid, p_level_1 text, p_level_2 text, p_level_3 text, p_reason text, p_confirmation text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.admin_reassign_employee_approvers_with_audit_atomic(p_employee_id uuid, p_level_1 text, p_level_2 text, p_level_3 text, p_reason text, p_confirmation text) TO anon;
GRANT ALL ON FUNCTION public.admin_reassign_employee_approvers_with_audit_atomic(p_employee_id uuid, p_level_1 text, p_level_2 text, p_level_3 text, p_reason text, p_confirmation text) TO authenticated;
GRANT ALL ON FUNCTION public.admin_reassign_employee_approvers_with_audit_atomic(p_employee_id uuid, p_level_1 text, p_level_2 text, p_level_3 text, p_reason text, p_confirmation text) TO service_role;


--
-- Name: FUNCTION admin_rollback_claim_atomic(p_claim_id uuid, p_reason text, p_confirmation text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.admin_rollback_claim_atomic(p_claim_id uuid, p_reason text, p_confirmation text) TO anon;
GRANT ALL ON FUNCTION public.admin_rollback_claim_atomic(p_claim_id uuid, p_reason text, p_confirmation text) TO authenticated;
GRANT ALL ON FUNCTION public.admin_rollback_claim_atomic(p_claim_id uuid, p_reason text, p_confirmation text) TO service_role;


--
-- Name: FUNCTION admin_toggle_designation_active_atomic(p_id uuid, p_is_active boolean); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.admin_toggle_designation_active_atomic(p_id uuid, p_is_active boolean) TO anon;
GRANT ALL ON FUNCTION public.admin_toggle_designation_active_atomic(p_id uuid, p_is_active boolean) TO authenticated;
GRANT ALL ON FUNCTION public.admin_toggle_designation_active_atomic(p_id uuid, p_is_active boolean) TO service_role;


--
-- Name: FUNCTION admin_toggle_expense_rate_active_atomic(p_id uuid, p_is_active boolean); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.admin_toggle_expense_rate_active_atomic(p_id uuid, p_is_active boolean) TO anon;
GRANT ALL ON FUNCTION public.admin_toggle_expense_rate_active_atomic(p_id uuid, p_is_active boolean) TO authenticated;
GRANT ALL ON FUNCTION public.admin_toggle_expense_rate_active_atomic(p_id uuid, p_is_active boolean) TO service_role;


--
-- Name: FUNCTION admin_toggle_vehicle_type_active_atomic(p_id uuid, p_is_active boolean); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.admin_toggle_vehicle_type_active_atomic(p_id uuid, p_is_active boolean) TO anon;
GRANT ALL ON FUNCTION public.admin_toggle_vehicle_type_active_atomic(p_id uuid, p_is_active boolean) TO authenticated;
GRANT ALL ON FUNCTION public.admin_toggle_vehicle_type_active_atomic(p_id uuid, p_is_active boolean) TO service_role;


--
-- Name: FUNCTION admin_toggle_work_location_active_atomic(p_id uuid, p_is_active boolean); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.admin_toggle_work_location_active_atomic(p_id uuid, p_is_active boolean) TO anon;
GRANT ALL ON FUNCTION public.admin_toggle_work_location_active_atomic(p_id uuid, p_is_active boolean) TO authenticated;
GRANT ALL ON FUNCTION public.admin_toggle_work_location_active_atomic(p_id uuid, p_is_active boolean) TO service_role;


--
-- Name: FUNCTION admin_update_expense_rate_amount_atomic(p_id uuid, p_rate_amount numeric); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.admin_update_expense_rate_amount_atomic(p_id uuid, p_rate_amount numeric) TO anon;
GRANT ALL ON FUNCTION public.admin_update_expense_rate_amount_atomic(p_id uuid, p_rate_amount numeric) TO authenticated;
GRANT ALL ON FUNCTION public.admin_update_expense_rate_amount_atomic(p_id uuid, p_rate_amount numeric) TO service_role;


--
-- Name: FUNCTION admin_update_vehicle_rates_atomic(p_id uuid, p_base_fuel_rate_per_day numeric, p_intercity_rate_per_km numeric, p_max_km_round_trip integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.admin_update_vehicle_rates_atomic(p_id uuid, p_base_fuel_rate_per_day numeric, p_intercity_rate_per_km numeric, p_max_km_round_trip integer) TO anon;
GRANT ALL ON FUNCTION public.admin_update_vehicle_rates_atomic(p_id uuid, p_base_fuel_rate_per_day numeric, p_intercity_rate_per_km numeric, p_max_km_round_trip integer) TO authenticated;
GRANT ALL ON FUNCTION public.admin_update_vehicle_rates_atomic(p_id uuid, p_base_fuel_rate_per_day numeric, p_intercity_rate_per_km numeric, p_max_km_round_trip integer) TO service_role;


--
-- Name: FUNCTION admin_upsert_approver_selection_rule_atomic(p_approval_level integer, p_designation_id uuid, p_requires_same_state boolean, p_is_active boolean); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.admin_upsert_approver_selection_rule_atomic(p_approval_level integer, p_designation_id uuid, p_requires_same_state boolean, p_is_active boolean) TO anon;
GRANT ALL ON FUNCTION public.admin_upsert_approver_selection_rule_atomic(p_approval_level integer, p_designation_id uuid, p_requires_same_state boolean, p_is_active boolean) TO authenticated;
GRANT ALL ON FUNCTION public.admin_upsert_approver_selection_rule_atomic(p_approval_level integer, p_designation_id uuid, p_requires_same_state boolean, p_is_active boolean) TO service_role;


--
-- Name: FUNCTION auth_user_has_elevated_role(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.auth_user_has_elevated_role() TO anon;
GRANT ALL ON FUNCTION public.auth_user_has_elevated_role() TO authenticated;
GRANT ALL ON FUNCTION public.auth_user_has_elevated_role() TO service_role;


--
-- Name: FUNCTION bulk_finance_actions_atomic(p_claim_ids uuid[], p_action text, p_notes text, p_allow_resubmit boolean); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.bulk_finance_actions_atomic(p_claim_ids uuid[], p_action text, p_notes text, p_allow_resubmit boolean) TO anon;
GRANT ALL ON FUNCTION public.bulk_finance_actions_atomic(p_claim_ids uuid[], p_action text, p_notes text, p_allow_resubmit boolean) TO authenticated;
GRANT ALL ON FUNCTION public.bulk_finance_actions_atomic(p_claim_ids uuid[], p_action text, p_notes text, p_allow_resubmit boolean) TO service_role;


--
-- Name: FUNCTION bulk_issue_claims_atomic(p_claim_ids uuid[], p_notes text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.bulk_issue_claims_atomic(p_claim_ids uuid[], p_notes text) TO anon;
GRANT ALL ON FUNCTION public.bulk_issue_claims_atomic(p_claim_ids uuid[], p_notes text) TO authenticated;
GRANT ALL ON FUNCTION public.bulk_issue_claims_atomic(p_claim_ids uuid[], p_notes text) TO service_role;


--
-- Name: FUNCTION bump_config_version_from_admin_log(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.bump_config_version_from_admin_log() TO anon;
GRANT ALL ON FUNCTION public.bump_config_version_from_admin_log() TO authenticated;
GRANT ALL ON FUNCTION public.bump_config_version_from_admin_log() TO service_role;


--
-- Name: FUNCTION capture_claim_config_snapshot_on_insert(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.capture_claim_config_snapshot_on_insert() TO anon;
GRANT ALL ON FUNCTION public.capture_claim_config_snapshot_on_insert() TO authenticated;
GRANT ALL ON FUNCTION public.capture_claim_config_snapshot_on_insert() TO service_role;


--
-- Name: FUNCTION current_user_email(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.current_user_email() TO anon;
GRANT ALL ON FUNCTION public.current_user_email() TO authenticated;
GRANT ALL ON FUNCTION public.current_user_email() TO service_role;


--
-- Name: FUNCTION generate_claim_number(p_employee_uuid uuid, p_claim_date date); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.generate_claim_number(p_employee_uuid uuid, p_claim_date date) TO anon;
GRANT ALL ON FUNCTION public.generate_claim_number(p_employee_uuid uuid, p_claim_date date) TO authenticated;
GRANT ALL ON FUNCTION public.generate_claim_number(p_employee_uuid uuid, p_claim_date date) TO service_role;


--
-- Name: FUNCTION get_admin_approver_options_by_state(p_state_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_admin_approver_options_by_state(p_state_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_admin_approver_options_by_state(p_state_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_admin_approver_options_by_state(p_state_id uuid) TO service_role;


--
-- Name: FUNCTION get_admin_dashboard_analytics(p_date_from date, p_date_to date, p_date_filter_field text, p_designation_id uuid, p_work_location_id uuid, p_state_id uuid, p_employee_id text, p_employee_name text, p_vehicle_code text, p_claim_status_id uuid, p_pending_only boolean, p_top_claims_limit integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_admin_dashboard_analytics(p_date_from date, p_date_to date, p_date_filter_field text, p_designation_id uuid, p_work_location_id uuid, p_state_id uuid, p_employee_id text, p_employee_name text, p_vehicle_code text, p_claim_status_id uuid, p_pending_only boolean, p_top_claims_limit integer) TO anon;
GRANT ALL ON FUNCTION public.get_admin_dashboard_analytics(p_date_from date, p_date_to date, p_date_filter_field text, p_designation_id uuid, p_work_location_id uuid, p_state_id uuid, p_employee_id text, p_employee_name text, p_vehicle_code text, p_claim_status_id uuid, p_pending_only boolean, p_top_claims_limit integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_admin_dashboard_analytics(p_date_from date, p_date_to date, p_date_filter_field text, p_designation_id uuid, p_work_location_id uuid, p_state_id uuid, p_employee_id text, p_employee_name text, p_vehicle_code text, p_claim_status_id uuid, p_pending_only boolean, p_top_claims_limit integer) TO service_role;


--
-- Name: FUNCTION get_admin_dashboard_analytics(p_date_from date, p_date_to date, p_claim_id text, p_date_filter_field text, p_designation_id uuid, p_work_location_id uuid, p_state_id uuid, p_employee_id text, p_employee_name text, p_vehicle_code text, p_claim_status_id uuid, p_pending_only boolean, p_top_claims_limit integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_admin_dashboard_analytics(p_date_from date, p_date_to date, p_claim_id text, p_date_filter_field text, p_designation_id uuid, p_work_location_id uuid, p_state_id uuid, p_employee_id text, p_employee_name text, p_vehicle_code text, p_claim_status_id uuid, p_pending_only boolean, p_top_claims_limit integer) TO anon;
GRANT ALL ON FUNCTION public.get_admin_dashboard_analytics(p_date_from date, p_date_to date, p_claim_id text, p_date_filter_field text, p_designation_id uuid, p_work_location_id uuid, p_state_id uuid, p_employee_id text, p_employee_name text, p_vehicle_code text, p_claim_status_id uuid, p_pending_only boolean, p_top_claims_limit integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_admin_dashboard_analytics(p_date_from date, p_date_to date, p_claim_id text, p_date_filter_field text, p_designation_id uuid, p_work_location_id uuid, p_state_id uuid, p_employee_id text, p_employee_name text, p_vehicle_code text, p_claim_status_id uuid, p_pending_only boolean, p_top_claims_limit integer) TO service_role;


--
-- Name: FUNCTION get_admin_finance_overview_metrics(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_admin_finance_overview_metrics() TO anon;
GRANT ALL ON FUNCTION public.get_admin_finance_overview_metrics() TO authenticated;
GRANT ALL ON FUNCTION public.get_admin_finance_overview_metrics() TO service_role;


--
-- Name: FUNCTION get_admin_summary_counts(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_admin_summary_counts() TO anon;
GRANT ALL ON FUNCTION public.get_admin_summary_counts() TO authenticated;
GRANT ALL ON FUNCTION public.get_admin_summary_counts() TO service_role;


--
-- Name: FUNCTION get_approval_employee_name_suggestions(p_name_search text, p_limit integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_approval_employee_name_suggestions(p_name_search text, p_limit integer) TO anon;
GRANT ALL ON FUNCTION public.get_approval_employee_name_suggestions(p_name_search text, p_limit integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_approval_employee_name_suggestions(p_name_search text, p_limit integer) TO service_role;


--
-- Name: FUNCTION get_claim_available_actions(p_claim_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_claim_available_actions(p_claim_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_claim_available_actions(p_claim_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_claim_available_actions(p_claim_id uuid) TO service_role;


--
-- Name: FUNCTION get_claim_available_actions_bulk(p_claim_ids uuid[]); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_claim_available_actions_bulk(p_claim_ids uuid[]) TO anon;
GRANT ALL ON FUNCTION public.get_claim_available_actions_bulk(p_claim_ids uuid[]) TO authenticated;
GRANT ALL ON FUNCTION public.get_claim_available_actions_bulk(p_claim_ids uuid[]) TO service_role;


--
-- Name: FUNCTION get_claim_bucket_metrics(p_claim_ids uuid[], p_pending_status_ids uuid[], p_approved_status_ids uuid[], p_rejected_status_ids uuid[]); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_claim_bucket_metrics(p_claim_ids uuid[], p_pending_status_ids uuid[], p_approved_status_ids uuid[], p_rejected_status_ids uuid[]) TO anon;
GRANT ALL ON FUNCTION public.get_claim_bucket_metrics(p_claim_ids uuid[], p_pending_status_ids uuid[], p_approved_status_ids uuid[], p_rejected_status_ids uuid[]) TO authenticated;
GRANT ALL ON FUNCTION public.get_claim_bucket_metrics(p_claim_ids uuid[], p_pending_status_ids uuid[], p_approved_status_ids uuid[], p_rejected_status_ids uuid[]) TO service_role;


--
-- Name: FUNCTION get_claim_status_id(p_code character varying); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_claim_status_id(p_code character varying) TO anon;
GRANT ALL ON FUNCTION public.get_claim_status_id(p_code character varying) TO authenticated;
GRANT ALL ON FUNCTION public.get_claim_status_id(p_code character varying) TO service_role;


--
-- Name: FUNCTION get_designation_id(p_code character varying); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_designation_id(p_code character varying) TO anon;
GRANT ALL ON FUNCTION public.get_designation_id(p_code character varying) TO authenticated;
GRANT ALL ON FUNCTION public.get_designation_id(p_code character varying) TO service_role;


--
-- Name: FUNCTION get_employee_claim_metrics(p_employee_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_employee_claim_metrics(p_employee_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_employee_claim_metrics(p_employee_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_employee_claim_metrics(p_employee_id uuid) TO service_role;


--
-- Name: FUNCTION get_filtered_approval_history(p_limit integer, p_cursor_acted_at timestamp with time zone, p_cursor_action_id uuid, p_name_search text, p_actor_filters text[], p_claim_status text, p_claim_status_id uuid, p_claim_allow_resubmit boolean, p_claim_date_from date, p_claim_date_to date, p_hod_approved_from timestamp with time zone, p_hod_approved_to timestamp with time zone, p_finance_approved_from timestamp with time zone, p_finance_approved_to timestamp with time zone); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_filtered_approval_history(p_limit integer, p_cursor_acted_at timestamp with time zone, p_cursor_action_id uuid, p_name_search text, p_actor_filters text[], p_claim_status text, p_claim_status_id uuid, p_claim_allow_resubmit boolean, p_claim_date_from date, p_claim_date_to date, p_hod_approved_from timestamp with time zone, p_hod_approved_to timestamp with time zone, p_finance_approved_from timestamp with time zone, p_finance_approved_to timestamp with time zone) TO anon;
GRANT ALL ON FUNCTION public.get_filtered_approval_history(p_limit integer, p_cursor_acted_at timestamp with time zone, p_cursor_action_id uuid, p_name_search text, p_actor_filters text[], p_claim_status text, p_claim_status_id uuid, p_claim_allow_resubmit boolean, p_claim_date_from date, p_claim_date_to date, p_hod_approved_from timestamp with time zone, p_hod_approved_to timestamp with time zone, p_finance_approved_from timestamp with time zone, p_finance_approved_to timestamp with time zone) TO authenticated;
GRANT ALL ON FUNCTION public.get_filtered_approval_history(p_limit integer, p_cursor_acted_at timestamp with time zone, p_cursor_action_id uuid, p_name_search text, p_actor_filters text[], p_claim_status text, p_claim_status_id uuid, p_claim_allow_resubmit boolean, p_claim_date_from date, p_claim_date_to date, p_hod_approved_from timestamp with time zone, p_hod_approved_to timestamp with time zone, p_finance_approved_from timestamp with time zone, p_finance_approved_to timestamp with time zone) TO service_role;


--
-- Name: FUNCTION get_filtered_approval_history(p_limit integer, p_cursor_acted_at timestamp with time zone, p_cursor_action_id uuid, p_name_search text, p_actor_filters text[], p_claim_status text, p_claim_status_id uuid, p_claim_allow_resubmit boolean, p_amount_operator text, p_amount_value numeric, p_location_type text, p_claim_date_from date, p_claim_date_to date, p_hod_approved_from timestamp with time zone, p_hod_approved_to timestamp with time zone, p_finance_approved_from timestamp with time zone, p_finance_approved_to timestamp with time zone); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_filtered_approval_history(p_limit integer, p_cursor_acted_at timestamp with time zone, p_cursor_action_id uuid, p_name_search text, p_actor_filters text[], p_claim_status text, p_claim_status_id uuid, p_claim_allow_resubmit boolean, p_amount_operator text, p_amount_value numeric, p_location_type text, p_claim_date_from date, p_claim_date_to date, p_hod_approved_from timestamp with time zone, p_hod_approved_to timestamp with time zone, p_finance_approved_from timestamp with time zone, p_finance_approved_to timestamp with time zone) TO anon;
GRANT ALL ON FUNCTION public.get_filtered_approval_history(p_limit integer, p_cursor_acted_at timestamp with time zone, p_cursor_action_id uuid, p_name_search text, p_actor_filters text[], p_claim_status text, p_claim_status_id uuid, p_claim_allow_resubmit boolean, p_amount_operator text, p_amount_value numeric, p_location_type text, p_claim_date_from date, p_claim_date_to date, p_hod_approved_from timestamp with time zone, p_hod_approved_to timestamp with time zone, p_finance_approved_from timestamp with time zone, p_finance_approved_to timestamp with time zone) TO authenticated;
GRANT ALL ON FUNCTION public.get_filtered_approval_history(p_limit integer, p_cursor_acted_at timestamp with time zone, p_cursor_action_id uuid, p_name_search text, p_actor_filters text[], p_claim_status text, p_claim_status_id uuid, p_claim_allow_resubmit boolean, p_amount_operator text, p_amount_value numeric, p_location_type text, p_claim_date_from date, p_claim_date_to date, p_hod_approved_from timestamp with time zone, p_hod_approved_to timestamp with time zone, p_finance_approved_from timestamp with time zone, p_finance_approved_to timestamp with time zone) TO service_role;


--
-- Name: FUNCTION get_filtered_approval_history_count(p_name_search text, p_actor_filters text[], p_claim_status text, p_claim_status_id uuid, p_claim_allow_resubmit boolean, p_amount_operator text, p_amount_value numeric, p_location_type text, p_claim_date_from date, p_claim_date_to date, p_hod_approved_from timestamp with time zone, p_hod_approved_to timestamp with time zone, p_finance_approved_from timestamp with time zone, p_finance_approved_to timestamp with time zone); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_filtered_approval_history_count(p_name_search text, p_actor_filters text[], p_claim_status text, p_claim_status_id uuid, p_claim_allow_resubmit boolean, p_amount_operator text, p_amount_value numeric, p_location_type text, p_claim_date_from date, p_claim_date_to date, p_hod_approved_from timestamp with time zone, p_hod_approved_to timestamp with time zone, p_finance_approved_from timestamp with time zone, p_finance_approved_to timestamp with time zone) TO anon;
GRANT ALL ON FUNCTION public.get_filtered_approval_history_count(p_name_search text, p_actor_filters text[], p_claim_status text, p_claim_status_id uuid, p_claim_allow_resubmit boolean, p_amount_operator text, p_amount_value numeric, p_location_type text, p_claim_date_from date, p_claim_date_to date, p_hod_approved_from timestamp with time zone, p_hod_approved_to timestamp with time zone, p_finance_approved_from timestamp with time zone, p_finance_approved_to timestamp with time zone) TO authenticated;
GRANT ALL ON FUNCTION public.get_filtered_approval_history_count(p_name_search text, p_actor_filters text[], p_claim_status text, p_claim_status_id uuid, p_claim_allow_resubmit boolean, p_amount_operator text, p_amount_value numeric, p_location_type text, p_claim_date_from date, p_claim_date_to date, p_hod_approved_from timestamp with time zone, p_hod_approved_to timestamp with time zone, p_finance_approved_from timestamp with time zone, p_finance_approved_to timestamp with time zone) TO service_role;


--
-- Name: FUNCTION get_finance_history_action_metrics(p_claim_ids uuid[], p_action_filter text, p_date_from timestamp with time zone, p_date_to timestamp with time zone, p_date_scoped_actions text[], p_approved_actions text[], p_rejected_actions text[]); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_finance_history_action_metrics(p_claim_ids uuid[], p_action_filter text, p_date_from timestamp with time zone, p_date_to timestamp with time zone, p_date_scoped_actions text[], p_approved_actions text[], p_rejected_actions text[]) TO anon;
GRANT ALL ON FUNCTION public.get_finance_history_action_metrics(p_claim_ids uuid[], p_action_filter text, p_date_from timestamp with time zone, p_date_to timestamp with time zone, p_date_scoped_actions text[], p_approved_actions text[], p_rejected_actions text[]) TO authenticated;
GRANT ALL ON FUNCTION public.get_finance_history_action_metrics(p_claim_ids uuid[], p_action_filter text, p_date_from timestamp with time zone, p_date_to timestamp with time zone, p_date_scoped_actions text[], p_approved_actions text[], p_rejected_actions text[]) TO service_role;


--
-- Name: FUNCTION get_finance_pending_dashboard_analytics(p_date_from date, p_date_to date, p_designation_id uuid, p_work_location_id uuid, p_state_id uuid, p_employee_id text, p_employee_name text, p_vehicle_code text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_finance_pending_dashboard_analytics(p_date_from date, p_date_to date, p_designation_id uuid, p_work_location_id uuid, p_state_id uuid, p_employee_id text, p_employee_name text, p_vehicle_code text) TO anon;
GRANT ALL ON FUNCTION public.get_finance_pending_dashboard_analytics(p_date_from date, p_date_to date, p_designation_id uuid, p_work_location_id uuid, p_state_id uuid, p_employee_id text, p_employee_name text, p_vehicle_code text) TO authenticated;
GRANT ALL ON FUNCTION public.get_finance_pending_dashboard_analytics(p_date_from date, p_date_to date, p_designation_id uuid, p_work_location_id uuid, p_state_id uuid, p_employee_id text, p_employee_name text, p_vehicle_code text) TO service_role;


--
-- Name: FUNCTION get_finance_pending_dashboard_analytics(p_date_from date, p_date_to date, p_designation_id uuid, p_work_location_id uuid, p_state_id uuid, p_employee_id text, p_employee_name text, p_vehicle_code text, p_date_filter_field text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_finance_pending_dashboard_analytics(p_date_from date, p_date_to date, p_designation_id uuid, p_work_location_id uuid, p_state_id uuid, p_employee_id text, p_employee_name text, p_vehicle_code text, p_date_filter_field text) TO anon;
GRANT ALL ON FUNCTION public.get_finance_pending_dashboard_analytics(p_date_from date, p_date_to date, p_designation_id uuid, p_work_location_id uuid, p_state_id uuid, p_employee_id text, p_employee_name text, p_vehicle_code text, p_date_filter_field text) TO authenticated;
GRANT ALL ON FUNCTION public.get_finance_pending_dashboard_analytics(p_date_from date, p_date_to date, p_designation_id uuid, p_work_location_id uuid, p_state_id uuid, p_employee_id text, p_employee_name text, p_vehicle_code text, p_date_filter_field text) TO service_role;


--
-- Name: FUNCTION get_finance_pending_dashboard_analytics(p_date_from date, p_date_to date, p_claim_id text, p_designation_id uuid, p_work_location_id uuid, p_state_id uuid, p_employee_id text, p_employee_name text, p_vehicle_code text, p_date_filter_field text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_finance_pending_dashboard_analytics(p_date_from date, p_date_to date, p_claim_id text, p_designation_id uuid, p_work_location_id uuid, p_state_id uuid, p_employee_id text, p_employee_name text, p_vehicle_code text, p_date_filter_field text) TO anon;
GRANT ALL ON FUNCTION public.get_finance_pending_dashboard_analytics(p_date_from date, p_date_to date, p_claim_id text, p_designation_id uuid, p_work_location_id uuid, p_state_id uuid, p_employee_id text, p_employee_name text, p_vehicle_code text, p_date_filter_field text) TO authenticated;
GRANT ALL ON FUNCTION public.get_finance_pending_dashboard_analytics(p_date_from date, p_date_to date, p_claim_id text, p_designation_id uuid, p_work_location_id uuid, p_state_id uuid, p_employee_id text, p_employee_name text, p_vehicle_code text, p_date_filter_field text) TO service_role;


--
-- Name: FUNCTION get_finance_visible_status_ids(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.get_finance_visible_status_ids() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_finance_visible_status_ids() TO anon;
GRANT ALL ON FUNCTION public.get_finance_visible_status_ids() TO authenticated;
GRANT ALL ON FUNCTION public.get_finance_visible_status_ids() TO service_role;


--
-- Name: FUNCTION get_latest_finance_action_id(p_claim_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.get_latest_finance_action_id(p_claim_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_latest_finance_action_id(p_claim_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_latest_finance_action_id(p_claim_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_latest_finance_action_id(p_claim_id uuid) TO service_role;


--
-- Name: FUNCTION get_my_approver_acted_claim_ids(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_my_approver_acted_claim_ids() TO anon;
GRANT ALL ON FUNCTION public.get_my_approver_acted_claim_ids() TO authenticated;
GRANT ALL ON FUNCTION public.get_my_approver_acted_claim_ids() TO service_role;


--
-- Name: FUNCTION get_pending_approval_scope_summary(p_level1_employee_ids uuid[], p_level2_employee_ids uuid[], p_pending_status_ids uuid[], p_allow_resubmit boolean, p_employee_name text, p_claim_date_from date, p_claim_date_to date, p_amount_operator text, p_amount_value numeric, p_location_ids uuid[]); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_pending_approval_scope_summary(p_level1_employee_ids uuid[], p_level2_employee_ids uuid[], p_pending_status_ids uuid[], p_allow_resubmit boolean, p_employee_name text, p_claim_date_from date, p_claim_date_to date, p_amount_operator text, p_amount_value numeric, p_location_ids uuid[]) TO anon;
GRANT ALL ON FUNCTION public.get_pending_approval_scope_summary(p_level1_employee_ids uuid[], p_level2_employee_ids uuid[], p_pending_status_ids uuid[], p_allow_resubmit boolean, p_employee_name text, p_claim_date_from date, p_claim_date_to date, p_amount_operator text, p_amount_value numeric, p_location_ids uuid[]) TO authenticated;
GRANT ALL ON FUNCTION public.get_pending_approval_scope_summary(p_level1_employee_ids uuid[], p_level2_employee_ids uuid[], p_pending_status_ids uuid[], p_allow_resubmit boolean, p_employee_name text, p_claim_date_from date, p_claim_date_to date, p_amount_operator text, p_amount_value numeric, p_location_ids uuid[]) TO service_role;


--
-- Name: FUNCTION get_work_location_id(p_code character varying); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_work_location_id(p_code character varying) TO anon;
GRANT ALL ON FUNCTION public.get_work_location_id(p_code character varying) TO authenticated;
GRANT ALL ON FUNCTION public.get_work_location_id(p_code character varying) TO service_role;


--
-- Name: FUNCTION reassign_orphaned_approvals(p_old_approver_id uuid, p_new_approver_id uuid, p_admin_employee_id uuid, p_reason text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.reassign_orphaned_approvals(p_old_approver_id uuid, p_new_approver_id uuid, p_admin_employee_id uuid, p_reason text) TO anon;
GRANT ALL ON FUNCTION public.reassign_orphaned_approvals(p_old_approver_id uuid, p_new_approver_id uuid, p_admin_employee_id uuid, p_reason text) TO authenticated;
GRANT ALL ON FUNCTION public.reassign_orphaned_approvals(p_old_approver_id uuid, p_new_approver_id uuid, p_admin_employee_id uuid, p_reason text) TO service_role;


--
-- Name: FUNCTION require_admin_actor(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.require_admin_actor() TO anon;
GRANT ALL ON FUNCTION public.require_admin_actor() TO authenticated;
GRANT ALL ON FUNCTION public.require_admin_actor() TO service_role;


--
-- Name: FUNCTION require_finance_actor(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.require_finance_actor() TO anon;
GRANT ALL ON FUNCTION public.require_finance_actor() TO authenticated;
GRANT ALL ON FUNCTION public.require_finance_actor() TO service_role;


--
-- Name: FUNCTION resolve_claim_allow_resubmit_filter(p_claim_status_id uuid, p_claim_allow_resubmit boolean); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.resolve_claim_allow_resubmit_filter(p_claim_status_id uuid, p_claim_allow_resubmit boolean) TO anon;
GRANT ALL ON FUNCTION public.resolve_claim_allow_resubmit_filter(p_claim_status_id uuid, p_claim_allow_resubmit boolean) TO authenticated;
GRANT ALL ON FUNCTION public.resolve_claim_allow_resubmit_filter(p_claim_status_id uuid, p_claim_allow_resubmit boolean) TO service_role;


--
-- Name: FUNCTION resubmit_claim_after_rejection_atomic(p_claim_id uuid, p_notes text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.resubmit_claim_after_rejection_atomic(p_claim_id uuid, p_notes text) TO anon;
GRANT ALL ON FUNCTION public.resubmit_claim_after_rejection_atomic(p_claim_id uuid, p_notes text) TO authenticated;
GRANT ALL ON FUNCTION public.resubmit_claim_after_rejection_atomic(p_claim_id uuid, p_notes text) TO service_role;


--
-- Name: FUNCTION set_claim_number_before_insert(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.set_claim_number_before_insert() TO anon;
GRANT ALL ON FUNCTION public.set_claim_number_before_insert() TO authenticated;
GRANT ALL ON FUNCTION public.set_claim_number_before_insert() TO service_role;


--
-- Name: FUNCTION submit_approval_action_atomic(p_claim_id uuid, p_action text, p_notes text, p_allow_resubmit boolean); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.submit_approval_action_atomic(p_claim_id uuid, p_action text, p_notes text, p_allow_resubmit boolean) TO anon;
GRANT ALL ON FUNCTION public.submit_approval_action_atomic(p_claim_id uuid, p_action text, p_notes text, p_allow_resubmit boolean) TO authenticated;
GRANT ALL ON FUNCTION public.submit_approval_action_atomic(p_claim_id uuid, p_action text, p_notes text, p_allow_resubmit boolean) TO service_role;


--
-- Name: FUNCTION submit_finance_action_atomic(p_claim_id uuid, p_action text, p_notes text, p_allow_resubmit boolean); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.submit_finance_action_atomic(p_claim_id uuid, p_action text, p_notes text, p_allow_resubmit boolean) TO anon;
GRANT ALL ON FUNCTION public.submit_finance_action_atomic(p_claim_id uuid, p_action text, p_notes text, p_allow_resubmit boolean) TO authenticated;
GRANT ALL ON FUNCTION public.submit_finance_action_atomic(p_claim_id uuid, p_action text, p_notes text, p_allow_resubmit boolean) TO service_role;


--
-- Name: FUNCTION supersede_rejected_claim(p_claim_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.supersede_rejected_claim(p_claim_id uuid) TO anon;
GRANT ALL ON FUNCTION public.supersede_rejected_claim(p_claim_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.supersede_rejected_claim(p_claim_id uuid) TO service_role;


--
-- Name: FUNCTION update_updated_at_column(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_updated_at_column() TO anon;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO authenticated;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO service_role;


--
-- Name: FUNCTION apply_rls(wal jsonb, max_record_bytes integer); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO postgres;
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO anon;
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO authenticated;
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO service_role;
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO supabase_realtime_admin;


--
-- Name: FUNCTION broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text) TO postgres;
GRANT ALL ON FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text) TO dashboard_user;


--
-- Name: FUNCTION build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO postgres;
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO anon;
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO authenticated;
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO service_role;
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO supabase_realtime_admin;


--
-- Name: FUNCTION "cast"(val text, type_ regtype); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO postgres;
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO dashboard_user;
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO anon;
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO authenticated;
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO service_role;
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO supabase_realtime_admin;


--
-- Name: FUNCTION check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO postgres;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO anon;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO authenticated;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO service_role;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO supabase_realtime_admin;


--
-- Name: FUNCTION is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO postgres;
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO anon;
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO authenticated;
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO service_role;
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO supabase_realtime_admin;


--
-- Name: FUNCTION list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO postgres;
GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO anon;
GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO authenticated;
GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO service_role;
GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO supabase_realtime_admin;


--
-- Name: FUNCTION quote_wal2json(entity regclass); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO postgres;
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO anon;
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO authenticated;
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO service_role;
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO supabase_realtime_admin;


--
-- Name: FUNCTION send(payload jsonb, event text, topic text, private boolean); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean) TO postgres;
GRANT ALL ON FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean) TO dashboard_user;


--
-- Name: FUNCTION subscription_check_filters(); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO postgres;
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO dashboard_user;
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO anon;
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO authenticated;
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO service_role;
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO supabase_realtime_admin;


--
-- Name: FUNCTION to_regrole(role_name text); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO postgres;
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO anon;
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO authenticated;
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO service_role;
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO supabase_realtime_admin;


--
-- Name: FUNCTION topic(); Type: ACL; Schema: realtime; Owner: supabase_realtime_admin
--

GRANT ALL ON FUNCTION realtime.topic() TO postgres;
GRANT ALL ON FUNCTION realtime.topic() TO dashboard_user;


--
-- Name: FUNCTION _crypto_aead_det_decrypt(message bytea, additional bytea, key_id bigint, context bytea, nonce bytea); Type: ACL; Schema: vault; Owner: supabase_admin
--

GRANT ALL ON FUNCTION vault._crypto_aead_det_decrypt(message bytea, additional bytea, key_id bigint, context bytea, nonce bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION vault._crypto_aead_det_decrypt(message bytea, additional bytea, key_id bigint, context bytea, nonce bytea) TO service_role;


--
-- Name: FUNCTION create_secret(new_secret text, new_name text, new_description text, new_key_id uuid); Type: ACL; Schema: vault; Owner: supabase_admin
--

GRANT ALL ON FUNCTION vault.create_secret(new_secret text, new_name text, new_description text, new_key_id uuid) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION vault.create_secret(new_secret text, new_name text, new_description text, new_key_id uuid) TO service_role;


--
-- Name: FUNCTION update_secret(secret_id uuid, new_secret text, new_name text, new_description text, new_key_id uuid); Type: ACL; Schema: vault; Owner: supabase_admin
--

GRANT ALL ON FUNCTION vault.update_secret(secret_id uuid, new_secret text, new_name text, new_description text, new_key_id uuid) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION vault.update_secret(secret_id uuid, new_secret text, new_name text, new_description text, new_key_id uuid) TO service_role;


--
-- Name: TABLE audit_log_entries; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.audit_log_entries TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.audit_log_entries TO postgres;
GRANT SELECT ON TABLE auth.audit_log_entries TO postgres WITH GRANT OPTION;


--
-- Name: TABLE custom_oauth_providers; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.custom_oauth_providers TO postgres;
GRANT ALL ON TABLE auth.custom_oauth_providers TO dashboard_user;


--
-- Name: TABLE flow_state; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.flow_state TO postgres;
GRANT SELECT ON TABLE auth.flow_state TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.flow_state TO dashboard_user;


--
-- Name: TABLE identities; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.identities TO postgres;
GRANT SELECT ON TABLE auth.identities TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.identities TO dashboard_user;


--
-- Name: TABLE instances; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.instances TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.instances TO postgres;
GRANT SELECT ON TABLE auth.instances TO postgres WITH GRANT OPTION;


--
-- Name: TABLE mfa_amr_claims; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.mfa_amr_claims TO postgres;
GRANT SELECT ON TABLE auth.mfa_amr_claims TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.mfa_amr_claims TO dashboard_user;


--
-- Name: TABLE mfa_challenges; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.mfa_challenges TO postgres;
GRANT SELECT ON TABLE auth.mfa_challenges TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.mfa_challenges TO dashboard_user;


--
-- Name: TABLE mfa_factors; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.mfa_factors TO postgres;
GRANT SELECT ON TABLE auth.mfa_factors TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.mfa_factors TO dashboard_user;


--
-- Name: TABLE oauth_authorizations; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.oauth_authorizations TO postgres;
GRANT ALL ON TABLE auth.oauth_authorizations TO dashboard_user;


--
-- Name: TABLE oauth_client_states; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.oauth_client_states TO postgres;
GRANT ALL ON TABLE auth.oauth_client_states TO dashboard_user;


--
-- Name: TABLE oauth_clients; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.oauth_clients TO postgres;
GRANT ALL ON TABLE auth.oauth_clients TO dashboard_user;


--
-- Name: TABLE oauth_consents; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.oauth_consents TO postgres;
GRANT ALL ON TABLE auth.oauth_consents TO dashboard_user;


--
-- Name: TABLE one_time_tokens; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.one_time_tokens TO postgres;
GRANT SELECT ON TABLE auth.one_time_tokens TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.one_time_tokens TO dashboard_user;


--
-- Name: TABLE refresh_tokens; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.refresh_tokens TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.refresh_tokens TO postgres;
GRANT SELECT ON TABLE auth.refresh_tokens TO postgres WITH GRANT OPTION;


--
-- Name: SEQUENCE refresh_tokens_id_seq; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON SEQUENCE auth.refresh_tokens_id_seq TO dashboard_user;
GRANT ALL ON SEQUENCE auth.refresh_tokens_id_seq TO postgres;


--
-- Name: TABLE saml_providers; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.saml_providers TO postgres;
GRANT SELECT ON TABLE auth.saml_providers TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.saml_providers TO dashboard_user;


--
-- Name: TABLE saml_relay_states; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.saml_relay_states TO postgres;
GRANT SELECT ON TABLE auth.saml_relay_states TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.saml_relay_states TO dashboard_user;


--
-- Name: TABLE schema_migrations; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT SELECT ON TABLE auth.schema_migrations TO postgres WITH GRANT OPTION;


--
-- Name: TABLE sessions; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.sessions TO postgres;
GRANT SELECT ON TABLE auth.sessions TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.sessions TO dashboard_user;


--
-- Name: TABLE sso_domains; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.sso_domains TO postgres;
GRANT SELECT ON TABLE auth.sso_domains TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.sso_domains TO dashboard_user;


--
-- Name: TABLE sso_providers; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.sso_providers TO postgres;
GRANT SELECT ON TABLE auth.sso_providers TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.sso_providers TO dashboard_user;


--
-- Name: TABLE users; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.users TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.users TO postgres;
GRANT SELECT ON TABLE auth.users TO postgres WITH GRANT OPTION;


--
-- Name: TABLE webauthn_challenges; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.webauthn_challenges TO postgres;
GRANT ALL ON TABLE auth.webauthn_challenges TO dashboard_user;


--
-- Name: TABLE webauthn_credentials; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.webauthn_credentials TO postgres;
GRANT ALL ON TABLE auth.webauthn_credentials TO dashboard_user;


--
-- Name: TABLE pg_stat_statements; Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON TABLE extensions.pg_stat_statements FROM postgres;
GRANT ALL ON TABLE extensions.pg_stat_statements TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE extensions.pg_stat_statements TO dashboard_user;


--
-- Name: TABLE pg_stat_statements_info; Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON TABLE extensions.pg_stat_statements_info FROM postgres;
GRANT ALL ON TABLE extensions.pg_stat_statements_info TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE extensions.pg_stat_statements_info TO dashboard_user;


--
-- Name: TABLE _backup_approval_history; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public._backup_approval_history TO anon;
GRANT ALL ON TABLE public._backup_approval_history TO authenticated;
GRANT ALL ON TABLE public._backup_approval_history TO service_role;


--
-- Name: TABLE _backup_expense_claim_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public._backup_expense_claim_items TO anon;
GRANT ALL ON TABLE public._backup_expense_claim_items TO authenticated;
GRANT ALL ON TABLE public._backup_expense_claim_items TO service_role;


--
-- Name: TABLE _backup_expense_claims; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public._backup_expense_claims TO anon;
GRANT ALL ON TABLE public._backup_expense_claims TO authenticated;
GRANT ALL ON TABLE public._backup_expense_claims TO service_role;


--
-- Name: TABLE _backup_finance_actions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public._backup_finance_actions TO anon;
GRANT ALL ON TABLE public._backup_finance_actions TO authenticated;
GRANT ALL ON TABLE public._backup_finance_actions TO service_role;


--
-- Name: TABLE _migration_history; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public._migration_history TO anon;
GRANT ALL ON TABLE public._migration_history TO authenticated;
GRANT ALL ON TABLE public._migration_history TO service_role;


--
-- Name: TABLE admin_logs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.admin_logs TO anon;
GRANT ALL ON TABLE public.admin_logs TO authenticated;
GRANT ALL ON TABLE public.admin_logs TO service_role;


--
-- Name: TABLE allowed_email_domains; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.allowed_email_domains TO anon;
GRANT ALL ON TABLE public.allowed_email_domains TO authenticated;
GRANT ALL ON TABLE public.allowed_email_domains TO service_role;


--
-- Name: TABLE approval_history; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.approval_history TO anon;
GRANT ALL ON TABLE public.approval_history TO authenticated;
GRANT ALL ON TABLE public.approval_history TO service_role;


--
-- Name: TABLE approval_routing; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.approval_routing TO anon;
GRANT ALL ON TABLE public.approval_routing TO authenticated;
GRANT ALL ON TABLE public.approval_routing TO service_role;


--
-- Name: TABLE approver_selection_rules; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.approver_selection_rules TO anon;
GRANT ALL ON TABLE public.approver_selection_rules TO authenticated;
GRANT ALL ON TABLE public.approver_selection_rules TO service_role;


--
-- Name: TABLE archive_claim_expenses; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.archive_claim_expenses TO anon;
GRANT ALL ON TABLE public.archive_claim_expenses TO authenticated;
GRANT ALL ON TABLE public.archive_claim_expenses TO service_role;


--
-- Name: TABLE archive_claim_status_audit; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.archive_claim_status_audit TO anon;
GRANT ALL ON TABLE public.archive_claim_status_audit TO authenticated;
GRANT ALL ON TABLE public.archive_claim_status_audit TO service_role;


--
-- Name: TABLE base_location_day_types; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.base_location_day_types TO anon;
GRANT ALL ON TABLE public.base_location_day_types TO authenticated;
GRANT ALL ON TABLE public.base_location_day_types TO service_role;


--
-- Name: TABLE cities; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.cities TO anon;
GRANT ALL ON TABLE public.cities TO authenticated;
GRANT ALL ON TABLE public.cities TO service_role;


--
-- Name: TABLE claim_config_snapshots; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.claim_config_snapshots TO anon;
GRANT ALL ON TABLE public.claim_config_snapshots TO authenticated;
GRANT ALL ON TABLE public.claim_config_snapshots TO service_role;


--
-- Name: SEQUENCE claim_number_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.claim_number_seq TO anon;
GRANT ALL ON SEQUENCE public.claim_number_seq TO authenticated;
GRANT ALL ON SEQUENCE public.claim_number_seq TO service_role;


--
-- Name: TABLE claim_status_transitions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.claim_status_transitions TO anon;
GRANT ALL ON TABLE public.claim_status_transitions TO authenticated;
GRANT ALL ON TABLE public.claim_status_transitions TO service_role;


--
-- Name: TABLE claim_statuses; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.claim_statuses TO anon;
GRANT ALL ON TABLE public.claim_statuses TO authenticated;
GRANT ALL ON TABLE public.claim_statuses TO service_role;


--
-- Name: TABLE config_versions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.config_versions TO anon;
GRANT ALL ON TABLE public.config_versions TO authenticated;
GRANT ALL ON TABLE public.config_versions TO service_role;


--
-- Name: SEQUENCE config_versions_version_number_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.config_versions_version_number_seq TO anon;
GRANT ALL ON SEQUENCE public.config_versions_version_number_seq TO authenticated;
GRANT ALL ON SEQUENCE public.config_versions_version_number_seq TO service_role;


--
-- Name: TABLE designation_approval_flow; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.designation_approval_flow TO anon;
GRANT ALL ON TABLE public.designation_approval_flow TO authenticated;
GRANT ALL ON TABLE public.designation_approval_flow TO service_role;


--
-- Name: TABLE designation_vehicle_permissions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.designation_vehicle_permissions TO anon;
GRANT ALL ON TABLE public.designation_vehicle_permissions TO authenticated;
GRANT ALL ON TABLE public.designation_vehicle_permissions TO service_role;


--
-- Name: TABLE designations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.designations TO anon;
GRANT ALL ON TABLE public.designations TO authenticated;
GRANT ALL ON TABLE public.designations TO service_role;


--
-- Name: TABLE employee_replacements; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.employee_replacements TO anon;
GRANT ALL ON TABLE public.employee_replacements TO authenticated;
GRANT ALL ON TABLE public.employee_replacements TO service_role;


--
-- Name: TABLE employee_roles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.employee_roles TO anon;
GRANT ALL ON TABLE public.employee_roles TO authenticated;
GRANT ALL ON TABLE public.employee_roles TO service_role;


--
-- Name: TABLE employee_states; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.employee_states TO anon;
GRANT ALL ON TABLE public.employee_states TO authenticated;
GRANT ALL ON TABLE public.employee_states TO service_role;


--
-- Name: TABLE employee_statuses; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.employee_statuses TO anon;
GRANT ALL ON TABLE public.employee_statuses TO authenticated;
GRANT ALL ON TABLE public.employee_statuses TO service_role;


--
-- Name: TABLE employees; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.employees TO anon;
GRANT ALL ON TABLE public.employees TO authenticated;
GRANT ALL ON TABLE public.employees TO service_role;


--
-- Name: TABLE expense_claim_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.expense_claim_items TO anon;
GRANT ALL ON TABLE public.expense_claim_items TO authenticated;
GRANT ALL ON TABLE public.expense_claim_items TO service_role;


--
-- Name: TABLE expense_claims; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.expense_claims TO anon;
GRANT ALL ON TABLE public.expense_claims TO authenticated;
GRANT ALL ON TABLE public.expense_claims TO service_role;


--
-- Name: TABLE expense_rates; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.expense_rates TO anon;
GRANT ALL ON TABLE public.expense_rates TO authenticated;
GRANT ALL ON TABLE public.expense_rates TO service_role;


--
-- Name: TABLE expense_reimbursement_rates; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.expense_reimbursement_rates TO anon;
GRANT ALL ON TABLE public.expense_reimbursement_rates TO authenticated;
GRANT ALL ON TABLE public.expense_reimbursement_rates TO service_role;


--
-- Name: TABLE finance_actions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.finance_actions TO anon;
GRANT ALL ON TABLE public.finance_actions TO authenticated;
GRANT ALL ON TABLE public.finance_actions TO service_role;


--
-- Name: TABLE roles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.roles TO anon;
GRANT ALL ON TABLE public.roles TO authenticated;
GRANT ALL ON TABLE public.roles TO service_role;


--
-- Name: TABLE states; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.states TO anon;
GRANT ALL ON TABLE public.states TO authenticated;
GRANT ALL ON TABLE public.states TO service_role;


--
-- Name: TABLE system_settings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.system_settings TO anon;
GRANT ALL ON TABLE public.system_settings TO authenticated;
GRANT ALL ON TABLE public.system_settings TO service_role;


--
-- Name: TABLE validation_rules; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.validation_rules TO anon;
GRANT ALL ON TABLE public.validation_rules TO authenticated;
GRANT ALL ON TABLE public.validation_rules TO service_role;


--
-- Name: TABLE vehicle_types; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.vehicle_types TO anon;
GRANT ALL ON TABLE public.vehicle_types TO authenticated;
GRANT ALL ON TABLE public.vehicle_types TO service_role;


--
-- Name: TABLE work_locations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.work_locations TO anon;
GRANT ALL ON TABLE public.work_locations TO authenticated;
GRANT ALL ON TABLE public.work_locations TO service_role;


--
-- Name: TABLE messages; Type: ACL; Schema: realtime; Owner: supabase_realtime_admin
--

GRANT ALL ON TABLE realtime.messages TO postgres;
GRANT ALL ON TABLE realtime.messages TO dashboard_user;
GRANT SELECT,INSERT,UPDATE ON TABLE realtime.messages TO anon;
GRANT SELECT,INSERT,UPDATE ON TABLE realtime.messages TO authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE realtime.messages TO service_role;


--
-- Name: TABLE schema_migrations; Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON TABLE realtime.schema_migrations TO postgres;
GRANT ALL ON TABLE realtime.schema_migrations TO dashboard_user;
GRANT SELECT ON TABLE realtime.schema_migrations TO anon;
GRANT SELECT ON TABLE realtime.schema_migrations TO authenticated;
GRANT SELECT ON TABLE realtime.schema_migrations TO service_role;
GRANT ALL ON TABLE realtime.schema_migrations TO supabase_realtime_admin;


--
-- Name: TABLE subscription; Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON TABLE realtime.subscription TO postgres;
GRANT ALL ON TABLE realtime.subscription TO dashboard_user;
GRANT SELECT ON TABLE realtime.subscription TO anon;
GRANT SELECT ON TABLE realtime.subscription TO authenticated;
GRANT SELECT ON TABLE realtime.subscription TO service_role;
GRANT ALL ON TABLE realtime.subscription TO supabase_realtime_admin;


--
-- Name: SEQUENCE subscription_id_seq; Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON SEQUENCE realtime.subscription_id_seq TO postgres;
GRANT ALL ON SEQUENCE realtime.subscription_id_seq TO dashboard_user;
GRANT USAGE ON SEQUENCE realtime.subscription_id_seq TO anon;
GRANT USAGE ON SEQUENCE realtime.subscription_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE realtime.subscription_id_seq TO service_role;
GRANT ALL ON SEQUENCE realtime.subscription_id_seq TO supabase_realtime_admin;


--
-- Name: TABLE buckets; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

REVOKE ALL ON TABLE storage.buckets FROM supabase_storage_admin;
GRANT ALL ON TABLE storage.buckets TO supabase_storage_admin WITH GRANT OPTION;
GRANT ALL ON TABLE storage.buckets TO service_role;
GRANT ALL ON TABLE storage.buckets TO authenticated;
GRANT ALL ON TABLE storage.buckets TO anon;
GRANT ALL ON TABLE storage.buckets TO postgres WITH GRANT OPTION;


--
-- Name: TABLE buckets_analytics; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

GRANT ALL ON TABLE storage.buckets_analytics TO service_role;
GRANT ALL ON TABLE storage.buckets_analytics TO authenticated;
GRANT ALL ON TABLE storage.buckets_analytics TO anon;


--
-- Name: TABLE buckets_vectors; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

GRANT SELECT ON TABLE storage.buckets_vectors TO service_role;
GRANT SELECT ON TABLE storage.buckets_vectors TO authenticated;
GRANT SELECT ON TABLE storage.buckets_vectors TO anon;


--
-- Name: TABLE objects; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

REVOKE ALL ON TABLE storage.objects FROM supabase_storage_admin;
GRANT ALL ON TABLE storage.objects TO supabase_storage_admin WITH GRANT OPTION;
GRANT ALL ON TABLE storage.objects TO service_role;
GRANT ALL ON TABLE storage.objects TO authenticated;
GRANT ALL ON TABLE storage.objects TO anon;
GRANT ALL ON TABLE storage.objects TO postgres WITH GRANT OPTION;


--
-- Name: TABLE s3_multipart_uploads; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

GRANT ALL ON TABLE storage.s3_multipart_uploads TO service_role;
GRANT SELECT ON TABLE storage.s3_multipart_uploads TO authenticated;
GRANT SELECT ON TABLE storage.s3_multipart_uploads TO anon;


--
-- Name: TABLE s3_multipart_uploads_parts; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

GRANT ALL ON TABLE storage.s3_multipart_uploads_parts TO service_role;
GRANT SELECT ON TABLE storage.s3_multipart_uploads_parts TO authenticated;
GRANT SELECT ON TABLE storage.s3_multipart_uploads_parts TO anon;


--
-- Name: TABLE vector_indexes; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

GRANT SELECT ON TABLE storage.vector_indexes TO service_role;
GRANT SELECT ON TABLE storage.vector_indexes TO authenticated;
GRANT SELECT ON TABLE storage.vector_indexes TO anon;


--
-- Name: TABLE secrets; Type: ACL; Schema: vault; Owner: supabase_admin
--

GRANT SELECT,REFERENCES,DELETE,TRUNCATE ON TABLE vault.secrets TO postgres WITH GRANT OPTION;
GRANT SELECT,DELETE ON TABLE vault.secrets TO service_role;


--
-- Name: TABLE decrypted_secrets; Type: ACL; Schema: vault; Owner: supabase_admin
--

GRANT SELECT,REFERENCES,DELETE,TRUNCATE ON TABLE vault.decrypted_secrets TO postgres WITH GRANT OPTION;
GRANT SELECT,DELETE ON TABLE vault.decrypted_secrets TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: auth; Owner: supabase_auth_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON SEQUENCES TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: auth; Owner: supabase_auth_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON FUNCTIONS TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: auth; Owner: supabase_auth_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON TABLES TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: extensions; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA extensions GRANT ALL ON SEQUENCES TO postgres WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: extensions; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA extensions GRANT ALL ON FUNCTIONS TO postgres WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: extensions; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA extensions GRANT ALL ON TABLES TO postgres WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: graphql; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: graphql; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: graphql; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: graphql_public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: graphql_public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: graphql_public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: realtime; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON SEQUENCES TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: realtime; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON FUNCTIONS TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: realtime; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON TABLES TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: storage; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: storage; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: storage; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON TABLES TO service_role;


--
-- Name: issue_graphql_placeholder; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

CREATE EVENT TRIGGER issue_graphql_placeholder ON sql_drop
         WHEN TAG IN ('DROP EXTENSION')
   EXECUTE FUNCTION extensions.set_graphql_placeholder();


ALTER EVENT TRIGGER issue_graphql_placeholder OWNER TO supabase_admin;

--
-- Name: issue_pg_cron_access; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

CREATE EVENT TRIGGER issue_pg_cron_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_cron_access();


ALTER EVENT TRIGGER issue_pg_cron_access OWNER TO supabase_admin;

--
-- Name: issue_pg_graphql_access; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

CREATE EVENT TRIGGER issue_pg_graphql_access ON ddl_command_end
         WHEN TAG IN ('CREATE FUNCTION')
   EXECUTE FUNCTION extensions.grant_pg_graphql_access();


ALTER EVENT TRIGGER issue_pg_graphql_access OWNER TO supabase_admin;

--
-- Name: issue_pg_net_access; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

CREATE EVENT TRIGGER issue_pg_net_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_net_access();


ALTER EVENT TRIGGER issue_pg_net_access OWNER TO supabase_admin;

--
-- Name: pgrst_ddl_watch; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

CREATE EVENT TRIGGER pgrst_ddl_watch ON ddl_command_end
   EXECUTE FUNCTION extensions.pgrst_ddl_watch();


ALTER EVENT TRIGGER pgrst_ddl_watch OWNER TO supabase_admin;

--
-- Name: pgrst_drop_watch; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

CREATE EVENT TRIGGER pgrst_drop_watch ON sql_drop
   EXECUTE FUNCTION extensions.pgrst_drop_watch();


ALTER EVENT TRIGGER pgrst_drop_watch OWNER TO supabase_admin;

--
-- PostgreSQL database dump complete
--

\unrestrict 2mw4gXOJ0ls3c94dO89VsBwppVn7rqyhYsrDcFgW3yUK7xTyAaNV7hklME5IfWb

