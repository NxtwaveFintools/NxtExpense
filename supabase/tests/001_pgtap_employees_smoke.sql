-- Simple pgTAP smoke test for a core table contract.
-- Run in a writable DB context (for example: supabase test db).
-- If pgTAP is not installed in your target DB, enable it first:
-- create extension if not exists pgtap with schema extensions;

begin;
set local search_path = public, extensions;

select plan(3);

select has_table('public', 'employees', 'public.employees table should exist');
select has_column('public', 'employees', 'id', 'public.employees.id column should exist');
select col_is_pk('public', 'employees', array['id'], 'public.employees.id should be the primary key');

select * from finish();
rollback;
