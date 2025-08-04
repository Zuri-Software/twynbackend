import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum number of connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: {
    rejectUnauthorized: false // Required for Supabase
  }
});

console.log('[Database] Connecting to:', process.env.DATABASE_URL?.replace(/:[^:@]*@/, ':****@')); // Hide password in logs

// Test database connection
pool.on('connect', () => {
  console.log('[Database] Connected to PostgreSQL');
});

pool.on('error', (err) => {
  console.error('[Database] Unexpected error on idle client', err);
  process.exit(-1);
});

// Export pool for queries
export { pool };

// Helper function for single queries
export async function query(text: string, params?: any[]) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  console.log(`[Database] Query executed in ${duration}ms:`, text);
  return res;
}

// Helper function for transactions
export async function getClient(): Promise<PoolClient> {
  const client = await pool.connect();
  return client;
}

// Database models and types
export interface User {
  id: string; // UUID from Supabase
  phone: string;
  name?: string;
  date_of_birth?: Date;
  gender?: string;
  subscription_tier: 'free' | 'pro';
  model_count: number;
  monthly_generations: number;
  generation_count_reset_date: Date;
  onboarding_completed: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Model {
  id: string;
  user_id: string;
  name: string;
  status: 'pending' | 'training' | 'completed' | 'failed';
  temp_folder_name?: string;
  final_model_id?: string; // Legacy FAL AI model ID (deprecated)
  higgsfield_id?: string; // 302.AI character ID
  model_name?: string; // Name sent to 302.AI
  thumbnail_url?: string; // 302.AI training thumbnail
  photo_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface UsageLog {
  id: number;
  user_id: string;
  action: 'generate' | 'train' | 'upload' | 'upgrade';
  count: number;
  metadata?: any;
  created_at: Date;
}

export interface Style {
  id: string; // 302.AI style_id
  name: string;
  description?: string;
  preview_url?: string;
  category?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}