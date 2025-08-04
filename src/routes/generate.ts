import { Router } from 'express';
import { handleGenerate } from '../controllers/generateController';
import { authenticateUser } from '../middleware/auth';
import { checkImageGenerationLimit } from '../middleware/usageLimits';

const router = Router();

// All generate routes require authentication
router.use(authenticateUser);

// POST /api/generate - No file upload needed for 302.AI
router.post('/', checkImageGenerationLimit, handleGenerate);

export default router;
