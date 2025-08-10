import { Request, Response } from 'express';
import { listImages, getAllGeneratedImagesForUser, getTrainingImages, deleteTrainingImages } from '../services/s3';
import { query } from '../services/database';

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

export async function getImageBatches(req: Request, res: Response) {
  try {
    console.log('Fetching image batches from database...');
    
    // Check if user is authenticated
    if (!req.user?.id) {
      return res.status(401).json({ 
        error: 'User not authenticated',
        batches: [],
        count: 0
      });
    }

    // Get all completed generations for this user, ordered by newest first
    const result = await query(
      `SELECT id, model_id, higgsfield_id, style_id, prompt, quality, aspect_ratio, 
              image_urls, image_count, created_at, completed_at 
       FROM generations 
       WHERE user_id = $1 AND status = 'completed' AND image_urls IS NOT NULL
       ORDER BY completed_at DESC, created_at DESC`,
      [req.user.id]
    );

    console.log(`Found ${result.rows.length} completed generations for user ${req.user.id}`);

    // Convert database rows to batch format
    const batches = result.rows.map(row => ({
      id: row.id, // generationId like "gen_userId_timestamp"
      images: row.image_urls || [],
      created_at: row.completed_at || row.created_at, // Use completion time if available
      higgsfield_id: row.higgsfield_id || row.model_id || row.style_id, // For compatibility
      // Additional metadata for potential frontend use
      metadata: {
        prompt: row.prompt,
        style_id: row.style_id,
        quality: row.quality,
        aspect_ratio: row.aspect_ratio,
        image_count: row.image_count
      }
    }));

    console.log(`Returning ${batches.length} generation batches for user ${req.user.id}`);
    
    res.status(200).json({ 
      batches,
      count: batches.length,
      userId: req.user.id
    });
  } catch (err: any) {
    console.error('getImageBatches error:', err);
    
    // Fallback to S3-based approach if database query fails
    console.log('Database query failed, falling back to S3-based image fetching...');
    
    // Check if user is still authenticated for fallback
    if (!req.user?.id) {
      return res.status(401).json({ 
        error: 'User not authenticated',
        batches: [],
        count: 0
      });
    }

    try {
      const images = await getAllGeneratedImagesForUser(req.user.id);
      
      // Create individual "batches" of 1 image each as fallback
      const fallbackBatches = images.map((image, index) => ({
        id: `fallback-single-${index}`,
        images: [image],
        created_at: new Date(Date.now() - (index * 1000)).toISOString(),
        higgsfield_id: `fallback-${index}`,
      }));

      console.log(`Fallback: Created ${fallbackBatches.length} individual image batches`);
      
      res.status(200).json({ 
        batches: fallbackBatches,
        count: fallbackBatches.length,
        userId: req.user.id,
        fallback: true
      });
    } catch (fallbackError: any) {
      res.status(500).json({ 
        error: fallbackError.message || 'Failed to load image batches',
        batches: [],
        count: 0
      });
    }
  }
}