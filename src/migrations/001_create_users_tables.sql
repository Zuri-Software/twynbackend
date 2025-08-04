-- Soul App Database Schema
-- Migration 001: Create users and related tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table - stores user profile and subscription info
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY, -- Supabase auth user ID
    phone VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(255),
    date_of_birth DATE,
    gender VARCHAR(20),
    subscription_tier VARCHAR(10) DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro')),
    model_count INTEGER DEFAULT 0,
    monthly_generations INTEGER DEFAULT 0,
    generation_reset_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Models table - stores user's trained models
CREATE TABLE IF NOT EXISTS models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'training', 'completed', 'failed')),
    temp_folder_name VARCHAR(255), -- Temporary S3 folder name during onboarding
    final_model_id VARCHAR(255),   -- Final model ID after training
    photo_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Usage logs table - tracks user actions for analytics and limits
CREATE TABLE IF NOT EXISTS usage_logs (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(20) NOT NULL CHECK (action IN ('generate', 'train', 'upload')),
    count INTEGER DEFAULT 1,
    metadata JSONB, -- Store additional data like model_id, prompt, etc.
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_subscription ON users(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_models_user_id ON models(user_id);
CREATE INDEX IF NOT EXISTS idx_models_status ON models(status);
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_date ON usage_logs(created_at);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_models_updated_at BEFORE UPDATE ON models
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Sample data for testing (remove in production)
-- INSERT INTO users (id, phone, name, subscription_tier) 
-- VALUES ('550e8400-e29b-41d4-a716-446655440000', '+1234567890', 'Test User', 'free')
-- ON CONFLICT DO NOTHING;