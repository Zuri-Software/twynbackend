import { query } from '../services/database';

async function updateNSFWConstraint() {
  try {
    console.log('[Migration] Updating generations table to support NSFW status...');
    
    // Drop existing constraint
    await query(`
      ALTER TABLE generations 
      DROP CONSTRAINT IF EXISTS generations_status_check;
    `);
    
    // Add new constraint with NSFW included
    await query(`
      ALTER TABLE generations 
      ADD CONSTRAINT generations_status_check 
      CHECK (status IN ('processing', 'completed', 'failed', 'nsfw'));
    `);
    
    console.log('[Migration] ✅ Successfully updated generations table constraint');
    console.log('[Migration] NSFW status is now supported');
    
    // Verify the constraint
    const result = await query(`
      SELECT 
        conname as constraint_name,
        consrc as constraint_definition 
      FROM pg_constraint 
      WHERE conname = 'generations_status_check';
    `);
    
    console.log('[Migration] Constraint verification:', result.rows[0]);
    
    process.exit(0);
  } catch (error) {
    console.error('[Migration] ❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  updateNSFWConstraint();
}

export { updateNSFWConstraint };