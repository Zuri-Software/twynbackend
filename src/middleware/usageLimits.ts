import { Request, Response, NextFunction } from 'express';
import { canUserCreateModel, canUserGenerateImages, getUserLimits } from '../config/limits';

// Middleware to check if user can create a model
export function checkModelCreationLimit(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  const canCreate = canUserCreateModel(req.user.modelCount, req.user.subscriptionTier);
  
  if (!canCreate) {
    const limits = getUserLimits(req.user.subscriptionTier);
    return res.status(403).json({ 
      error: 'Model creation limit reached',
      details: {
        current: req.user.modelCount,
        limit: limits.models,
        subscriptionTier: req.user.subscriptionTier
      }
    });
  }

  next();
}

// Middleware to check if user can generate images
export function checkImageGenerationLimit(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  // Get requested count from body or default to 1
  const requestedCount = req.body.count || req.body.images_count || 1;
  
  const canGenerate = canUserGenerateImages(req.user.monthlyGenerations, req.user.subscriptionTier, requestedCount);
  
  if (!canGenerate) {
    const limits = getUserLimits(req.user.subscriptionTier);
    return res.status(403).json({ 
      error: 'Monthly generation limit reached',
      details: {
        current: req.user.monthlyGenerations,
        limit: limits.monthlyGenerations,
        requested: requestedCount,
        subscriptionTier: req.user.subscriptionTier
      }
    });
  }

  next();
}

// General usage check endpoint middleware
export function checkUsageLimits(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  const limits = getUserLimits(req.user.subscriptionTier);
  
  // Add usage info to request for downstream use
  req.usage = {
    models: {
      current: req.user.modelCount,
      limit: limits.models,
      canCreate: canUserCreateModel(req.user.modelCount, req.user.subscriptionTier)
    },
    generations: {
      current: req.user.monthlyGenerations,
      limit: limits.monthlyGenerations,
      canGenerate: canUserGenerateImages(req.user.monthlyGenerations, req.user.subscriptionTier)
    }
  };

  next();
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      usage?: {
        models: {
          current: number;
          limit: number;
          canCreate: boolean;
        };
        generations: {
          current: number;
          limit: number;
          canGenerate: boolean;
        };
      };
    }
  }
}