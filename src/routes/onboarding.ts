import { Router } from 'express';
import multer from 'multer';
import { handleOnboardingImageUpload, handleOnboardingBatchUpload, checkOnboardingTempFolderHandler, trainModelFromOnboardingImages } from '../controllers/onboardingController';
import { requireFreeUser } from '../middleware/subscriptionTier';
import { authenticateUser } from '../middleware/auth';

const upload = multer();
const router = Router();

// All onboarding routes require authentication
router.use(authenticateUser);

// POST /api/onboarding/images - Single image upload
router.post('/images', requireFreeUser, upload.single('file'), handleOnboardingImageUpload);

// POST /api/onboarding/batch-upload - Multiple images upload
router.post('/batch-upload', requireFreeUser, upload.array('images', 25), handleOnboardingBatchUpload);

// GET /api/onboarding/check-temp-folder - Check if user has onboarding images in temp folder
router.get('/check-temp-folder', checkOnboardingTempFolderHandler);

// POST /api/onboarding/train-from-images - Create first model using onboarding images
router.post('/train-from-images', trainModelFromOnboardingImages);

export default router;
