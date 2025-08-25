import { Request, Response } from 'express';
import { getSupabaseUserProfile } from '../services/supabase';
import { updateUserProfile as updateUserProfileDB, upgradeUserToPro, logUserAction, getUserModels, completeUserOnboarding, registerDeviceToken } from '../services/userService';
import { getUserLimits } from '../config/limits';

// Get user profile (combines Supabase auth data with our database data)
export async function getUserProfile(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    // Fetch fresh user data from database to ensure we have latest name
    const { getUserById } = require('../services/userService');
    const dbUser = await getUserById(req.user.id);
    
    if (!dbUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userProfile = {
      id: dbUser.id,
      phone: dbUser.phone,
      name: dbUser.name,
      subscriptionTier: dbUser.subscription_tier,
      modelCount: dbUser.model_count,
      monthlyGenerations: dbUser.monthly_generations,
      onboardingCompleted: dbUser.onboarding_completed,
      createdAt: dbUser.created_at,
      updatedAt: dbUser.updated_at,
    };
    
    console.log(`[UserController] Returning profile for ${dbUser.phone}, name: '${dbUser.name || 'null'}'`);
    res.json({ user: userProfile });
  } catch (error) {
    console.error('Error getting user profile:', error);
    res.status(500).json({ error: 'Failed to get user profile' });
  }
}

// Update user profile
export async function updateUserProfile(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const { name, dateOfBirth, gender } = req.body;
    if (!name || !dateOfBirth || !gender) {
      return res.status(400).json({ error: 'Missing required fields: name, dateOfBirth, gender' });
    }
    // Update user data in PostgreSQL database
    const updatedUser = await updateUserProfileDB(req.user.id, {
      name,
      date_of_birth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      gender
    });
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    console.log(`[UserController] Updated profile for user ${req.user.id}:`, {
      name, dateOfBirth, gender
    });
    res.json({ 
      success: true, 
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        phone: updatedUser.phone,
        name: updatedUser.name,
        dateOfBirth: updatedUser.date_of_birth,
        gender: updatedUser.gender,
        subscriptionTier: updatedUser.subscription_tier,
        modelCount: updatedUser.model_count,
        monthlyGenerations: updatedUser.monthly_generations,
        onboardingCompleted: updatedUser.onboarding_completed,
      }
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
}

// Get user usage stats
export async function getUserUsage(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    // Get usage data from database (loaded in auth middleware)
    const limits = getUserLimits(req.user.subscriptionTier);
    const usage = {
      modelsCreated: req.user.modelCount,
      imagesGenerated: req.user.monthlyGenerations,
      subscriptionTier: req.user.subscriptionTier,
      limits: {
        models: limits.models,
        generations: limits.monthlyGenerations
      },
      // Include detailed status if usage check middleware was used
      ...(req.usage && {
        canCreateModel: req.usage.models.canCreate,
        canGenerateImages: req.usage.generations.canGenerate
      })
    };
    
    res.json({ usage });
  } catch (error) {
    console.error('Error getting user usage:', error);
    res.status(500).json({ error: 'Failed to get usage data' });
  }
}

// Get user's models
export async function getUserModelsController(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const models = await getUserModels(req.user.id);
    
    // Debug: Log the first model to see what data we're returning
    if (models.length > 0) {
      console.log('[UserController] Sample model data:', JSON.stringify(models[0], null, 2));
    }
    
    res.json({ 
      models,
      count: models.length,
      userId: req.user.id
    });
  } catch (error) {
    console.error('Error getting user models:', error);
    res.status(500).json({ error: 'Failed to get user models' });
  }
}

// Upgrade user to pro (placeholder for payment integration)
export async function upgradeUser(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    // Validate required fields (simulate paymentInfo required for upgrade)
    const { paymentInfo } = req.body;
    if (!paymentInfo) {
      return res.status(400).json({ error: 'Missing required field: paymentInfo' });
    }
    if (!req.user.id) {
      return res.status(400).json({ error: 'Missing required field: user id' });
    }
    // TODO: Integrate with payment system before upgrading
    // Update user subscription_tier in database
    const updatedUser = await upgradeUserToPro(req.user.id);
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    // Log the upgrade action
    await logUserAction(req.user.id, 'upgrade', 1);
    console.log(`[UserController] Upgraded user ${req.user.id} to pro`);
    res.json({ 
      success: true, 
      message: 'User upgraded to pro successfully',
      subscriptionTier: updatedUser.subscription_tier,
      user: {
        id: updatedUser.id,
        phone: updatedUser.phone,
        name: updatedUser.name,
        subscriptionTier: updatedUser.subscription_tier,
        modelCount: updatedUser.model_count,
        monthlyGenerations: updatedUser.monthly_generations,
      }
    });
  } catch (error) {
    console.error('Error upgrading user:', error);
    res.status(500).json({ error: 'Failed to upgrade user' });
  }
}

// Complete user onboarding
export async function completeOnboarding(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const updatedUser = await completeUserOnboarding(req.user.id);
    
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log(`[UserController] Completed onboarding for user ${req.user.id}`);
    
    res.json({ 
      success: true, 
      message: 'Onboarding completed successfully',
      user: {
        id: updatedUser.id,
        phone: updatedUser.phone,
        name: updatedUser.name,
        subscriptionTier: updatedUser.subscription_tier,
        modelCount: updatedUser.model_count,
        monthlyGenerations: updatedUser.monthly_generations,
        onboardingCompleted: updatedUser.onboarding_completed,
      }
    });
  } catch (error) {
    console.error('Error completing onboarding:', error);
    res.status(500).json({ error: 'Failed to complete onboarding' });
  }
}

// Register device token for push notifications
export async function registerDeviceTokenController(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const { deviceToken, platform } = req.body;
    
    if (!deviceToken) {
      return res.status(400).json({ error: 'Missing required field: deviceToken' });
    }
    
    if (!platform || !['ios', 'android', 'expo'].includes(platform)) {
      return res.status(400).json({ error: 'Missing or invalid platform field. Must be "ios", "android", or "expo"' });
    }
    
    await registerDeviceToken(req.user.id, deviceToken, platform);
    
    console.log(`[UserController] Registered device token for user ${req.user.id}, platform: ${platform}`);
    
    res.json({ 
      success: true, 
      message: 'Device token registered successfully'
    });
  } catch (error) {
    console.error('Error registering device token:', error);
    res.status(500).json({ error: 'Failed to register device token' });
  }
}

// Check if user has active device token
export async function checkDeviceTokenStatusController(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const { hasActiveDeviceToken } = require('../services/userService');
    const hasToken = await hasActiveDeviceToken(req.user.id);
    
    console.log(`[UserController] Device token status for user ${req.user.id}: ${hasToken ? 'exists' : 'missing'}`);
    
    res.json({ 
      hasDeviceToken: hasToken
    });
  } catch (error) {
    console.error('Error checking device token status:', error);
    res.status(500).json({ error: 'Failed to check device token status' });
  }
}