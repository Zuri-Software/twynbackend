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
    const { refresh_token } = req.body;
    
    if (!refresh_token) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }
    
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refresh_token
    });
    
    if (error) {
      console.error('Token refresh error:', error);
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    
    res.json({
      success: true,
      session: {
        access_token: data.session?.access_token,
        refresh_token: data.session?.refresh_token,
        expires_at: data.session?.expires_at,
      }
    });
    
  } catch (error) {
    console.error('Error refreshing token:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
}