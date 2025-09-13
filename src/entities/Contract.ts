export interface Contract {
  id: string;
  client_id: string; // References client_info.id
  template_id?: number; // References contract_templates.id
  template_name?: string;
  fee?: string;
  deposit?: string;
  note?: string;
  document_url?: string;
  status: 'draft' | 'pending_signature' | 'signed' | 'active' | 'completed' | 'cancelled';
  generated_by: string; // References users.id
  created_at: string;
  updated_at: string;
}

export interface ContractTemplate {
  id: number;
  title: string;
  storage_path?: string;
  fee?: string;
  deposit?: string;
}

export interface ContractSignNowIntegration {
  id: string;
  contract_id: string;
  signnow_document_id?: string;
  signnow_envelope_id?: string;
  signing_url?: string;
  status: 'pending' | 'sent' | 'viewed' | 'signed' | 'completed' | 'declined';
  sent_at?: string;
  viewed_at?: string;
  signed_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ContractPayment {
  id: string;
  contract_id: string;
  payment_type: 'deposit' | 'installment' | 'final';
  amount: number;
  stripe_payment_intent_id?: string;
  status: 'pending' | 'succeeded' | 'failed' | 'canceled' | 'refunded';
  created_at: string;
  completed_at?: string;
  failed_at?: string;
  refunded_at?: string;
}
