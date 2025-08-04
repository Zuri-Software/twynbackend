import { Request, Response } from 'express';
import { deleteS3Folder } from '../services/s3';
import { logUserAction, getUserModels, getModelById } from '../services/userService';

// DELETE /api/models/:modelId
export async function handleDeleteModel(req: Request, res: Response) {
  const userId = req.user?.id;
  const modelId = req.params.modelId;

  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }
  if (!modelId) {
    return res.status(400).json({ error: 'modelId is required' });
  }

  const s3Folder = `users/${userId}/${modelId}/training`;

  try {
    await deleteS3Folder(s3Folder);
    // Remove model from Supabase
    const { deleteModel } = await import('../services/userService');
    await deleteModel(userId, modelId);
    await logUserAction(userId, 'train', 0, {
      modelId,
      action: 'delete',
      timestamp: new Date()
    });
    return res.status(200).json({ success: true });
  } catch (err: any) {
    const msg = err?.message ? String(err.message) : String(err);
    return res.status(500).json({ error: `Delete failed: ${msg}` });
  }
}

// GET /api/models - Get all user's models
export async function handleGetUserModels(req: Request, res: Response) {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  try {
    const models = await getUserModels(userId);
    res.json({ models });
  } catch (err: any) {
    console.error('Get user models error:', err);
    res.status(500).json({ error: err.message || 'Failed to get models' });
  }
}

// GET /api/models/:modelId - Get specific model
export async function handleGetModel(req: Request, res: Response) {
  const userId = req.user?.id;
  const modelId = req.params.modelId;

  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }
  if (!modelId) {
    return res.status(400).json({ error: 'modelId is required' });
  }

  try {
    const model = await getModelById(modelId, userId);
    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }
    res.json(model);
  } catch (err: any) {
    console.error('Get model error:', err);
    res.status(500).json({ error: err.message || 'Failed to get model' });
  }
}
