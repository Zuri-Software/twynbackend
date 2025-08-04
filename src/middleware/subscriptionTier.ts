import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to restrict access to routes based on user's subscription tier.
 * Usage: router.use(requireProUser) or router.use(requireFreeUser)
 */
export function requireProUser(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'User not authenticated' });
  }
  if (req.user.subscriptionTier !== 'pro') {
    return res.status(403).json({ error: 'This feature is only available to Pro users.' });
  }
  next();
}

export function requireFreeUser(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'User not authenticated' });
  }
  if (req.user.subscriptionTier !== 'free') {
    return res.status(403).json({ error: 'This feature is only available to Free users.' });
  }
  next();
}
