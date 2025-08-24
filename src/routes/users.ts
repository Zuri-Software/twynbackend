import { Router } from 'express';
import { 
  getUserProfile, 
  updateUserProfile, 
  getUserUsage, 
  getUserModelsController,
  upgradeUser,
  completeOnboarding,
  registerDeviceTokenController,
  checkDeviceTokenStatusController
} from '../controllers/userController';
import { authenticateUser } from '../middleware/auth';
import { checkUsageLimits } from '../middleware/usageLimits';

const router = Router();

// All user routes require authentication
router.use(authenticateUser);

// GET /api/users/profile - Get user profile
router.get('/profile', getUserProfile);

// PUT /api/users/profile - Update user profile
router.put('/profile', updateUserProfile);

// GET /api/users/usage - Get user usage stats with limits check
router.get('/usage', checkUsageLimits, getUserUsage);

// GET /api/users/models - Get user's trained models
router.get('/models', getUserModelsController);

// POST /api/users/upgrade - Upgrade to pro (payment integration later)
router.post('/upgrade', upgradeUser);

// POST /api/users/complete-onboarding - Mark onboarding as completed
router.post('/complete-onboarding', completeOnboarding);

// POST /api/users/register-device - Register device token for push notifications
router.post('/register-device', registerDeviceTokenController);

// GET /api/users/device-token-status - Check if user has active device token
router.get('/device-token-status', checkDeviceTokenStatusController);

export default router;