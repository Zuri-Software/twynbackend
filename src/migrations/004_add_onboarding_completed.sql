-- Migration 004: Add onboarding_completed field to users table
-- This field tracks whether a user has completed the full onboarding flow
-- (profile setup + avatar training + success screen + notification permission)

BEGIN;

-- Add onboarding_completed column to users table
ALTER TABLE users 
ADD COLUMN onboarding_completed BOOLEAN DEFAULT FALSE;

-- Update existing users to mark them as onboarding completed
-- (assume existing users have already completed onboarding)
UPDATE users 
SET onboarding_completed = TRUE
WHERE created_at < NOW();

-- Add comment for documentation
COMMENT ON COLUMN users.onboarding_completed IS 'Whether user has completed full onboarding flow (profile + avatar training + notifications)';

COMMIT;