import { Router } from 'express';
import { authenticateUser } from '../middleware/auth';
import { 
  captureAndAnalyze, 
  analyzePhoto, 
  getCaptureHistory,
  uploadMiddleware 
} from '../controllers/cameraController';

const router = Router();

// All camera routes require authentication
router.use(authenticateUser);

/**
 * POST /api/camera/capture
 * Capture photo, analyze with OpenAI, and optionally start generation
 * 
 * Body (multipart/form-data):
 * - photo: File (required)
 * - modelId: string (optional, required if generateImmediately=true)
 * - styleId: string (optional)
 * - quality: 'basic' | 'premium' (optional, default: 'basic')
 * - aspectRatio: '1:1' | '16:9' | '9:16' (optional, default: '1:1')
 * - generateImmediately: boolean (optional, default: false)
 */
router.post('/capture', uploadMiddleware, captureAndAnalyze);

/**
 * POST /api/camera/analyze
 * Analyze photo only (no generation, no storage)
 * 
 * Body (multipart/form-data):
 * - photo: File (required)
 * - analysisType: 'standard' | 'detailed' (optional, default: 'standard')
 */
router.post('/analyze', uploadMiddleware, analyzePhoto);

/**
 * GET /api/camera/captures
 * Get user's camera capture history
 * 
 * Query params:
 * - limit: number (optional, default: 20)
 * - offset: number (optional, default: 0)
 */
router.get('/captures', getCaptureHistory);

export default router;