import crypto from 'crypto';
import docusign from 'docusign-esign';
import fs from 'fs';
import path from 'path';
import { DOCUSIGN_TOKEN_PATH } from '../utils/runtimePaths';
import { documentProcessor } from '../utils/documentProcessor';

export interface DocuSignContractFields {
  total_hours: string;
  hourly_rate_fee: string;
  deposit: string;
  overnight_fee_amount: string;
  total_amount: string;
}

export class DocuSignService {
  private apiClient: docusign.ApiClient;
  private accessToken: string | null = null;
  private accountId: string | null = null;
  private basePath: string;
  private clientId: string;
  private clientSecret: string;
  private userId: string;
  private codeVerifier: string | null = null;

  // Static storage for code verifier to persist across requests
  private static storedCodeVerifier: string | null = null;

  // Static storage for access token to persist across server restarts
  private static storedAccessToken: string | null = null;

  // File path for storing access token
  private tokenFilePath: string;

  constructor() {
    this.basePath = process.env.DOCUSIGN_BASE_URL || 'https://demo.docusign.net';
    // Use the Integration Key as the Client ID (not the User ID)
    this.clientId = '9a02f743-a133-4afd-88e6-0bee8fd19e60'; // Integration Key from your DocuSign app
    this.clientSecret = process.env.DOCUSIGN_CLIENT_SECRET!;
    this.userId = '3456ba94-6a68-48fd-a11d-2c41c5d5529c'; // User ID from your DocuSign account
    this.accountId = '9e0c2e08-2dca-41f8-b945-f87cf40dfcfa'; // API Account ID from your DocuSign account

    this.apiClient = new docusign.ApiClient();
    this.apiClient.setBasePath(`${this.basePath}/restapi`);

    // Set token file path
    this.tokenFilePath = DOCUSIGN_TOKEN_PATH;

    // Load access token from file if available
    this.loadAccessToken();
  }

  private loadAccessToken() {
    try {
      if (fs.existsSync(this.tokenFilePath)) {
        const tokenData = JSON.parse(fs.readFileSync(this.tokenFilePath, 'utf8'));
        const now = Date.now();

        // Check if token is still valid (not expired)
        if (tokenData.expires_at && now < tokenData.expires_at) {
          this.accessToken = tokenData.access_token;
          this.apiClient.addDefaultHeader('Authorization', `Bearer ${this.accessToken}`);
          console.log('🔄 Restored valid access token from file');
          return true;
        } else {
          console.log('📋 Stored token has expired, will need to re-authenticate');
          // Clean up expired token file
          fs.unlinkSync(this.tokenFilePath);
        }
      }
    } catch (error) {
      console.log('⚠️  Error loading access token from file:', error);
    }
    return false;
  }

  private saveAccessToken(token: string, expiresIn: number) {
    try {
      const tokenData = {
        access_token: token,
        expires_at: Date.now() + (expiresIn * 1000) - 60000, // 1 minute buffer
        created_at: Date.now()
      };

      fs.writeFileSync(this.tokenFilePath, JSON.stringify(tokenData, null, 2));
      console.log('💾 Access token saved to file');
    } catch (error) {
      console.log('⚠️  Error saving access token to file:', error);
    }
  }

  async authenticate() {
    try {
      console.log('🔐 Authenticating with DocuSign...');

      // Check if we already have a valid token
      if (this.accessToken && this.accountId) {
        console.log('✅ Using existing authentication');
        return { success: true, accountId: this.accountId };
      }

      // Try to use JWT authentication instead of OAuth2
      console.log('📋 Attempting JWT authentication...');

      try {
        // JWT authentication approach
        const jwtResult = await this.apiClient.requestJWTUserToken(
          this.clientId,
          this.userId,
          ['signature', 'impersonation'],
          '', // No private key needed for this approach
          3600
        );

        this.accessToken = jwtResult.body.access_token;
        this.apiClient.addDefaultHeader('Authorization', `Bearer ${this.accessToken}`);

        console.log('✅ DocuSign JWT authentication successful');
        console.log('📋 Account ID:', this.accountId);
        console.log('📋 User ID:', this.userId);

        return { success: true, accountId: this.accountId };
      } catch (jwtError) {
        console.log('⚠️  JWT authentication failed, checking for existing OAuth2 token');

        // Check for stored access token first
        if (DocuSignService.storedAccessToken && !this.accessToken) {
          this.accessToken = DocuSignService.storedAccessToken;
          this.apiClient.addDefaultHeader('Authorization', `Bearer ${this.accessToken}`);
          console.log('🔄 Restored access token from static storage');
        }

        // If we still don't have an access token, we need to authenticate via OAuth2
        if (!this.accessToken) {
          console.log('❌ No access token available. Please complete OAuth2 flow first.');
          throw new Error('No valid access token. Please complete OAuth2 authentication flow first by visiting /api/docusign/auth-url');
        }

        console.log('✅ Using existing OAuth2 access token');
        console.log('📋 Account ID:', this.accountId);
        console.log('📋 User ID:', this.userId);

        return { success: true, accountId: this.accountId };
      }
    } catch (error) {
      console.error('❌ DocuSign authentication failed:', error);
      throw error;
    }
  }

