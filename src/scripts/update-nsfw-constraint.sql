-- Update generations table to allow 'nsfw' status
-- Run this manually in your database to add NSFW support

-- First, drop the existing constraint
ALTER TABLE generations 
DROP CONSTRAINT IF EXISTS generations_status_check;

-- Add the new constraint with 'nsfw' included
ALTER TABLE generations 
ADD CONSTRAINT generations_status_check 
CHECK (status IN ('processing', 'completed', 'failed', 'nsfw'));

-- Verify the constraint was added
SELECT 
    conname as constraint_name,
    consrc as constraint_definition 
FROM pg_constraint 
WHERE conname = 'generations_status_check';

-- Show current table definition
\d generations;