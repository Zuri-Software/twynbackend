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

    // Generate model name for the user
    const modelName = `user_${req.user.id}_${Date.now()}`;
    
    // 1. Create model record in Supabase with pending status
    modelRecord = await createModel({
      user_id: req.user.id,
      name: modelName,
      photo_count: files.length
    });
    
    console.log(`[Train] Created model record: ${modelRecord.id} for user ${req.user.id}`);
    
    // 2. Return immediately with the model ID, then process in background
    res.json({ 
      supabaseModelId: modelRecord.id,
      modelName,
      status: 'pending',
      message: 'Training started, check status with GET /api/train/:id/status'
    });
    
    // 3. Continue training in background (don't await)
    processTrainingInBackground(modelRecord.id, files.map(f => f.buffer), modelName, req.user.id);
    
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

// Background processing function
async function processTrainingInBackground(modelId: string, imageBuffers: Buffer[], modelName: string, userId: string) {
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
    
  } catch (error) {
    console.error(`[Train Background] Error training model ${modelId}:`, error);
    
    // Mark as failed
    try {
      await updateModelStatus(modelId, 'failed');
    } catch (updateErr) {
      console.error('Failed to update model status to failed:', updateErr);
    }
  }
}