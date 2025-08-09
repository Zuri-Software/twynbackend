import { Request, Response } from 'express';
import { generateWithCharacter } from '../services/302aiService';
import { uploadBuffer } from '../services/s3';
import { incrementGenerationCount, logUserAction } from '../services/userService';


export async function handleGenerate(req: Request, res: Response) {
  console.log('handleGenerate: req.body:', req.body);
  
  if (!req.user) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  const body = (req.body && typeof req.body === 'object') ? req.body : {};
  
  // Extract parameters for 302.AI generation
  const prompt = body && typeof body.prompt === 'string' ? body.prompt : '';
  const style_id = body && typeof body.style_id === 'string' ? body.style_id : '';
  const higgsfield_id = body && typeof body.higgsfield_id === 'string' ? body.higgsfield_id : '';
  const quality = body.quality || 'basic';
  const aspect_ratio = body.aspect_ratio || '1:1';
  const enhance_prompt = body.enhance_prompt ?? true;
  const negative_prompt = body.negative_prompt || '';
  const seed = body.seed || Math.floor(Math.random() * 1000000);

  // Validate required fields
  if (!prompt || prompt.trim() === '') {
    return res.status(400).json({ error: 'Prompt is required' });
  }
  if (!style_id || style_id.trim() === '') {
    return res.status(400).json({ error: 'Style ID is required' });
  }

  try {
    console.log(`[Generate] User ${req.user.id} generating with style: ${style_id}, character: ${higgsfield_id || 'none'}`);

    // Generate a unique generation ID for tracking
    const generationId = `gen_${req.user.id}_${Date.now()}`;

    // Return immediately with generation started message
    res.json({
      generationId,
      status: 'started',
      message: 'Generation started, you will receive a push notification when complete',
      prompt,
      style_id,
      higgsfield_id: higgsfield_id || null
    });

    // Continue generation in background with push notification on completion
    processGenerationWithNotification({
      generationId,
      userId: req.user.id,
      prompt,
      style_id,
      higgsfield_id: higgsfield_id || undefined,
      quality: quality as 'basic' | 'high',
      aspect_ratio,
      enhance_prompt,
      negative_prompt,
      seed
    });

  } catch (error: any) {
    console.error('Generate controller error:', error);
    return res.status(500).json({ 
      error: error?.message || 'Generation failed',
      details: error?.stack || 'No additional details'
    });
  }
}

// Background processing with push notification
async function processGenerationWithNotification(params: {
  generationId: string;
  userId: string;
  prompt: string;
  style_id: string;
  higgsfield_id?: string;
  quality: 'basic' | 'high';
  aspect_ratio: string;
  enhance_prompt: boolean;
  negative_prompt: string;
  seed: number;
}) {
  try {
    console.log(`[Generate Background] Starting generation ${params.generationId}`);

    // Generate images using 302.AI
    const imageUrls = await generateWithCharacter({
      prompt: params.prompt,
      style_id: params.style_id,
      higgsfield_id: params.higgsfield_id,
      quality: params.quality,
      aspect_ratio: params.aspect_ratio,
      enhance_prompt: params.enhance_prompt,
      negative_prompt: params.negative_prompt,
      seed: params.seed
    });

    console.log(`[Generate Background] Got ${imageUrls.length} images from 302.AI for ${params.generationId}`);

    // S3 folder structure - use style_id or higgsfield_id for organization
    const modelId = params.higgsfield_id || params.style_id;
    const s3Folder = `users/${params.userId}/${modelId}/generations`;

    // Download images from 302.AI and upload to S3
    const s3Images = await Promise.all(
      imageUrls.map(async (imageUrl, index) => {
        try {
          const response = await fetch(imageUrl);
          if (!response.ok) {
            throw new Error(`Failed to fetch image ${index + 1}: ${response.status}`);
          }
          const buffer = Buffer.from(await response.arrayBuffer());
          return await uploadBuffer(buffer, s3Folder, 'image/jpeg');
        } catch (error) {
          console.error(`Error processing image ${index + 1}:`, error);
          throw error;
        }
      })
    );

    console.log(`[Generate Background] Uploaded ${s3Images.length} images to S3 for ${params.generationId}`);

    // Track usage
    await incrementGenerationCount(params.userId, s3Images.length);
    await logUserAction(params.userId, 'generate', s3Images.length, {
      generationId: params.generationId,
      prompt: params.prompt,
      style_id: params.style_id,
      higgsfield_id: params.higgsfield_id || null,
      quality: params.quality,
      aspect_ratio: params.aspect_ratio,
      imageCount: s3Images.length,
      timestamp: new Date()
    });

    console.log(`[Generate Background] Completed generation ${params.generationId}`);

    // Send push notification to user with generated images
    await sendGenerationCompletedNotification(params.userId, params.generationId, s3Images);

  } catch (error) {
    console.error(`[Generate Background] Error in generation ${params.generationId}:`, error);
    
    // Notify user of failure
    await sendGenerationFailedNotification(params.userId, params.generationId);
  }
}

// Push notification functions
async function sendGenerationCompletedNotification(userId: string, generationId: string, imageUrls: string[]) {
  try {
    const { pushNotificationService } = require('../services/pushNotificationService');
    
    await pushNotificationService.sendToUser(userId, {
      title: "Generation Complete!",
      body: `Your ${imageUrls.length} images are ready to view`,
      type: 'generation_complete',
      data: { 
        generationId, 
        imageUrls: imageUrls.slice(0, 4) // Limit URL array size in notification
      }
    });
    
    console.log(`[Push] ✅ Sent generation completion notification to user ${userId}: Generation ${generationId}`);
  } catch (error) {
    console.error('Failed to send generation completion notification:', error);
  }
}

async function sendGenerationFailedNotification(userId: string, generationId: string) {
  try {
    const { pushNotificationService } = require('../services/pushNotificationService');
    
    await pushNotificationService.sendToUser(userId, {
      title: "Generation Failed",
      body: "Your image generation could not be completed. Please try again.",
      type: 'generation_failed',
      data: { generationId }
    });
    
    console.log(`[Push] ✅ Sent generation failure notification to user ${userId}: Generation ${generationId}`);
  } catch (error) {
    console.error('Failed to send generation failure notification:', error);
  }
}
