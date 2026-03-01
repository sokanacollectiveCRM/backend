import fs from 'fs-extra';
import path from 'path';
import { getPool } from '../db/cloudSqlPool';
import { createPaymentScheduleInCloudSql } from '../services/cloudSqlPaymentScheduleService';
import { signNowService } from '../services/signNowService';
import { convertDocxToPdf, generateContractDocx } from './contractProcessor';

function parseCurrency(val: string | undefined): number {
  if (!val) return 0;
  const parsed = parseFloat(String(val).replace(/[$,]/g, '').trim());
  return isNaN(parsed) ? 0 : parsed;
}

export interface SignNowContractData {
  contractId: string;
  clientName: string;
  clientEmail: string;
  serviceType?: string;
  totalInvestment?: string;
  depositAmount?: string;
  remainingBalance?: string;
  contractDate?: string;
  dueDate?: string;
  startDate?: string;
  endDate?: string;
  [key: string]: any;
}

export interface SignNowProcessingResult {
  success: boolean;
  contractId: string;
  clientName: string;
  clientEmail: string;

  // Local file paths
  docxPath: string;
  pdfPath?: string;

  // SignNow results
  signNow: {
    documentId: string;
    invitationSent: boolean;
    signingUrl?: string;
    status: string;
  };

  // Email confirmation
  emailDelivery: {
    provider: 'SignNow';
    sent: boolean;
    message: string;
  };
}

/**
 * Complete contract processing workflow using ONLY SignNow for email delivery
 * @param contractData - Contract data
 * @returns Processing result with SignNow integration
 */
