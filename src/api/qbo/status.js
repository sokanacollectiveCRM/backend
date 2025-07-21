'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const express_1 = require('express');
const tokenUtils_1 = require('../../utils/tokenUtils');
const router = (0, express_1.Router)();
router.get('/status', async (req, res) => {
  try {
    const accessToken = await (0, tokenUtils_1.getValidAccessToken)();
    res.json({ connected: !!accessToken });
  } catch (error) {
    console.error('Error checking QBO status:', error);
    res.json({ connected: false });
  }
});
exports.default = router;
