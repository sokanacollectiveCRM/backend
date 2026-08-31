import {
  ContractCalculationService,
  DepositInput,
  MoneyInput,
  buildInstallmentCents,
  calculateContractPricing,
  parseMoneyToCents,
} from './calculations';
import {
  ContractTemplateClass,
  classifyContractTemplate,
} from './classification';
import { ContractPricingSnapshot, ContractServiceSnapshot } from './types';

type UnknownRecord = Record<string, unknown>;

export interface NormalizedContractPayload {
  contractId?: string;
  templateId?: string;
  clientId?: string;
  clientName: string;
  clientEmail: string;
  serviceType: string;
  templateClass: ContractTemplateClass;
  selectedServices: ContractServiceSnapshot[];
  pricing: ContractPricingSnapshot;
  templateValues: {
    totalHours?: string;
    hourlyRateCents?: number;
    overnightFeeCents?: number;
  };
  contractDate?: string;
  dueDate?: string;
  startDate?: string;
  endDate?: string;
}

function asRecord(value: unknown): UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function firstDefined(source: UnknownRecord, ...keys: string[]): unknown {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) return source[key];
  }
  return undefined;
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function toCalculationServices(value: unknown): ContractCalculationService[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry, index) => {
    const service = asRecord(entry);
    const type = service.type === 'hourly' ? 'hourly' : 'flat';
    const id =
      optionalString(firstDefined(service, 'id', 'serviceId', 'service_id')) ??
      `service-${index + 1}`;
    const name =
      optionalString(
        firstDefined(service, 'name', 'serviceName', 'service_name')
      ) ?? id;

    return [
      {
        id,
        name,
        type,
        amount: firstDefined(service, 'amount', 'flatAmount', 'flat_amount') as
          | MoneyInput
          | undefined,
        hourlyRate: firstDefined(service, 'hourlyRate', 'hourly_rate') as
          | MoneyInput
          | undefined,
        totalHours: firstDefined(service, 'totalHours', 'total_hours') as
          | number
          | string
          | undefined,
      },
    ];
  });
}

function normalizeDeposit(source: UnknownRecord): DepositInput | undefined {
  const type = firstDefined(source, 'depositType', 'deposit_type');
  const value = firstDefined(source, 'depositValue', 'deposit_value');
  if ((type !== 'percent' && type !== 'flat') || value === undefined) {
    return undefined;
  }
  return { type, value: value as MoneyInput };
}

function normalizeInstallmentsCount(
  source: UnknownRecord,
  fallback: number
): number {
  const raw = firstDefined(source, 'installmentsCount', 'installments_count');
  const count = typeof raw === 'number' ? raw : Number(raw);
  return Number.isInteger(count) && count > 0 ? count : fallback;
}

/**
 * Normalizes both active flat request bodies and legacy `{ contractData: ... }`
 * bodies. Outer values win for identity fields. When selected services are
 * present, all totals are recomputed and provided total strings are ignored.
 */
