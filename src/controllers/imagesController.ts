import { Request, Response } from 'express';
import { listImages, getAllGeneratedImagesForUser, getTrainingImages, deleteTrainingImages } from '../services/s3';

export async function getImages(req: Request, res: Response) {
  try {
    console.log('Fetching images from S3...');
    
    // Check if user is authenticated
    if (!req.user?.id) {
      return res.status(401).json({ 
        error: 'User not authenticated',
        images: [],
        count: 0
      });
    }

    // Get all generated images for this user across all their models
    const images = await getAllGeneratedImagesForUser(req.user.id);
    
    if (!images || !Array.isArray(images)) {
      throw new Error('S3 connection failed');
    }
    
    console.log(`Found ${images.length} images for user ${req.user.id}`);
    res.status(200).json({ 
      images,
      count: images.length,
      userId: req.user.id
    });
  } catch (err: any) {
    console.error('getImages error:', err);
    res.status(500).json({ 
      error: err.message || 'S3 connection failed',
      images: [],
      count: 0
    });
  }
}

export async function getTrainingImagesForModel(req: Request, res: Response) {
  try {
    const { modelId } = req.params;
    if (!modelId) {
      return res.status(400).json({ error: 'Model ID is required' });
    }
    
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    console.log(`Fetching training images for model: ${modelId}, user: ${req.user.id}`);
    const trainingImages = await getTrainingImages(req.user.id, modelId);
    if (!trainingImages || !Array.isArray(trainingImages)) {
      throw new Error('S3 connection failed');
    }
    console.log(`Found ${trainingImages.length} training images for model ${modelId}`);
    res.status(200).json({ 
      images: trainingImages,
      count: trainingImages.length,
      modelId 
    });
  } catch (err: any) {
    console.error('getTrainingImagesForModel error:', err);
    res.status(500).json({ 
      error: err.message || 'S3 connection failed',
      images: [],
      count: 0
    });
  }
}

export async function deleteTrainingImagesForModel(req: Request, res: Response) {
  try {
    const { modelId } = req.params;
    if (!modelId) {
      return res.status(400).json({ error: 'Model ID is required' });
    }
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    console.log(`Deleting training images for model: ${modelId}, user: ${req.user.id}`);
    await deleteTrainingImages(req.user.id, modelId);
    console.log(`Successfully deleted training images for model ${modelId}`);
    res.status(200).json({ 
      success: true,
      message: `Training images for model ${modelId} have been deleted`,
      modelId 
    });
  } catch (err: any) {
    console.error('deleteTrainingImagesForModel error:', err);
    res.status(500).json({ 
      error: err.message || 'Delete failed',
      success: false
    });
  }
}