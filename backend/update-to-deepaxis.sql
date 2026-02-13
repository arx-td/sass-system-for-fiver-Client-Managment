-- Migration: Update CodeReve references to DEEPAXIS in live database
-- Run this on your production database to update existing records

-- Update admin user email and name
UPDATE "users"
SET email = 'admin@deepaxis.com', name = 'DEEPAXIS Admin'
WHERE email = 'admin@codereve.com';

-- Update any other users with @codereve.com emails
UPDATE "users" SET email = REPLACE(email, '@codereve.com', '@deepaxis.com') WHERE email LIKE '%@codereve.com';

-- Update Fiverr account names
UPDATE "fiverr_accounts" SET account_name = REPLACE(account_name, 'CodeReve', 'DEEPAXIS') WHERE account_name LIKE '%CodeReve%';
UPDATE "fiverr_accounts" SET account_email = REPLACE(account_email, '@codereve.com', '@deepaxis.com') WHERE account_email LIKE '%@codereve.com';

-- Update system settings
UPDATE "system_settings"
SET value = REPLACE(value::text, 'codereve', 'deepaxis')::jsonb
WHERE key = 'smtp_config' AND value::text LIKE '%codereve%';

UPDATE "system_settings"
SET value = REPLACE(value::text, 'CodeReve', 'DEEPAXIS')::jsonb
WHERE key = 'general_config' AND value::text LIKE '%CodeReve%';

-- Verify changes
SELECT id, email, name, role FROM "users" ORDER BY created_at;
SELECT id, account_name, account_email FROM "fiverr_accounts";
SELECT key, value FROM "system_settings" WHERE key IN ('smtp_config', 'general_config');
