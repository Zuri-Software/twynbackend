import fs from 'fs';
import path from 'path';
import { query } from '../services/database';

async function runDeviceTokensMigration() {
  try {
    console.log('[Migration] Running device tokens migration...');
    
    // Read migration file
    const migrationPath = path.join(__dirname, '../migrations/005_add_device_tokens.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute migration
    await query(migrationSQL);
    
    console.log('[Migration] ✅ Successfully created device_tokens table');
    
    process.exit(0);
  } catch (error) {
    console.error('[Migration] ❌ Device tokens migration failed:', error);
    process.exit(1);
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  runDeviceTokensMigration();
}