const express = require('express');
const { calculatePostpartumContract, formatForSignNow, ValidationError } = require('../services/postpartum/calculateContract');
const SignNowService = require('../services/signNowService');
const signNowService = new SignNowService();
const { DEFAULT_CONFIG } = require('../types/postpartum');

const router = express.Router();

console.log('Setting up postpartum routes...');

router.post('/postpartum/calculate', async (req, res) => {
  try {
    const input = req.body;
    const amounts = calculatePostpartumContract(input);
    const signNowFields = formatForSignNow(input, amounts);

    res.json({
      success: true,
      amounts,
      fields: signNowFields
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    } else {
      console.error('Contract calculation failed:', error);
    res.status(500).json({
      success: false,
        error: 'Failed to calculate contract amounts'
      });
    }
  }
});

router.post('/postpartum/send', async (req, res) => {
  try {
    const {
      contract_input,
      client
    } = req.body;

    if (!contract_input || !client || !client.email || !client.name) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // Calculate amounts and format for SignNow
    console.log('Calculating contract amounts for input:', contract_input);
    const amounts = calculatePostpartumContract(contract_input);
    console.log('Calculated amounts:', amounts);

    console.log('Formatting for SignNow...');
    const signNowFields = formatForSignNow(contract_input, amounts);
    console.log('Formatted fields:', signNowFields);

    console.log('Sending to SignNow:', {
      templateId: DEFAULT_CONFIG.template_id,
      client,
      signNowFields
    });

    // Send to SignNow
    const result = await signNowService.createInvitationClientPartner(
      DEFAULT_CONFIG.template_id,
      client,
      undefined, // no partner
      {
        subject: "Your Postpartum Care Contract",
        message: "Please review and sign your postpartum care contract. After signing, you'll be directed to make the deposit payment.",
        fields: signNowFields
      }
    );

    res.json({
      success: true,
      amounts,
      signnow: result
    });

    } catch (error) {
      const { logAxiosError } = require('../utils/logAxiosError');

      if (error instanceof ValidationError) {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }

      logAxiosError(error, 'Contract sending failed');

      // Handle specific error cases
      if (error?.response?.data?.errors) {
        const dailyLimitError = error.response.data.errors.find(e => e.code === 65639);
        if (dailyLimitError) {
          return res.status(429).json({
            success: false,
            error: 'Daily invite limit exceeded. Please try again tomorrow.'
          });
        }
      }

      // Send back meaningful error response
      const status = error?.response?.status ?? 500;
      const errors = error?.response?.data?.errors;
      const message = (Array.isArray(errors) && errors[0]?.message) ||
                     error?.response?.data?.message ||
                     error?.message || 'Unknown error';

      res.status(status).json({
        success: false,
        error: message,
        details: errors ?? error?.response?.data ?? undefined
      });
    }
  }
});

module.exports = router;
