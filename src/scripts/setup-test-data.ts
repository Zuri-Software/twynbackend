import { query } from '../services/database';
import { v4 as uuidv4 } from 'uuid';

async function setupTestData() {
  try {
    console.log('[Setup] Creating test data for Dhruv...');
    
    // Generate proper UUIDs for models, but store clean folder names in temp_folder_name
    const userId = '550e8400-e29b-41d4-a716-446655440000'; // Test UUID for Dhruv
    const domModelId = uuidv4(); // Generate UUID for Dom's model
    const kirstenModelId = uuidv4(); // Generate UUID for Kirsten's model
    const domFolderName = '_UwRaAnsV3uvoIzukNyjG'; // Dom's clean folder name
    const kirstenFolderName = 'B8wGjKcged0J0Va_zvYST'; // Kirsten's clean folder name
    
    // 1. Create user record for Dhruv
    await query(`
      INSERT INTO users (id, phone, name, subscription_tier, model_count) 
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) DO UPDATE SET 
        phone = EXCLUDED.phone,
        name = EXCLUDED.name,
        subscription_tier = EXCLUDED.subscription_tier,
        model_count = EXCLUDED.model_count,
        updated_at = NOW()
    `, [userId, '+15195463438', 'Dhruv Desai', 'free', 2]);
    
    console.log('✅ Created user: Dhruv Desai (+15195463438)');
    console.log(`   User ID: ${userId}`);
    
    // 2. Create model records for your existing LoRAs (using UUIDs as IDs, clean names in temp_folder_name)
    await query(`
      INSERT INTO models (id, user_id, name, status, temp_folder_name, photo_count) 
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO UPDATE SET 
        name = EXCLUDED.name,
        status = EXCLUDED.status,
        temp_folder_name = EXCLUDED.temp_folder_name,
        updated_at = NOW()
    `, [domModelId, userId, "Dom's Model", 'completed', domFolderName, 25]);
    
    await query(`
      INSERT INTO models (id, user_id, name, status, temp_folder_name, photo_count) 
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO UPDATE SET 
        name = EXCLUDED.name,
        status = EXCLUDED.status,
        temp_folder_name = EXCLUDED.temp_folder_name,
        updated_at = NOW()
    `, [kirstenModelId, userId, "Kirsten's Model", 'completed', kirstenFolderName, 24]);
    
    console.log('✅ Created models:');
    console.log(`   Dom's Model: ${domModelId} (folder: ${domFolderName})`);
    console.log(`   Kirsten's Model: ${kirstenModelId} (folder: ${kirstenFolderName})`);
    
    // 3. Log some usage actions for testing
    await query(`
      INSERT INTO usage_logs (user_id, action, count, metadata) 
      VALUES 
        ($1, 'train', 1, $2),
        ($1, 'train', 1, $3)
    `, [
      userId, 
      JSON.stringify({ modelId: domModelId, modelName: "Dom's Model" }),
      JSON.stringify({ modelId: kirstenModelId, modelName: "Kirsten's Model" })
    ]);
    
    console.log('✅ Added usage logs for model training');
    
    console.log('\n📁 Expected S3 Structure:');
    console.log(`your-bucket/`);
    console.log(`└── users/`);
    console.log(`    └── ${userId}/`);
    console.log(`        ├── ${domModelId}/`);
    console.log(`        │   ├── training/     # Move ${domFolderName}/* here`);
    console.log(`        │   └── generations/  # Generated images will go here`);
    console.log(`        └── ${kirstenModelId}/`);
    console.log(`            ├── training/     # Move ${kirstenFolderName}/* here`);
    console.log(`            └── generations/  # Generated images will go here`);
    
    console.log('\n🔧 Next Steps:');
    console.log('1. Reorganize your S3 bucket to match the structure above');
    console.log('2. Move your training images to the new folder structure');
    console.log('3. Test the generate endpoint with these model IDs');
    console.log('4. Update your LoRA final_model_id fields when you have the FAL URLs');
    
    process.exit(0);
  } catch (error) {
    console.error('[Setup] ❌ Failed to create test data:', error);
    process.exit(1);
  }
}

// Run setup if this file is executed directly
if (require.main === module) {
  setupTestData();
}

export { setupTestData };