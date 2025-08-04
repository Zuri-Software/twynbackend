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

    // Generate images using 302.AI
    const imageUrls = await generateWithCharacter({
      prompt,
      style_id,
      higgsfield_id: higgsfield_id || undefined, // Optional - for custom trained character
      quality: quality as 'basic' | 'high',
      aspect_ratio,
      enhance_prompt,
      negative_prompt,
      seed
    });

    console.log(`[Generate] Got ${imageUrls.length} images from 302.AI`);

    // S3 folder structure - use style_id or higgsfield_id for organization
    const modelId = higgsfield_id || style_id;
    const userId = req.user.id;
    const s3Folder = `users/${userId}/${modelId}/generations`;

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

    console.log(`[Generate] Uploaded ${s3Images.length} images to S3`);

    // Track usage
    await incrementGenerationCount(req.user.id, s3Images.length);
    await logUserAction(req.user.id, 'generate', s3Images.length, {
      prompt,
      style_id,
      higgsfield_id: higgsfield_id || null,
      quality,
      aspect_ratio,
      imageCount: s3Images.length,
      timestamp: new Date()
    });

    // Respond with generated image URLs
    return res.status(200).json({
      images: s3Images,
      count: s3Images.length,
      modelId,
      style_id,
      higgsfield_id: higgsfield_id || null,
      prompt,
      quality,
      aspect_ratio
    });

  } catch (error: any) {
    console.error('Generate controller error:', error);
    return res.status(500).json({ 
      error: error?.message || 'Generation failed',
      details: error?.stack || 'No additional details'
    });
  }
}
