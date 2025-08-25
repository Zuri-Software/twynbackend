-- Update platform constraint to support 'expo' platform
-- Migration 006: Allow expo platform in device_tokens table

-- Drop the existing constraint
ALTER TABLE device_tokens DROP CONSTRAINT IF EXISTS device_tokens_platform_check;

-- Add the new constraint that includes 'expo'
ALTER TABLE device_tokens ADD CONSTRAINT device_tokens_platform_check 
    CHECK (platform IN ('ios', 'android', 'expo'));