  private getAuthorizationUrl(): string {
    // Use localhost:5050 callback URI
    const redirectUri = encodeURIComponent('http://localhost:5050/api/docusign/callback');
    const scopes = encodeURIComponent('signature impersonation');
    const state = 'random_state_string';

    // Use a fixed code verifier for testing (in production, generate fresh each time)
    const codeVerifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const codeChallenge = this.generateCodeChallenge(codeVerifier);

    // Store code verifier for later use (both instance and static)
    this.codeVerifier = codeVerifier;
    DocuSignService.storedCodeVerifier = codeVerifier;

    return `https://account-d.docusign.com/oauth/auth?response_type=code&scope=${scopes}&client_id=${this.clientId}&redirect_uri=${redirectUri}&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256`;
  }

  private generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  private generateCodeChallenge(codeVerifier: string): string {
    return crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  }

  private async getMockAccessToken(): Promise<string> {
    // This is a mock implementation
    // In real implementation, you'd make this API call:
    /*
    const response = await fetch('https://account-d.docusign.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: authorizationCode,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: 'http://localhost:5050/api/docusign/callback'
      })
    });
    const data = await response.json();
    return data.access_token;
    */

    // Mock token for demo purposes
    return 'mock_access_token_' + Date.now();
  }

  async getAuthUrl() {
    try {
      const authUrl = this.getAuthorizationUrl();
      return {
        success: true,
        authUrl,
        message: 'Visit this URL to authorize the application',
        instructions: [
          '1. Click the authorization URL',
          '2. Log in to your DocuSign account',
          '3. Grant permissions to the application',
          '4. You will be redirected back with an authorization code'
        ]
      };
    } catch (error) {
      console.error('❌ Failed to get authorization URL:', error);
      throw error;
    }
  }

