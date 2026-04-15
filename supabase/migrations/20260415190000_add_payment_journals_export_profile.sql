BEGIN;

ALTER TABLE public.finance_export_profiles
  ADD COLUMN IF NOT EXISTS document_type varchar(100),
  ADD COLUMN IF NOT EXISTS cash_flow_options varchar(200),
  ADD COLUMN IF NOT EXISTS type_of_payment varchar(200),
  ADD COLUMN IF NOT EXISTS description varchar(200),
  ADD COLUMN IF NOT EXISTS payment_method_code varchar(40),
  ADD COLUMN IF NOT EXISTS bal_account_no varchar(100);

INSERT INTO public.finance_export_profiles (
  profile_code,
  account_type,
  employee_transaction_type,
  bal_account_type,
  default_document_no,
  program_code,
  sub_product_code,
  responsible_dep_code,
  beneficiary_dep_code,
  document_type,
  cash_flow_options,
  type_of_payment,
  description,
  payment_method_code,
  bal_account_no
)
VALUES (
  'PAYMENT_JOURNALS',
  'Employee',
  'ADVANCE',
  'Bank Account',
  '',
  'NIAT',
  'NIAT362',
  'PRE-SALES',
  'PRE-SALES',
  'Payment',
  'Petty cash & Reimbursements',
  '100% Payment after Service / Goods delivery',
  'Reimbursements',
  'IMPS',
  'IDFC 2012'
)
ON CONFLICT (profile_code)
DO UPDATE SET
  account_type = EXCLUDED.account_type,
  employee_transaction_type = EXCLUDED.employee_transaction_type,
  bal_account_type = EXCLUDED.bal_account_type,
  default_document_no = EXCLUDED.default_document_no,
  program_code = EXCLUDED.program_code,
  sub_product_code = EXCLUDED.sub_product_code,
  responsible_dep_code = EXCLUDED.responsible_dep_code,
  beneficiary_dep_code = EXCLUDED.beneficiary_dep_code,
  document_type = EXCLUDED.document_type,
  cash_flow_options = EXCLUDED.cash_flow_options,
  type_of_payment = EXCLUDED.type_of_payment,
  description = EXCLUDED.description,
  payment_method_code = EXCLUDED.payment_method_code,
  bal_account_no = EXCLUDED.bal_account_no,
  is_active = true,
  updated_at = now();

COMMIT;
