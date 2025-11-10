import {
  processContractForSigning,
  uploadContractToSupabase,
} from '../services/signNowPdfService';
import {
  fillPdfTemplate,
  getAvailableTemplates,
  validateContractData,
} from './pdfTemplateFiller';

interface ContractData {
  contractId: string;
  clientName: string;
  clientEmail: string;
  templateKey: string;
  [key: string]: any;
}

interface ProcessingResult {
  contractId: string;
  filledPdfPath: string;
  documentId: string;
  invitationId: string;
  signingUrl: string;
  supabaseUrl: string;
  success: boolean;
}

/**
 * Main contract processor using PDF templates with fixed coordinates
 * This eliminates DOCX conversion and ensures perfect SignNow field alignment
 */
export async function processContractWithPdfTemplate(
  contractData: ContractData,
  signNowToken: string
): Promise<ProcessingResult> {
  try {
    console.log(`🚀 Processing contract with PDF template system...`);
    console.log(`📋 Contract ID: ${contractData.contractId}`);
    console.log(`🎯 Template: ${contractData.templateKey}`);
    console.log(`👤 Client: ${contractData.clientName}`);

    // 1️⃣ Validate template and contract data
    const availableTemplates = getAvailableTemplates();
    if (!availableTemplates.includes(contractData.templateKey)) {
      throw new Error(
        `Template "${contractData.templateKey}" not found. Available: ${availableTemplates.join(', ')}`
      );
    }

    const validation = validateContractData(
      contractData.templateKey,
      contractData
    );
    if (!validation.valid) {
      console.warn(`⚠️ Missing fields: ${validation.missingFields.join(', ')}`);
    }

    // 2️⃣ Fill PDF template with contract data
    console.log(`📄 Filling PDF template...`);
    const filledPdfPath = await fillPdfTemplate(
      contractData.templateKey,
      contractData
    );

    // 3️⃣ Process contract for SignNow signing
    console.log(`📤 Processing for SignNow signing...`);
    const signNowResult = await processContractForSigning(
      filledPdfPath,
      contractData.templateKey,
      contractData.clientEmail,
      contractData.clientName,
      signNowToken
    );

    // 4️⃣ Upload to Supabase storage
    console.log(`☁️ Uploading to Supabase storage...`);
    const supabaseUrl = await uploadContractToSupabase(
      filledPdfPath,
      contractData.contractId
    );

    const result: ProcessingResult = {
      contractId: contractData.contractId,
      filledPdfPath,
      documentId: signNowResult.documentId,
      invitationId: signNowResult.invitationId,
      signingUrl: signNowResult.signingUrl,
      supabaseUrl,
      success: true,
    };

    console.log(`✅ Contract processing completed successfully!`);
    console.log(`📋 Contract ID: ${result.contractId}`);
    console.log(`📄 Filled PDF: ${result.filledPdfPath}`);
    console.log(`📋 SignNow Document ID: ${result.documentId}`);
    console.log(`🔗 Signing URL: ${result.signingUrl}`);
    console.log(`☁️ Supabase URL: ${result.supabaseUrl}`);

    return result;
  } catch (error) {
    console.error(`❌ Error processing contract with PDF template:`, error);
    throw error;
  }
}

/**
 * Get available template keys
 */
export function getAvailableContractTemplates(): string[] {
  return getAvailableTemplates();
}

/**
 * Validate contract data for a specific template
 */
export function validateContractDataForTemplate(
  templateKey: string,
  contractData: any
) {
  return validateContractData(templateKey, contractData);
}

/**
 * Example usage function
 */
export async function exampleContractProcessing() {
  try {
    // Example contract data
    const contractData: ContractData = {
      contractId: 'contract-001',
      clientName: 'Jane Doe',
      clientEmail: 'jane@example.com',
      templateKey: 'labor_support_v1',
      totalAmount: '2400.00',
      deposit: '400.00',
      balanceAmount: '2000.00',
      clientInitials: 'JD',
      client_signed_date: new Date().toLocaleDateString(),
    };

    // SignNow token (you would get this from authentication)
    const signNowToken = 'your-signnow-token-here';

    // Process the contract
    const result = await processContractWithPdfTemplate(
      contractData,
      signNowToken
    );

    console.log('Contract processing result:', result);
    return result;
  } catch (error) {
    console.error('Example contract processing failed:', error);
    throw error;
  }
}





