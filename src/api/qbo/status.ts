import { Router } from 'express';
import { getValidAccessToken } from '../../utils/tokenUtils';

const router = Router();

router.get('/status', async (req, res) => {
  try {
    const accessToken = await getValidAccessToken();
    res.json({ connected: !!accessToken });
  } catch (error) {
    console.error('Error checking QBO status:', error);
    res.json({ connected: false });
  }
});

export default router; 