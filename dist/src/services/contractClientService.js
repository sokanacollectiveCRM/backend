"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContractClientService = void 0;
const supabase_1 = __importDefault(require("../supabase"));
const simplePaymentService_1 = require("./simplePaymentService");
class ContractClientService {
    constructor() {
        this.paymentService = new simplePaymentService_1.SimplePaymentService();
    }
    /**
     * Get contract by SignNow document ID (backward compatibility)
     */
    async getContractBySignNowId(signnowDocumentId) {
        console.log('🔍 Getting contract by SignNow ID:', signnowDocumentId);
        const { data, error } = await supabase_1.default
            .from('contracts')
            .select('*')
            .eq('signnow_document_id', signnowDocumentId)
            .single();
        if (error) {
            if (error.code === 'PGRST116') {
                // No rows found
                return null;
            }
            console.error('❌ Error getting contract by SignNow ID:', error);
            return null;
        }
        return data;
    }
    /**
     * Update contract with SignNow document ID (for backward compatibility)
     */
    async updateContractWithSignNowId(contractId, signnowDocumentId, signingUrl) {
        console.log('📄 Updating contract with SignNow ID:', contractId, signnowDocumentId);
        const updateData = {
            signnow_document_id: signnowDocumentId,
            updated_at: new Date().toISOString()
        };
        const { data, error } = await supabase_1.default
            .from('contracts')
            .update(updateData)
            .eq('id', contractId)
            .select()
            .single();
        if (error) {
            console.error('❌ Error updating contract with SignNow ID:', error);
            throw new Error(`Failed to update contract: ${error.message}`);
        }
        // Also create SignNow integration record
        if (signingUrl) {
            await this.createSignNowIntegration(contractId, signnowDocumentId, signingUrl);
        }
        console.log('✅ Contract updated with SignNow ID successfully');
        return data;
    }
    /**
     * Get all contracts that need manual cleanup (for post-migration)
     */
    async getContractsNeedingCleanup() {
        console.log('🧹 Getting contracts that need manual cleanup');
        const { data, error } = await supabase_1.default
            .from('contracts')
            .select('*')
            .or('client_id.is.null,generated_by.is.null,note.like.*NEEDS MANUAL*')
            .order('created_at', { ascending: false });
        if (error) {
            console.error('❌ Error getting contracts needing cleanup:', error);
            throw new Error(`Failed to get contracts: ${error.message}`);
        }
        return data;
    }
    /**
     * Manually link a contract to a client (post-migration cleanup)
     */
    async linkContractToClient(contractId, clientId, generatedByUserId) {
        console.log('🔗 Manually linking contract to client:', contractId, clientId);
        // Verify client exists
        const { data: client, error: clientError } = await supabase_1.default
            .from('client_info')
            .select('id, first_name, last_name, email')
            .eq('id', clientId)
            .single();
        if (clientError || !client) {
            throw new Error(`Client not found: ${clientId}`);
        }
        // Verify user exists
        const { data: user, error: userError } = await supabase_1.default
            .from('users')
            .select('id, firstname, lastname')
            .eq('id', generatedByUserId)
            .single();
        if (userError || !user) {
            throw new Error(`User not found: ${generatedByUserId}`);
        }
        const { data, error } = await supabase_1.default
            .from('contracts')
            .update({
            client_id: clientId,
            generated_by: generatedByUserId,
            note: `Manually linked to client ${client.first_name} ${client.last_name} by ${user.firstname} ${user.lastname}`,
            updated_at: new Date().toISOString()
        })
            .eq('id', contractId)
            .select()
            .single();
        if (error) {
            console.error('❌ Error linking contract to client:', error);
            throw new Error(`Failed to link contract: ${error.message}`);
        }
        console.log('✅ Contract linked to client successfully');
        return data;
    }
    /**
     * Create a new contract associated with a client from client_info
     */
    async createContract(request) {
        console.log('📝 Creating contract for client:', request.client_id);
        // Verify client exists in client_info
        const { data: client, error: clientError } = await supabase_1.default
            .from('client_info')
            .select('id, first_name, last_name, email')
            .eq('id', request.client_id)
            .single();
        if (clientError || !client) {
            throw new Error(`Client not found: ${request.client_id}`);
        }
        // Verify user exists
        const { data: user, error: userError } = await supabase_1.default
            .from('users')
            .select('id, firstname, lastname')
            .eq('id', request.generated_by)
            .single();
        if (userError || !user) {
            throw new Error(`User not found: ${request.generated_by}`);
        }
        // Get template info if provided
        let template_name;
        if (request.template_id) {
            const { data: template } = await supabase_1.default
                .from('contract_templates')
                .select('title')
                .eq('id', request.template_id)
                .single();
            template_name = template?.title;
        }
        // Create the contract
        const { data: contract, error: contractError } = await supabase_1.default
            .from('contracts')
            .insert({
            client_id: request.client_id,
            template_id: request.template_id,
            template_name: template_name,
            fee: request.fee,
            deposit: request.deposit,
            note: request.note,
            generated_by: request.generated_by,
            status: 'draft'
        })
            .select()
            .single();
        if (contractError) {
            console.error('❌ Error creating contract:', contractError);
            throw new Error(`Failed to create contract: ${contractError.message}`);
        }
        console.log('✅ Contract created successfully:', contract.id);
        // Create payment schedule if provided
        if (request.payment_schedule) {
            console.log('📅 Creating payment schedule for contract:', contract.id);
            const paymentScheduleRequest = {
                contract_id: contract.id,
                schedule_name: request.payment_schedule.schedule_name,
                total_amount: request.payment_schedule.total_amount,
                deposit_amount: request.payment_schedule.deposit_amount,
                number_of_installments: request.payment_schedule.number_of_installments,
                payment_frequency: request.payment_schedule.payment_frequency,
                start_date: request.payment_schedule.start_date
            };
            try {
                const scheduleId = await this.paymentService.createPaymentSchedule(paymentScheduleRequest);
                console.log('✅ Payment schedule created successfully:', scheduleId);
            }
            catch (paymentError) {
                console.error('⚠️ Contract created but payment schedule failed:', paymentError);
                // Don't fail the contract creation if payment schedule fails
            }
        }
        return contract;
    }
    /**
     * Get contract with full client information
     */
    async getContractWithClient(contractId) {
        console.log('🔍 Getting contract with client info:', contractId);
        const { data, error } = await supabase_1.default
            .from('contracts')
            .select(`
        *,
        client_info:client_id (
          id,
          first_name,
          last_name,
          email,
          phone_number
        ),
        generated_by_user:generated_by (
          id,
          firstname,
          lastname
        ),
        template:template_id (
          id,
          title,
          storage_path,
          fee,
          deposit
        )
      `)
            .eq('id', contractId)
            .single();
        if (error || !data) {
            console.error('❌ Error getting contract:', error);
            return null;
        }
        return {
            contract: {
                id: data.id,
                client_id: data.client_id,
                template_id: data.template_id,
                template_name: data.template_name,
                fee: data.fee,
                deposit: data.deposit,
                note: data.note,
                document_url: data.document_url,
                status: data.status,
                generated_by: data.generated_by,
                created_at: data.created_at,
                updated_at: data.updated_at
            },
            client_info: data.client_info,
            generated_by_user: data.generated_by_user,
            template: data.template
        };
    }
    /**
     * Get all contracts for a specific client
     */
    async getContractsByClient(clientId) {
        console.log('📋 Getting contracts for client:', clientId);
        const { data, error } = await supabase_1.default
            .from('contracts')
            .select('*')
            .eq('client_id', clientId)
            .order('created_at', { ascending: false });
        if (error) {
            console.error('❌ Error getting contracts:', error);
            throw new Error(`Failed to get contracts: ${error.message}`);
        }
        return data;
    }
    /**
     * Update contract status
     */
    async updateContractStatus(contractId, status, documentUrl) {
        console.log('🔄 Updating contract status:', contractId, 'to', status);
        const updateData = {
            status,
            updated_at: new Date().toISOString()
        };
        if (documentUrl) {
            updateData.document_url = documentUrl;
        }
        const { data, error } = await supabase_1.default
            .from('contracts')
            .update(updateData)
            .eq('id', contractId)
            .select()
            .single();
        if (error) {
            console.error('❌ Error updating contract:', error);
            throw new Error(`Failed to update contract: ${error.message}`);
        }
        console.log('✅ Contract updated successfully');
        return data;
    }
    /**
     * Create SignNow integration for a contract
     */
    async createSignNowIntegration(contractId, signnowDocumentId, signingUrl) {
        console.log('📄 Creating SignNow integration for contract:', contractId);
        const { data, error } = await supabase_1.default
            .from('contract_signnow_integration')
            .insert({
            contract_id: contractId,
            signnow_document_id: signnowDocumentId,
            signing_url: signingUrl,
            status: 'pending'
        })
            .select()
            .single();
        if (error) {
            console.error('❌ Error creating SignNow integration:', error);
            throw new Error(`Failed to create SignNow integration: ${error.message}`);
        }
        console.log('✅ SignNow integration created successfully');
        return data;
    }
    /**
     * Update SignNow integration status
     */
    async updateSignNowStatus(contractId, status, additionalData) {
        console.log('🔄 Updating SignNow status for contract:', contractId, 'to', status);
        const updateData = {
            status,
            updated_at: new Date().toISOString(),
            ...additionalData
        };
        // Set timestamp based on status
        switch (status) {
            case 'sent':
                updateData.sent_at = new Date().toISOString();
                break;
            case 'viewed':
                updateData.viewed_at = new Date().toISOString();
                break;
            case 'signed':
                updateData.signed_at = new Date().toISOString();
                break;
            case 'completed':
                updateData.completed_at = new Date().toISOString();
                break;
        }
        const { data, error } = await supabase_1.default
            .from('contract_signnow_integration')
            .update(updateData)
            .eq('contract_id', contractId)
            .select()
            .single();
        if (error) {
            console.error('❌ Error updating SignNow status:', error);
            throw new Error(`Failed to update SignNow status: ${error.message}`);
        }
        console.log('✅ SignNow status updated successfully');
        return data;
    }
    /**
     * Create a contract payment
     */
    async createContractPayment(contractId, paymentType, amount, stripePaymentIntentId) {
        console.log('💳 Creating contract payment:', contractId, paymentType, amount);
        const { data, error } = await supabase_1.default
            .from('contract_payments')
            .insert({
            contract_id: contractId,
            payment_type: paymentType,
            amount: amount,
            stripe_payment_intent_id: stripePaymentIntentId,
            status: 'pending'
        })
            .select()
            .single();
        if (error) {
            console.error('❌ Error creating contract payment:', error);
            throw new Error(`Failed to create contract payment: ${error.message}`);
        }
        console.log('✅ Contract payment created successfully');
        return data;
    }
    /**
     * Get all payments for a contract
     */
    async getContractPayments(contractId) {
        console.log('💰 Getting payments for contract:', contractId);
        const { data, error } = await supabase_1.default
            .from('contract_payments')
            .select('*')
            .eq('contract_id', contractId)
            .order('created_at', { ascending: false });
        if (error) {
            console.error('❌ Error getting contract payments:', error);
            throw new Error(`Failed to get contract payments: ${error.message}`);
        }
        return data;
    }
    /**
     * Get payment summary for a contract
     */
    async getContractPaymentSummary(contractId) {
        return this.paymentService.getPaymentSummary(contractId);
    }
    /**
     * Get payment schedule for a contract
     */
    async getContractPaymentSchedule(contractId) {
        return this.paymentService.getPaymentSchedule(contractId);
    }
    /**
     * Get payment history for a contract (with enhanced tracking)
     */
    async getContractPaymentHistory(contractId) {
        return this.paymentService.getContractPayments(contractId);
    }
    /**
     * Update payment status (enhanced version)
     */
    async updatePaymentStatus(paymentId, status, stripePaymentIntentId, notes) {
        return this.paymentService.updatePaymentStatus(paymentId, status, stripePaymentIntentId, notes);
    }
    /**
     * Get overdue payments
     */
    async getOverduePayments() {
        return this.paymentService.getOverduePayments();
    }
    /**
     * Get payment dashboard
     */
    async getPaymentDashboard() {
        return this.paymentService.getPaymentDashboard();
    }
    /**
     * Run daily payment maintenance (update overdue flags)
     */
    async runDailyPaymentMaintenance() {
        return this.paymentService.runDailyMaintenance();
    }
}
exports.ContractClientService = ContractClientService;
