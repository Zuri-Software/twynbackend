-- Soul App Database Schema
-- Migration 006: Add generations table for tracking image batches

-- Generations table - tracks generation batches for proper image grouping
CREATE TABLE IF NOT EXISTS generations (
    id VARCHAR(255) PRIMARY KEY, -- generationId from controller (e.g., "gen_userId_timestamp")
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    model_id VARCHAR(255), -- The higgsfield_id or style_id used for generation
    higgsfield_id VARCHAR(255), -- 302.AI character ID (if character generation)
    style_id VARCHAR(255) NOT NULL, -- 302.AI style ID
    prompt TEXT NOT NULL,
    quality VARCHAR(10) DEFAULT 'basic',
    aspect_ratio VARCHAR(10) DEFAULT '1:1',
    seed INTEGER,
    status VARCHAR(20) DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
    image_urls TEXT[], -- Array of S3 URLs for generated images
    image_count INTEGER DEFAULT 0,
    error_message TEXT,
    metadata JSONB, -- Additional generation parameters and data
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_generations_user_id ON generations(user_id);
CREATE INDEX IF NOT EXISTS idx_generations_status ON generations(status);
CREATE INDEX IF NOT EXISTS idx_generations_created_at ON generations(created_at);
CREATE INDEX IF NOT EXISTS idx_generations_model_id ON generations(model_id);
CREATE INDEX IF NOT EXISTS idx_generations_higgsfield_id ON generations(higgsfield_id);

-- Comments
COMMENT ON TABLE generations IS 'Tracks image generation batches for proper photo stack grouping';
COMMENT ON COLUMN generations.id IS 'Unique generation ID (gen_userId_timestamp)';
COMMENT ON COLUMN generations.model_id IS 'Either higgsfield_id or style_id used for S3 folder structure';
COMMENT ON COLUMN generations.higgsfield_id IS '302.AI character ID for character generations';
COMMENT ON COLUMN generations.style_id IS '302.AI style ID used in generation';
COMMENT ON COLUMN generations.image_urls IS 'Array of S3 URLs for the 4 generated images';
COMMENT ON COLUMN generations.image_count IS 'Number of images generated (usually 4)';
COMMENT ON COLUMN generations.metadata IS 'Additional parameters like enhance_prompt, negative_prompt, etc.';