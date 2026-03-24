-- Fix work_locations.location_name to use hyphens instead of em dashes
-- Matches existing expense_claims.work_location text values
UPDATE work_locations 
SET location_name = REPLACE(location_name, '–', '-')
WHERE location_name LIKE '%–%';
