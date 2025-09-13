export type DepositType = 'percent' | 'flat';
export type PaymentCadence = 'biweekly' | 'monthly';

export interface PostpartumContractInput {
  total_hours: number;
  hourly_rate: number;
  deposit_type: DepositType;
  deposit_value: number;  // percent (10-20) or flat amount
  installments_count: number;
  cadence: PaymentCadence;
}

export interface PostpartumContractAmounts {
  total_amount: number;
  deposit_amount: number;
  balance_amount: number;
  installments_amounts: number[];
}

export interface SignNowPostpartumFields {
  total_hours: string;
  deposit: string;
  hourly_rate_fee: string;
  overnight_fee_amount: string;
  total_amount: string;
}

export interface PostpartumContractConfig {
  min_deposit_percent: number;
  max_deposit_percent: number;
  min_installments: number;
  max_installments: number;
  template_id: string;
}

// Default configuration
export const DEFAULT_CONFIG: PostpartumContractConfig = {
  min_deposit_percent: 10,
  max_deposit_percent: 20,
  min_installments: 2,
  max_installments: 5,
  template_id: '3cc4323f75af4986b9a142513185d2b13d300759'
};
