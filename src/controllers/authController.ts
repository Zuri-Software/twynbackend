import { Request, Response } from 'express';
import { supabase } from '../services/supabase';
import { createUser, getUserById } from '../services/userService';

// Send OTP to phone number
export async function sendPhoneOTP(req: Request, res: Response) {
  try {
    const { phone } = req.body;
    
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }
    
    console.log(`[Auth] Sending OTP to phone: ${phone}`);
    
    // TESTING BYPASS: Skip real OTP for test numbers starting with +1555
    if (process.env.NODE_ENV === 'development' && phone.startsWith('+1555')) {
      console.log(`[AUTH] 🧪 Development bypass - fake OTP sent to: ${phone}`);
      return res.json({
        success: true,
        message: 'OTP sent successfully (bypassed for testing)'
      });
    }
    
    const { data, error } = await supabase.auth.signInWithOtp({
      phone: phone,
    });
    
    if (error) {
      console.error('Supabase OTP error:', error);
      return res.status(400).json({ 
        error: 'Failed to send OTP', 
        details: error.message 
      });
    }
    
    res.json({ 
      success: true, 
      message: 'OTP sent successfully',
      // Don't return sensitive data in production
    });
    
  } catch (error) {
    console.error('Error sending phone OTP:', error);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
}

// Verify OTP and sign in
export async function verifyPhoneOTP(req: Request, res: Response) {
  try {
    const { phone, token } = req.body;
    
    if (!phone || !token) {
      return res.status(400).json({ error: 'Phone number and verification code are required' });
    }
    
    console.log(`[Auth] Verifying OTP for phone: ${phone}`);
    
    // TESTING BYPASS: Skip OTP verification for test numbers starting with +1555
    if (process.env.NODE_ENV === 'development' && phone.startsWith('+1555')) {
      console.log(`[AUTH] 🧪 Development bypass for test number: ${phone}`);

      // Generate a deterministic UUID for test users (consistent based on phone number)
      const crypto = require('crypto');
      const phoneDigits = phone.replace(/\D/g, '');
      const hash = crypto.createHash('sha256').update(`test-user-${phoneDigits}`).digest('hex');
      const mockUserId = [
        hash.substring(0, 8),
        hash.substring(8, 12),
        hash.substring(12, 16),
        hash.substring(16, 20),
        hash.substring(20, 32)
      ].join('-');
      
      // Create or update user record in PostgreSQL database
      const dbUser = await createUser({
        id: mockUserId,
        phone: phone,
      });
      
      console.log(`[AUTH] 🧪 Test user created/found: ${dbUser.phone} (${mockUserId})`);
      
      // Generate mock session tokens for test users
      const mockSession = {
        access_token: `mock-access-token-${Date.now()}`,
        refresh_token: `mock-refresh-token-${Date.now()}`,
        expires_at: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour from now
      };
      
      console.log(`[AUTH] 🧪 Generated mock session:`, {
        access_token: mockSession.access_token.substring(0, 25) + '...',
        refresh_token: mockSession.refresh_token.substring(0, 25) + '...'
      });
      
      return res.json({
        success: true,
        user: {
          id: mockUserId,
          phone: dbUser.phone,
          name: dbUser.name,
          subscriptionTier: dbUser.subscription_tier,
          modelCount: dbUser.model_count,
          monthlyGenerations: dbUser.monthly_generations,
          onboardingCompleted: dbUser.onboarding_completed,
          createdAt: dbUser.created_at,
          updatedAt: dbUser.updated_at,
        },
        session: mockSession
      });
    }
    
    const { data, error } = await supabase.auth.verifyOtp({
      phone: phone,
      token: token,
      type: 'sms',
    });
    
    if (error) {
      console.error('Supabase OTP verification error:', error);
      return res.status(400).json({ 
        error: 'Invalid verification code', 
        details: error.message 
      });
    }
    
    if (!data.user || !data.session) {
      return res.status(400).json({ error: 'Verification failed' });
    }
    
    // Create or update user record in PostgreSQL database
    // Ensure consistent phone number formatting (always use the original request phone number)
    const dbUser = await createUser({
      id: data.user.id,
      phone: phone, // Use the original request phone number with consistent formatting
    });
    
    console.log(`[Auth] User authenticated and DB record created: ${data.user.phone} (${data.user.id})`);
    
    res.json({
      success: true,
      user: {
        id: data.user.id,
        phone: data.user.phone,
        name: dbUser.name,
        subscriptionTier: dbUser.subscription_tier,
        modelCount: dbUser.model_count,
        monthlyGenerations: dbUser.monthly_generations,
        onboardingCompleted: dbUser.onboarding_completed,
        createdAt: dbUser.created_at,
        updatedAt: dbUser.updated_at,
      },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
      }
    });
    
  } catch (error) {
    console.error('Error verifying phone OTP:', error);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
}

// Refresh access token
export async function refreshToken(req: Request, res: Response) {
  try {
    console.log('[AUTH] 🔄 Refresh token request received:', {
      body: req.body,
      hasRefreshToken: !!req.body.refreshToken,
      hasRefresh_token: !!req.body.refresh_token
    });
    
    const { refreshToken, refresh_token } = req.body;
    const token = refreshToken || refresh_token; // Support both field names
    
    if (!token) {
      console.log('[AUTH] ❌ No refresh token provided');
      return res.status(400).json({ error: 'Refresh token is required' });
    }
    
    console.log('[AUTH] 🔍 Processing token:', token.substring(0, 20) + '...');
    
    // TESTING BYPASS: Handle mock refresh tokens for test users in development
    if (process.env.NODE_ENV === 'development' && token.startsWith('mock-refresh-token-')) {
      console.log(`[AUTH] 🧪 Development bypass for mock refresh token: ${token.substring(0, 25)}...`);
      
      // Generate new mock tokens for test users
      const newMockSession = {
        access_token: `mock-access-token-${Date.now()}`,
        refresh_token: `mock-refresh-token-${Date.now()}`,
        expires_at: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour from now
      };
      
      return res.json({
        success: true,
        access_token: newMockSession.access_token,
        refresh_token: newMockSession.refresh_token,
      });
    }
    
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: token
    });
    
    if (error) {
      console.error('Token refresh error:', error);
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    
    res.json({
      success: true,
      access_token: data.session?.access_token,
      refresh_token: data.session?.refresh_token,
    });
    
  } catch (error) {
    console.error('Error refreshing token:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
}