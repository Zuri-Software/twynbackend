import dotenv from 'dotenv';
dotenv.config();

import { uploadBuffer, copyS3Object, deleteS3Object, listS3Objects } from './s3';
import { query } from './database';

// Configure the API key
const API_KEY = process.env.AI_302_API_KEY;
const BASE_URL = 'https://api.302.ai';

if (!API_KEY) {
  throw new Error('AI_302_API_KEY is required');
}

// Train character using S3 image URLs
export async function trainCharacter(imageBuffers: Buffer[], modelName: string, userId: string): Promise<{characterId: string, thumbnailUrl?: string}> {
  try {
    // 1. First submit training request to 302.AI to get the higgsfield_id
    // We'll use a temporary folder first, then reorganize after getting the ID
    const tempModelId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const tempS3Folder = `users/${userId}/${tempModelId}/training`;
    
    const uploadPromises = imageBuffers.map(async (buffer, idx) => {
      const imageUrl = await uploadBuffer(buffer, tempS3Folder, 'image/jpeg');
      console.log(`Uploaded training image ${idx + 1} to temp folder: ${imageUrl}`);
      return imageUrl;
    });

    const s3ImageUrls = await Promise.all(uploadPromises);
    console.log(`Successfully uploaded ${s3ImageUrls.length} training images to temp S3 folder`);

    // 2. Submit training request to 302.AI using S3 URLs
    const response = await fetch(`${BASE_URL}/higgsfield/character`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: modelName,
        input_images: s3ImageUrls
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`302.AI training failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('302.AI training response:', result);
    
    // 302.AI returns a task_id, not immediate character_id
    const taskId = result.task_id || result.id;
    if (!taskId) {
      throw new Error('No task_id returned from 302.AI training');
    }
    
    console.log(`Received task_id: ${taskId}, starting polling...`);
    
    // 3. Poll for completion and reorganize S3 files
    const trainingResult = await pollTrainingCompletion(taskId);
    
    // 4. Move S3 files from temp folder to higgsfield_id folder
    await reorganizeS3Files(userId, tempModelId, trainingResult.characterId);
    
    return trainingResult;
    
  } catch (error) {
    console.error('Error training character on 302.AI:', error);
    throw error;
  }
}

// Generate images using trained character and style
export async function generateWithCharacter(input: {
  prompt: string;
  style_id: string;
  higgsfield_id?: string; // Optional - for using trained character
  quality?: 'basic' | 'high';
  aspect_ratio?: string;
  enhance_prompt?: boolean;
  negative_prompt?: string;
  seed?: number;
}): Promise<{ imageUrls: string[], jobBatchId: string }> {
  try {
    // 1. Submit generation task
    const generatePayload = {
      prompt: input.prompt,
      style_id: input.style_id,
      quality: input.quality || 'basic', // API accepts 'basic' or 'high' 
      aspect_ratio: input.aspect_ratio || '3:4',
      enhance_prompt: input.enhance_prompt ?? true,
      seed: input.seed || Math.floor(Math.random() * 1000000),
      negative_prompt: input.negative_prompt || ''
      // Remove num_images - API docs don't show this parameter
    };

    // Add custom_reference_id if using trained character (302.AI parameter name)
    if (input.higgsfield_id) {
      console.log('[302.AI] Validating character ID:', input.higgsfield_id);
      
      // Try to validate the character ID first
      try {
        const isValid = await validateCharacterId(input.higgsfield_id);
        if (!isValid) {
          console.error('[302.AI] ❌ Character ID appears to be invalid or expired:', input.higgsfield_id);
          
          // Mark the model as expired in the database
          await markModelAsExpired(input.higgsfield_id);
          
          throw new Error(`Character ID ${input.higgsfield_id} is invalid or expired. Please retrain your model.`);
        }
        console.log('[302.AI] ✅ Character ID validated successfully');
        
        (generatePayload as any).custom_reference_id = input.higgsfield_id;
        (generatePayload as any).custom_reference_strength = 0.8;
      } catch (validationError) {
        console.error('[302.AI] Character ID validation failed:', validationError);
        throw validationError;
      }
    }

    // Validate critical parameters before sending
    console.log('[302.AI] Validating parameters...');
    console.log('[302.AI] - style_id format:', input.style_id, 'length:', input.style_id?.length);
    console.log('[302.AI] - higgsfield_id format:', input.higgsfield_id, 'length:', input.higgsfield_id?.length);
    console.log('[302.AI] - prompt length:', input.prompt?.length);
    console.log('[302.AI] - quality value:', generatePayload.quality);
    console.log('[302.AI] - aspect_ratio value:', generatePayload.aspect_ratio);
    
    console.log('Submitting generation task to 302.AI:', generatePayload);
    console.log('API URL:', `${BASE_URL}/higgsfield/text2image_soul`);
    console.log('API Key present:', !!API_KEY);
    console.log('API Key prefix:', API_KEY ? API_KEY.substring(0, 10) + '...' : 'None');

    const taskResponse = await fetch(`${BASE_URL}/higgsfield/text2image_soul`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(generatePayload)
    });

    if (!taskResponse.ok) {
      const errorText = await taskResponse.text();
      console.error(`[302.AI] HTTP ${taskResponse.status} Error Response:`, errorText);
      console.error(`[302.AI] Request payload that failed:`, JSON.stringify(generatePayload, null, 2));
      throw new Error(`302.AI generation submission failed: ${taskResponse.status} - ${errorText}`);
    }

    const taskResult = await taskResponse.json();
    const taskId = taskResult.id || taskResult.task_id;
    
    if (!taskId) {
      throw new Error('No task ID returned from 302.AI generation');
    }

    console.log(`Generation task submitted with ID: ${taskId}`);

    // 2. Poll for completion
    return await pollForResults(taskId);
    
  } catch (error) {
    console.error('Error generating with 302.AI:', error);
    throw error;
  }
}

// Poll for training completion
async function pollTrainingCompletion(taskId: string): Promise<{characterId: string, thumbnailUrl?: string}> {
  const maxAttempts = 180; // 30 minutes max (10s intervals) - much longer for training
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      console.log(`Polling training completion (attempt ${attempts + 1}/${maxAttempts})...`);
      
      const resultsResponse = await fetch(`${BASE_URL}/higgsfield/task/${taskId}/fetch`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${API_KEY}`
        }
      });

      if (!resultsResponse.ok) {
        throw new Error(`Training polling failed: ${resultsResponse.status}`);
      }

      const results = await resultsResponse.json();
      console.log(`Training poll response:`, results);

      // Check if task is completed - 302.AI returns status at root level
      if (results.status === 'completed') {
        // Extract character_id and thumbnail from the completed training
        const characterId = results.id || results.character_id || taskId;
        const thumbnailUrl = results.thumbnail_url;
        console.log(`Training completed! Character ID: ${characterId}, Thumbnail: ${thumbnailUrl}`);
        return { characterId, thumbnailUrl };
      }

      if (results.status === 'failed' || results.status === 'error') {
        throw new Error(`Training failed: ${results.error || 'Unknown error'}`);
      }

      // Task still in progress, wait and retry
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
      attempts++;
      
    } catch (error) {
      console.error(`Training polling attempt ${attempts + 1} failed:`, error);
      attempts++;
      
      if (attempts >= maxAttempts) {
        throw error;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }

  throw new Error(`Training timeout after ${maxAttempts} attempts (30 minutes)`);
}

