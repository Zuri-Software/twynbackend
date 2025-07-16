import dotenv from 'dotenv';
dotenv.config();

import { fal } from '@fal-ai/client';
import JSZip from 'jszip';

// Configure the SDK with your API key
fal.config({ credentials: process.env.FAL_KEY });

// Generate image using prompt and LoRA ID
export async function generateImage(prompt: string, loraUrl: string, image_url: string) {
  const result = await fal.run('fal-ai/flux-lora/image-to-image', {
    input: {
      prompt,
      image_url: image_url,
      loras: [{ path: loraUrl }],
    },
  });
  return result;
}

// Get training status
export async function getTrainingStatus(requestId: string) {
  const status = await fal.queue.status('fal-ai/flux-lora-fast-training', { requestId });
  return status;
}

// Train LoRA using zipped images as a Data URI
export async function trainLoRA(imageBuffers: Buffer[]) {
  // 1. Zip the images
  const zip = new JSZip();
  imageBuffers.forEach((buffer, idx) => {
    zip.file(`image${idx}.png`, buffer);
  });
  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

  // 2. Upload ZIP to Fal storage
  const zipFile = new File([zipBuffer], 'images.zip', { type: 'application/zip' });
  const url = await fal.storage.upload(zipFile);

  // 3. Submit the training job using the uploaded file URL
  const res = await fal.queue.submit('fal-ai/flux-lora-fast-training', {
    input: { images_data_url: url },
    webhookUrl: process.env.WEBHOOK_URL,
  });

  return res.request_id; // Only return the request ID here
}
