import { Request, Response } from 'express';
import { trainCharacter } from '../services/302aiService';
import { incrementModelCount, logUserAction, createModel, updateModelStatus } from '../services/userService';

export const trainController = async (req: Request, res: Response) => { 
  let modelRecord = null;
  
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const files = req.files as Express.Multer.File[];
    if (!files?.length) {
      return res.status(400).json({ error: 'No images uploaded' });
    }

    // Get model name from form data (fallback to generated name)
    const userModelName = req.body.modelName?.trim();
    const modelName = userModelName || `user_${req.user.id}_${Date.now()}`;
    console.log(`[Train] Using model name: "${modelName}" (user provided: ${!!userModelName})`);
    
    // 1. Create model record in Supabase with pending status
    modelRecord = await createModel({
      user_id: req.user.id,
      name: modelName,
      photo_count: files.length
    });
    
    console.log(`[Train] Created model record: ${modelRecord.id} for user ${req.user.id}`);
    
    // 2. Return immediately, then process training in background with push notification
    res.json({ 
      modelId: modelRecord.id,
      modelName,
      status: 'pending',
      message: 'Training started, you will receive a push notification when complete'
    });
    
    // 3. Continue training in background with push notification on completion
    processTrainingWithNotification(modelRecord.id, files.map(f => f.buffer), modelName, req.user.id);
    
  } catch (err: any) {
    console.error('trainController error:', err);
    
    // If we created a model record but training failed, mark it as failed
    if (modelRecord) {
      try {
        await updateModelStatus(modelRecord.id, 'failed');
        console.log(`[Train] Marked model ${modelRecord.id} as failed due to error`);
      } catch (updateErr) {
        console.error('Failed to update model status to failed:', updateErr);
      }
    }
    
    res.status(500).json({ error: err.message });
  }
};

// Background processing with push notification
async function processTrainingWithNotification(modelId: string, imageBuffers: Buffer[], modelName: string, userId: string) {
  try {
    console.log(`[Train Background] Starting training for model ${modelId}`);
    
    // Update status to training
    await updateModelStatus(modelId, 'training');
    
    // Train character using 302.AI (this takes time)
    const trainingResult = await trainCharacter(imageBuffers, modelName, userId);
    
    // Update model record with completed status, higgsfield_id, and thumbnail
    await updateModelStatus(modelId, 'completed', trainingResult.characterId, trainingResult.thumbnailUrl);
    
    // Track usage: increment model count and log action
    await incrementModelCount(userId);
    await logUserAction(userId, 'train', 1, { 
      higgsfield_id: trainingResult.characterId, 
      modelName,
      photoCount: imageBuffers.length,
      supabaseModelId: modelId,
      thumbnailUrl: trainingResult.thumbnailUrl,
      timestamp: new Date()
    });
    
    console.log(`[Train Background] Completed training for model ${modelId} (higgsfield_id: ${trainingResult.characterId})`);
    
    // Send push notification to user
    await sendTrainingCompletedNotification(userId, modelName, trainingResult.characterId);
    
  } catch (error) {
    console.error(`[Train Background] Error training model ${modelId}:`, error);
    
    // Mark as failed and notify user
    try {
      await updateModelStatus(modelId, 'failed');
      await sendTrainingFailedNotification(userId, modelName);
    } catch (updateErr) {
      console.error('Failed to update model status to failed:', updateErr);
    }
  }
}

// Push notification functions
async function sendTrainingCompletedNotification(userId: string, modelName: string, higgsFieldId: string) {
  try {
    const { pushNotificationService } = require('../services/pushNotificationService');
    
    await pushNotificationService.sendToUser(userId, {
      title: "Training Complete!",
      body: `Your model "${modelName}" is ready to use`,
      type: 'training_complete',
      data: { higgsfield_id: higgsFieldId, modelName }
    });
    
    console.log(`[Push] ✅ Sent training completion notification to user ${userId}: Model "${modelName}" (${higgsFieldId})`);
  } catch (error) {
    console.error('Failed to send completion notification:', error);
  }
}

async function sendTrainingFailedNotification(userId: string, modelName: string) {
  try {
    const { pushNotificationService } = require('../services/pushNotificationService');
    
    await pushNotificationService.sendToUser(userId, {
      title: "Training Failed",
      body: `Your model "${modelName}" could not be trained. Please try again.`,
      type: 'training_failed',
      data: { modelName }
    });
    
    console.log(`[Push] ✅ Sent training failure notification to user ${userId}: Model "${modelName}"`);
  } catch (error) {
    console.error('Failed to send failure notification:', error);
  }
}