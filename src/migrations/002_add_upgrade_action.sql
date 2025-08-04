-- Soul App Database Schema
-- Migration 002: Add 'upgrade' action to usage_logs

-- Update the check constraint to include 'upgrade' action
ALTER TABLE usage_logs 
DROP CONSTRAINT IF EXISTS usage_logs_action_check;

ALTER TABLE usage_logs 
ADD CONSTRAINT usage_logs_action_check 
CHECK (action IN ('generate', 'train', 'upload', 'upgrade'));