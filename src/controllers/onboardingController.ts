import { Request, Response } from 'express';
import { uploadBuffer, checkOnboardingTempFolder, moveTempFolderToModelFolder, getTrainingImages } from '../services/s3';
import { logUserAction, incrementModelCount } from '../services/userService';
import { query } from '../services/database';
import { trainCharacterFromExistingImages, pollAndUpdateModelTraining } from '../services/302aiService';
import { v4 as uuidv4 } from 'uuid';

// POST /api/onboarding/images
export async function handleOnboardingImageUpload(req: Request, res: Response) {
  const userId = req.user?.id;
  const tempModelId = req.body.tempModelId;
  const file = req.file;

  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }
  if (!tempModelId) {
    return res.status(400).json({ error: 'tempModelId is required' });
  }
  if (!file || !file.buffer) {
    return res.status(400).json({ error: 'Image file is required' });
  }

  const s3Folder = `users/${userId}/${tempModelId}/training`;

  try {
    const s3Url = await uploadBuffer(Buffer.from(file.buffer), s3Folder, file.mimetype || 'image/jpeg');
    await logUserAction(userId, 'upload', 1, {
      tempModelId,
      s3Url,
      timestamp: new Date()
    });
    return res.status(200).json({ s3Url });
  } catch (err: any) {
    const msg = err?.message ? String(err.message) : String(err);
    return res.status(500).json({ error: `S3 upload failed: ${msg}` });
  }
}

// POST /api/onboarding/batch-upload - Multiple images for temp folder
export async function handleOnboardingBatchUpload(req: Request, res: Response) {
  const userId = req.user?.id;
  const files = req.files as Express.Multer.File[];

  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }
  
  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'At least one image file is required' });
  }

  if (files.length < 15) {
    return res.status(400).json({ error: 'Minimum 15 images required for avatar training' });
  }

  if (files.length > 25) {
    return res.status(400).json({ error: 'Maximum 25 images allowed' });
  }

  // Generate temp model ID for this onboarding upload
  const tempModelId = `temp_${Date.now()}_${uuidv4().slice(0, 8)}`;
  const s3Folder = `users/${userId}/${tempModelId}/training`;

  try {
    console.log(`[Onboarding] Starting batch upload of ${files.length} images for user ${userId}`);
    
    // Upload all images to S3
    const uploadPromises = files.map(async (file, index) => {
      const s3Url = await uploadBuffer(
        Buffer.from(file.buffer), 
        s3Folder, 
        file.mimetype || 'image/jpeg'
      );
      console.log(`[Onboarding] Uploaded image ${index + 1}/${files.length}: ${s3Url}`);
      return s3Url;
    });

    const s3Urls = await Promise.all(uploadPromises);
    
    // Log the batch upload action
    await logUserAction(userId, 'upload', files.length, {
      tempModelId,
      s3Urls,
      isOnboarding: true,
      timestamp: new Date()
    });

    console.log(`[Onboarding] Successfully uploaded ${s3Urls.length} images to temp folder: ${tempModelId}`);

    return res.status(200).json({
      tempModelId,
      uploadedCount: s3Urls.length,
      s3Urls,
      message: `Successfully uploaded ${s3Urls.length} images for avatar training`
    });

  } catch (err: any) {
    console.error(`[Onboarding] Batch upload failed for user ${userId}:`, err);
    const msg = err?.message ? String(err.message) : String(err);
    return res.status(500).json({ error: `Batch upload failed: ${msg}` });
  }
}

// GET /api/onboarding/check-temp-folder - Check if user has temp folder with onboarding images
export async function checkOnboardingTempFolderHandler(req: Request, res: Response) {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  try {
    console.log(`[Onboarding] Checking temp folder for user ${userId}`);
    
    const tempFolderInfo = await checkOnboardingTempFolder(userId);
    
    if (tempFolderInfo.exists) {
      console.log(`[Onboarding] User ${userId} has temp folder: ${tempFolderInfo.tempFolderName} with ${tempFolderInfo.imageCount} images`);
      
      return res.status(200).json({
        hasOnboardingImages: true,
        tempFolderName: tempFolderInfo.tempFolderName,
        imageCount: tempFolderInfo.imageCount,
        imageUrls: tempFolderInfo.imageUrls,
        message: `Found ${tempFolderInfo.imageCount} images from your onboarding upload`
      });
    } else {
      console.log(`[Onboarding] User ${userId} has no temp folders with images`);
      
      return res.status(200).json({
        hasOnboardingImages: false,
        message: 'No onboarding images found'
      });
    }

  } catch (err: any) {
    console.error(`[Onboarding] Check temp folder failed for user ${userId}:`, err);
    const msg = err?.message ? String(err.message) : String(err);
    return res.status(500).json({ error: `Failed to check onboarding images: ${msg}` });
  }
}

