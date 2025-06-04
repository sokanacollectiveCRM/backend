import { Router } from 'express';
import qboStatusRouter from './qbo/status';

const router = Router();

router.use('/qbo', qboStatusRouter);

export default router; 