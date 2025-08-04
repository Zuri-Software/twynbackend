import { Router } from 'express';
import { requireProUser } from '../middleware/subscriptionTier';
import { handleDeleteModel, handleGetUserModels, handleGetModel } from '../controllers/modelController';

const router = Router();

// GET /api/models - Get all user's models
router.get('/', handleGetUserModels);

// GET /api/models/:modelId - Get specific model
router.get('/:modelId', handleGetModel);

// DELETE /api/models/:modelId
router.delete('/:modelId', requireProUser, handleDeleteModel);

export default router;
