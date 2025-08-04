import { Router } from 'express';
import trainRouter from './train';
import generateRouter from './generate';
import imagesRouter from './images';
import usersRouter from './users';
import authRouter from './auth';
import onboardingRouter from './onboarding';
import modelsRouter from './models';

const router = Router();

router.use('/auth', authRouter);
router.use('/train', trainRouter);
router.use('/generate', generateRouter);
router.use('/images', imagesRouter);
router.use('/users', usersRouter);
router.use('/onboarding', onboardingRouter);
router.use('/models', modelsRouter);

export default router;
