import { Router } from 'express';
import trainRouter from './train';
import generateRouter from './generate';

const router = Router();

router.use('/train', trainRouter);
router.use('/generate', generateRouter);

export default router;
