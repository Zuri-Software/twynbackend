-- Soul App Database Schema
-- Migration 007: Add camera captures table for camera-to-avatar feature

-- Camera captures table - tracks photo captures and analysis results
CREATE TABLE IF NOT EXISTS camera_captures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    capture_url TEXT NOT NULL, -- S3 URL of original captured photo
    generated_prompt TEXT,
    generation_id VARCHAR(255), -- Links to generations table if generation was started
    model_id UUID, -- Model used for generation (if any)
    analysis_metadata JSONB DEFAULT '{}', -- OpenAI analysis metadata
    status VARCHAR(20) DEFAULT 'captured' CHECK (status IN ('captured', 'analyzed', 'generated', 'failed')),
    created_at TIMESTAMP DEFAULT NOW(),
    analyzed_at TIMESTAMP,
    generated_at TIMESTAMP
);

-- Add camera-related actions to usage_logs
-- Note: We need to add these to the existing CHECK constraint
-- This will need to be done carefully to avoid breaking existing data

-- For now, let's add the new actions to the existing constraint
-- This requires dropping and recreating the constraint
ALTER TABLE usage_logs DROP CONSTRAINT IF EXISTS usage_logs_action_check;
ALTER TABLE usage_logs ADD CONSTRAINT usage_logs_action_check 
    CHECK (action IN ('generate', 'train', 'upload', 'upgrade', 'camera_capture', 'camera_generation'));

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_camera_captures_user_id ON camera_captures(user_id);
CREATE INDEX IF NOT EXISTS idx_camera_captures_created_at ON camera_captures(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_camera_captures_status ON camera_captures(status);
CREATE INDEX IF NOT EXISTS idx_camera_captures_generation_id ON camera_captures(generation_id);

-- Comments
COMMENT ON TABLE camera_captures IS 'Tracks camera captures and their analysis for avatar generation';
COMMENT ON COLUMN camera_captures.capture_url IS 'S3 URL of the original captured photo';
COMMENT ON COLUMN camera_captures.generated_prompt IS 'OpenAI-generated prompt for avatar creation';
COMMENT ON COLUMN camera_captures.generation_id IS 'Links to generations table if avatar was generated';
COMMENT ON COLUMN camera_captures.analysis_metadata IS 'OpenAI Vision API response metadata (styles, mood, etc.)';
COMMENT ON COLUMN camera_captures.status IS 'Current status: captured -> analyzed -> generated/failed';