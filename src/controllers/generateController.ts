import { Request, Response } from 'express';
import axios from 'axios';
import { fal } from '@fal-ai/client';

import { generateImage } from '../services/falService';
import { uploadBuffer } from '../services/s3';

export async function handleGenerate(req: Request, res: Response) {
  try {
    const prompt = req.body.prompt;
    const image_url = req.body.image_url || req.body.imageUrl;
    const loraFile = req.file; // LoRA file uploaded as 'lora'

    if (!prompt || !loraFile || !image_url) {
      return res.status(400).json({ error: 'Missing prompt, lora file, or imageUrl in request body' });
    }

    // Upload the LoRA file to Fal storage
    const loraFalUrl = await fal.storage.upload(
      new File([loraFile.buffer], loraFile.originalname, { type: loraFile.mimetype })
    );

    // Now call Fal generate with the uploaded LoRA file URL
    const result = await generateImage(prompt, loraFalUrl, image_url);

    // Download and re-upload each generated image
    const images = await Promise.all(
      result.data.images.map(async (img: any) => {
        const resp = await axios.get(img.url, { responseType: 'arraybuffer' });
        // Fix: cast resp.data to Uint8Array
        return uploadBuffer(Buffer.from(resp.data as Uint8Array), 'generated', 'image/jpeg');
      })
    );

    res.json({ images });
  } catch (err: any) {
    console.error('generateController error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate image' });
  }
}