// Train character using existing S3 image URLs (for onboarding images)
export async function trainCharacterFromExistingImages(
  imageUrls: string[], 
  modelName: string, 
  modelId: string
): Promise<{taskId: string}> {
  try {
    console.log(`[302.AI] Starting training for model ${modelId} with ${imageUrls.length} existing images`);

    // Submit training request to 302.AI using existing S3 URLs
    const response = await fetch(`${BASE_URL}/higgsfield/character`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: modelName,
        input_images: imageUrls
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`302.AI training failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log(`[302.AI] Training submission response:`, result);
    
    // 302.AI returns a task_id
    const taskId = result.task_id || result.id;
    if (!taskId) {
      throw new Error('No task_id returned from 302.AI training');
    }
    
    console.log(`[302.AI] Training submitted with task_id: ${taskId}`);
    return { taskId };
    
  } catch (error) {
    console.error(`[302.AI] Error starting training for model ${modelId}:`, error);
    throw error;
  }
}

// Async function to poll training completion and update model record
export async function pollAndUpdateModelTraining(
  taskId: string, 
  modelId: string, 
  userId: string
): Promise<void> {
  try {
    console.log(`[302.AI] Starting async polling for model ${modelId}, task ${taskId}`);
    
    // Poll for completion (this can take 10+ minutes)
    const trainingResult = await pollTrainingCompletion(taskId);
    
    // Update model record with results
    await query(
      `UPDATE models 
       SET higgsfield_id = $1, thumbnail_url = $2, status = $3, updated_at = NOW() 
       WHERE id = $4`,
      [trainingResult.characterId, trainingResult.thumbnailUrl, 'completed', modelId]
    );
    
    console.log(`[302.AI] ✅ Model ${modelId} training completed! Character ID: ${trainingResult.characterId}`);
    
  } catch (error) {
    console.error(`[302.AI] ❌ Training failed for model ${modelId}:`, error);
    
    // Mark model as failed
    try {
      await query(
        'UPDATE models SET status = $1, updated_at = NOW() WHERE id = $2',
        ['failed', modelId]
      );
      console.log(`[302.AI] Marked model ${modelId} as failed`);
    } catch (updateError) {
      console.error(`[302.AI] Failed to update model status to failed:`, updateError);
    }
  }
}

// Poll for generation results
async function pollForResults(taskId: string): Promise<{ imageUrls: string[], jobBatchId: string }> {
  const maxAttempts = 60; // 10 minutes max (10s intervals) - generation is faster than training
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      console.log(`Polling for results (attempt ${attempts + 1}/${maxAttempts})...`);
      
      const resultsResponse = await fetch(`${BASE_URL}/higgsfield/task/${taskId}/fetch`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${API_KEY}`
        }
      });

      if (!resultsResponse.ok) {
        throw new Error(`Polling failed: ${resultsResponse.status}`);
      }

      const results = await resultsResponse.json();
      console.log(`Poll response:`, results);

      // Check if task is completed (based on 302.AI response format)
      if (results.jobs && results.jobs.length > 0) {
        // Check if all jobs are completed
        const completedJobs = results.jobs.filter((job: any) => job.status === 'completed');
        
        if (completedJobs.length > 0) {
          // Extract image URLs from all completed jobs
          const imageUrls = [];
          
          for (const job of completedJobs) {
            if (job.results) {
              // 302.AI returns both min and raw image URLs - take raw for higher quality
              // Only take one version to avoid duplicates
              if (job.results.raw && job.results.raw.url) {
                imageUrls.push(job.results.raw.url);
              } else if (job.results.min && job.results.min.url) {
                // Fallback to min if raw is not available
                imageUrls.push(job.results.min.url);
              }
            }
          }

          if (imageUrls.length === 0) {
            throw new Error('No images found in completed task results');
          }

          console.log(`Generation completed! Got ${imageUrls.length} images from ${completedJobs.length} jobs`);
          return { 
            imageUrls, 
            jobBatchId: results.id || taskId // Use the batch ID from 302.AI response
          };
        }
        
        // Check if any jobs failed
        const failedJobs = results.jobs.filter((job: any) => job.status === 'failed' || job.status === 'error');
        if (failedJobs.length > 0) {
          const failedJob = failedJobs[0];
          throw new Error(`Generation failed: ${failedJob.error || 'Unknown error'}`);
        }

        // Check if content was flagged as NSFW
        const nsfwJobs = results.jobs.filter((job: any) => job.status === 'nsfw');
        if (nsfwJobs.length > 0) {
          console.log(`Generation flagged as NSFW: ${nsfwJobs.length} jobs flagged`);
          throw new Error('NSFW_CONTENT');
        }
      }

      // Task still in progress, wait and retry
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
      attempts++;
      
    } catch (error) {
      console.error(`Polling attempt ${attempts + 1} failed:`, error);
      attempts++;
      
      if (attempts >= maxAttempts) {
        throw error;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }

  throw new Error(`Generation timeout after ${maxAttempts} attempts`);
}

