import { Router } from 'express';
import { requireProUser } from '../middleware/subscriptionTier';
import { handleDeleteModel } from '../controllers/modelController';

const router = Router();

// DELETE /api/models/:modelId
router.delete('/:modelId', requireProUser, handleDeleteModel);

export default router;
