import { Request, Response, Router } from 'express';
import { docusignService, DocuSignContractFields } from '../services/docusignService';
import { calculatePostpartumContract, formatForSignNow, ValidationError } from '../services/postpartum/calculateContract';
import { PostpartumContractInput } from '../types/postpartum';
import { signNowService } from '../services/signNowService';

const router = Router();

router.post('/postpartum/calculate', async (req, res) => {
  try {
    const input = req.body as PostpartumContractInput;
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
    const amounts = calculatePostpartumContract(contract_input);
    const signNowFields = formatForSignNow(contract_input, amounts);

    // Clone template WITH prefilled field values
    console.log('Cloning template with prefilled field values...');

    // Convert SignNow fields to the correct format for field_values
    const fieldValues = [
      { field_name: "total_hours", value: signNowFields.total_hours },
      { field_name: "hourly_rate_fee", value: signNowFields.hourly_rate_fee },
      { field_name: "deposit", value: signNowFields.deposit },
      { field_name: "overnight_fee_amount", value: signNowFields.overnight_fee_amount },
      { field_name: "total_amount", value: signNowFields.total_amount }
    ];

    // Create DocuSign envelope with prefilled fields
    console.log('📄 Creating DocuSign envelope with prefilled fields...');

      const docusignFields: DocuSignContractFields = {
        total_hours: signNowFields.total_hours,
        hourly_rate_fee: signNowFields.hourly_rate_fee,
        deposit: signNowFields.deposit,
        overnight_fee_amount: signNowFields.overnight_fee_amount,
        total_amount: signNowFields.total_amount
      };

            const result = await docusignService.createEnvelopeWithPrefill(
              '5fa4ef87-0821-48c3-9361-efe32cb22948', // Your actual DocuSign template ID
              client,
              docusignFields,
              {
                subject: "Your Postpartum Care Contract",
                message: "Please review and sign your postpartum care contract. The contract amounts have been calculated and prefilled. After signing, you'll be directed to make the deposit payment."
              }
            );

    res.json({
      success: true,
      message: 'Contract created with prefilled values and sent to client via DocuSign',
      amounts,
      envelopeId: result.envelopeId,
      docusign: result,
      prefilledValues: docusignFields
    });

  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({
      success: false,
      error: error.message
    });
    } else {
      console.error('Failed to send contract:', {
        error: error.message,
        response: error.response?.data,
        stack: error.stack,
        config: error.config
      });
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to send contract',
        details: error.response?.data
      });
    }
  }
});

// Step 2: Send client signing invitation after admin fills fields
router.post('/postpartum/send-client-invite', async (req, res) => {
  try {
    const { documentId, client } = req.body;

    if (!documentId || !client || !client.email || !client.name) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: documentId, client.email, client.name'
      });
    }

    console.log('📤 Sending client signing invitation...');

    // Send invitation to client as Recipient 1 (signer)
    const result = await signNowService.createInvitationClientPartner(
      documentId,
      client,
      undefined,
      {
        subject: "Your Postpartum Care Contract",
        message: "Please review and sign your postpartum care contract. After signing, you'll be directed to make the deposit payment.",
        clientRole: 'Recipient 1' // Client signs as Recipient 1
      }
    );

    res.json({
      success: true,
      message: 'Client signing invitation sent successfully',
      client,
      documentId,
      signnow: result
    });

  } catch (error) {
    console.error('Failed to send client invitation:', {
      error: error.message,
      response: error.response?.data,
      stack: error.stack,
      config: error.config
    });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send client invitation',
      details: error.response?.data
    });
  }
});

export default router;
