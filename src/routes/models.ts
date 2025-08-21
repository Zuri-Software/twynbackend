import { Router } from 'express';
import { requireProUser } from '../middleware/subscriptionTier';
import { handleDeleteModel, handleGetUserModels, handleGetModel } from '../controllers/modelController';

const router = Router();

// GET /api/models - Get all user's models
router.get('/', handleGetUserModels);

// GET /api/models/:modelId - Get specific model
router.get('/:modelId', handleGetModel);

// DELETE /api/models/:modelId - Temporarily removed Pro requirement for testing
// TODO: Re-add requireProUser middleware if delete should be Pro-only
router.delete('/:modelId', handleDeleteModel);

export default router;
