import { Router } from 'express';

const router = Router();

router.all('*', (_req, res) => {
  res.status(410).json({
    success: false,
    error: 'Stripe payment routes are disabled',
    code: 'stripe_disabled',
  });
});

export default router;

