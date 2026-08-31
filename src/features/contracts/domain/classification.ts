export const CONTRACT_TEMPLATE_CLASSES = ['labor', 'postpartum'] as const;

export type ContractTemplateClass = (typeof CONTRACT_TEMPLATE_CLASSES)[number];

/**
 * Preserves the active processor's behavior: any case-insensitive service type
 * containing "labor support" or "labor" is labor; everything else is postpartum.
 */
export function classifyContractTemplate(
  serviceType: string | null | undefined
): ContractTemplateClass {
  const normalized = serviceType?.toLowerCase() ?? '';
  return normalized.includes('labor support') || normalized.includes('labor')
    ? 'labor'
    : 'postpartum';
}

export function isLaborContract(
  serviceType: string | null | undefined
): boolean {
  return classifyContractTemplate(serviceType) === 'labor';
}
