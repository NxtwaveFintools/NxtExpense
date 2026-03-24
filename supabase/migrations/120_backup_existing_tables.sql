-- Migration 120: Backup existing tables before Phase 4 data migration
-- Safety: Create full backups of all tables being modified

-- Backup expense_claims
CREATE TABLE IF NOT EXISTS _backup_expense_claims AS 
SELECT * FROM expense_claims;

-- Backup approval_history
CREATE TABLE IF NOT EXISTS _backup_approval_history AS 
SELECT * FROM approval_history;

-- Backup finance_actions
CREATE TABLE IF NOT EXISTS _backup_finance_actions AS 
SELECT * FROM finance_actions;

-- Backup expense_claim_items
CREATE TABLE IF NOT EXISTS _backup_expense_claim_items AS 
SELECT * FROM expense_claim_items;

-- Verify row counts match
DO $$
DECLARE
  ec_orig INT; ec_bak INT;
  ah_orig INT; ah_bak INT;
  fa_orig INT; fa_bak INT;
  eci_orig INT; eci_bak INT;
BEGIN
  SELECT count(*) INTO ec_orig FROM expense_claims;
  SELECT count(*) INTO ec_bak FROM _backup_expense_claims;
  SELECT count(*) INTO ah_orig FROM approval_history;
  SELECT count(*) INTO ah_bak FROM _backup_approval_history;
  SELECT count(*) INTO fa_orig FROM finance_actions;
  SELECT count(*) INTO fa_bak FROM _backup_finance_actions;
  SELECT count(*) INTO eci_orig FROM expense_claim_items;
  SELECT count(*) INTO eci_bak FROM _backup_expense_claim_items;
  
  IF ec_orig != ec_bak THEN RAISE EXCEPTION 'expense_claims backup mismatch: % vs %', ec_orig, ec_bak; END IF;
  IF ah_orig != ah_bak THEN RAISE EXCEPTION 'approval_history backup mismatch: % vs %', ah_orig, ah_bak; END IF;
  IF fa_orig != fa_bak THEN RAISE EXCEPTION 'finance_actions backup mismatch: % vs %', fa_orig, fa_bak; END IF;
  IF eci_orig != eci_bak THEN RAISE EXCEPTION 'expense_claim_items backup mismatch: % vs %', eci_orig, eci_bak; END IF;
  
  RAISE NOTICE 'All backups verified: expense_claims=%, approval_history=%, finance_actions=%, expense_claim_items=%', 
    ec_orig, ah_orig, fa_orig, eci_orig;
END $$;
