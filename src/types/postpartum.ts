export interface PostpartumContractInput {
  total_hours: number;
  hourly_rate: number;
  deposit_type: 'percent' | 'fixed';
  deposit_value: number;
  installments_count: number;
  cadence: 'monthly' | 'biweekly';
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

export const DEFAULT_CONFIG = {
  min_installments: 1,
  max_installments: 12,
  min_deposit_percent: 10,
  max_deposit_percent: 50
};
