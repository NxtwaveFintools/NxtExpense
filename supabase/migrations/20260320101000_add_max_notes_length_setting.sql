-- Add configurable max notes length used by approval/finance/admin actions.

INSERT INTO system_settings (
  setting_key,
  setting_value,
  setting_description,
  data_type,
  is_active
)
VALUES (
  'MAX_NOTES_LENGTH',
  '{"value": 500}'::jsonb,
  'Maximum length for notes/reason fields in workflow actions',
  'number',
  true
)
ON CONFLICT (setting_key)
DO UPDATE SET
  setting_value = EXCLUDED.setting_value,
  setting_description = EXCLUDED.setting_description,
  data_type = EXCLUDED.data_type,
  is_active = true,
  updated_at = NOW();
