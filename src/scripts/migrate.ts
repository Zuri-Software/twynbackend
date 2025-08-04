import fs from 'fs';
import path from 'path';
import { query } from '../services/database';

async function runMigrations() {
  try {
    console.log('[Migration] Starting database migrations...');
    
    // Read migration file
    const migrationPath = path.join(__dirname, '../migrations/001_create_users_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute migration
    await query(migrationSQL);
    
    console.log('[Migration] ✅ Successfully created users tables');
    console.log('[Migration] Tables created: users, models, usage_logs');
    
    process.exit(0);
  } catch (error) {
    console.error('[Migration] ❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations();
}