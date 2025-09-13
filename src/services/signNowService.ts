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

  async createInvitationClientPartner(documentId: string, client: { email: string; name: string }, partner?: { email: string; name: string }, options: any = {}) {
    console.log('Creating invitation:', { documentId, client, partner, options });
    try {
      // Clone the template and prefill fields if provided
      if (!documentId) {
        console.log('Cloning template:', this.templateId);
        const cloneResult = await this.cloneTemplate(
          this.templateId,
          `Contract for ${client.name} - ${new Date().toISOString()}`
        );
        documentId = cloneResult.documentId;
        console.log('Template cloned successfully, new document ID:', documentId);

        // Prefill fields if provided
        if (options.fields) {
          console.log('Prefilling template with fields:', options.fields);
          await this.prefillTemplate(documentId, options.fields);
          console.log('Fields prefilled successfully');
        }
      } else {
        console.log('Using provided document ID:', documentId);
        // If fields are provided and we have a document ID, we can still try to prefill
        if (options.fields) {
          console.log('Prefilling fields for existing document:', options.fields);
          try {
            await this.prefillTemplate(documentId, options.fields);
            console.log('Fields prefilled successfully');
          } catch (error) {
            console.log('Field prefilling failed, continuing with invitation:', error.message);
            // Continue with invitation even if prefilling fails
          }
        }
      }

      if (!client || !client.email || !client.name) {
        throw new Error('client {name,email} is required');
      }

      // Get a fresh OAuth token
      await this.authenticate();
      console.log('✅ Got fresh OAuth token');

      // Get document details to find available roles
      const { data: docData } = await axios.get(`${this.baseURL}/document/${documentId}`, {
        headers: this.getAuthHeaders()
      });

      console.log('Document data:', docData);

      // Find available roles
      const rolesOnDoc = docData.roles?.map(r => r.name) || [];
      console.log('Available roles:', rolesOnDoc);

      const clientRole = options.clientRole || rolesOnDoc.find(r => r === 'Client') || 'Recipient 1'; // Client signs as Recipient 1
      const sequential = options.sequential !== false;

      const to = [{
        email: client.email,
        name: client.name,
        role: clientRole,
        order: sequential ? 1 : undefined
      }];

      console.log('Building invitation payload with roles:', { clientRole });

      const buildPayload = (includeCustom: boolean) => {
        const APP_URL = process.env.FRONTEND_URL || 'http://localhost:3001';

        const payload = {
          document_id: documentId,
          from: 'jerry@techluminateacademy.com',
          to,
          redirect_uri: `${APP_URL}/payment`,
          decline_redirect_uri: `${APP_URL}/dashboard`,
          close_redirect_uri: `${APP_URL}/dashboard`,
          redirect_target: 'self',
          redirect_behavior: 'always'
        };

        if (includeCustom) {
          if (options.subject) payload['subject'] = options.subject;
          if (options.message) payload['message'] = options.message;
        }

        return payload;
      };

      const tryCustom = Boolean(options.subject || options.message);
      const headers = { headers: this.getAuthHeaders() };

      try {
        console.log('Sending invitation request:', buildPayload(tryCustom));
        const { data } = await axios.post(
          `${this.baseURL}/document/${documentId}/invite`,
          buildPayload(tryCustom),
          headers
        );
        return { success: true, invite: data, rolesUsed: { clientRole }, note: tryCustom ? 'Sent with custom subject/message' : undefined };
      } catch (err) {
        const errs = err.response?.data?.errors;
        const planBlock = Array.isArray(errs) && errs.some(e => Number(e.code) === 65582);
        if (planBlock && tryCustom) {
          const { data } = await axios.post(
            `${this.baseURL}/document/${documentId}/invite`,
            buildPayload(false),
            headers
          );
          return { success: true, invite: data, rolesUsed: { clientRole }, note: 'Sent without custom subject/message due to plan limits' };
        }
        throw err;
      }
    } catch (error) {
      console.error('Error creating client+partner invitation:', {
        response: error.response?.data,
        error: error.message,
        stack: error.stack,
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
        request: {
          url: error.config?.url,
          method: error.config?.method,
          data: error.config?.data
        }
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
}

// Export a singleton instance
export const signNowService = new SignNowService();
