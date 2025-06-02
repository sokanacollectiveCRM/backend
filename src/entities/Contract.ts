export interface Contract {
  id: string;
  template_id: string;
  template_name: string;
  client_id: string;
  note?: string;
  fee?: string;
  deposit?: string;
  status: 'created' | 'signed' | 'active',
  document_url: string;
  generated_by: string;
  created_at: string;
  updated_at: string;
}