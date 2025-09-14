import fs from 'fs-extra';
import path from 'path';
import { signNowService } from '../services/signNowService';
import { convertDocxToPdf, generateContractDocx } from './contractProcessor';

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
    const docxPath = await generateContractDocx(data, contractId);
    console.log(`✅ Contract generated: ${docxPath}`);

    // Step 2: Convert to PDF for better SignNow compatibility
    console.log('📑 Step 2: Converting to PDF...');
    let pdfPath: string | undefined;
    try {
      pdfPath = await convertDocxToPdf(docxPath, contractId);
      console.log(`✅ PDF generated: ${pdfPath}`);
    } catch (pdfError) {
      console.log('⚠️ PDF conversion failed, using DOCX for SignNow');
    }

    // Step 3: Upload to SignNow (use PDF if available, otherwise DOCX)
    console.log('☁️ Step 3: Uploading to SignNow...');
    const fileToUpload = pdfPath || docxPath;
    const fileName = path.basename(fileToUpload);
    const fileBuffer = await fs.readFile(fileToUpload);

    const uploadResult = await signNowService.uploadDocument(fileBuffer, fileName);
    const documentId = uploadResult.documentId;
    console.log(`✅ Document uploaded to SignNow: ${documentId}`);

    // Step 4: Add signature fields with PDF analysis for positioning
    console.log('✍️ Step 4: Adding signature fields with automatic positioning...');
    await signNowService.addSignatureFields(documentId, clientName, contractData, fileToUpload);
    console.log('✅ Signature fields added successfully');

    // Step 5: SKIP invitation for coordinate testing
    console.log('📤 Step 5: SKIPPING SignNow invitation for coordinate testing...');
    const invitationResult = {
      success: false,
      message: 'Invitation skipped for testing'
    };

    console.log('⚠️ SignNow invitation SKIPPED for testing');

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
