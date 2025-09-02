import dotenv from 'dotenv';
dotenv.config();

import { fal } from '@fal-ai/client';
import JSZip from 'jszip';
import { uploadBuffer } from './s3';

// Configure the SDK with your API key
fal.config({ credentials: process.env.FAL_KEY });

// Generate image using prompt and LoRA ID
export async function generateImage(input: {
  prompt: string;
  image_url: string;
  loras: Array<{ path: string; scale?: number }>;
  num_inference_steps?: number;
  guidance_scale?: number;
  num_images?: number;
  output_format?: 'jpeg' | 'png' | undefined;
  strength?: number;
}) {
  const result = await fal.run('fal-ai/flux-lora/image-to-image', { input });
  return result;
}

// Get training status
export async function getTrainingStatus(requestId: string) {
  const status = await fal.queue.status('fal-ai/flux-lora-fast-training', { requestId });
  return status;
}

// Train LoRA using zipped images as a Data URI
export async function trainLoRA(imageBuffers: Buffer[]) {
  // 1. Zip the images for Fal
  const zip = new JSZip();
  imageBuffers.forEach((buffer, idx) => {
    zip.file(`image${idx}.png`, buffer);
  });
  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

  // 2. Upload ZIP to Fal storage
  const zipFile = new File([new Uint8Array(zipBuffer)], 'images.zip', { type: 'application/zip' });
  const url = await fal.storage.upload(zipFile);

  // 3. Submit the training job using the uploaded file URL
  const res = await fal.queue.submit('fal-ai/flux-lora-fast-training', {
    input: { images_data_url: url },
    webhookUrl: process.env.WEBHOOK_URL,
  });

  // 4. Store training images in our S3 for future reference using user/model scoped folder
  const modelId = res.request_id;
  // You may need to pass userId to this function in future for full context
  // For now, fallback to 'unknown-user' if not available
  const userId = (process as any).currentUserId || 'unknown-user';
  const s3Folder = `users/${userId}/${modelId}/training`;
  const uploadPromises = imageBuffers.map(async (buffer, idx) => {
    try {
      const imageUrl = await uploadBuffer(buffer, s3Folder, 'image/jpeg');
      console.log(`Uploaded training image ${idx + 1} for model ${modelId}: ${imageUrl}`);
      return imageUrl;
    } catch (error) {
      console.error(`Failed to upload training image ${idx + 1} for model ${modelId}:`, error);
      return null;
    }
  });

  // Wait for all uploads to complete (don't block training if some fail)
  const uploadedUrls = await Promise.allSettled(uploadPromises);
  const successfulUploads = uploadedUrls.filter(result => result.status === 'fulfilled' && result.value).length;
  console.log(`Successfully uploaded ${successfulUploads}/${imageBuffers.length} training images for model ${modelId}`);

  return res.request_id;
}
