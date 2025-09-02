import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { analyzeImageForAvatar } from '../services/openaiService';
import { uploadBuffer } from '../services/s3';
import { query } from '../services/database';
import { logUserAction } from '../services/userService';
import { generateWithCharacter } from '../services/302aiService';
import multer from 'multer';

// Configure multer for image uploads (in memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only allow image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

export const uploadMiddleware = upload.single('photo');

/**
 * Capture and analyze photo for avatar generation
 * POST /api/camera/capture
 */
export async function captureAndAnalyze(req: Request, res: Response) {
  try {
    console.log('[Camera Controller] 📸 Processing camera capture request');
    
    const { captureId, modelId, styleId, quality = 'basic', aspectRatio = '1:1', generateImmediately = false } = req.body;
    const userId = req.user!.id;
    
    // Check if this is generation on existing capture or new capture
    if (captureId && generateImmediately === 'true') {
      console.log('[Camera Controller] 🔄 Processing generation for existing capture:', captureId);
      return await handleExistingCaptureGeneration(req, res, userId, captureId, modelId, styleId, quality, aspectRatio);
    }
    
    // For new captures, require photo
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No photo provided. Please capture or select a photo.',
      });
    }

    console.log('[Camera Controller] 📁 Received photo:', {
      size: req.file.size,
      mimetype: req.file.mimetype,
      filename: req.file.originalname,
    });

    // Generate unique ID for this new capture
    const newCaptureId = uuidv4();
    
    try {
      // Step 1: Upload photo to S3
      console.log('[Camera Controller] ☁️ Uploading photo to S3...');
      const s3Key = `users/${userId}/camera-captures/${newCaptureId}.jpg`;
      const captureUrl = await uploadBuffer(req.file.buffer, s3Key, 'image/jpeg');
      console.log('[Camera Controller] ✅ Photo uploaded to S3:', captureUrl);

      // Step 2: Analyze image with OpenAI
      console.log('[Camera Controller] 🔍 Analyzing image with OpenAI...');
      const analysisResult = await analyzeImageForAvatar(req.file.buffer);
      console.log('[Camera Controller] ✅ Image analysis complete');

      // Step 3: Store capture record in database
      const captureQuery = `
        INSERT INTO camera_captures (id, user_id, capture_url, generated_prompt, analysis_metadata, status, analyzed_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING *
      `;
      
      const captureResult = await query(captureQuery, [
        newCaptureId,
        userId,
        captureUrl,
        analysisResult.prompt,
        JSON.stringify(analysisResult.metadata || {}),
        'analyzed'
      ]);

      console.log('[Camera Controller] 💾 Capture record saved to database');

      // Step 4: Log user action (use 'upload' temporarily until migration is run)
      await logUserAction(userId, 'upload', 1, { captureId: newCaptureId });

      // Step 5: Optionally start generation immediately
      let generationId: string | undefined;
      let estimatedTime: number | undefined;

      if (generateImmediately && modelId) {
        try {
          console.log('[Camera Controller] 🚀 Starting immediate generation...');
          
          // Create generation ID
          generationId = `gen_${userId}_${Date.now()}`;
          
          // Start the generation (this will be async)
          // We'll return immediately with the generation ID
          startCameraGeneration(userId, newCaptureId, generationId, modelId, styleId, analysisResult.prompt, quality, aspectRatio);
          
          estimatedTime = 60; // Estimated 60 seconds for generation
          console.log('[Camera Controller] 🎯 Generation started:', generationId);
          
        } catch (genError) {
          console.error('[Camera Controller] ❌ Failed to start generation:', genError);
          // Don't fail the whole request if generation fails
        }
      }

      // Return success response
      const responseData = {
        success: true,
        data: {
          captureId: newCaptureId,
          prompt: analysisResult.prompt,
          generationId,
          estimatedTime,
          metadata: analysisResult.metadata,
        },
      };
      
      console.log('[Camera Controller] 📤 Sending response to frontend:', JSON.stringify(responseData, null, 2));
      res.json(responseData);

    } catch (processingError) {
      console.error('[Camera Controller] ❌ Processing error:', processingError);
      
      // Return appropriate error messages
      if (processingError instanceof Error) {
        if (processingError.message.includes('content policy') || processingError.message.includes('cannot be used')) {
          return res.status(400).json({
            success: false,
            error: 'This photo cannot be used for avatar generation. Please try a different photo.',
            code: 'CONTENT_RESTRICTED',
          });
        } else if (processingError.message.includes('rate limit') || processingError.message.includes('busy')) {
          return res.status(429).json({
            success: false,
            error: 'Service is currently busy. Please try again in a few minutes.',
            code: 'RATE_LIMITED',
          });
        }
      }
      
      return res.status(500).json({
        success: false,
        error: 'Failed to analyze photo. Please try again.',
        code: 'ANALYSIS_FAILED',
      });
    }

  } catch (error) {
    console.error('[Camera Controller] ❌ Capture request failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process camera capture. Please try again.',
      code: 'CAPTURE_FAILED',
    });
  }
}

