import axios from 'axios';
import fs from 'fs';
import path from 'path';

import { createClient } from '@supabase/supabase-js';
import FormData from 'form-data';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

interface SignNowUploadResponse {
  id: string;
  name: string;
  page_count: number;
  created: string;
}

interface SignNowFieldResponse {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page_number: number;
  type: string;
  label: string;
  role: string;
}

/**
 * Upload a PDF to SignNow and return document ID
 */
export async function uploadPdfToSignNow(
  filePath: string,
  token: string
): Promise<SignNowUploadResponse> {
  try {
    console.log(`📤 Uploading PDF to SignNow: ${filePath}`);

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const form = new FormData();
    form.append('file', fs.createReadStream(filePath), {
      filename: path.basename(filePath),
      contentType: 'application/pdf',
    });
    form.append('tags', 'contract');

    const { data } = await axios.post(
      'https://api.signnow.com/document',
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${token}`,
        },
      }
    );

    console.log(
      `✅ PDF uploaded to SignNow successfully. Document ID: ${data.id}`
    );
    return data;
  } catch (error) {
    console.error(
      '❌ Error uploading PDF to SignNow:',
      error.response?.data || error.message
    );
    throw error;
  }
}

/**
 * Add signature fields to a SignNow document using pre-defined coordinates
 */
export async function addSignatureFieldsToDocument(
  documentId: string,
  token: string,
  templateKey: string
): Promise<SignNowFieldResponse[]> {
  try {
    console.log(`📝 Adding signature fields to document: ${documentId}`);

    // Load coordinate map for this template
    const coordinates = require('../config/pdfCoordinates.json');
    const coords = coordinates[templateKey];

    if (!coords) {
      throw new Error(`No coordinate map found for template: ${templateKey}`);
    }

    // Define signature fields based on template coordinates
    const signatureFields = [
      {
        type: 'signature',
        x: coords.client_signature?.x || coords.clientSignature?.x || 380,
        y: coords.client_signature?.y || coords.clientSignature?.y || 223,
        page_number:
          (coords.client_signature?.page || coords.clientSignature?.page || 3) -
          1, // Convert to 0-based
        width: 200,
        height: 60,
        required: true,
        label: 'Client Signature',
        role: 'Signer 1',
      },
      {
        type: 'text',
        x: coords.client_signed_date?.x || coords.date?.x || 128,
        y: coords.client_signed_date?.y || coords.date?.y || 274,
        page_number:
          (coords.client_signed_date?.page || coords.date?.page || 3) - 1, // Convert to 0-based
        width: 120,
        height: 30,
        required: true,
        label: 'Date',
        role: 'Signer 1',
      },
    ];

    const payload = {
      fields: signatureFields,
    };

    const { data } = await axios.put(
      `https://api.signnow.com/document/${documentId}`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log(`✅ Signature fields added successfully`);
    return data.fields || signatureFields;
  } catch (error) {
    console.error(
      '❌ Error adding signature fields:',
      error.response?.data || error.message
    );
    throw error;
  }
}

/**
 * Create signing invitation for a client
 */
export async function createSigningInvitation(
  documentId: string,
  clientEmail: string,
  clientName: string,
  token: string
): Promise<{ invitationId: string; signingUrl: string }> {
  try {
    console.log(`📧 Creating signing invitation for: ${clientEmail}`);

    const invitationData = {
      document_id: documentId,
      subject: `${clientName} - Contract Signature Required`,
      message: `${clientName}, please review and sign your contract.`,
      from: 'jerry@techluminateacademy.com',
      to: [
        {
          email: clientEmail,
          role: 'Signer 1',
          order: 1,
        },
      ],
    };

    const { data } = await axios.post(
      `https://api.signnow.com/v2/documents/${documentId}/invite`,
      invitationData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log(`✅ Signing invitation created successfully`);
    return {
      invitationId: data.id,
      signingUrl: data.signing_url,
    };
  } catch (error) {
    console.error(
      '❌ Error creating signing invitation:',
      error.response?.data || error.message
    );
    throw error;
  }
}

/**
 * Complete workflow: Upload PDF, add fields, create invitation
 */
export async function processContractForSigning(
  filePath: string,
  templateKey: string,
  clientEmail: string,
  clientName: string,
  token: string
): Promise<{
  documentId: string;
  invitationId: string;
  signingUrl: string;
  fields: SignNowFieldResponse[];
}> {
  try {
    console.log(`🚀 Processing contract for signing...`);
    console.log(`📄 File: ${filePath}`);
    console.log(`🎯 Template: ${templateKey}`);
    console.log(`👤 Client: ${clientName} (${clientEmail})`);

    // Step 1: Upload PDF to SignNow
    const uploadResult = await uploadPdfToSignNow(filePath, token);
    const documentId = uploadResult.id;

    // Step 2: Add signature fields
    const fields = await addSignatureFieldsToDocument(
      documentId,
      token,
      templateKey
    );

    // Step 3: Create signing invitation
    const invitationResult = await createSigningInvitation(
      documentId,
      clientEmail,
      clientName,
      token
    );

    console.log(`✅ Contract processing completed successfully!`);
    console.log(`📋 Document ID: ${documentId}`);
    console.log(`🔗 Signing URL: ${invitationResult.signingUrl}`);

    return {
      documentId,
      invitationId: invitationResult.invitationId,
      signingUrl: invitationResult.signingUrl,
      fields,
    };
  } catch (error) {
    console.error('❌ Error processing contract for signing:', error);
    throw error;
  }
}

/**
 * Upload filled contract to Supabase storage
 */
export async function uploadContractToSupabase(
  filePath: string,
  contractId: string
): Promise<string> {
  try {
    console.log(`📤 Uploading contract to Supabase storage...`);

    const fileBuffer = await fs.promises.readFile(filePath);
    const fileName = `contract-${contractId}-filled.pdf`;

    const { data, error } = await supabase.storage
      .from('contracts')
      .upload(fileName, fileBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (error) {
      throw new Error(`Supabase upload error: ${error.message}`);
    }

    console.log(`✅ Contract uploaded to Supabase: ${fileName}`);

    // Generate signed URL (valid for 1 hour)
    const { data: urlData, error: urlError } = await supabase.storage
      .from('contracts')
      .createSignedUrl(fileName, 3600);

    if (urlError) {
      throw new Error(`Signed URL generation error: ${urlError.message}`);
    }

    console.log(`🔗 Signed URL generated`);
    return urlData.signedUrl;
  } catch (error) {
    console.error('❌ Error uploading contract to Supabase:', error);
    throw error;
  }
}
