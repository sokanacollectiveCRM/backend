import {
  ContractPricingSnapshot,
  ContractServiceSnapshot,
  ServicePricingType,
} from './types';

export type MoneyInput = number | string;

export interface ContractCalculationService {
  id: string;
  name: string;
  type: ServicePricingType;
  amount?: MoneyInput;
  hourlyRate?: MoneyInput;
  totalHours?: number | string;
}

export interface DepositInput {
  type: 'percent' | 'flat';
  value: MoneyInput;
}

export interface CalculateContractPricingInput {
  selectedServices: readonly ContractCalculationService[];
  adminFeeAmount?: MoneyInput | null;
  deposit?: DepositInput | null;
  installmentsCount?: number;
}

export interface CalculatedContractPricing extends ContractPricingSnapshot {
  selectedServices: ContractServiceSnapshot[];
  positiveServiceCount: number;
}

const MONEY_PATTERN = /^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/;

export function parseMoneyToCents(
  value: MoneyInput | null | undefined
): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Money must be finite');
    return Math.round(value * 100);
  }

  const normalized = value.trim().replace(/^\$/, '');
  if (!MONEY_PATTERN.test(normalized)) {
    throw new Error(`Invalid money value: ${value}`);
  }
  return Math.round(Number(normalized.replace(/,/g, '')) * 100);
}

export function formatCentsAsDollarString(cents: number): string {
  if (!Number.isSafeInteger(cents)) {
    throw new Error('Cents must be a safe integer');
  }
  return (cents / 100).toFixed(2);
}

function parseHours(value: number | string | undefined): number {
  if (value === undefined || value === '') return 0;
  const hours = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(hours) || hours < 0) {
    throw new Error('totalHours must be a non-negative finite number');
  }
  return hours;
}

function normalizeService(
  service: ContractCalculationService
): ContractServiceSnapshot {
  if (service.type === 'flat') {
    return {
      id: service.id,
      name: service.name,
      type: 'flat',
      amountCents: Math.max(parseMoneyToCents(service.amount), 0),
    };
  }

  return {
    id: service.id,
    name: service.name,
    type: 'hourly',
    hourlyRateCents: Math.max(parseMoneyToCents(service.hourlyRate), 0),
    totalHours: parseHours(service.totalHours),
  };
}

export function getServiceAmountCents(
  service: ContractServiceSnapshot
): number {
  if (service.type === 'flat') return Math.max(service.amountCents ?? 0, 0);
  return Math.round(
    Math.max(service.hourlyRateCents ?? 0, 0) *
      Math.max(service.totalHours ?? 0, 0)
  );
}

export function buildInstallmentCents(
  balanceCents: number,
  installmentsCount: number
): number[] {
  if (!Number.isInteger(installmentsCount) || installmentsCount <= 0) return [];

  const safeBalance = Math.max(Math.round(balanceCents), 0);
  const base = Math.floor(safeBalance / installmentsCount);
  const remainder = safeBalance - base * installmentsCount;

  return Array.from({ length: installmentsCount }, (_, index) =>
    index === installmentsCount - 1 ? base + remainder : base
  );
}

export function calculateContractPricing(
  input: CalculateContractPricingInput
): CalculatedContractPricing {
  const selectedServices = input.selectedServices.map(normalizeService);
  const serviceAmounts = selectedServices.map(getServiceAmountCents);
  const servicesSubtotalCents = serviceAmounts.reduce(
    (sum, amount) => sum + amount,
    0
  );
  const positiveServiceCount = serviceAmounts.filter(
    (amount) => amount > 0
  ).length;
  const discountRate = positiveServiceCount > 1 ? 0.1 : 0;
  const discountCents = Math.round(servicesSubtotalCents * discountRate);
  const servicesAfterDiscountCents = Math.max(
    servicesSubtotalCents - discountCents,
    0
  );
  const adminFeeCents = Math.max(parseMoneyToCents(input.adminFeeAmount), 0);
  const totalCents = servicesAfterDiscountCents + adminFeeCents;

  let depositCents = 0;
  if (input.deposit) {
    const depositValueCents = Math.max(
      parseMoneyToCents(input.deposit.value),
      0
    );
    depositCents =
      input.deposit.type === 'percent'
        ? Math.round((totalCents * depositValueCents) / 10_000)
        : depositValueCents;
  }

  const balanceCents = Math.max(totalCents - depositCents, 0);
  const installmentsCount = input.installmentsCount ?? 1;

  return {
    selectedServices,
    positiveServiceCount,
    servicesSubtotalCents,
    discountRate,
    discountCents,
    servicesAfterDiscountCents,
    adminFeeCents,
    totalCents,
    depositCents,
    balanceCents,
    installmentCents: buildInstallmentCents(balanceCents, installmentsCount),
  };
}