export function normalizeContractPayload(
  payload: unknown
): NormalizedContractPayload {
  const outer = asRecord(payload);
  const nested = asRecord(outer.contractData);
  const source = { ...nested, ...outer };
  delete source.contractData;

  const rawServices = firstDefined(
    source,
    'selectedServices',
    'selected_services'
  );
  const selectedServices = toCalculationServices(rawServices);
  const adminFee = firstDefined(
    source,
    'adminFee',
    'adminFeeAmount',
    'admin_fee',
    'admin_fee_amount'
  ) as MoneyInput | undefined;
  const deposit = normalizeDeposit(source);
  const serviceType =
    optionalString(firstDefined(source, 'serviceType', 'service_type')) ??
    'Postpartum Doula Services';
  const templateClass = classifyContractTemplate(serviceType);
  const installmentsCount = normalizeInstallmentsCount(
    source,
    templateClass === 'labor' ? 3 : 1
  );
  const explicitTotalHours = firstDefined(source, 'totalHours', 'total_hours');
  const explicitHourlyRate = firstDefined(
    source,
    'hourlyRate',
    'hourly_rate'
  ) as MoneyInput | undefined;
  const explicitOvernightFee = firstDefined(
    source,
    'overnightFee',
    'overnight_fee'
  ) as MoneyInput | undefined;

  let pricing: ContractPricingSnapshot;
  let normalizedServices: ContractServiceSnapshot[];

  if (Array.isArray(rawServices)) {
    const calculated = calculateContractPricing({
      selectedServices,
      adminFeeAmount: adminFee,
      deposit,
      installmentsCount,
    });
    normalizedServices = calculated.selectedServices;
    const adapterDepositCents = Math.max(
      parseMoneyToCents(
        firstDefined(source, 'depositAmount', 'deposit_amount') as
          | MoneyInput
          | undefined
      ),
      0
    );
    const depositCents = deposit
      ? calculated.depositCents
      : adapterDepositCents;
    const balanceCents = Math.max(calculated.totalCents - depositCents, 0);
    pricing = {
      ...calculated,
      depositCents,
      balanceCents,
      installmentCents: buildInstallmentCents(balanceCents, installmentsCount),
    };
  } else {
    normalizedServices = [];
    const totalCents = Math.max(
      parseMoneyToCents(
        firstDefined(
          source,
          'totalInvestment',
          'totalAmount',
          'total_amount'
        ) as MoneyInput | undefined
      ),
      0
    );
    const adminFeeCents = Math.max(parseMoneyToCents(adminFee), 0);
    const providedDepositCents = Math.max(
      parseMoneyToCents(
        firstDefined(source, 'depositAmount', 'deposit_amount') as
          | MoneyInput
          | undefined
      ),
      0
    );
    const depositCents = deposit
      ? deposit.type === 'percent'
        ? Math.round(
            (totalCents * Math.max(parseMoneyToCents(deposit.value), 0)) /
              10_000
          )
        : Math.max(parseMoneyToCents(deposit.value), 0)
      : providedDepositCents;
    const balanceCents = Math.max(totalCents - depositCents, 0);

    pricing = {
      servicesSubtotalCents: Math.max(totalCents - adminFeeCents, 0),
      discountRate: 0,
      discountCents: 0,
      servicesAfterDiscountCents: Math.max(totalCents - adminFeeCents, 0),
      adminFeeCents,
      totalCents,
      depositCents,
      balanceCents,
      installmentCents: buildInstallmentCents(balanceCents, installmentsCount),
    };
  }

  return {
    contractId: optionalString(
      firstDefined(source, 'contractId', 'contract_id')
    ),
    templateId: optionalString(
      firstDefined(source, 'templateId', 'template_id')
    ),
    clientId: optionalString(firstDefined(source, 'clientId', 'client_id')),
    clientName:
      optionalString(firstDefined(source, 'clientName', 'client_name')) ?? '',
    clientEmail:
      optionalString(firstDefined(source, 'clientEmail', 'client_email')) ?? '',
    serviceType,
    templateClass,
    selectedServices: normalizedServices,
    pricing,
    templateValues: {
      totalHours:
        explicitTotalHours === undefined
          ? normalizedServices
              .filter((service) => service.type === 'hourly')
              .reduce((sum, service) => sum + (service.totalHours ?? 0), 0)
              .toString()
          : String(explicitTotalHours),
      hourlyRateCents:
        explicitHourlyRate === undefined
          ? normalizedServices.find(
              (service) =>
                service.type === 'hourly' && (service.hourlyRateCents ?? 0) > 0
            )?.hourlyRateCents
          : Math.max(parseMoneyToCents(explicitHourlyRate), 0),
      overnightFeeCents:
        explicitOvernightFee === undefined
          ? undefined
          : Math.max(parseMoneyToCents(explicitOvernightFee), 0),
    },
    contractDate: optionalString(
      firstDefined(source, 'contractDate', 'contract_date', 'date')
    ),
    dueDate: optionalString(firstDefined(source, 'dueDate', 'due_date')),
    startDate: optionalString(firstDefined(source, 'startDate', 'start_date')),
    endDate: optionalString(firstDefined(source, 'endDate', 'end_date')),
  };
}

export const normalizeLegacyContractPayload = normalizeContractPayload;
