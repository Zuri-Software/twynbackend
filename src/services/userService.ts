// Delete a model record from Supabase
export async function deleteModel(userId: string, modelId: string): Promise<void> {
  await query('DELETE FROM models WHERE user_id = $1 AND id = $2', [userId, modelId]);
  console.log(`[UserService] Deleted model ${modelId} for user ${userId}`);
}
import { query } from './database';
import type { User, Model } from './database';

// Create a new user (called on first login)
export async function createUser(userData: {
  id: string; // Supabase user ID
  phone: string;
  name?: string;
}): Promise<User> {
  const { id, phone, name } = userData;
  
  const result = await query(
    `INSERT INTO users (id, phone, name) 
     VALUES ($1, $2, $3) 
     ON CONFLICT (id) DO UPDATE SET 
       phone = EXCLUDED.phone,
       name = COALESCE(EXCLUDED.name, users.name),  -- Keep existing name if new name is null
       updated_at = NOW()
     RETURNING *`,
    [id, phone, name]
  );
  
  console.log(`[UserService] Created/updated user: ${phone} (${id})`);
  return result.rows[0];
}

// Get user by ID
export async function getUserById(userId: string): Promise<User | null> {
  const result = await query('SELECT * FROM users WHERE id = $1', [userId]);
  return result.rows[0] || null;
}

// Get user by phone
export async function getUserByPhone(phone: string): Promise<User | null> {
  const result = await query('SELECT * FROM users WHERE phone = $1', [phone]);
  return result.rows[0] || null;
}

// Update user profile
export async function updateUserProfile(userId: string, updates: {
  name?: string;
  date_of_birth?: Date;
  gender?: string;
}): Promise<User | null> {
  const setClause = [];
  const values = [];
  let paramIndex = 1;
  
  if (updates.name !== undefined) {
    setClause.push(`name = $${paramIndex++}`);
    values.push(updates.name);
  }
  
  if (updates.date_of_birth !== undefined) {
    setClause.push(`date_of_birth = $${paramIndex++}`);
    values.push(updates.date_of_birth);
  }
  
  if (updates.gender !== undefined) {
    setClause.push(`gender = $${paramIndex++}`);
    values.push(updates.gender);
  }
  
  if (setClause.length === 0) {
    return getUserById(userId);
  }
  
  values.push(userId);
  
  const result = await query(
    `UPDATE users SET ${setClause.join(', ')}, updated_at = NOW() 
     WHERE id = $${paramIndex} 
     RETURNING *`,
    values
  );
  
  return result.rows[0] || null;
}

// Increment user's model count
export async function incrementModelCount(userId: string): Promise<void> {
  await query(
    'UPDATE users SET model_count = model_count + 1, updated_at = NOW() WHERE id = $1',
    [userId]
  );
  console.log(`[UserService] Incremented model count for user ${userId}`);
}

// Increment user's generation count
export async function incrementGenerationCount(userId: string, count: number = 1): Promise<void> {
  await query(`
    UPDATE users 
    SET monthly_generations = monthly_generations + $2, 
        updated_at = NOW() 
    WHERE id = $1
  `, [userId, count]);
  
  console.log(`[UserService] Incremented generation count by ${count} for user ${userId}`);
}

// Reset monthly generation count (run monthly)
export async function resetMonthlyGenerations(): Promise<void> {
  await query(`
    UPDATE users 
    SET monthly_generations = 0, 
        generation_reset_date = CURRENT_DATE,
        updated_at = NOW() 
    WHERE generation_reset_date < CURRENT_DATE - INTERVAL '30 days'
  `);
  
  console.log('[UserService] Reset monthly generation counts');
}

// Mark user onboarding as completed
export async function completeUserOnboarding(userId: string): Promise<User | null> {
  const result = await query(
    'UPDATE users SET onboarding_completed = TRUE, updated_at = NOW() WHERE id = $1 RETURNING *',
    [userId]
  );
  
  console.log(`[UserService] Marked onboarding as completed for user ${userId}`);
  return result.rows[0] || null;
}

// Upgrade user to pro
export async function upgradeUserToPro(userId: string): Promise<User | null> {
  const result = await query(
    `UPDATE users 
     SET subscription_tier = 'pro', updated_at = NOW() 
     WHERE id = $1 
     RETURNING *`,
    [userId]
  );
  
  console.log(`[UserService] Upgraded user ${userId} to pro`);
  return result.rows[0] || null;
}

// Get user's models
export async function getUserModels(userId: string): Promise<Model[]> {
  const result = await query(
    'SELECT * FROM models WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
  
  return result.rows;
}

// Create a new model record
export async function createModel(modelData: {
  user_id: string;
  name: string;
  temp_folder_name?: string;
  photo_count: number;
}): Promise<Model> {
  const { user_id, name, temp_folder_name, photo_count } = modelData;
  
  const result = await query(
    `INSERT INTO models (user_id, name, temp_folder_name, photo_count, status) 
     VALUES ($1, $2, $3, $4, 'pending') 
     RETURNING *`,
    [user_id, name, temp_folder_name, photo_count]
  );
  
  console.log(`[UserService] Created model: ${name} for user ${user_id}`);
  return result.rows[0];
}

// Update model status
export async function updateModelStatus(modelId: string, status: 'pending' | 'training' | 'completed' | 'failed', finalModelId?: string, thumbnailUrl?: string): Promise<Model | null> {
  const result = await query(
    `UPDATE models 
     SET status = $2, final_model_id = COALESCE($3, final_model_id), thumbnail_url = COALESCE($4, thumbnail_url), updated_at = NOW() 
     WHERE id = $1 
     RETURNING *`,
    [modelId, status, finalModelId, thumbnailUrl]
  );
  
  return result.rows[0] || null;
}

// Log user action
export async function logUserAction(userId: string, action: 'generate' | 'train' | 'upload' | 'upgrade', count: number = 1, metadata?: any): Promise<void> {
  await query(
    'INSERT INTO usage_logs (user_id, action, count, metadata) VALUES ($1, $2, $3, $4)',
    [userId, action, count, metadata]
  );
}