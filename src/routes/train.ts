import { Router } from 'express';
import multer from 'multer';
import { trainController } from '../controllers/trainController';
import { getTrainingStatus } from '../services/302aiService';
import { getUserModels } from '../services/userService';
import { authenticateUser } from '../middleware/auth';
import { checkModelCreationLimit } from '../middleware/usageLimits';

const upload = multer(); // in-memory storage
const router = Router();

// All train routes require authentication
router.use(authenticateUser);

// POST /api/train
// Accept multiple images under the 'images' field
router.post('/', checkModelCreationLimit, upload.array('images', 50), trainController);

// GET /api/train/:id/status - Get training status by Supabase model ID
router.get('/:id/status', async (req, res) => {
  try {
    const { id: modelId } = req.params;
    if (!modelId) {
      return res.status(400).json({ error: 'Missing model ID parameter' });
    }
    
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    // Get user's models and find the requested one
    const userModels = await getUserModels(req.user.id);
    const model = userModels.find(m => m.id === modelId);
    
    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }
    
    // If model is completed and has higgsfield_id, also check 302.AI status
    let aiStatus = null;
    if (model.status === 'completed' && model.final_model_id) {
      try {
        aiStatus = await getTrainingStatus(model.final_model_id);
      } catch (aiErr) {
        console.warn(`Failed to get 302.AI status for ${model.final_model_id}:`, aiErr);
      }
    }
    
    res.json({ 
      modelId: model.id,
      status: model.status,
      name: model.name,
      higgsfield_id: model.final_model_id,
      thumbnail_url: model.thumbnail_url,
      photo_count: model.photo_count,
      created_at: model.created_at,
      updated_at: model.updated_at,
      aiStatus: aiStatus
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to get training status' });
  }
});

// POST /api/train/:id/complete - Save completed training model
router.post('/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const { modelName, photoCount, thumbnail_url } = req.body;
    
    if (!id) {
      return res.status(400).json({ error: 'Missing higgsfield_id parameter' });
    }
    
    // For now, just return success - the iOS app will handle local storage
    res.json({ 
      success: true,
      higgsfield_id: id,
      modelName: modelName || 'My Character',
      photoCount: photoCount || 0,
      thumbnail_url: thumbnail_url
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to save completed training' });
  }
});

export default router;
