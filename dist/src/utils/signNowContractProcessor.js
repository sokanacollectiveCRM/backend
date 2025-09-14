"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processContractWithSignNow = processContractWithSignNow;
exports.checkSignNowDocumentStatus = checkSignNowDocumentStatus;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const signNowService_1 = require("../services/signNowService");
const contractProcessor_1 = require("./contractProcessor");
/**
 * Complete contract processing workflow using ONLY SignNow for email delivery
 * @param contractData - Contract data
 * @returns Processing result with SignNow integration
 */
async function processContractWithSignNow(contractData) {
    try {
        const { contractId, clientEmail, clientName, ...data } = contractData;
        console.log(`🔄 Starting SignNow contract workflow for ${contractId}`);
        console.log(`👤 Client: ${clientName}`);
        console.log(`📧 Email: ${clientEmail}`);
        // Step 1: Generate contract DOCX (no email)
        console.log('📄 Step 1: Generating contract document...');
        const docxPath = await (0, contractProcessor_1.generateContractDocx)(data, contractId);
        console.log(`✅ Contract generated: ${docxPath}`);
        // Step 2: Convert to PDF for better SignNow compatibility
        console.log('📑 Step 2: Converting to PDF...');
        let pdfPath;
        try {
            pdfPath = await (0, contractProcessor_1.convertDocxToPdf)(docxPath, contractId);
            console.log(`✅ PDF generated: ${pdfPath}`);
        }
        catch (pdfError) {
            console.log('⚠️ PDF conversion failed, using DOCX for SignNow');
        }
        // Step 3: Upload to SignNow (use PDF if available, otherwise DOCX)
        console.log('☁️ Step 3: Uploading to SignNow...');
        const fileToUpload = pdfPath || docxPath;
        const fileName = path_1.default.basename(fileToUpload);
        const fileBuffer = await fs_extra_1.default.readFile(fileToUpload);
        const uploadResult = await signNowService_1.signNowService.uploadDocument(fileBuffer, fileName);
        const documentId = uploadResult.documentId;
        console.log(`✅ Document uploaded to SignNow: ${documentId}`);
        // Step 4: Add signature fields with PDF analysis for positioning
        console.log('✍️ Step 4: Adding signature fields with automatic positioning...');
        await signNowService_1.signNowService.addSignatureFields(documentId, clientName, contractData, fileToUpload);
        console.log('✅ Signature fields added successfully');
        // Step 5: Send invitation via SignNow (SignNow handles all email)
        console.log('📤 Step 5: Sending SignNow invitation...');
        const invitationResult = await signNowService_1.signNowService.createInvitationClientPartner(documentId, {
            email: clientEmail,
            name: clientName
        }, undefined, // No partner
        {
            subject: `Contract Ready for Signature - ${contractId}`,
            message: `Dear ${clientName},\n\nYour contract is ready for signature.\n\nContract ID: ${contractId}\nService: ${data.serviceType || 'Services'}\nTotal: ${data.totalInvestment || 'TBD'}\n\nPlease review and sign when convenient.\n\nBest regards,\nSokana Collective`,
            clientRole: 'Recipient 1'
        });
        console.log('✅ SignNow invitation sent successfully');
        // Return comprehensive result
        const result = {
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
    }
    catch (error) {
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
async function checkSignNowDocumentStatus(documentId) {
    try {
        await signNowService_1.signNowService.testAuthentication();
        const response = await fetch(`https://api.signnow.com/document/${documentId}`, {
            headers: signNowService_1.signNowService.getAuthHeaders()
        });
        if (!response.ok) {
            throw new Error(`SignNow API error: ${response.status}`);
        }
        const document = await response.json();
        const signatures = document.signatures || [];
        const isComplete = signatures.every((sig) => sig.data && sig.data.length > 0);
        return {
            success: true,
            documentId,
            status: isComplete ? 'completed' : 'pending',
            document_name: document.document_name,
            created: document.created,
            signatures: signatures.map((sig) => ({
                role: sig.role,
                email: sig.email,
                signed: !!(sig.data && sig.data.length > 0),
                signed_date: sig.created
            }))
        };
    }
    catch (error) {
        console.error('❌ Failed to check SignNow document status:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}
