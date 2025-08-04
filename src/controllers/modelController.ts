import { Request, Response } from 'express';
import { deleteS3Folder } from '../services/s3';
import { logUserAction } from '../services/userService';

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
