import { Router } from 'express';
import { getImages, getTrainingImagesForModel, deleteTrainingImagesForModel } from '../controllers/imagesController';
import { authenticateUser } from '../middleware/auth';

const router = Router();

// GET /api/images - Fetch all generated images for authenticated user
router.get('/', authenticateUser, getImages);

// GET /api/images/training/:modelId - Fetch training images for a specific model
router.get('/training/:modelId', authenticateUser, getTrainingImagesForModel);

// DELETE /api/images/training/:modelId - Delete training images for a specific model
router.delete('/training/:modelId', authenticateUser, deleteTrainingImagesForModel);

export default router;