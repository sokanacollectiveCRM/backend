"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signNowService = exports.SignNowService = void 0;
const axios_1 = __importDefault(require("axios"));
class SignNowService {
    async testAuthentication() {
        try {
            // First authenticate to get a token
            await this.authenticate();
            // Then test with a simple API call like getting user info
            const response = await axios_1.default.get(`${this.baseURL}/user`, {
                headers: this.getAuthHeaders()
            });
            return { success: true, data: response.data };
        }
        catch (error) {
            throw error;
        }
    }
    async testTemplate(templateId) {
        try {
            // First authenticate to get a token
            await this.authenticate();
            // Try to get template details
            const response = await axios_1.default.get(`${this.baseURL}/template/${templateId}`, {
                headers: this.getAuthHeaders()
            });
            return { success: true, template: response.data };
        }
        catch (error) {
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
            const response = await axios_1.default.get(`${this.baseURL}/template`, {
                headers: this.getAuthHeaders()
            });
            return { success: true, templates: response.data };
        }
        catch (error) {
            console.error('List templates error:', {
                status: error.response?.status,
                data: error.response?.data,
                url: `${this.baseURL}/template`
            });
            throw error;
        }
    }
    async getTemplateFields(templateId) {
        try {
            // First authenticate to get a token
            await this.authenticate();
            // Get template details including fields
            const response = await axios_1.default.get(`${this.baseURL}/document/${templateId}`, {
                headers: this.getAuthHeaders()
            });
            // Extract field information
            const fields = response.data.texts || [];
            const fieldInfo = fields.map((field) => ({
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
        }
        catch (error) {
            console.error('Get template fields error:', {
                status: error.response?.status,
                data: error.response?.data,
                url: `${this.baseURL}/document/${templateId}`
            });
            throw error;
        }
    }
    async inspectDocumentFields(documentId) {
        try {
            await this.authenticate();
            console.log('🔍 Inspecting document fields (source of truth):', documentId);
            const doc = await axios_1.default.get(`${this.baseURL}/document/${documentId}`, {
                headers: this.getAuthHeaders()
            });
            const fields = doc.data?.fields || [];
            const fieldInfo = fields.map((f) => ({
                id: f.id,
                name: f.name, // exact field_name you must use
                json_name: f.json_attributes?.name, // sometimes different
                type: f.type, // text / signature / initials / date
                role: f.role, // "Client" / "Recipient 1" etc
                prefilled_text: f.prefilled_text, // any existing value
                required: f.required || f.json_attributes?.required,
                data: f.data // current value
            }));
            console.log('📋 Document fields (source of truth):');
            console.dir(fieldInfo, { depth: null });
            return { success: true, fields: fieldInfo, rawFields: fields };
        }
        catch (error) {
            console.error('Error inspecting document fields:', error.response?.data || error.message);
            throw error;
        }
    }
    async prefillByNameOrId(documentId, values) {
        try {
            await this.authenticate();
            console.log('🔧 Prefilling document fields:', { documentId, values });
            // Get live field metadata
            const doc = await axios_1.default.get(`${this.baseURL}/document/${documentId}`, {
                headers: this.getAuthHeaders()
            });
            const fields = doc.data?.fields || [];
            const fieldValues = [];
            for (const [key, val] of Object.entries(values)) {
                // Try by json_attributes.name first (most common)
                let field = fields.find((f) => f.json_attributes?.name === key);
                // Try by direct name
                if (!field) {
                    field = fields.find((f) => f.name === key);
                }
                // Try by ID
                if (!field) {
                    field = fields.find((f) => f.id === key);
                }
                if (field) {
                    fieldValues.push({ field_id: field.id, value: String(val) });
                    console.log(`✅ Mapped "${key}" → field_id: ${field.id}, value: "${val}"`);
                }
                else {
                    console.warn(`❌ No matching field for key "${key}"`);
                }
            }
            if (fieldValues.length) {
                console.log('📤 Sending field updates:', fieldValues);
                const response = await axios_1.default.put(`${this.baseURL}/document/${documentId}`, { field_values: fieldValues }, { headers: this.getAuthHeaders() });
                console.log('✅ Field update response:', response.data);
                return { success: true, updatedFields: fieldValues.length, response: response.data };
            }
            else {
                console.warn('⚠️ No field_values to update.');
                return { success: false, error: 'No matching fields found' };
            }
        }
        catch (error) {
            console.error('❌ Error prefilling fields:', error.response?.data || error.message);
            throw error;
        }
    }
    async verifyFieldValues(documentId) {
        try {
            await this.authenticate();
            console.log('🔍 Verifying field values after update:', documentId);
            const verify = await axios_1.default.get(`${this.baseURL}/document/${documentId}`, {
                headers: this.getAuthHeaders()
            });
            const fields = verify.data?.fields || [];
            const fieldInfo = fields.map((f) => ({
                name: f.json_attributes?.name || f.name,
                id: f.id,
                type: f.type,
                value: f.prefilled_text || f.data,
                role: f.role
            }));
            console.log('📋 Field values verification:');
            console.dir(fieldInfo, { depth: null });
            return { success: true, fields: fieldInfo };
        }
        catch (error) {
            console.error('Error verifying field values:', error.response?.data || error.message);
            throw error;
        }
    }
    async updateDocumentFields(documentId, fieldValues) {
        try {
            // First authenticate to get a token
            await this.authenticate();
            console.log('Updating document fields:', { documentId, fieldValues });
            // Get document info first to see current state
            console.log('Getting document details before update...');
            const docResponse = await axios_1.default.get(`${this.baseURL}/document/${documentId}`, {
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
            const response = await axios_1.default.put(`${this.baseURL}/document/${documentId}`, payload, { headers: this.getAuthHeaders() });
            console.log('Document fields updated successfully:', response.data);
            // Get document info after update to verify
            console.log('Getting document details after update...');
            const docResponseAfter = await axios_1.default.get(`${this.baseURL}/document/${documentId}`, {
                headers: this.getAuthHeaders()
            });
            console.log('Document fields after update:', docResponseAfter.data.fields?.map(f => ({ name: f.json_attributes?.name, id: f.id, value: f.data })));
            return {
                success: true,
                data: response.data
            };
        }
        catch (error) {
            console.error('Error updating document fields:', {
                status: error.response?.status,
                data: error.response?.data,
                url: `${this.baseURL}/document/${documentId}`,
                payload: fieldValues
            });
            throw error;
        }
    }
    constructor() {
        this.apiToken = null;
        this.baseURL = process.env.SIGNNOW_BASE_URL || 'https://api.signnow.com';
        this.clientId = process.env.SIGNNOW_CLIENT_ID;
        this.clientSecret = process.env.SIGNNOW_CLIENT_SECRET;
        this.username = process.env.SIGNNOW_USERNAME;
        this.password = process.env.SIGNNOW_PASSWORD;
        this.templateId = process.env.SIGNNOW_TEMPLATE_ID || '3cc4323f75af4986b9a142513185d2b13d300759';
    }
    async authenticate() {
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
            const { data } = await axios_1.default.post(`${this.baseURL}/oauth2/token`, params.toString(), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });
            console.log('✅ Authentication successful');
            this.apiToken = data.access_token;
            return data;
        }
        catch (error) {
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
    get headers() {
        if (!this.apiToken)
            throw new Error('SignNow API token not configured');
        return {
            Authorization: `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json'
        };
    }
    getAuthHeaders() {
        return this.headers;
    }
    async prefillTemplate(documentId, fields) {
        try {
            if (!this.apiToken)
                throw new Error('SignNow API token not configured');
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
                await axios_1.default.post(`${this.baseURL}/document/${newDocumentId}/fielddata`, fieldData, { headers: this.getAuthHeaders() });
            }
            catch (fieldError) {
                console.log('First field endpoint failed, trying alternative:', fieldError.response?.status);
                // Try alternative endpoint
                await axios_1.default.put(`${this.baseURL}/document/${newDocumentId}/prefill`, fieldData, { headers: this.getAuthHeaders() });
            }
            return newDocumentId;
        }
        catch (error) {
            console.error('Failed to prefill template:', error.response?.data || error.message);
            throw error;
        }
    }
    async createInvitationClientPartner(documentId, client, partner, options = {}) {
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
            const invitePayload = {
                document_id: documentId,
                to: [
                    {
                        email: client.email,
                        role: "Signer 1",
                        order: 1
                    }
                ],
                from: "jerry@techluminateacademy.com"
                // No subject/message due to plan restrictions
            };
            console.log('📤 Sending field invitation:', invitePayload);
            const { data } = await axios_1.default.post(`${this.baseURL}/document/${documentId}/invite`, invitePayload, { headers: this.getAuthHeaders() });
            console.log('✅ Field invitation sent successfully');
            return { success: true, invite: data, type: 'field_invite' };
        }
        catch (error) {
            console.error('❌ Error creating client+partner invitation:');
            console.error('Status:', error.response?.status);
            console.error('Data:', JSON.stringify(error.response?.data, null, 2));
            console.error('Request URL:', error.config?.url);
            console.error('Request method:', error.config?.method);
            console.error('Request data:', JSON.stringify(error.config?.data, null, 2));
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
    async createPrefilledDocFromTemplate(templateId, documentName, fieldValues) {
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
                const response = await axios_1.default.post(`${this.baseURL}/template/${templateId}/copy`, payload, { headers: this.getAuthHeaders() });
                data = response.data;
                console.log('Template copy succeeded');
            }
            catch (templateError) {
                console.log('Template copy failed, trying document copy:', templateError.response?.status);
                const response = await axios_1.default.post(`${this.baseURL}/document/${templateId}/copy`, payload, { headers: this.getAuthHeaders() });
                data = response.data;
                console.log('Document copy succeeded');
            }
            console.log('Prefilled document created successfully:', data);
            return {
                success: true,
                documentId: data.id,
                name: data.name
            };
        }
        catch (error) {
            console.error('Error creating prefilled document:', error.response?.data || error.message);
            throw new Error(`Failed to create prefilled document: ${error.response?.data?.error || error.message}`);
        }
    }
    async cloneTemplate(templateId, documentName, fieldValues) {
        try {
            // Get a fresh token first
            await this.authenticate();
            console.log('Cloning template with fields:', { templateId, documentName, fieldValues });
            const payload = {
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
            const { data } = await axios_1.default.post(`${this.baseURL}/document/${templateId}/copy`, payload, { headers: this.getAuthHeaders() });
            console.log('Document copied successfully with fields:', data);
            return {
                success: true,
                documentId: data.id,
                name: data.name
            };
        }
        catch (error) {
            console.error('Error cloning template:', error.response?.data || error.message);
            throw new Error(`Failed to clone template: ${error.response?.data?.error || error.message}`);
        }
    }
    async uploadDocument(fileBuffer, fileName) {
        try {
            await this.authenticate();
            console.log(`📤 Uploading document: ${fileName}, size: ${fileBuffer.length} bytes`);
            const FormData = require('form-data');
            const formData = new FormData();
            formData.append('file', fileBuffer, fileName);
            console.log(`🌐 POST ${this.baseURL}/document`);
            const response = await axios_1.default.post(`${this.baseURL}/document`, formData, {
                headers: {
                    ...this.getAuthHeaders(),
                    ...formData.getHeaders()
                }
            });
            console.log('✅ Document uploaded successfully:', response.data.id);
            return {
                success: true,
                documentId: response.data.id,
                document: response.data
            };
        }
        catch (error) {
            console.error('❌ Document upload failed:');
            console.error('Status:', error.response?.status);
            console.error('Data:', JSON.stringify(error.response?.data, null, 2));
            console.error('Headers:', error.response?.headers);
            throw new Error(`Failed to upload document: ${error.response?.data?.error || error.message}`);
        }
    }
    async addSignatureFields(documentId, clientName, contractData, pdfPath) {
        try {
            await this.authenticate();
            console.log(`✍️ Adding signature fields to document: ${documentId}`);
            // Try to analyze PDF for signature position
            let signatureX = 355; // Fallback
            let signatureY = 385; // Fallback
            if (pdfPath) {
                try {
                    console.log('🔍 Analyzing PDF for signature position...');
                    const { getSignatureFieldPosition } = await Promise.resolve().then(() => __importStar(require('../utils/pdfTextAnalyzer')));
                    const position = await getSignatureFieldPosition(pdfPath);
                    if (position) {
                        signatureX = position.x;
                        signatureY = position.y;
                        console.log(`✅ Using analyzed position: (${signatureX}, ${signatureY})`);
                    }
                    else {
                        console.log('⚠️ PDF analysis failed, using fallback position');
                    }
                }
                catch (error) {
                    console.log('⚠️ PDF analysis error, using fallback position:', error.message);
                }
            }
            else {
                console.log('⚠️ No PDF path provided, using fallback position');
            }
            const fieldData = {
                client_timestamp: Math.floor(Date.now() / 1000),
                fields: [
                    {
                        page_number: 0,
                        type: "signature",
                        name: "client_signature",
                        role: "Signer 1",
                        required: true,
                        height: 30,
                        width: 200,
                        x: signatureX,
                        y: signatureY
                    }
                ]
            };
            console.log(`🌐 PUT ${this.baseURL}/document/${documentId}`);
            console.log('📋 Field data:', JSON.stringify(fieldData, null, 2));
            const response = await axios_1.default.put(`${this.baseURL}/document/${documentId}`, fieldData, { headers: this.getAuthHeaders() });
            console.log('✅ Signature fields added successfully');
            return {
                success: true,
                response: response.data
            };
        }
        catch (error) {
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
                const rolesResponse = await axios_1.default.put(`${this.baseURL}/document/${documentId}/roles`, rolesData, { headers: this.getAuthHeaders() });
                console.log('✅ Roles added successfully');
                return {
                    success: true,
                    response: rolesResponse.data
                };
            }
            catch (rolesError) {
                console.error('❌ Roles approach also failed:', rolesError.response?.data);
                throw new Error(`Failed to add signature fields: ${error.response?.data?.error || error.message}`);
            }
        }
    }
}
exports.SignNowService = SignNowService;
// Export a singleton instance
exports.signNowService = new SignNowService();