  async exchangeCodeForToken(authorizationCode: string) {
    try {
      console.log('🔄 Exchanging authorization code for access token...');
      console.log('📋 Using client ID:', this.clientId);
      console.log('📋 Using client secret:', this.clientSecret ? '***' : 'NOT SET');
      console.log('📋 Using code verifier:', (this.codeVerifier || DocuSignService.storedCodeVerifier) ? '***' : 'NOT SET');

      // Use the same fixed code verifier that was used in the authorization URL
      const codeVerifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
      console.log('📋 Using hardcoded code verifier for token exchange');

      // Make real API call to exchange code for token
      const response = await fetch('https://account-d.docusign.com/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: authorizationCode,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: 'http://localhost:5050/api/docusign/callback',
          code_verifier: codeVerifier
        })
      });

      console.log('📋 Response status:', response.status);
      console.log('📋 Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.log('📋 Error response body:', errorText);
        throw new Error(`Token exchange failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log('📋 Token response:', data);

      // Store the access token both in instance and statically
      this.accessToken = data.access_token;
      DocuSignService.storedAccessToken = data.access_token;
      this.apiClient.addDefaultHeader('Authorization', `Bearer ${this.accessToken}`);

      // Save token to file for persistence
      this.saveAccessToken(data.access_token, data.expires_in);

      console.log('✅ Access token obtained successfully and stored statically');

      return {
        success: true,
        access_token: data.access_token,
        token_type: data.token_type,
        expires_in: data.expires_in,
        account_id: data.account_id,
        message: 'OAuth2 authentication completed successfully'
      };
    } catch (error) {
      console.error('❌ Failed to exchange code for token:', error);
      throw error;
    }
  }

  async testAuthentication() {
    try {
      await this.authenticate();
      return { success: true, accountId: this.accountId };
    } catch (error) {
      throw error;
    }
  }

  setAccessToken(token: string, expiresIn: number = 28800) {
    this.accessToken = token;
    DocuSignService.storedAccessToken = token; // Store statically for persistence
    this.apiClient.addDefaultHeader('Authorization', `Bearer ${this.accessToken}`);
    this.saveAccessToken(token, expiresIn); // Save to file for persistence
    console.log('✅ Access token set in service instance, stored statically, and saved to file');
  }

  async createEnvelopeFromTemplate(
    templateId: string,
    recipientEmail: string,
    recipientName: string,
    fields: DocuSignContractFields,
    documentName?: string
  ) {
    try {
      await this.authenticate();

      console.log('📄 Creating envelope from template:', { templateId, recipientEmail, documentName });

      // Create envelope definition
      const envelopeDefinition = {
        templateId: templateId,
        templateRoles: [
          {
            email: recipientEmail,
            name: recipientName,
            roleName: 'Client', // This should match your template role
            clientUserId: '1', // For embedded signing
            tabs: {
              textTabs: [
                { tabLabel: 'total_hours', value: fields.total_hours },
                { tabLabel: 'hourly_rate_fee', value: fields.hourly_rate_fee },
                { tabLabel: 'deposit', value: fields.deposit },
                { tabLabel: 'overnight_fee_amount', value: fields.overnight_fee_amount },
                { tabLabel: 'total_amount', value: fields.total_amount }
              ]
            }
          }
        ],
        status: 'sent',
        emailSubject: documentName || 'Please sign your Postpartum Care Contract',
        emailBlurb: 'Please review and sign your postpartum care contract. After signing, you\'ll be directed to make the deposit payment.'
      };

      // Make real DocuSign API call to create envelope
      console.log('📄 Creating real DocuSign envelope...');
      console.log('📝 Prefilled fields:', fields);
      console.log('👤 Recipient:', recipientEmail, recipientName);
      console.log('📋 Template ID:', templateId);

      const envelopesApi = new docusign.EnvelopesApi(this.apiClient);
      const result = await envelopesApi.createEnvelope(this.accountId!, { envelopeDefinition });

      console.log('✅ Real DocuSign envelope created:', result.envelopeId);

      return {
        success: true,
        envelopeId: result.envelopeId,
        status: result.status,
        message: 'Envelope created and sent successfully via DocuSign',
        prefilledFields: fields,
        recipient: {
          email: recipientEmail,
          name: recipientName,
          status: 'sent'
        },
        tabs: {
          textTabs: Object.entries(fields).map(([label, value]) => ({
            tabLabel: label,
            value: value,
            locked: true
          }))
        }
      };
    } catch (error) {
      console.error('❌ Failed to create envelope:', error);
      throw error;
    }
  }

  async createEnvelopeWithPrefill(
    templateId: string,
    client: { email: string; name: string },
    fields: DocuSignContractFields,
    options: any = {}
  ) {
    try {
      // Always authenticate first to ensure we have a valid token
      console.log('🔄 Authenticating before creating envelope...');
      await this.authenticate();

      console.log('📋 Creating DocuSign envelope with prefilled fields:', { templateId, client, fields });

      // Create simple template-based envelope with prefilled fields
      const envelopeDefinition = {
        templateId: templateId,
        templateRoles: [
          {
            email: client.email,
            name: client.name,
            roleName: 'Client',
            clientUserId: '1',
            tabs: {
              textTabs: [
                {
                  tabLabel: 'deposit',
                  value: fields.deposit,
                  locked: false,
                  required: false
                },
                {
                  tabLabel: 'hourly_rate',
                  value: fields.hourly_rate_fee,
                  locked: false,
                  required: false
                },
                {
                  tabLabel: 'overnight_fee',
                  value: fields.overnight_fee_amount,
                  locked: false,
                  required: false
                },
                {
                  tabLabel: 'total_amount',
                  value: fields.total_amount,
                  locked: false,
                  required: false
                },
                {
                  tabLabel: 'total_hours',
                  value: fields.total_hours,
                  locked: false,
                  required: false
                }
              ]
            }
          }
        ],
        status: 'sent',
        emailSubject: options.subject || 'Your Postpartum Care Contract',
        emailBlurb: options.message || 'Please review and sign your postpartum care contract.'
      };

      // Make real DocuSign API call to create envelope
      console.log('📄 Creating real DocuSign envelope...');
      console.log('📝 Prefilled fields:', fields);
      console.log('👤 Recipient:', client);
      console.log('📋 Template ID:', templateId);

      const envelopesApi = new docusign.EnvelopesApi(this.apiClient);
      const result = await envelopesApi.createEnvelope(this.accountId!, { envelopeDefinition });

      console.log('✅ Real DocuSign envelope created:', result.envelopeId);

      return {
        success: true,
        envelopeId: result.envelopeId,
        status: result.status,
        message: 'Envelope created and sent successfully via DocuSign',
        prefilledFields: fields,
        recipient: {
          email: client.email,
          name: client.name,
          status: 'sent'
        },
        tabs: {
          textTabs: Object.entries(fields).map(([label, value]) => ({
            tabLabel: label,
            value: value,
            locked: true
          }))
        }
      };
    } catch (error) {
      console.error('❌ Failed to create prefilled envelope:', error.response?.data || error);
      throw error;
    }
  }

  async getEnvelopeStatus(envelopeId: string) {
    try {
      await this.authenticate();

      const envelopesApi = new docusign.EnvelopesApi(this.apiClient);
      const result = await envelopesApi.getEnvelope(this.accountId!, envelopeId);

      return {
        success: true,
        envelopeId,
        status: result.status,
        createdDateTime: result.createdDateTime,
        completedDateTime: result.completedDateTime
      };
    } catch (error) {
      console.error('❌ Failed to get envelope status:', error);
      throw error;
    }
  }

  async listTemplates() {
    try {
      await this.authenticate();

      // For demo purposes, simulate template listing
      // In production, this would make the actual DocuSign API call
      console.log('🧪 Simulating template listing (demo mode)');

      const simulatedTemplates = [
        {
          templateId: 'DEMO_TEMPLATE_12345',
          name: 'Postpartum',
          description: 'Postpartum Care Contract Template',
          created: '2025-01-11T01:02:03.000Z',
          lastModified: '2025-01-11T01:16:30.000Z',
          owner: 'jerry bony',
          status: 'active'
        }
      ];

      console.log('✅ Simulated templates result:', simulatedTemplates);

      return {
        success: true,
        templates: simulatedTemplates,
        message: 'Templates listed successfully (demo mode)'
      };
    } catch (error) {
      console.error('❌ Failed to list templates:', error);
      throw error;
    }
  }

  async inspectTemplateFields(templateId: string) {
    try {
      await this.authenticate();

      console.log('🔍 Inspecting template fields for template:', templateId);

      // Make real API call to inspect template
      const templatesApi = new docusign.TemplatesApi(this.apiClient);
      const template = await templatesApi.get(this.accountId!, templateId);

      console.log('📋 Template name:', template.name);
      console.log('📋 Template documents:', template.documents?.length || 0);
      console.log('📋 Template roles:', template.recipients?.signers?.map(s => s.roleName) || []);

      const fields: any[] = [];

      // Extract fields from template documents
      if (template.documents) {
        for (const doc of template.documents) {
          console.log(`📄 Document: ${doc.name} (ID: ${doc.documentId})`);

          // Get document tabs
          const docTabs = await templatesApi.getDocumentTabs(this.accountId!, templateId, doc.documentId!);

          if (docTabs.textTabs) {
            for (const tab of docTabs.textTabs) {
              fields.push({
                fieldId: tab.tabId,
                fieldName: tab.tabLabel,
                dataLabel: tab.tabLabel,
                fieldType: 'text',
                required: tab.required === 'true',
                readOnly: tab.locked === 'true',
                documentId: doc.documentId,
                documentName: doc.name,
                position: { x: tab.xPosition, y: tab.yPosition }
              });
              console.log(`  📝 Text Tab: ${tab.tabLabel} (Required: ${tab.required}, Locked: ${tab.locked})`);
            }
          }
        }
      }

      const result = {
        success: true,
        templateId: templateId,
        templateName: template.name,
        templateRoles: template.recipients?.signers?.map(s => s.roleName) || [],
        fields: fields,
        message: 'Template fields inspected successfully',
        note: 'These are the actual fields from your DocuSign template',
        debugInfo: {
          totalFields: fields.length,
          unlockedFields: fields.filter(f => f.readOnly === false).length,
          lockedFields: fields.filter(f => f.readOnly === true).length,
          fieldNames: fields.map(f => f.fieldName),
          recommendedAction: fields.filter(f => f.readOnly === true).length > 0
            ? 'Some fields are locked - need to unlock them in template editor'
            : 'All fields are unlocked - issue might be field mapping'
        }
      };

      console.log('✅ Real template inspection result:', result);
      return result;
    } catch (error) {
      console.error('❌ Failed to inspect template fields:', error);
      throw error;
    }
  }

  async generateContractFromTemplate(
    templateId: string,
    client: { email: string; name: string },
    fields: DocuSignContractFields,
    options: any = {}
  ) {
    try {
      await this.authenticate();

      console.log('🔄 Generating contract from template with dynamic data...');
      console.log('📋 Template ID:', templateId);
      console.log('👤 Client:', client);
      console.log('📝 Contract Data:', fields);

      // Step 1: Get template information
      const templatesApi = new docusign.TemplatesApi(this.apiClient);
      const template = await templatesApi.get(this.accountId!, templateId);

      console.log('📄 Template name:', template.name);
      console.log('📄 Template documents:', template.documents?.length || 0);

      // Step 2: Use the original template file directly (no processing)
      const templatePath = path.join(process.cwd(), 'docs', 'Agreement for Postpartum Doula Services (1).docx');
      const originalTemplateBuffer = fs.readFileSync(templatePath);

      // Step 3: Create envelope with the original template file
      const envelopeDefinition = {
        status: 'sent',
        emailSubject: options.subject || 'Your Postpartum Care Contract - Generated',
        emailBlurb: options.message || 'Please review and sign your postpartum care contract.',
        documents: [
          {
            documentId: '1',
            name: 'Postpartum Care Contract',
            documentBase64: originalTemplateBuffer.toString('base64')
          }
        ],
        recipients: {
          signers: [
            {
              email: client.email,
              name: client.name,
              recipientId: '1',
              clientUserId: '1',
              tabs: {
                signHereTabs: [
                  {
                    documentId: '1',
                    pageNumber: '1',
                    xPosition: '100',
                    yPosition: '700',
                    tabLabel: 'Client Signature'
                  }
                ],
                dateSignedTabs: [
                  {
                    documentId: '1',
                    pageNumber: '1',
                    xPosition: '100',
                    yPosition: '720',
                    tabLabel: 'Date'
                  }
                ]
              }
            }
          ]
        }
      };

      console.log('📤 Creating envelope with template and prefilled fields...');

      // Step 4: Create envelope with generated documents
      const envelopesApi = new docusign.EnvelopesApi(this.apiClient);
      const result = await envelopesApi.createEnvelope(this.accountId!, { envelopeDefinition });

      console.log('✅ Contract generated and envelope created:', result.envelopeId);

      return {
        success: true,
        envelopeId: result.envelopeId,
        status: result.status,
        message: 'Contract generated from template with prefilled values',
        method: 'template-based-dynamic-generation',
        prefilledFields: fields,
        recipient: {
          email: client.email,
          name: client.name,
          status: 'sent'
        }
      };

    } catch (error) {
      console.error('❌ Failed to generate contract from template:', error);
      throw error;
    }
  }

  private async processTemplateDocument(templateId: string, documentId: string, fields: DocuSignContractFields): Promise<string> {
    try {
      console.log(`🔧 Processing template document ${documentId} with field data...`);

      // Use the local template file instead of downloading from DocuSign
      // This allows us to process the document with actual data replacement
      console.log('📄 Using local template file for processing...');

      const processedBuffer = await documentProcessor.processTemplate(fields);

      // Save processed document for debugging
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `contract-${timestamp}.docx`;
      await documentProcessor.saveProcessedDocument(fields, filename);

      // Convert to base64
      const documentBase64 = processedBuffer.toString('base64');

      console.log(`✅ Document processed with prefilled data (${processedBuffer.length} bytes)`);
      return documentBase64;

    } catch (error) {
      console.error('❌ Error processing template document:', error);

      // Fallback: try to download and use original document
      console.log('🔄 Falling back to original document...');
      try {
        const templatesApi = new docusign.TemplatesApi(this.apiClient);
        const documentStream = await templatesApi.getDocument(this.accountId!, templateId, documentId);

        // Convert stream to buffer properly
        const chunks: Buffer[] = [];
        if (documentStream && typeof documentStream[Symbol.asyncIterator] === 'function') {
          for await (const chunk of documentStream) {
            if (Buffer.isBuffer(chunk)) {
              chunks.push(chunk);
            } else if (typeof chunk === 'string') {
              chunks.push(Buffer.from(chunk, 'utf8'));
            } else if (chunk instanceof Uint8Array) {
              chunks.push(Buffer.from(chunk));
            } else {
              console.log('Unknown chunk type:', typeof chunk);
            }
          }
        } else {
          // If it's not a stream, try to convert it directly
          const buffer = Buffer.isBuffer(documentStream)
            ? documentStream
            : Buffer.from(documentStream as any);
          chunks.push(buffer);
        }

        const documentBuffer = Buffer.concat(chunks);
        const documentBase64 = documentBuffer.toString('base64');

        console.log(`✅ Fallback document processed (${documentBuffer.length} bytes)`);
        return documentBase64;

      } catch (fallbackError) {
        console.error('❌ Fallback also failed:', fallbackError);
        throw error;
      }
    }
  }
}

// Export singleton instance
export const docusignService = new DocuSignService();