// POST /api/onboarding/train-from-images - Create first model using onboarding images  
export async function trainModelFromOnboardingImages(req: Request, res: Response) {
  const userId = req.user?.id;
  const { modelName, tempFolderName } = req.body;

  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  if (!modelName || typeof modelName !== 'string' || modelName.trim().length === 0) {
    return res.status(400).json({ error: 'Model name is required' });
  }

  if (!tempFolderName || typeof tempFolderName !== 'string') {
    return res.status(400).json({ error: 'Temp folder name is required' });
  }

  try {
    console.log(`[Onboarding] Starting model training from onboarding images for user ${userId}`);
    console.log(`[Onboarding] Model name: "${modelName}", Temp folder: "${tempFolderName}"`);

    // Verify temp folder exists
    const tempFolderInfo = await checkOnboardingTempFolder(userId);
    if (!tempFolderInfo.exists || tempFolderInfo.tempFolderName !== tempFolderName) {
      return res.status(404).json({ error: 'Onboarding images not found or temp folder mismatch' });
    }

    // Generate new model ID
    const modelId = uuidv4();
    
    // Create model record in database with 'training' status
    const modelResult = await query(
      `INSERT INTO models (id, user_id, name, status, temp_folder_name, photo_count, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) 
       RETURNING *`,
      [modelId, userId, modelName.trim(), 'training', tempFolderName, tempFolderInfo.imageCount]
    );

    const createdModel = modelResult.rows[0];
    console.log(`[Onboarding] Created model record: ${modelId} with status 'training'`);

    // Move images from temp folder to permanent model folder
    const moveResult = await moveTempFolderToModelFolder(userId, tempFolderName, modelId);
    
    if (!moveResult.success || moveResult.movedCount === 0) {
      // Rollback: delete the model record
      await query('DELETE FROM models WHERE id = $1', [modelId]);
      return res.status(500).json({ error: 'Failed to move onboarding images to model folder' });
    }

    // Increment user's model count
    await incrementModelCount(userId);

    // Log the training action
    await logUserAction(userId, 'train', 1, {
      modelId,
      modelName: modelName.trim(),
      source: 'onboarding',
      tempFolderName,
      imageCount: moveResult.movedCount,
      timestamp: new Date()
    });

    console.log(`[Onboarding] Successfully created model ${modelId} from onboarding images`);
    console.log(`[Onboarding] Moved ${moveResult.movedCount} images from temp folder`);

    // Start actual 302.AI training with the moved images
    try {
      // Get the training images from the new permanent folder
      const trainingImageUrls = await getTrainingImages(userId, modelId);
      
      if (trainingImageUrls.length === 0) {
        throw new Error('No training images found in permanent model folder');
      }
      
      console.log(`[Onboarding] Starting 302.AI training with ${trainingImageUrls.length} images`);
      
      // Submit training (returns immediately with task_id)
      const trainingSubmission = await trainCharacterFromExistingImages(
        trainingImageUrls, 
        modelName.trim(), 
        modelId
      );
      
      console.log(`[Onboarding] 302.AI training submitted with task_id: ${trainingSubmission.taskId}`);
      
      // Start async polling (don't await this - let it run in background)
      pollAndUpdateModelTraining(trainingSubmission.taskId, modelId, userId)
        .catch(error => {
          console.error(`[Onboarding] Background training polling failed for model ${modelId}:`, error);
        });
        
    } catch (trainingError) {
      console.error(`[Onboarding] Failed to start 302.AI training for model ${modelId}:`, trainingError);
      
      // Mark model as failed but still return success to user
      try {
        await query('UPDATE models SET status = $1, updated_at = NOW() WHERE id = $2', ['failed', modelId]);
      } catch (updateError) {
        console.error(`[Onboarding] Failed to update model status to failed:`, updateError);
      }
    }

    return res.status(200).json({
      success: true,
      model: {
        id: createdModel.id,
        name: createdModel.name,
        status: createdModel.status,
        userId: createdModel.user_id,
        photoCount: createdModel.photo_count,
        createdAt: createdModel.created_at,
        updatedAt: createdModel.updated_at
      },
      message: `Model "${modelName}" created successfully from onboarding images`,
      imagesUsed: moveResult.movedCount,
      trainingStatus: 'started'
    });

  } catch (err: any) {
    console.error(`[Onboarding] Training from onboarding images failed for user ${userId}:`, err);
    const msg = err?.message ? String(err.message) : String(err);
    return res.status(500).json({ error: `Failed to create model from onboarding images: ${msg}` });
  }
}
