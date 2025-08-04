import { Router } from 'express';
import { 
  sendPhoneOTP, 
  verifyPhoneOTP, 
  refreshToken 
} from '../controllers/authController';

const router = Router();

// POST /api/auth/send-otp - Send OTP to phone number
router.post('/send-otp', sendPhoneOTP);

// POST /api/auth/verify-otp - Verify OTP and sign in
router.post('/verify-otp', verifyPhoneOTP);

// POST /api/auth/refresh - Refresh access token
router.post('/refresh', refreshToken);

export default router;