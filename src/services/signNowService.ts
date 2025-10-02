import axios from 'axios';
import { SignNowPostpartumFields } from '../types/postpartum';

export class SignNowService {
  async testAuthentication() {
    try {
      // First authenticate to get a token
      await this.authenticate();

      // Then test with a simple API call like getting user info
      const response = await axios.get(`${this.baseURL}/user`, {
        headers: this.getAuthHeaders()
      });
      return { success: true, data: response.data };
    } catch (error) {
      throw error;
    }
  }

  async testTemplate(templateId: string) {
    try {
      // First authenticate to get a token
      await this.authenticate();

      // Try to get template details
      const response = await axios.get(`${this.baseURL}/template/${templateId}`, {
        headers: this.getAuthHeaders()
      });
      return { success: true, template: response.data };
    } catch (error) {
      console.error('Template test error:', {
        status: error.response?.status,
        data: error.response?.data,
        url: `${this.baseURL}/template/${templateId}`
      });
      throw error;
    }
  }

  async listTemplates() {
    try {
      // First authenticate to get a token
      await this.authenticate();

      // List all templates
      const response = await axios.get(`${this.baseURL}/template`, {
        headers: this.getAuthHeaders()
      });
      return { success: true, templates: response.data };
    } catch (error) {
      console.error('List templates error:', {
        status: error.response?.status,
        data: error.response?.data,
        url: `${this.baseURL}/template`
      });
      throw error;
    }
  }

  async getTemplateFields(templateId: string) {
    try {
      // First authenticate to get a token
      await this.authenticate();

      // Get template details including fields
      const response = await axios.get(`${this.baseURL}/document/${templateId}`, {
        headers: this.getAuthHeaders()
      });

      // Extract field information
      const fields = response.data.texts || [];
      const fieldInfo = fields.map((field: any) => ({
        name: field.name,
        label: field.label,
        id: field.id,
        required: field.required
      }));

      return {
        success: true,
        fields: fieldInfo,
        allTexts: response.data.texts,
        fullDocument: response.data
      };
    } catch (error) {
      console.error('Get template fields error:', {
        status: error.response?.status,
        data: error.response?.data,
        url: `${this.baseURL}/document/${templateId}`
      });
      throw error;
    }
  }

  async inspectDocumentFields(documentId: string) {
    try {
      await this.authenticate();

      console.log('🔍 Inspecting document fields (source of truth):', documentId);

      const doc = await axios.get(`${this.baseURL}/document/${documentId}`, {
        headers: this.getAuthHeaders()
      });

      const fields = doc.data?.fields || [];
      const fieldInfo = fields.map((f: any) => ({
        id: f.id,
        name: f.name,                    // exact field_name you must use
        json_name: f.json_attributes?.name, // sometimes different
        type: f.type,                    // text / signature / initials / date
        role: f.role,                    // "Client" / "Recipient 1" etc
        prefilled_text: f.prefilled_text, // any existing value
        required: f.required || f.json_attributes?.required,
        data: f.data                     // current value
      }));

      console.log('📋 Document fields (source of truth):');
      console.dir(fieldInfo, { depth: null });

      return { success: true, fields: fieldInfo, rawFields: fields };
    } catch (error) {
      console.error('Error inspecting document fields:', error.response?.data || error.message);
      throw error;
    }
  }

