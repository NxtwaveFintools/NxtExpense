-- ROLLBACK for 20260723130000_hierarchy_fix_sparsh_rj_approver.sql
--
-- ⚠ This deliberately does NOT restore the defect. The forward migration
-- corrected a mis-wired approver; reinstating "Sparsh Gupta reports to the
-- Maharashtra SBH" would put a Rajasthan ABH's claims back on the wrong state's
-- approval queue. There is no state of the system in which that is the desired
-- resting point.
--
-- Sparsh is created by the Phase 2 migration and pointed at Arka there, so
-- rolling Phase 2 back removes him entirely — which is the only meaningful way
-- to undo this. That is handled by the Phase 2 rollback script.
--
-- All this script does is drop the config_versions marker, so the correction can
-- be re-applied cleanly if Phase 2 is re-run.

DO $$
BEGIN
  RAISE NOTICE
    'No approver change is reverted: restoring the Maharashtra mis-wiring is never correct. Roll back Phase 2 to remove Sparsh Gupta entirely.';
END $$;

DELETE FROM public.config_versions
WHERE change_scope = 'employee_hierarchy'
  AND change_summary LIKE 'Hierarchy changes 2026-07 correction (Sparsh Gupta):%'
  AND NOT EXISTS (
    SELECT 1 FROM public.claim_config_snapshots s
    WHERE s.config_version_id = config_versions.id
  );
