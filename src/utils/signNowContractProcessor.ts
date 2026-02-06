import fs from 'fs-extra';
import path from 'path';
import { signNowService } from '../services/signNowService';
import supabase from '../supabase';
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

    // Step 5: Create client record if not exists
    console.log('👤 Step 5: Creating client record...');
    let client;
    try {
      const { data: clientData, error: clientError } = await supabase
        .from('client_info')
        .upsert({
          first_name: clientName.split(' ')[0],
          last_name: clientName.split(' ').slice(1).join(' '),
          email: clientEmail
        })
        .select()
        .single();

      if (clientError) {
        console.error('Error creating client:', clientError);
        throw clientError;
      }
      client = clientData;
      console.log('✅ Client record created successfully');
    } catch (error) {
      console.error('Error in client creation:', error);
      throw error;
    }

    // Step 6: Create contract record in database
    console.log('💾 Step 6: Creating contract record...');
    try {
      const { data: contract, error: contractError } = await supabase
        .from('contracts')
        .insert({
          id: contractId,
          client_id: client.id,
          status: 'signed',
          fee: contractData.totalInvestment,
          deposit: contractData.depositAmount,
          signnow_document_id: documentId
        })
        .select()
        .single();

      if (contractError) {
        console.error('Error creating contract:', contractError);
        throw contractError;
      }
      console.log('✅ Contract record created successfully');
    } catch (error) {
      console.error('Error in contract creation:', error);
      throw error;
    }

    // Step 7: Create payment schedule (only for Labor Support contracts)
    const isLaborSupport = contractData.serviceType?.toLowerCase().includes('labor support');
    if (isLaborSupport) {
      console.log('💰 Step 7: Creating payment schedule for Labor Support contract...');
      try {
        const paymentSchedule = await createPaymentSchedule({
          contractId,
          totalAmount: parseFloat(contractData.totalInvestment?.replace(/[$,]/g, '') || '1200'),
          depositAmount: parseFloat(contractData.depositAmount?.replace(/[$,]/g, '') || '600'),
          frequency: 'monthly',
          startDate: new Date(contractData.startDate || new Date()),
          numberOfInstallments: 3
        });
        console.log('✅ Payment schedule created successfully');
      } catch (error) {
        console.error('Error in payment schedule creation:', error);
        console.error('Error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        });
        throw error;
      }
    } else {
      console.log('💰 Step 7: Skipping payment schedule for Postpartum contract (no payment required)');
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

/**
 * Create payment schedule for a contract
 */
async function createPaymentSchedule({
  contractId,
  totalAmount,
  depositAmount,
  frequency,
  startDate,
  numberOfInstallments
}: {
  contractId: string;
  totalAmount: number;
  depositAmount: number;
  frequency: string;
  startDate: Date;
  numberOfInstallments: number;
}) {
  try {
    // Create payment schedule
    const { data: schedule, error: scheduleError } = await supabase
      .from('payment_schedules')
      .insert({
        contract_id: contractId,
        schedule_name: 'Standard Payment Plan',
        total_amount: totalAmount,
        deposit_amount: depositAmount,
        deposit_due_date: new Date().toISOString().split('T')[0], // Deposit due immediately (today)
        installment_amount: (totalAmount - depositAmount) / numberOfInstallments,
        number_of_installments: numberOfInstallments,
        payment_frequency: frequency,
        start_date: startDate.toISOString().split('T')[0],
        end_date: (() => {
          const endDate = new Date(startDate);
          endDate.setMonth(endDate.getMonth() + numberOfInstallments + 1); // +1 for the month after deposit
          return endDate.toISOString().split('T')[0];
        })(),
        status: 'active',
        remaining_balance: totalAmount - depositAmount,
        frequency: frequency
      })
      .select()
      .single();

    if (scheduleError) {
      console.error('Error creating payment schedule:', scheduleError);
      throw scheduleError;
    }

    // Create deposit payment record (due immediately)
    console.log(`Creating deposit payment: $${depositAmount.toFixed(2)} due immediately`);
    const { error: depositError } = await supabase
      .from('payment_installments')
      .insert({
        schedule_id: schedule.id,
        amount: depositAmount,
        due_date: new Date().toISOString().split('T')[0], // Due today
        status: 'pending',
        payment_type: 'deposit'
      });

    if (depositError) {
      console.error('Error creating deposit payment:', depositError);
      throw depositError;
    }

    // Generate installments with proper date calculations
    const installmentAmount = (totalAmount - depositAmount) / numberOfInstallments;

    // Calculate the first installment date (30 days after start date for monthly)
    const firstInstallmentDate = new Date(startDate);
    firstInstallmentDate.setMonth(firstInstallmentDate.getMonth() + 1); // Add 1 month for first installment

    for (let i = 0; i < numberOfInstallments; i++) {
      const dueDate = new Date(firstInstallmentDate);
      dueDate.setMonth(dueDate.getMonth() + i); // Add i months for each subsequent installment

      console.log(`Creating installment ${i + 1}: $${installmentAmount.toFixed(2)} due on ${dueDate.toISOString().split('T')[0]}`);

      const { error: installmentError } = await supabase
        .from('payment_installments')
        .insert({
          schedule_id: schedule.id,
          amount: installmentAmount,
          due_date: dueDate.toISOString().split('T')[0],
          status: 'pending'
        });

      if (installmentError) {
        console.error('Error creating installment:', installmentError);
        throw installmentError;
      }
    }

    console.log(`✅ Payment schedule created with ${numberOfInstallments} installments`);
    return schedule;
  } catch (error) {
    console.error('Error creating payment schedule:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      contractId,
      totalAmount,
      depositAmount,
      frequency,
      numberOfInstallments
    });
    throw error;
  }
}