// Get training status using the task fetch endpoint
export async function getTrainingStatus(taskId: string) {
  try {
    const response = await fetch(`${BASE_URL}/higgsfield/task/${taskId}/fetch`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`
      }
    });

    if (!response.ok) {
      throw new Error(`Status check failed: ${response.status}`);
    }

    const results = await response.json();
    
    // Return status from root level - 302.AI returns status directly
    return {
      status: results.status || 'pending',
      higgsfield_id: results.id || taskId,
      result: results
    };
  } catch (error) {
    console.error('Error checking training status:', error);
    throw error;
  }
}

// Mark a model as expired when its character ID is no longer valid
async function markModelAsExpired(higgsfield_id: string): Promise<void> {
  try {
    const { query } = await import('./database');
    
    // Use 'failed' status since 'expired' might not be in the constraint yet
    await query(
      `UPDATE models 
       SET status = 'failed', updated_at = NOW() 
       WHERE higgsfield_id = $1`,
      [higgsfield_id]
    );
    
    console.log(`[302.AI] Marked model with higgsfield_id ${higgsfield_id} as expired`);
  } catch (error) {
    console.error(`[302.AI] Failed to mark model as expired:`, error);
  }
}

// Validate if a character ID is still valid in 302.AI
async function validateCharacterId(characterId: string): Promise<boolean> {
  try {
    console.log(`[302.AI] Validating character ID: ${characterId}`);
    
    // Try to fetch the character task status
    const response = await fetch(`${BASE_URL}/higgsfield/task/${characterId}/fetch`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`
      }
    });
    
    if (!response.ok) {
      console.log(`[302.AI] Character validation failed with HTTP ${response.status}`);
      return false;
    }
    
    const result = await response.json();
    console.log(`[302.AI] Character validation response:`, result);
    
    // Character is valid if it exists and is completed
    return result.status === 'completed';
    
  } catch (error) {
    console.error(`[302.AI] Character validation error:`, error);
    return false;
  }
}

// Reorganize S3 files from temp folder to higgsfield_id folder
async function reorganizeS3Files(userId: string, tempModelId: string, higgsfield_id: string): Promise<void> {
  try {
    const tempFolder = `users/${userId}/${tempModelId}/`;
    const finalFolder = `users/${userId}/${higgsfield_id}/`;
    
    console.log(`Moving S3 files from ${tempFolder} to ${finalFolder}`);
    
    // List objects in temp folder
    const objects = await listS3Objects(tempFolder);
    
    // Copy each object to new location
    for (const obj of objects) {
      const oldKey = obj.Key!;
      const newKey = oldKey.replace(tempFolder, finalFolder);
      
      await copyS3Object(oldKey, newKey);
      await deleteS3Object(oldKey);
      
      console.log(`Moved S3 object: ${oldKey} → ${newKey}`);
    }
    
    console.log(`Successfully reorganized S3 files for higgsfield_id: ${higgsfield_id}`);
    
  } catch (error) {
    console.error('Error reorganizing S3 files:', error);
    // Don't throw - training succeeded, file organization is secondary
  }
}