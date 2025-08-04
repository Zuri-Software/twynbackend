-- Soul App Database Schema
-- Migration 003: Migrate from FAL AI to 302.AI

-- Update models table to store higgsfield_id instead of final_model_id
ALTER TABLE models 
ADD COLUMN higgsfield_id VARCHAR(255),
ADD COLUMN model_name VARCHAR(255);

-- For backward compatibility, keep final_model_id for now
-- In production, you might want to migrate existing data first

-- Update models table comments
COMMENT ON COLUMN models.higgsfield_id IS '302.AI character ID returned from training';
COMMENT ON COLUMN models.model_name IS 'Name sent to 302.AI for character training';
COMMENT ON COLUMN models.final_model_id IS 'Legacy FAL AI model ID (deprecated)';

-- Add index for higgsfield_id lookups
CREATE INDEX IF NOT EXISTS idx_models_higgsfield_id ON models(higgsfield_id);

-- Optional: Add styles table for caching 302.AI style catalog
CREATE TABLE IF NOT EXISTS styles (
    id VARCHAR(255) PRIMARY KEY, -- 302.AI style_id
    name VARCHAR(255) NOT NULL,
    description TEXT,
    preview_url TEXT,
    category VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for styles table
CREATE INDEX IF NOT EXISTS idx_styles_category ON styles(category);
CREATE INDEX IF NOT EXISTS idx_styles_active ON styles(is_active);

-- Add updated_at trigger for styles table
CREATE TRIGGER update_styles_updated_at BEFORE UPDATE ON styles
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Comments for styles table
COMMENT ON TABLE styles IS 'Cache of available 302.AI generation styles';
COMMENT ON COLUMN styles.id IS '302.AI style_id used in generation requests';
COMMENT ON COLUMN styles.preview_url IS 'URL to style preview image';