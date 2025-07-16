import { Router } from 'express';
import multer from 'multer';
import { trainController } from '../controllers/trainController';
import { getTrainingStatus } from '../services/falService';
import { fal } from '@fal-ai/client';
import axios from 'axios';
import { uploadBuffer } from '../services/s3';

const upload = multer(); // in-memory storage
const router = Router();

// POST /api/train

// Accept multiple images under the 'images' field
router.post('/', upload.array('images', 50), trainController);

// GET /api/train/:id/status
router.get('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Missing id parameter' });
    }
    const status = await getTrainingStatus(id);

    let loraId = null;
    let resultData = null;

    if (status.status === 'COMPLETED') {
      const result = await fal.queue.result('fal-ai/flux-lora-fast-training', { requestId: id });
      const falLoraUrl = result.data?.diffusers_lora_file?.url ?? null;

      // Do NOT upload to S3. Just return the Fal URL.
      loraId = falLoraUrl;
      resultData = result.data;
    }

    res.json({ status: status.status, lora_id: loraId, result: resultData, raw: status });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to get training status' });
  }
});

export default router;
