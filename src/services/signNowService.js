const axios = require('axios');
const fs = require('fs-extra');
const FormData = require('form-data');

class SignNowError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'SignNowError';
    this.details = details;
  }
};

class SignNowService {
  constructor() {
    console.log('Initializing SignNow service...');
    this.baseURL =
      process.env.SIGNNOW_BASE_URL ||
      (process.env.SIGNNOW_ENV === 'eval'
        ? 'https://api-eval.signnow.com'
        : 'https://api.signnow.com');

    this.clientId = process.env.SIGNNOW_CLIENT_ID;
    this.clientSecret = process.env.SIGNNOW_CLIENT_SECRET;
    this.username = process.env.SIGNNOW_USERNAME;
    this.password = process.env.SIGNNOW_PASSWORD;

    // Use the API token directly
        this.apiToken = '42d2a44df392aa3418c4e4486316dd2429b27e7b690834c68cd0e407144';

    // Template ID for contract
    this.templateId = process.env.SIGNNOW_TEMPLATE_ID || '3cc4323f75af4986b9a142513185d2b13d300759';
  }

  async authenticate() {
    try {
      // Log the URL we're using
      console.log('🌐 Using SignNow URL:', this.baseURL);

      // Prepare the request body
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
      // Log detailed error information
      console.error('Authentication error details:', {
        status: error.response?.status,
        data: error.response?.data,
        headers: error.response?.headers,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          headers: error.config?.headers,
          data: error.config?.data?.replace(/(client_secret=)[^&]+/, '$1[REDACTED]')  // Redact sensitive info
        }
      });
      throw error;
    }
  }

  getAuthHeaders() {
    if (!this.apiToken) throw new Error('SignNow API token not configured');
    return {
      Authorization: `Bearer ${this.apiToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    };
  }

  async addFieldsToDocument(documentId, fields) {
    try {
      if (!documentId) throw new Error('documentId is required');
      if (!Array.isArray(fields) || fields.length === 0) {
        throw new Error('fields array is required');
      }

      const payload = {
        fields: fields.map(f => ({
          type: f.type,
          x: f.x,
          y: f.y,
          width: f.width ?? 150,
          height: f.height ?? 50,
          page_number: Math.max(0, (f.page ?? 1) - 1), // 0-based in API
          required: f.required !== false,
          label: f.label ?? '',
          role: f.role ?? 'Signer 1'
        }))
      };

      // Correct endpoint: PUT /document/{id}
      const { data } = await axios.put(
        `${this.baseURL}/document/${documentId}`,
        payload,
        { headers: this.getAuthHeaders() }
      );

      return {
        success: true,
        fields: data?.fields ?? payload.fields,
        message: 'Fields added to document'
      };
    } catch (error) {
      const status = error.response?.status;
      const body = error.response?.data;
      console.error('Error adding fields to document:', status, body || error.message);
      if (status === 404) {
        throw new Error('SignNow returned 404. Possible causes: wrong environment/host (prod vs eval), documentId not found in this account, or incorrect base URL.');
      }
      throw new Error(`Failed to add fields: ${body?.error || body?.message || error.message}`);
    }
  }

  async addStandardContractFields(documentId, options = {}) {
    const defaults = {
      signatureX: 100,
      signatureY: 200,
      nameX: 100,
      nameY: 280,
      dateX: 100,
      dateY: 330,
      page: 3 // human 1-based; converted in addFieldsToDocument
    };
    const o = { ...defaults, ...options };

    const fields = [
      {
        type: 'signature',
        x: o.signatureX,
        y: o.signatureY,
        page: o.page,
        width: 200,
        height: 60,
        required: true,
        label: 'Client Signature',
        role: 'Signer 1'
      },
      {
        type: 'text',
        x: o.nameX,
        y: o.nameY,
        page: o.page,
        width: 250,
        height: 30,
        required: true,
        label: 'Client Name (Printed)',
        role: 'Signer 1'
      },
      {
        type: 'text', // use text field for date entry
        x: o.dateX,
        y: o.dateY,
        page: o.page,
        width: 120,
        height: 30,
        required: true,
        label: 'Date',
        role: 'Signer 1'
      }
    ];

    return this.addFieldsToDocument(documentId, fields);
  }

  async createSigningInvitation(documentId, clientEmail, clientName, contractId) {
    try {
      if (!this.apiToken) throw new Error('SignNow API token not configured');

      // First get document details to find the correct role
      const { data: docData } = await axios.get(`${this.baseURL}/document/${documentId}`, {
        headers: this.getAuthHeaders()
      });

      // Find existing invites that need to be cancelled
      const existingInvites = docData.field_invites || [];
      for (const invite of existingInvites) {
        if (invite.email !== clientEmail) {
          try {
            await axios.delete(`${this.baseURL}/document/${documentId}/fieldinvite/${invite.id}`, {
              headers: this.getAuthHeaders()
            });
            console.log(`Cancelled existing invitation for ${invite.email}`);
          } catch (err) {
            console.warn(`Failed to cancel invitation for ${invite.email}:`, err.message);
          }
        }
      }

      // Find the role that matches the signer
      const roles = docData.roles || [];
      const role = roles.find(r => r.name === 'Sokana Collective' || r.name === 'Client');
      if (!role) {
        throw new Error('No matching role found in document');
      }

      const invitationData = {
        document_id: documentId,
        subject: `${clientName} Needs Your Signature`,
        message: `${clientName} invited you to sign "Contract-${contractId}"`,
        from: 'jerry@techluminateacademy.com',
        to: [
          {
            email: clientEmail,
            role: role.name,
            order: 1
          }
        ]
      };

      const { data } = await axios.post(
        `${this.baseURL}/v2/documents/${documentId}/invite`,
        invitationData,
        { headers: this.getAuthHeaders() }
      );

      return {
        success: true,
        invitationId: data.id,
        signingUrl: data.signing_url,
        status: 'pending',
        role: role.name
      };
    } catch (error) {
      console.error('Error creating SignNow invitation:', error.response?.data || error.message);
      throw new Error(`Failed to create signing invitation: ${error.response?.data?.error || error.message}`);
    }
  }

  /**
   * Invite Client (Signer 1) and optional Partner (Signer 2).
   * client = { name, email }
   * partner = { name, email } | undefined
   * options = { subject?, message?, sequential?, clientRole?, partnerRole? }
   */
  async createInvitationClientPartner(documentId, client, partner, options) {
    console.log('Creating invitation:', { documentId, client, partner, options });
    try {
      options = options || {};

      // Clone the template and prefill fields if provided
      if (!documentId) {
        const cloneResult = await this.cloneTemplate(
          this.templateId,
          `Contract for ${client.name} - ${new Date().toISOString()}`
        );
        documentId = cloneResult.documentId;

        // Prefill fields if provided
        if (options.fields) {
          await this.prefillTemplate(documentId, options.fields);
        }
      }
      if (!client || !client.email || !client.name) {
        throw new Error('client {name,email} is required');
      }

      // Get a fresh OAuth token first
      try {
        const authResult = await this.authenticate();
        this.apiToken = authResult.access_token;
        console.log('✅ Got fresh OAuth token');
      } catch (authError) {
        console.error('Failed to get OAuth token:', authError);
        throw authError;
      }

      // Check for existing invites
      try {
        // Get document details
        const { data: docData } = await axios.get(`${this.baseURL}/document/${documentId}`, {
          headers: this.getAuthHeaders()
        });

        const existingInvites = docData.field_invites || [];
        console.log('Found existing invites:', existingInvites.map(i => ({ id: i.id, email: i.email, status: i.status })));

        // Check if there's a fulfilled invite
        const hasFulfilledInvite = existingInvites.some(invite =>
          invite.status === 'fulfilled' && invite.email.toLowerCase() === client.email.toLowerCase()
        );

        if (hasFulfilledInvite) {
          throw new Error('This document has already been signed by this client. Please create a new document copy for additional signatures.');
        }

        // Check for pending invites
        const hasPendingInvite = existingInvites.some(invite =>
          invite.status === 'pending' && invite.email.toLowerCase() === client.email.toLowerCase()
        );

        if (hasPendingInvite) {
          throw new Error('There is already a pending invitation for this client. Please wait for it to be signed or cancelled.');
        }

        // If we get here, we can proceed with creating a new invitation
        console.log('No existing invites found, proceeding with new invitation');
      } catch (err) {
        console.warn('Failed to cancel existing invitations:', err.message);
      }

      // --- discover roles present on the document ---
      const fetchRoles = async () => {
        try {
          const { data } = await axios.get(`${this.baseURL}/document/${documentId}`, {
            headers: this.getAuthHeaders()
          });
          const fields = Array.isArray(data?.fields) ? data.fields : [];
          const roles = Array.from(new Set(
            fields.map(f => (typeof f.role === 'string' ? f.role.trim() : ''))
                 .filter(r => r)
          ));
          return roles;
        } catch (_e) {
          return [];
        }
      };

      const rolesOnDoc = await fetchRoles();

      const pickRole = (preferRegexes, fallback) => {
        if (options[fallback]) return options[fallback]; // if caller passed clientRole/partnerRole
        for (const rx of preferRegexes) {
          const hit = rolesOnDoc.find(r => rx.test(r));
          if (hit) return hit;
        }
        if (/client/i.test(fallback)) return rolesOnDoc[0] || 'Signer 1';
        if (/partner/i.test(fallback)) {
          const notClient = rolesOnDoc.find(r => r !== options.clientRole);
          return notClient || 'Signer 2';
        }
        return 'Signer 1';
      };

      // Get document details to find available roles
      const { data: docData } = await axios.get(`${this.baseURL}/document/${documentId}`, {
        headers: this.getAuthHeaders()
      });

      console.log('Document data:', docData);

      // Find available roles
      // Get all fields to find role IDs
      const fields = docData.fields || [];
      const roleMap = new Map();

      // Map role names to their IDs
      fields.forEach(field => {
        if (field.role && field.role_id) {
          roleMap.set(field.role, field.role_id);
        }
      });

      console.log('Available roles with IDs:', Object.fromEntries(roleMap));

      // Find the first Recipient role and its ID
      const recipientRole = fields.find(f => f.role?.startsWith('Recipient'))?.role || 'Recipient 1';
      const roleId = roleMap.get(recipientRole);

      if (!roleId) {
        throw new Error(`Could not find role ID for ${recipientRole}`);
      }

      const clientRole = recipientRole;
      const sequential = options.sequential !== false; // default: true

      const to = [{
        email: client.email,
        name: client.name,
        role: clientRole,
        role_id: roleId,
        order: sequential ? 1 : undefined
      }];

      console.log('Building invitation payload with roles:', { clientRole });

      const buildPayload = (includeCustom) => {
        // Standard email invite payload
        const payload = {
          from: 'jerry@techluminateacademy.com',
          to: [{
            email: client.email,
            name: client.name,
            role_id: roleId,  // Using role_id from document
            order: 1
          }]
        };

        if (includeCustom) {
          if (options.subject) payload.subject = options.subject;
          if (options.message) payload.message = options.message;
        }

        return payload;
      };

      const tryCustom = Boolean(options.subject || options.message);
      const headers = { headers: this.getAuthHeaders() };

      try {
        const payload = buildPayload(tryCustom);
        console.log('Sending invitation request:', JSON.stringify(payload, null, 2));

        // First, get document details to verify roles
        const { data: docData } = await axios.get(
          `${this.baseURL}/document/${documentId}`,
          { headers: this.getAuthHeaders() }
        );
        console.log('Document details:', JSON.stringify(docData, null, 2));

        const { data } = await axios.post(
          `${this.baseURL}/document/${documentId}/invite`,
          payload,
          {
            ...headers,
            validateStatus: () => true // Allow 4xx responses through
          }
        );
        return { success: true, invite: data, rolesUsed: { clientRole, partnerRole }, note: tryCustom ? 'Sent with custom subject/message' : undefined };
      } catch (err) {
        const errs = err.response?.data?.errors;
        const planBlock = Array.isArray(errs) && errs.some(e => Number(e.code) === 65582);
        if (planBlock && tryCustom) {
          const { data } = await axios.post(
            `${this.baseURL}/v2/documents/${documentId}/invite`,
            buildPayload(false),
            headers
          );
          return { success: true, invite: data, rolesUsed: { clientRole, partnerRole }, note: 'Sent without custom subject/message due to plan limits' };
        }
        const roleMissing = Array.isArray(errs) && errs.some(e => Number(e.code) === 65536);
        if (roleMissing) {
          throw new Error(`Document roles are ${JSON.stringify(rolesOnDoc)}; tried clientRole="${clientRole}" partnerRole="${partnerRole}".`);
        }
        throw err;
      }
      } catch (error) {
        const util = require('util');
        console.error('RAW:', util.inspect(error, { depth: null }));
        console.error('RESP DATA:', util.inspect(error?.response?.data, { depth: null }));
        console.error('RESP STATUS:', error?.response?.status);
        console.error('REQ URL:', error?.config?.url);
        console.error('REQ DATA:', error?.config?.data);
        throw error; // Don't wrap, preserve the original error

        // Specifically log the errors array if it exists
        if (error.response?.data?.errors) {
          console.error('SignNow API Errors:', error.response.data.errors);
          error.response.data.errors.forEach((err, index) => {
            console.error(`Error ${index + 1}:`, {
              code: err.code,
              message: err.message,
              ...err
            });
          });
        }

        // Log request details that caused the error
        if (error.config) {
          console.error('Request that caused error:', {
            url: error.config.url,
            method: error.config.method,
            data: JSON.parse(error.config.data || '{}')
          });
        }

        // Check for specific error types
        if (error.response?.data?.errors) {
          const dailyLimitError = error.response.data.errors.find(e => e.code === 65639);
          if (dailyLimitError) {
            throw new Error('Daily invite limit exceeded. Please try again tomorrow.');
          }
        }

        // Construct detailed error message
        const errorDetails = {
          message: error.response?.data?.error || error.message,
          errors: error.response?.data?.errors?.map(e => ({
            code: e.code,
            message: e.message,
            details: e
          })),
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          request: {
            url: error.config?.url,
            method: error.config?.method,
            data: JSON.parse(error.config?.data || '{}'),
            headers: error.config?.headers
          },
          stack: error.stack
        };
        console.error('Error details:', JSON.stringify(errorDetails, null, 2));
        throw new SignNowError('Failed to create invitation', errorDetails);
      }
  }

  async uploadDocument(filePath, documentName) {
    try {
      if (!this.apiToken) throw new Error('SignNow API token not configured');

      if (!(await fs.pathExists(filePath))) {
        throw new Error(`File not found: ${filePath}`);
      }

      const fileBuffer = await fs.readFile(filePath);
      const formData = new FormData();
      formData.append('file', fileBuffer, {
        filename: `${documentName}.pdf`,
        contentType: 'application/pdf'
      });

      const { data } = await axios.post(`${this.baseURL}/document`, formData, {
        headers: {
          ...this.getAuthHeaders(),
          ...formData.getHeaders()
        }
      });

      return { success: true, documentId: data.id, name: data.name };
    } catch (error) {
      console.error('Error uploading document:', error.response?.data || error.message);
      throw new Error(`Failed to upload document: ${error.response?.data?.error || error.message}`);
    }
  }

  async getDocument(documentId) {
    try {
      if (!this.apiToken) throw new Error('SignNow API token not configured');

      const { data } = await axios.get(`${this.baseURL}/document/${documentId}`, {
        headers: this.getAuthHeaders()
      });

      return { success: true, document: data };
    } catch (error) {
      console.error('Error getting document:', error.response?.data || error.message);
      throw new Error(`Failed to get document: ${error.response?.data?.error || error.message}`);
    }
  }

  async downloadDocument(documentId) {
    try {
      if (!this.apiToken) throw new Error('SignNow API token not configured');

      const { data } = await axios.get(`${this.baseURL}/document/${documentId}/download`, {
        headers: { ...this.getAuthHeaders(), Accept: 'application/pdf' },
        responseType: 'arraybuffer'
      });

      return Buffer.from(data);
    } catch (error) {
      console.error('Error downloading document:', error.response?.data || error.message);
      throw new Error(`Failed to download document: ${error.response?.data?.error || error.message}`);
    }
  }

  async prefillTemplate(templateId, fields) {
    try {
      if (!this.apiToken) throw new Error('SignNow API token not configured');

      // Get a fresh token
      await this.authenticate();

      console.log('Prefilling template:', { templateId, fields });

      // Clone the template first
      const cloneResult = await this.cloneTemplate(templateId, fields.total_hours ? `Contract for ${fields.total_hours} hours` : undefined);
      const documentId = cloneResult.documentId;

      // Prepare the field data
      const fieldData = {
        fields: {
          total_hours: { value: fields.total_hours },
          hourly_rate_fee: { value: fields.hourly_rate_fee },
          total_amount: { value: fields.total_amount },
          deposit_amount: { value: fields.deposit_amount },
          balance_amount: { value: fields.balance_amount },
          payment_schedule: { value: fields.payment_schedule }
        }
      };

      console.log('Setting field data:', fieldData);

      // Prefill the fields
      await axios.post(
        `${this.baseURL}/document/${documentId}/fieldsdata`,
        fieldData,
        { headers: this.getAuthHeaders() }
      );

      return documentId;
    } catch (error) {
      console.error('Failed to prefill template:', error.response?.data || error.message);
      throw error;
    }
  }

  async cloneTemplate(templateId, documentName) {
    try {
      if (!this.apiToken) throw new Error('SignNow API token not configured');

      // Get a fresh token
      await this.authenticate();

      console.log('Cloning template:', templateId);
      // Create a copy of the template
      const { data } = await axios.post(
        `${this.baseURL}/template/${templateId}/copy`,
        { document_name: documentName || `Contract for ${new Date().toISOString()}` },
        { headers: this.getAuthHeaders() }
      );

      console.log('Template cloned successfully:', data);
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

  async getInvitationStatus(documentId) {
    try {
      if (!this.apiToken) throw new Error('SignNow API token not configured');

      const { data } = await axios.get(`${this.baseURL}/document/${documentId}/invite`, {
        headers: this.getAuthHeaders() }
      );

      return { success: true, invitations: data };
    } catch (error) {
      console.error('Error getting invitation status:', error.response?.data || error.message);
      throw new Error(`Failed to get invitation status: ${error.response?.data?.error || error.message}`);
    }
  }

  async processContractSigning(contractPath, clientEmail, clientName, contractId) {
    try {
      const upload = await this.uploadDocument(contractPath, `Contract-${contractId}`);
      const invite = await this.createSigningInvitation(upload.documentId, clientEmail, clientName, contractId);
      return {
        success: true,
        documentId: upload.documentId,
        invitationId: invite.invitationId,
        signingUrl: invite.signingUrl,
        status: 'invitation_sent'
      };
    } catch (error) {
      console.error('Error in contract signing workflow:', error);
      throw error;
    }
  }

  async testAuthentication() {
    try {
      // First get an OAuth token
      console.log('🔑 Getting OAuth token...');
      const authResult = await this.authenticate();
      console.log('✅ OAuth token received');

      // Then try to get user info to verify the token works
      console.log('👤 Verifying token with user info...');
      const { data } = await axios.get(`${this.baseURL}/user`, {
        headers: this.getAuthHeaders()
      });

      console.log('✅ Successfully authenticated with SignNow');
      console.log('👤 User:', data.email || data.id);

      return {
        success: true,
        message: 'Authentication successful',
        user: data,
        baseURL: this.baseURL,
        token: this.apiToken.substring(0, 10) + '...',  // Show first 10 chars only
        oauth: {
          access_token: authResult.access_token.substring(0, 10) + '...',
          token_type: authResult.token_type,
          expires_in: authResult.expires_in
        }
      };
    } catch (error) {
      console.error('SignNow authentication failed:', error.response?.data || error.message);

      // Add more detailed error info
      const errorDetails = {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        baseURL: this.baseURL,
        hasCredentials: {
          clientId: Boolean(this.clientId),
          clientSecret: Boolean(this.clientSecret),
          username: Boolean(this.username),
          password: Boolean(this.password)
        }
      };

      throw new Error(`Authentication failed: ${JSON.stringify(errorDetails, null, 2)}`);
    }
  }

  // ---------- Embedded Invites Helpers ----------
  async listEmbeddedInvites(documentId) {
    const { data } = await axios.get(`${this.baseURL}/v2/documents/${documentId}/embedded-invites`, {
      headers: this.getAuthHeaders()
    });
    // Normalize shapes into a simple array [{id,email,role_id,status}, ...]
    const arr = [];
    const pushNorm = (item) => {
      if (!item) return;
      const id = item.id || item.field_invite_unique_id || item.invite_id;
      const email = (item.email || item.signer_email || '').toLowerCase();
      const role_id = item.role_id || item.roleId || item.role;
      const status = item.status || item.state;
      if (id) arr.push({ id, email, role_id, status, raw: item });
    };
    if (Array.isArray(data?.data)) data.data.forEach(pushNorm);
    if (Array.isArray(data?.invites)) data.invites.forEach(pushNorm);
    if (data?.id || data?.field_invite_unique_id) pushNorm(data);
    return arr;
  }

  async deleteEmbeddedInvite(documentId, inviteId) {
    await axios.delete(`${this.baseURL}/v2/documents/${documentId}/embedded-invites/${inviteId}`, {
      headers: this.getAuthHeaders()
    });
  }

  // ---------- Create or Reuse Embedded Invite, then Return Link ----------
  /**
   * Create an embedded signing link (no SignNow emails).
   * signer = { email, name? }
   * opts = {
   *   roleName?: string, order?: number, expiresIn?: number,
   *   auth_method?: 'password'|'email'|'mfa'|'social'|'biometric'|'other'|'none',
   *   auth_password?: string,
   *   onConflict?: 'reuse' | 'replace'   // default 'reuse'
   * }
   */
  async createEmbeddedInviteLink(documentId, signer, opts) {
    try {
      opts = opts || {};
      if (!this.apiToken) throw new Error('SignNow API token not configured');
      if (!documentId) throw new Error('documentId is required');
      if (!signer || !signer.email) throw new Error('signer.email is required');

      const desiredEmail = String(signer.email).toLowerCase();
      const roleName   = opts.roleName || 'Client';
      const order      = (typeof opts.order === 'number' && isFinite(opts.order)) ? opts.order : 1;
      const expiresIn  = (typeof opts.expiresIn === 'number' && isFinite(opts.expiresIn)) ? opts.expiresIn : 60;
      const onConflict = opts.onConflict === 'replace' ? 'replace' : 'reuse';

      // Normalize auth method; default to 'email' to satisfy API
      const allowedAuth = ['password','email','mfa','social','biometric','other','none'];
      const method = typeof opts.auth_method === 'string' && allowedAuth.includes(opts.auth_method.toLowerCase())
        ? opts.auth_method.toLowerCase()
        : 'email';

      // 1) Resolve role_id from the document
      const docRes = await axios.get(`${this.baseURL}/document/${documentId}`, {
        headers: this.getAuthHeaders()
      });
      const doc = docRes?.data || {};

      let rolesFromDoc = Array.isArray(doc.roles) ? doc.roles : [];
      if ((!rolesFromDoc || rolesFromDoc.length === 0) && doc.signing_steps && Array.isArray(doc.signing_steps.steps)) {
        for (const step of doc.signing_steps.steps) {
          if (step && Array.isArray(step.roles)) rolesFromDoc = rolesFromDoc.concat(step.roles);
        }
      }

      const roleEntries = [];
      for (const r0 of rolesFromDoc) {
        const r = r0 || {};
        const nm = String(r.name || r.role || '').trim();
        const id = r.role_id || r.unique_id || r.id || r.roleId;
        if (nm && id) roleEntries.push({ name: nm, id });
      }

      let match = roleEntries.find(r => r.name.toLowerCase() === String(roleName).toLowerCase());
      if (!match) {
        const rx = new RegExp(roleName, 'i');
        match = roleEntries.find(r => rx.test(r.name));
      }
      if (!match) {
        const available = roleEntries.map(e => e.name);
        throw new Error(`Role "${roleName}" not found on document. Roles: ${JSON.stringify(available)}`);
      }

      // Helper to actually create an invite (with auth) and return inviteId
      const createInvite = async () => {
        const body = {
          invites: [{
            email: desiredEmail,
            role_id: match.id,
            order,
            auth_method: method,
            ...(method === 'password' && opts.auth_password ? { auth_password: String(opts.auth_password) } : {})
          }]
        };
        const res = await axios.post(
          `${this.baseURL}/v2/documents/${documentId}/embedded-invites`,
          body,
          { headers: this.getAuthHeaders() }
        );
        const d = res?.data || {};
        if (d.data && Array.isArray(d.data) && d.data[0]?.id) return d.data[0].id;
        if (d.invites && Array.isArray(d.invites) && d.invites[0]?.id) return d.invites[0].id;
        if (d.id) return d.id;
        if (d.field_invite_unique_id) return d.field_invite_unique_id;
        throw new Error('Could not resolve embedded invite id from response.');
      };

      // Helper to generate a link for a given inviteId
      const generateLink = async (inviteId) => {
        const linkRes = await axios.post(
          `${this.baseURL}/v2/documents/${documentId}/embedded-invites/${inviteId}/link`,
          { link_expiration: expiresIn },
          { headers: this.getAuthHeaders() }
        );
        const ld = linkRes?.data || {};
        const link = (ld.data && ld.data.link) || ld.link;
        if (!link) throw new Error('Embedded link was not returned by API');
        return link;
      };

      // First attempt: create a new embedded invite
      try {
        const inviteId = await createInvite();
        const link = await generateLink(inviteId);
        return { link, inviteId, roleId: match.id, auth_method: method, created: true };
      } catch (err) {
        const errs = err?.response?.data?.errors;
        const alreadyExists = Array.isArray(errs) && errs.some(e => Number(e.code) === 19004002);
        if (!alreadyExists) throw err;

        // Conflict path: an embedded invite already exists
        const existing = await this.listEmbeddedInvites(documentId);

        // Try to find a matching invite for the same role (and same email if present)
        const byRole = existing.filter(it => String(it.role_id) === String(match.id));
        let candidate = byRole.find(it => it.email && it.email === desiredEmail) || byRole[0] || existing[0];

        if (!candidate) {
          throw new Error('An embedded invite exists but could not resolve an invite to reuse.');
        }

        if (onConflict === 'reuse') {
          // Reuse existing invite: just generate a link
          const link = await generateLink(candidate.id);
          return { link, inviteId: candidate.id, roleId: match.id, auth_method: 'existing', created: false, reused: true };
        }

        // Replace: delete existing invites, then create a fresh one with our desired auth_method/email
        for (const inv of existing) {
          try {
            await this.deleteEmbeddedInvite(documentId, inv.id);
          } catch (dErr) {
            // Best-effort delete; continue
            console.warn('Delete embedded invite failed:', inv.id, dErr?.response?.data || dErr.message);
          }
        }

        const newInviteId = await createInvite();
        const link = await generateLink(newInviteId);
        return { link, inviteId: newInviteId, roleId: match.id, auth_method: method, created: true, replaced: true };
      }
    } catch (err) {
      console.error('createEmbeddedInviteLink failed:', err?.response?.data || err.message);
      throw err instanceof Error ? err : new Error(String(err));
    }
  }
}

module.exports = SignNowService;