export async function processContractWithSignNow(
  contractData: SignNowContractData
): Promise<SignNowProcessingResult> {
  try {
    const { contractId, clientEmail, clientName, ...data } = contractData;

    console.log(`🔄 Starting SignNow contract workflow for ${contractId}`);
    console.log(`👤 Client: ${clientName}`);
    console.log(`📧 Email: ${clientEmail}`);

    // Step 1: Generate contract DOCX (no email)
    console.log('📄 Step 1: Generating contract document...');
    let docxPath: string | Buffer;
    try {
      console.log('About to call generateContractDocx with:', { data, contractId });
      console.log('Data object keys:', Object.keys(data));
      console.log('Data object values:', Object.values(data));
      docxPath = await generateContractDocx(data, contractId);
      console.log(`✅ Contract generated: ${typeof docxPath === 'string' ? docxPath : 'Buffer'}`);
    } catch (error) {
      console.error('Error in contract generation:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        contractId,
        clientName,
        clientEmail
      });
      throw error;
    }

    // Step 2: Convert to PDF for better SignNow compatibility (skip in serverless)
    console.log('📑 Step 2: Converting to PDF...');
    let pdfPath: string | Buffer | undefined;
    try {
      if (typeof docxPath === 'string') {
        pdfPath = await convertDocxToPdf(docxPath, contractId);
        console.log(`✅ PDF generated: ${pdfPath}`);
      } else {
        // In serverless environments, use the DOCX buffer directly
        console.log('🚀 Using DOCX buffer directly for SignNow');
        pdfPath = docxPath;
      }
    } catch (pdfError) {
      console.log('⚠️ PDF conversion failed, using DOCX for SignNow');
      console.error('PDF conversion error:', pdfError);
      pdfPath = docxPath; // Fallback to DOCX
    }

    // Step 3: Upload to SignNow (use PDF if available, otherwise DOCX)
    console.log('☁️ Step 3: Uploading to SignNow...');
    const fileToUpload = pdfPath || docxPath;
    let documentId: string;
    try {
      let fileBuffer: Buffer;
      let fileName: string;

      if (typeof fileToUpload === 'string') {
        // Local file path
        fileBuffer = await fs.readFile(fileToUpload);
        fileName = path.basename(fileToUpload);
      } else {
        // Buffer (serverless environment)
        fileBuffer = fileToUpload;
        fileName = `contract-${contractId}.docx`;
      }

      const uploadResult = await signNowService.uploadDocument(fileBuffer, fileName);
      documentId = uploadResult.documentId;
      console.log(`✅ Document uploaded to SignNow: ${documentId}`);
    } catch (error) {
      console.error('Error in SignNow upload:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }

    // Step 4: Add signature fields with PDF analysis for positioning
    console.log('✍️ Step 4: Adding signature fields with automatic positioning...');
    try {
      await signNowService.addSignatureFields(documentId, clientName, contractData, fileToUpload);
      console.log('✅ Signature fields added successfully');
    } catch (error) {
      console.error('Error in signature fields addition:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }

    // Step 5: Look up client in Cloud SQL (phi_clients) — client must exist
    console.log('👤 Step 5: Looking up client in Cloud SQL...');
    let clientId: string;
    try {
      const { rows } = await getPool().query<{ id: string }>(
        'SELECT id FROM phi_clients WHERE LOWER(email) = LOWER($1) LIMIT 1',
        [clientEmail]
      );
      if (rows.length === 0) {
        throw new Error(
          `Client not found with email ${clientEmail}. The client must exist in the system before sending a contract.`
        );
      }
      clientId = rows[0].id;
      console.log('✅ Client found:', clientId);
    } catch (error) {
      console.error('Error looking up client:', error);
      throw error;
    }

    // Step 6: Create contract record in Cloud SQL (phi_contracts)
    console.log('💾 Step 6: Creating contract record in Cloud SQL...');
    try {
      await getPool().query(
        `INSERT INTO phi_contracts (id, client_id, status, signnow_document_id)
         VALUES ($1, $2, 'signed', $3)
         ON CONFLICT (id) DO UPDATE SET status = 'signed', signnow_document_id = EXCLUDED.signnow_document_id`,
        [contractId, clientId, documentId]
      );
      console.log('✅ Contract record created successfully');
    } catch (contractErr) {
      // phi_contracts may have different schema; try minimal insert
      console.warn('Contract insert (with signnow_document_id) failed, trying minimal insert:', contractErr);
      try {
        await getPool().query(
          `INSERT INTO phi_contracts (id, client_id, status) VALUES ($1, $2, 'signed')
           ON CONFLICT (id) DO UPDATE SET status = 'signed', client_id = EXCLUDED.client_id`,
          [contractId, clientId]
        );
        console.log('✅ Contract record created (minimal)');
      } catch (minimalErr) {
        console.error('Contract record creation failed (non-blocking):', minimalErr);
        // Continue — SignNow invitation will still be sent
      }
    }

    // Step 7: Payment schedule (Labor Support only) — Cloud SQL
    const isLaborSupport = contractData.serviceType?.toLowerCase().includes('labor support');
    if (isLaborSupport) {
      const totalAmount = parseCurrency(contractData.totalInvestment);
      const depositAmount = parseCurrency(contractData.depositAmount);
      if (totalAmount > 0) {
        try {
          const startDate = contractData.startDate
            ? new Date(contractData.startDate)
            : new Date();
          await createPaymentScheduleInCloudSql({
            contractId,
            scheduleName: 'Labor Support Payment Plan',
            totalAmount,
            depositAmount,
            numberOfInstallments: depositAmount > 0 && totalAmount > depositAmount ? 3 : 0,
            paymentFrequency: 'monthly',
            startDate,
          });
          console.log('✅ Step 7: Payment schedule created');
        } catch (err) {
          console.error('⚠️ Step 7: Payment schedule creation failed (non-blocking):', err);
        }
      } else {
        console.log('💰 Step 7: Skipping payment schedule (no total amount)');
      }
    } else {
      console.log('💰 Step 7: Skipping payment schedule (Postpartum)');
    }

    // Step 8: Send SignNow invitation with conditional redirect URLs
    console.log('📤 Step 8: Sending SignNow invitation...');
    let invitationResult;
    try {
      // Set redirect URLs based on contract type
      let redirectUrl, declineUrl;
      if (isLaborSupport) {
        // Labor Support: redirect to payment page
        redirectUrl = `${process.env.FRONTEND_URL || 'https://jerrybony.me'}/payment?contract_id=${contractId}`;
        declineUrl = `${process.env.FRONTEND_URL || 'https://jerrybony.me'}/`;
        console.log('🎯 Labor Support contract: redirecting to payment page after signing');
      } else {
        // Postpartum: redirect to success page (no payment required)
        redirectUrl = `${process.env.FRONTEND_URL || 'https://jerrybony.me'}/contract-signed?contract_id=${contractId}`;
        declineUrl = `${process.env.FRONTEND_URL || 'https://jerrybony.me'}/`;
        console.log('🎯 Postpartum contract: redirecting to success page (no payment required)');
      }

      invitationResult = await signNowService.createInvitationClientPartner(
        documentId,
        { email: clientEmail, name: clientName },
        undefined, // partner
        {
          contractId: contractId,
          redirectUrl: redirectUrl,
          declineUrl: declineUrl,
        }
      );
      console.log('✅ SignNow invitation sent successfully with appropriate redirect');
    } catch (error) {
      console.error('Error in SignNow invitation:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }

    // Return comprehensive result
    const result: SignNowProcessingResult = {
      success: true,
      contractId,
      clientName,
      clientEmail,

      // Local files
      docxPath,
      pdfPath,

      // SignNow integration
      signNow: {
        documentId,
        invitationSent: invitationResult.success,
        status: 'invitation_sent'
      },

      // Email delivery info
      emailDelivery: {
        provider: 'SignNow',
        sent: invitationResult.success,
        message: invitationResult.success
          ? `Professional signing invitation sent via SignNow to ${clientEmail}`
          : 'Failed to send SignNow invitation'
      }
    };

    console.log(`🎉 SignNow workflow completed for ${contractId}`);
    return result;

  } catch (error) {
    console.error('❌ SignNow contract processing failed:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      contractId: contractData.contractId
    });

    return {
      success: false,
      contractId: contractData.contractId,
      clientName: contractData.clientName,
      clientEmail: contractData.clientEmail,
      docxPath: '',
      signNow: {
        documentId: '',
        invitationSent: false,
        status: 'failed'
      },
      emailDelivery: {
        provider: 'SignNow',
        sent: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    };
  }
}

/**
 * Check the signing status of a SignNow document
 * @param documentId - SignNow document ID
 * @returns Document status and signature info
 */
export async function checkSignNowDocumentStatus(documentId: string) {
  try {
    await signNowService.testAuthentication();

    const response = await fetch(`https://api.signnow.com/document/${documentId}`, {
      headers: signNowService.getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error(`SignNow API error: ${response.status}`);
    }

    const document = await response.json();
    const signatures = document.signatures || [];
    const isComplete = signatures.every((sig: any) => sig.data && sig.data.length > 0);

    return {
      success: true,
      documentId,
      status: isComplete ? 'completed' : 'pending',
      document_name: document.document_name,
      created: document.created,
      signatures: signatures.map((sig: any) => ({
        role: sig.role,
        email: sig.email,
        signed: !!(sig.data && sig.data.length > 0),
        signed_date: sig.created
      }))
    };

  } catch (error) {
    console.error('❌ Failed to check SignNow document status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Payment schedule creation removed — Cloud SQL payment_schedules migration pending
