import { Router } from 'express';
import { handleGenerate } from '../controllers/generateController';
import multer from 'multer';

const router = Router();
const upload = multer(); // in-memory

// POST /api/generate
router.post('/', upload.single('lora'), handleGenerate);

export default router;
