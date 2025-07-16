import { Request, Response } from 'express';
import * as falService from '../services/falService';

export const trainController = async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files?.length) {
      return res.status(400).json({ error: 'No images uploaded' });
    }
    const requestId = await falService.trainLoRA(files.map(f => f.buffer));
    res.json({ requestId });
  } catch (err: any) {
    console.error('trainController error:', err);
    res.status(500).json({ error: err.message });
  }
};