  async prefillByNameOrId(documentId: string, values: Record<string, string>) {
    try {
      await this.authenticate();

      console.log('🔧 Prefilling document fields:', { documentId, values });

      // Get live field metadata
      const doc = await axios.get(`${this.baseURL}/document/${documentId}`, {
        headers: this.getAuthHeaders()
      });

      const fields = doc.data?.fields || [];
      const fieldValues = [];

      for (const [key, val] of Object.entries(values)) {
        // Try by json_attributes.name first (most common)
        let field = fields.find((f: any) => f.json_attributes?.name === key);

        // Try by direct name
        if (!field) {
          field = fields.find((f: any) => f.name === key);
        }

        // Try by ID
        if (!field) {
          field = fields.find((f: any) => f.id === key);
        }

        if (field) {
          fieldValues.push({ field_id: field.id, value: String(val) });
          console.log(`✅ Mapped "${key}" → field_id: ${field.id}, value: "${val}"`);
        } else {
          console.warn(`❌ No matching field for key "${key}"`);
        }
      }

      if (fieldValues.length) {
        console.log('📤 Sending field updates:', fieldValues);

        const response = await axios.put(
          `${this.baseURL}/document/${documentId}`,
          { field_values: fieldValues },
          { headers: this.getAuthHeaders() }
        );

        console.log('✅ Field update response:', response.data);
        return { success: true, updatedFields: fieldValues.length, response: response.data };
      } else {
        console.warn('⚠️ No field_values to update.');
        return { success: false, error: 'No matching fields found' };
      }
    } catch (error) {
      console.error('❌ Error prefilling fields:', error.response?.data || error.message);
      throw error;
    }
  }

  async verifyFieldValues(documentId: string) {
    try {
      await this.authenticate();

      console.log('🔍 Verifying field values after update:', documentId);

      const verify = await axios.get(`${this.baseURL}/document/${documentId}`, {
        headers: this.getAuthHeaders()
      });

      const fields = verify.data?.fields || [];
      const fieldInfo = fields.map((f: any) => ({
        name: f.json_attributes?.name || f.name,
        id: f.id,
        type: f.type,
        value: f.prefilled_text || f.data,
        role: f.role
      }));

      console.log('📋 Field values verification:');
      console.dir(fieldInfo, { depth: null });

      return { success: true, fields: fieldInfo };
    } catch (error) {
      console.error('Error verifying field values:', error.response?.data || error.message);
      throw error;
    }
  }