/**
 * Analyze photo only (without generation)
 * POST /api/camera/analyze
 */
export async function analyzePhoto(req: Request, res: Response) {
  try {
    console.log('[Camera Controller] 🔍 Processing analyze-only request');
    
    const { analysisType = 'standard' } = req.body;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No photo provided',
      });
    }

    // Analyze image with OpenAI
    const analysisResult = await analyzeImageForAvatar(
      req.file.buffer, 
      analysisType as 'standard' | 'detailed'
    );

    res.json({
      success: true,
      data: {
        prompt: analysisResult.prompt,
        metadata: analysisResult.metadata,
      },
    });

  } catch (error) {
    console.error('[Camera Controller] ❌ Analysis request failed:', error);
    
    if (error instanceof Error && error.message.includes('content policy')) {
      return res.status(400).json({
        success: false,
        error: 'This photo cannot be analyzed for avatar generation.',
        code: 'CONTENT_RESTRICTED',
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to analyze photo. Please try again.',
      code: 'ANALYSIS_FAILED',
    });
  }
}

/**
 * Get user's camera capture history
 * GET /api/camera/captures
 */
export async function getCaptureHistory(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const { limit = 20, offset = 0 } = req.query;

    const capturesQuery = `
      SELECT 
        cc.*,
        g.status as generation_status,
        g.image_urls as generated_images
      FROM camera_captures cc
      LEFT JOIN generations g ON cc.generation_id = g.id
      WHERE cc.user_id = $1
      ORDER BY cc.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await query(capturesQuery, [userId, limit, offset]);

    res.json({
      success: true,
      data: result.rows,
    });

  } catch (error) {
    console.error('[Camera Controller] ❌ Failed to get capture history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve capture history',
    });
  }
}

/**
 * Handle generation for existing capture (no photo upload needed)
 */
async function handleExistingCaptureGeneration(
  req: Request,
  res: Response,
  userId: string,
  captureId: string,
  modelId: string,
  styleId: string,
  quality: string,
  aspectRatio: string
) {
  try {
    console.log('[Camera Controller] 🎨 Starting generation for existing capture:', captureId);
    
    // Get existing capture from database
    const captureQuery = 'SELECT * FROM camera_captures WHERE id = $1 AND user_id = $2';
    const captureResult = await query(captureQuery, [captureId, userId]);
    
    if (!captureResult.rows.length) {
      return res.status(404).json({
        success: false,
        error: 'Capture not found',
      });
    }
    
    const capture = captureResult.rows[0];
    
    if (!capture.generated_prompt) {
      return res.status(400).json({
        success: false,
        error: 'Capture not analyzed yet',
      });
    }
    
    // Generate unique generation ID
    const generationId = `gen_${userId}_${Date.now()}`;
    
    // Start the generation (async)
    startCameraGeneration(userId, captureId, generationId, modelId, styleId, capture.generated_prompt, quality, aspectRatio);
    
    // Return success response immediately
    res.json({
      success: true,
      data: {
        captureId,
        generationId,
        estimatedTime: 60,
        prompt: capture.generated_prompt,
      },
    });
    
  } catch (error) {
    console.error('[Camera Controller] ❌ Existing capture generation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start generation',
    });
  }
}

/**
 * Start camera-based generation (async function)
 */
async function startCameraGeneration(
  userId: string,
  captureId: string,
  generationId: string,
  modelId: string,
  styleId: string,
  prompt: string,
  quality: string,
  aspectRatio: string
) {
  try {
    console.log('[Camera Controller] 🎨 Starting camera generation:', generationId);

    // Update capture record to link with generation
    await query(
      'UPDATE camera_captures SET generation_id = $1, status = $2 WHERE id = $3',
      [generationId, 'generated', captureId]
    );

    // Create generation record
    // Hardcode style_id for camera captures
    const hardcodedStyleId = '1b798b54-03da-446a-93bf-12fcba1050d7';
    const generationQuery = `
      INSERT INTO generations (id, user_id, model_id, style_id, prompt, quality, aspect_ratio, status, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;
    
    await query(generationQuery, [
      generationId,
      userId,
      modelId, // This could be higgsfield_id
      hardcodedStyleId, // Use hardcoded style ID for camera captures
      prompt,
      quality,
      aspectRatio,
      'processing',
      JSON.stringify({ source: 'camera', captureId })
    ]);

    // Start the actual generation with 302.AI
    console.log('[Camera Controller] 🚀 Starting 302.AI generation...');
    const generationResult = await generateWithCharacter({
      prompt,
      style_id: hardcodedStyleId,
      higgsfield_id: modelId,
      quality: quality === 'premium' ? 'high' : 'basic',
      aspect_ratio: aspectRatio,
    });

    const { imageUrls, jobBatchId } = generationResult;
    console.log(`[Camera Controller] ✅ Got ${imageUrls.length} images from 302.AI, job batch: ${jobBatchId}`);

    // S3 folder structure - same as regular generation
    const s3Folder = `users/${userId}/${modelId}/generations`;

    // Download images from 302.AI and upload to S3
    console.log('[Camera Controller] ⬇️ Downloading and uploading images to S3...');
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
          console.error(`[Camera Controller] ❌ Error processing image ${index + 1}:`, error);
          throw error;
        }
      })
    );

    console.log(`[Camera Controller] ✅ Uploaded ${s3Images.length} images to S3`);

    // Update generation record with completed images
    await query(
      `UPDATE generations 
       SET status = 'completed', image_urls = $1, image_count = $2, higgsfield_id = $3, completed_at = NOW()
       WHERE id = $4`,
      [s3Images, s3Images.length, jobBatchId, generationId]
    );

    console.log('[Camera Controller] ✅ Updated generation record in database');

    // Track usage metrics (import at runtime to avoid circular dependencies)
    const { incrementGenerationCount } = await import('../services/userService');
    await incrementGenerationCount(userId, s3Images.length);
    await logUserAction(userId, 'generate', s3Images.length, {
      generationId,
      prompt,
      style_id: hardcodedStyleId,
      higgsfield_id: modelId,
      quality: quality === 'premium' ? 'high' : 'basic',
      aspect_ratio: aspectRatio,
      imageCount: s3Images.length,
      source: 'camera',
      captureId,
      timestamp: new Date()
    });

    console.log('[Camera Controller] ✅ Tracked usage metrics');

    // Send push notification
    await sendCameraGenerationCompletedNotification(userId, generationId, s3Images);

    console.log('[Camera Controller] ✅ Camera generation completed successfully');

  } catch (error) {
    console.error('[Camera Controller] ❌ Camera generation failed:', error);
    
    // Update status to failed
    await query(
      'UPDATE camera_captures SET status = $1 WHERE id = $2',
      ['failed', captureId]
    );
  }
}

// Push notification for camera generation completion
async function sendCameraGenerationCompletedNotification(userId: string, generationId: string, imageUrls: string[]) {
  try {
    const { pushNotificationService } = require('../services/pushNotificationService');
    
    await pushNotificationService.sendToUser(userId, {
      title: "Camera Avatar Complete!",
      body: `Your ${imageUrls.length} camera-generated avatars are ready to view`,
      type: 'generation_complete',
      data: { 
        generationId, 
        source: 'camera',
        imageUrls: imageUrls.slice(0, 4) // Limit URL array size in notification
      }
    });
    
    console.log(`[Camera Controller] ✅ Sent camera generation completion notification to user ${userId}: Generation ${generationId}`);
  } catch (error) {
    console.error(`[Camera Controller] ❌ Failed to send camera generation notification to user ${userId}:`, error);
  }
}