BEGIN;

UPDATE public.claim_statuses
SET status_name = 'Payment Issued',
    status_description = 'Claim approved and payment issued to employee'
WHERE status_code = 'APPROVED';

COMMIT;
