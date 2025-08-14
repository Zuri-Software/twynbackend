import { Request, Response, NextFunction } from 'express';
import { verifySupabaseToken } from '../services/supabase';
import { getUserById } from '../services/userService';

// Extend Express Request to include user data
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        phone: string;
        name?: string;
        subscriptionTier: 'free' | 'pro';
        modelCount: number;
        monthlyGenerations: number;
        createdAt: Date;
        updatedAt: Date;
      };
    }
  }
}

export async function authenticateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // TESTING BYPASS: Handle mock tokens for test users in development
    if (process.env.NODE_ENV === 'development' && token.startsWith('mock-access-token-')) {
      console.log(`[Auth] 🧪 Development bypass for mock token: ${token.substring(0, 25)}...`);
      
      // For mock tokens, we need to find the most recent test user in the database
      // Since mock tokens don't contain user ID, we'll get the most recently created test user
      const { query } = require('../services/database');
      const result = await query(
        `SELECT * FROM users WHERE phone LIKE '+1555%' ORDER BY created_at DESC LIMIT 1`,
        [] // Look for users with test phone numbers (+1555...)
      );
      
      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Test user not found' });
      }
      
      const dbUser = result.rows[0];
      req.user = {
        id: dbUser.id,
        phone: dbUser.phone,
        name: dbUser.name,
        subscriptionTier: dbUser.subscription_tier,
        modelCount: dbUser.model_count,
        monthlyGenerations: dbUser.monthly_generations,
        createdAt: dbUser.created_at,
        updatedAt: dbUser.updated_at,
      };
      
      console.log(`[Auth] 🧪 Mock authenticated user: ${req.user.phone} (${req.user.id})`);
      return next();
    }
    
    // Verify JWT with Supabase
    const supabaseUser = await verifySupabaseToken(token);
    
    if (!supabaseUser) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    
    // Get full user data from PostgreSQL database
    const dbUser = await getUserById(supabaseUser.id);
    
    if (!dbUser) {
      return res.status(401).json({ error: 'User not found in database' });
    }
    
    req.user = {
      id: dbUser.id,
      phone: dbUser.phone,
      name: dbUser.name,
      subscriptionTier: dbUser.subscription_tier,
      modelCount: dbUser.model_count,
      monthlyGenerations: dbUser.monthly_generations,
      createdAt: dbUser.created_at,
      updatedAt: dbUser.updated_at,
    };
    
    console.log(`[Auth] Authenticated user: ${req.user.phone} (${req.user.subscriptionTier}, ${req.user.modelCount} models)`);
    next();
    
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
}

// Optional middleware for endpoints that work better with auth but don't require it
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const supabaseUser = await verifySupabaseToken(token);
      
      if (supabaseUser) {
        const dbUser = await getUserById(supabaseUser.id);
        if (dbUser) {
          req.user = {
            id: dbUser.id,
            phone: dbUser.phone,
            name: dbUser.name,
            subscriptionTier: dbUser.subscription_tier,
            modelCount: dbUser.model_count,
            monthlyGenerations: dbUser.monthly_generations,
            createdAt: dbUser.created_at,
            updatedAt: dbUser.updated_at,
          };
        }
      }
    }
    
    next();
  } catch (error) {
    // Don't fail on optional auth errors
    console.warn('Optional auth error:', error);
    next();
  }
}