  async updateDocumentFields(documentId: string, fieldValues: Array<{field_name: string, value: string}>) {
    try {
      // First authenticate to get a token
      await this.authenticate();

      console.log('Updating document fields:', { documentId, fieldValues });

      // Get document info first to see current state
      console.log('Getting document details before update...');
      const docResponse = await axios.get(`${this.baseURL}/document/${documentId}`, {
        headers: this.getAuthHeaders()
      });
      console.log('Document fields before update:', docResponse.data.fields?.map(f => ({ name: f.json_attributes?.name, id: f.id })));

      // Try both approaches - field names and field IDs
      const payload = {
        field_values: fieldValues
      };

      // Also try with texts array format
      const alternativePayload = {
        texts: fieldValues.map(fv => ({
          name: fv.field_name,
          data: fv.value
        }))
      };

      console.log('Sending PUT request with payload:', JSON.stringify(payload, null, 2));

      // Use PUT endpoint to update fields
      const response = await axios.put(
        `${this.baseURL}/document/${documentId}`,
        payload,
        { headers: this.getAuthHeaders() }
      );

      console.log('Document fields updated successfully:', response.data);

      // Get document info after update to verify
      console.log('Getting document details after update...');
      const docResponseAfter = await axios.get(`${this.baseURL}/document/${documentId}`, {
        headers: this.getAuthHeaders()
      });
      console.log('Document fields after update:', docResponseAfter.data.fields?.map(f => ({ name: f.json_attributes?.name, id: f.id, value: f.data })));

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Error updating document fields:', {
        status: error.response?.status,
        data: error.response?.data,
        url: `${this.baseURL}/document/${documentId}`,
        payload: fieldValues
      });
      throw error;
    }
  }
  private baseURL: string;
  private clientId: string;
  private clientSecret: string;
  private username: string;
  private password: string;
  apiToken: string | null = null;
  private templateId: string;

  constructor() {
    this.baseURL = process.env.SIGNNOW_BASE_URL || 'https://api.signnow.com';
    this.clientId = process.env.SIGNNOW_CLIENT_ID!;
    this.clientSecret = process.env.SIGNNOW_CLIENT_SECRET!;
    this.username = process.env.SIGNNOW_USERNAME!;
    this.password = process.env.SIGNNOW_PASSWORD!;
    this.templateId = process.env.SIGNNOW_TEMPLATE_ID || '3cc4323f75af4986b9a142513185d2b13d300759';
  }

  private async authenticate() {
    try {
      console.log('🌐 Using SignNow URL:', this.baseURL);

      const params = new URLSearchParams({
        grant_type: 'password',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        username: this.username,
        password: this.password
      });

      console.log('📝 Request params:', params.toString());

      const { data } = await axios.post(
        `${this.baseURL}/oauth2/token`,
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      console.log('✅ Authentication successful');
      this.apiToken = data.access_token;
      return data;
    } catch (error) {
      console.error('Authentication error details:', {
        status: error.response?.status,
        data: error.response?.data,
        headers: error.response?.headers,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          headers: error.config?.headers,
          data: error.config?.data?.replace(/(client_secret=)[^&]+/, '$1[REDACTED]')
        }
      });
      throw error;
    }
  }

  private get headers() {
    if (!this.apiToken) throw new Error('SignNow API token not configured');
    return {
      Authorization: `Bearer ${this.apiToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    };
  }

  getAuthHeaders() {
    return this.headers;
  }

  async prefillTemplate(documentId: string, fields: SignNowPostpartumFields) {
    try {
      if (!this.apiToken) throw new Error('SignNow API token not configured');

      // Get a fresh token
      await this.authenticate();

      console.log('Prefilling template:', { documentId, fields });

      // Clone the template first
      const cloneResult = await this.cloneTemplate(documentId, fields.total_hours ? `Contract for ${fields.total_hours} hours` : undefined);
      const newDocumentId = cloneResult.documentId;

      // Prepare the field data
      const fieldData = {
        fields: {
          total_hours: { value: fields.total_hours },
          hourly_rate_fee: { value: fields.hourly_rate_fee },
          total_amount: { value: fields.total_amount },
          deposit: { value: fields.deposit },
          overnight_fee_amount: { value: fields.overnight_fee_amount }
        }
      };

      console.log('Setting field data:', fieldData);

      // Prefill the fields - try different endpoints
      try {
        await axios.post(
          `${this.baseURL}/document/${newDocumentId}/fielddata`,
          fieldData,
          { headers: this.getAuthHeaders() }
        );
      } catch (fieldError) {
        console.log('First field endpoint failed, trying alternative:', fieldError.response?.status);
        // Try alternative endpoint
        await axios.put(
          `${this.baseURL}/document/${newDocumentId}/prefill`,
          fieldData,
          { headers: this.getAuthHeaders() }
        );
      }

      return newDocumentId;
    } catch (error) {
      console.error('Failed to prefill template:', error.response?.data || error.message);
      throw error;
    }
  }

  async getDocumentFields(documentId: string, token?: string) {
    try {
      // If no token provided, authenticate to get one
      if (!token) {
        await this.authenticate();
        token = this.apiToken;
        if (!token) {
          throw new Error('Failed to acquire SignNow access token');
        }
      }

      // Log token (masked for security)
      const maskedToken = `${token.slice(0, 8)}...${token.slice(-4)}`;
      console.log(`🔍 Getting field coordinates from document: ${documentId}`);
      console.log(`🔑 Using token: ${maskedToken}`);

      // Make the request to the SignNow API using standard auth headers
      const response = await axios.get(
        `${this.baseURL}/document/${documentId}`,
        {
          headers: this.getAuthHeaders()
        }
      );

      // Log success and field data
      if (response.data.fields?.length > 0) {
        console.log(`✅ Found ${response.data.fields.length} fields:`);
        response.data.fields.forEach((field: any) => {
          console.log(JSON.stringify({
            name: field.name,
            type: field.type,
            page: field.page_number,
            x: field.x,
            y: field.y,
            width: field.width,
            height: field.height,
            role: field.role
          }, null, 2));
        });
      } else {
        console.log('ℹ️ No fields found in document');
      }

      return response.data.fields || [];

    } catch (error: any) {
      // Log detailed error information
      const errorDetails = {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
        url: `${this.baseURL}/document/${documentId}`,
        token: this.apiToken ? `${this.apiToken.slice(0, 8)}...` : 'undefined'
      };

      console.error('❌ SignNow API Error:', errorDetails);

      throw new Error(
        `Failed to get document fields: ${error.response?.status} - ${JSON.stringify(error.response?.data || error.message)}`
      );
    }
  }

  async createInvitationClientPartner(documentId: string, client: { email: string; name: string }, partner?: { email: string; name: string }, options: any = {}) {
    console.log('Creating invitation:', { documentId, client, partner, options });
    try {
      if (!client || !client.email || !client.name) {
        throw new Error('client {name,email} is required');
      }

      // Get a fresh OAuth token
      await this.authenticate();
      console.log('✅ Got fresh OAuth token');

      // Send field invitation without custom subject/message (plan restriction)
      console.log('📧 Sending field invitation (no custom subject/message)...');

      // Fix redirect URL construction to prevent undefined contractId
      const baseUrl = process.env.FRONTEND_URL || 'https://jerrybony.me';
      const contractId = options.contractId || documentId; // Use documentId as fallback

      const invitePayload = {
        to: [{
          email: client.email,
          role: "Signer 1",
          order: 1
        }],
        from: "jerry@techluminateacademy.com",
        // Fixed redirect URLs with proper validation
        redirect_uri: options.redirectUrl || `${baseUrl}/payment?contract_id=${contractId}`,
        decline_redirect_uri: options.declineUrl || `${baseUrl}/`
      };

      console.log('📤 Sending field invitation:', invitePayload);
      console.log('🔗 Redirect URLs:');
      console.log('  Success:', invitePayload.redirect_uri);
      console.log('  Decline:', invitePayload.decline_redirect_uri);

      const { data } = await axios.post(
        `${this.baseURL}/document/${documentId}/invite`,
        invitePayload,
        { headers: this.getAuthHeaders() }
      );

      console.log('✅ Field invitation sent successfully');
      return { success: true, invite: data, type: 'field_invite' };
    } catch (error) {
      console.error('❌ Error creating invitation:', {
        status: error.response?.status,
        data: error.response?.data,
        url: `${this.baseURL}/document/${documentId}/invite`,
        method: 'POST',
        token: this.apiToken ? `${this.apiToken.slice(0, 8)}...` : 'undefined',
        headers: this.getAuthHeaders()
      });

      // Log the detailed errors from SignNow
      if (error.response?.data?.errors) {
        console.error('SignNow API errors:', JSON.stringify(error.response.data.errors, null, 2));
      }

      // Check for specific error types
      if (error.response?.data?.errors) {
        const dailyLimitError = error.response.data.errors.find(e => e.code === 65639);
        if (dailyLimitError) {
          throw new Error('Daily invite limit exceeded. Please try again tomorrow.');
        }
      }

      throw new Error(error.response?.data?.error || error.message || 'Failed to create invitation');
    }
  }

  async createPrefilledDocFromTemplate(templateId: string, documentName: string, fieldValues: Array<{field_name: string, value: string}>) {
    try {
      console.log('Creating prefilled document from template:', { templateId, documentName, fieldValues });

      // Get a fresh token first
      await this.authenticate();

      const payload = {
        document_name: documentName,
        field_values: fieldValues
      };

      // Try template copy endpoint first, then document copy
      let data;
      try {
        console.log('Trying template copy endpoint...');
        const response = await axios.post(
          `${this.baseURL}/template/${templateId}/copy`,
          payload,
          { headers: this.getAuthHeaders() }
        );
        data = response.data;
        console.log('Template copy succeeded');
      } catch (templateError) {
        console.log('Template copy failed, trying document copy:', templateError.response?.status);
        const response = await axios.post(
          `${this.baseURL}/document/${templateId}/copy`,
          payload,
          { headers: this.getAuthHeaders() }
        );
        data = response.data;
        console.log('Document copy succeeded');
      }

      console.log('Prefilled document created successfully:', data);
      return {
        success: true,
        documentId: data.id,
        name: data.name
      };
    } catch (error) {
      console.error('Error creating prefilled document:', error.response?.data || error.message);
      throw new Error(`Failed to create prefilled document: ${error.response?.data?.error || error.message}`);
    }
  }

  async cloneTemplate(templateId: string, documentName?: string, fieldValues?: Array<{field_name: string, value: string}>) {
    try {
      // Get a fresh token first
      await this.authenticate();

      console.log('Cloning template with fields:', { templateId, documentName, fieldValues });

      const payload: any = {
        document_name: documentName || `Contract for ${new Date().toISOString()}`
      };

      // Add field values if provided - try both field_name and field_id approaches
      if (fieldValues && fieldValues.length > 0) {
        payload.field_values = fieldValues;

        // Also try with known field IDs from template
        const fieldIdMap = {
          'total_hours': 'e6306c9700be4d97b4b0c43dda0e993fe5fe88f6',
          'deposit': '4702a39d39c34bd884df312df8e4a9b6d8ea0ca8',
          'hourly_rate_fee': '6bb9ad3702704fbb972d0248edc55096a3bfa041',
          'overnight_fee_amount': '14067a355bdf469da9f89661804913ce4f5f0535',
          'total_amount': '4da20398befa4a8f9868c61be82e874a4ce37d25'
        };

        // Try with template field IDs
        payload.template_field_values = fieldValues.map(fv => ({
          field_id: fieldIdMap[fv.field_name] || fv.field_name,
          value: fv.value
        }));
      }

      // Use document copy endpoint with field_values
      const { data } = await axios.post(
        `${this.baseURL}/document/${templateId}/copy`,
        payload,
        { headers: this.getAuthHeaders() }
      );

      console.log('Document copied successfully with fields:', data);
      return {
        success: true,
        documentId: data.id,
        name: data.name
      };
    } catch (error) {
      console.error('Error cloning template:', error.response?.data || error.message);
      throw new Error(`Failed to clone template: ${error.response?.data?.error || error.message}`);
    }
  }

  async uploadDocument(fileBuffer: Buffer, fileName: string) {
    try {
      await this.authenticate();

      console.log(`📤 Uploading document: ${fileName}, size: ${fileBuffer.length} bytes`);

      const FormData = require('form-data');
      const formData = new FormData();
      formData.append('file', fileBuffer, fileName);

      console.log(`🌐 POST ${this.baseURL}/document`);

      const response = await axios.post(
        `${this.baseURL}/document`,
        formData,
        {
          headers: {
            ...this.getAuthHeaders(),
            ...formData.getHeaders()
          }
        }
      );

      console.log('✅ Document uploaded successfully:', response.data.id);
      return {
        success: true,
        documentId: response.data.id,
        document: response.data
      };
    } catch (error) {
      console.error('❌ Document upload failed:');
      console.error('Status:', error.response?.status);
      console.error('Data:', JSON.stringify(error.response?.data, null, 2));
      console.error('Headers:', error.response?.headers);

      throw new Error(`Failed to upload document: ${error.response?.data?.error || error.message}`);
    }
  }

  async addSignatureFields(documentId: string, clientName: string, contractData?: any, pdfPath?: string) {
    try {
      await this.authenticate();

      console.log(`✍️ Adding signature and initials fields to document: ${documentId}`);

      // Determine contract type for appropriate field positioning
      const isLaborSupport = contractData?.serviceType?.toLowerCase().includes('labor support') ||
                            contractData?.serviceType?.toLowerCase().includes('labor') ||
                            contractData?.serviceType === 'Labor Support Services';

      console.log(`📋 Contract type: ${isLaborSupport ? 'Labor Support Agreement' : 'Postpartum Doula Services'}`);

      // Apply SignNow coordinate formula from PDF analysis
      // PDF found: "Client Signature:" at (3.2, 30.3) on page 2
      // SignNow formula: SignNow_X = PDF_X, SignNow_Y = 792 - PDF_Y
      const pageNumber = 2;    // Last page (0-indexed)

      const pdfX = 3.2;        // PDF X coordinate
      const pdfY = 30.3;       // PDF Y coordinate
      const pageHeight = 792;  // US Letter height in points

      // SignNow uses top-left origin, Y increases downward
      // Position signature field based on contract type
      let signatureX, signatureY;

      if (isLaborSupport) {
        // Labor Support Agreement signature coordinates (fine-tuned for accurate positioning)
        // Signature field: Adjusted to avoid text overlap in Labor Support template
        signatureX = Math.round(pdfX + 200);  // Move further right to avoid covering text
        signatureY = 680;  // Position lower to avoid text overlap
        console.log('🎯 Using Labor Support signature coordinates (fine-tuned positioning)');
      } else {
        // Postpartum Doula Services signature coordinates (original working values)
        signatureX = Math.round(pdfX + 150);  // Move further right to avoid covering text
        signatureY = 650;  // Position in lower part of page where signature typically appears
        console.log('🎯 Using Postpartum signature coordinates (original working values)');
      }

      // Date field positioning based on contract type
      let dateX, dateY;

      if (isLaborSupport) {
        // Labor Support Agreement date coordinates (fine-tuned for accurate positioning)
        // Date field: Adjusted to avoid text overlap in Labor Support template
        dateX = Math.round(pdfX + 460);       // Move even further right for better spacing
        dateY = signatureY;                   // Same line as signature
        console.log('🎯 Using Labor Support date coordinates (fine-tuned positioning)');
      } else {
        // Postpartum Doula Services date coordinates (original working values)
        dateX = Math.round(pdfX + 410);       // Move even further right for better spacing
        dateY = signatureY;                   // Same line
        console.log('🎯 Using Postpartum date coordinates (original working values)');
      }

      // Calculate positions for initials fields next to financial amounts
      // Apply proper SignNow coordinate conversion: SignNow_Y = 792 - PDF_Y
      // Based on typical doula contract structure, financial amounts appear in upper portion
      // Need to use actual PDF coordinates and convert them properly

      const initialsFieldWidth = 40;
      const initialsFieldHeight = 20;

      // Financial amounts positioning using SignNow coordinate system
      // Based on contract analysis - only 2 financial amounts exist:
      // - Total contract amount: "The total amount for your care is 1,200.00"
      // - Deposit amount: "A non-refundable deposit of 600.00"
      // Note: No monthly payment section exists (contract uses bi-weekly billing)

      // These positions need to place initials right after the dollar amounts
      // Total amount line: "The total amount for your care is 1,200.00" - initials after "1,200.00"
      // Deposit line: "A non-refundable deposit of 600.00" - initials after "600.00"

      // Position initials fields horizontally next to the dollar amounts on the same line
      // Need to find where the dollar amounts end and position initials immediately after
      // Based on typical text flow: "The total amount for your care is 1,200.00" [INITIALS HERE]
      // And: "A non-refundable deposit of 600.00" [INITIALS HERE]

      // SYSTEMATIC COORDINATE TESTING APPROACH
      // Step 1: Place initials in obvious test positions to see where they appear
      // Step 2: Adjust based on visual feedback

      // TEST PATTERN 2: Try positions based on typical contract layout
      // Financial amounts usually appear in upper-middle section
      // Need to be on same line as the amounts but after them

      // Use coordinates based on contract type
        let totalAmountX, totalAmountY, depositAmountX, depositAmountY;

        if (isLaborSupport) {
          // Labor Support Agreement coordinates (fine-tuned for accurate positioning)
          // Adjusted coordinates to avoid text overlap in Labor Support template
          totalAmountX = 280;    // Labor Support total amount initials X coordinate (adjusted)
          totalAmountY = 450;    // Labor Support total amount initials Y coordinate (adjusted)
          depositAmountX = 420;   // Labor Support deposit amount initials X coordinate (adjusted)
          depositAmountY = 120;   // Labor Support deposit amount initials Y coordinate (adjusted)
          console.log('🎯 Using Labor Support Agreement coordinates (fine-tuned positioning)');
        } else {
          // Postpartum Doula Services coordinates (original working values)
          totalAmountX = 253;    // Total amount initials X coordinate
          totalAmountY = 421;    // Total amount initials Y coordinate
          depositAmountX = 397;  // Deposit amount initials X coordinate
          depositAmountY = 108;  // Deposit amount initials Y coordinate
          console.log('🎯 Using Postpartum Doula Services coordinates (original working values)');
        }

      console.log(`📍 SignNow formula applied: PDF(${pdfX}, ${pdfY}) → SignNow(${signatureX}, ${signatureY})`);
      console.log('🎯 Using manually positioned coordinates:');
      console.log(`  Total amount initials: page 1, x=${totalAmountX}, y=${totalAmountY}`);
      console.log(`  Deposit amount initials: page 2, x=${depositAmountX}, y=${depositAmountY}`);

      const fieldData = {
        client_timestamp: Math.floor(Date.now() / 1000),
        fields: [
          // Signature and date fields (existing)
          {
            page_number: pageNumber,
            type: "signature",
            name: "client_signature",
            role: "Signer 1",
            required: true,
            height: 25,
            width: 150,
            x: signatureX,
            y: signatureY
          },
          {
            page_number: pageNumber,
            type: "text",  // Use text field for date entry (from working git history)
            name: "signature_date",
            role: "Signer 1",
            required: true,
            height: 25,
            width: 120,
            x: dateX,
            y: dateY,
            label: "Date"
          },
          // Initials fields next to financial amounts and additional positions (from manual positioning)
          {
            page_number: 1,  // Total amount initials on page 1
            type: "initials",
            name: "total_amount_initials",
            role: "Signer 1",
            required: true,
            height: 21,
            width: 69,
            x: 253,
            y: 421,
            label: "Initials"
          },
          {
            page_number: 2,  // Deposit amount initials on page 2
            type: "initials",
            name: "deposit_amount_initials",
            role: "Signer 1",
            required: true,
            height: 21,
            width: 69,
            x: 397,
            y: 108,
            label: "Initials"
          },
          {
            page_number: 1,  // Additional initials field 1
            type: "initials",
            name: "additional_initials_1",
            role: "Signer 1",
            required: true,
            height: 21,
            width: 69,
            x: 245,
            y: 649,
            label: "Initials"
          },
          {
            page_number: 2,  // Additional initials field 2
            type: "initials",
            name: "additional_initials_2",
            role: "Signer 1",
            required: true,
            height: 21,
            width: 69,
            x: 329,
            y: 70,
            label: "Initials"
          }
        ]
      };

      console.log(`🌐 PUT ${this.baseURL}/document/${documentId}`);
      console.log('📋 Field data:', JSON.stringify(fieldData, null, 2));

      const response = await axios.put(
        `${this.baseURL}/document/${documentId}`,
        fieldData,
        { headers: this.getAuthHeaders() }
      );

      console.log('✅ Signature fields added successfully');
      return {
        success: true,
        response: response.data
      };

    } catch (error) {
      console.error('❌ Failed to add signature fields:');
      console.error('Status:', error.response?.status);
      console.error('Data:', JSON.stringify(error.response?.data, null, 2));

      // Try alternative approach - use roles endpoint
      console.log('🔄 Trying alternative approach - adding roles...');
      try {
        const rolesData = {
          roles: [
            {
              name: 'Recipient 1',
              signing_order: 1
            }
          ]
        };

        const rolesResponse = await axios.put(
          `${this.baseURL}/document/${documentId}/roles`,
          rolesData,
          { headers: this.getAuthHeaders() }
        );

        console.log('✅ Roles added successfully');
        return {
          success: true,
          response: rolesResponse.data
        };
      } catch (rolesError) {
        console.error('❌ Roles approach also failed:', rolesError.response?.data);
        throw new Error(`Failed to add signature fields: ${error.response?.data?.error || error.message}`);
      }
    }
  }
}

// Export a singleton instance
export const signNowService = new SignNowService();
