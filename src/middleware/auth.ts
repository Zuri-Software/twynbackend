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