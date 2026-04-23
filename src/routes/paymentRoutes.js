'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const express_1 = require('express');
const router = (0, express_1.Router)();
const disabled = (_req, res) => {
  res.status(410).json({
    success: false,
    error: 'Stripe payment routes are disabled',
    code: 'stripe_disabled',
  });
};
router.all('*', disabled);
exports.default = router;
