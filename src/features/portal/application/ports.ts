import {
  BillingPath,
  OnboardingEventType,
  PortalBlockerCode,
  PortalEligibilitySnapshot,
} from '../domain/eligibility';

/** Raw onboarding facts for one client. `null` means the source had no value. */
export interface OnboardingFactRecord {
  hasSignedContract: boolean | null;
  installmentDepositPaid: boolean | null;
  legacyPaymentExists: boolean | null;
  paymentMethod: string | null;
  qbCustomerId: string | null;
}

export interface OnboardingFactsReader {
  /** Returns `null` when the client row does not exist. */
  read(clientId: string): Promise<OnboardingFactRecord | null>;
}

export interface CardOnFileRecord {
  onFile: boolean;
  paymentMethodReference: string | null;
}

export interface CardOnFileReader {
  read(clientId: string): Promise<CardOnFileRecord>;
}

export interface StoredReadiness {
  is_eligible: boolean;
  verification_invoice_id: string | null;
  verification_invoice_sent_at: Date | string | null;
  verification_invoice_paid_at: Date | string | null;
}

export interface SaveReadinessInput {
  client_id: string;
  contract_signed: boolean;
  deposit_paid: boolean;
  billing_path: BillingPath;
  payment_authorization_required: boolean;
  payment_authorization_satisfied: boolean;
  card_on_file: boolean;
  qb_customer_id: string | null;
  qb_stored_payment_method_id: string | null;
  is_eligible: boolean;
  portal_blockers: PortalBlockerCode[];
  primary_portal_blocker: PortalBlockerCode | null;
  verification_invoice_id: string | null;
  verification_invoice_sent_at: Date | string | null;
  verification_invoice_paid_at: Date | string | null;
}

export interface ReadinessEvent {
  client_id: string;
  event_type: OnboardingEventType;
  event_source?: string;
  payload?: Record<string, unknown>;
}

export interface PortalReadinessStore {
  getStored(clientId: string): Promise<StoredReadiness | null>;
  getSnapshots(
    clientIds: string[]
  ): Promise<Map<string, PortalEligibilitySnapshot>>;
  save(input: SaveReadinessInput): Promise<PortalEligibilitySnapshot>;
  recordEvent(event: ReadinessEvent): Promise<void>;
}

export interface PortalEligibilityDeps {
  facts: OnboardingFactsReader;
  cards: CardOnFileReader;
  readiness: PortalReadinessStore;
}
