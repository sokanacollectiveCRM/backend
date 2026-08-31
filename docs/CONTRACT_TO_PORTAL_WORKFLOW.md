# Contract, billing, signing, and client portal workflow

This document describes the authoritative backend workflow. Cloud SQL controls
client identity, billing path, contract state, payment readiness, and portal
eligibility. Browsers may display these values but must not decide whether a
client invoice is required.

## Billing paths

### Self-pay / out of pocket

- `phi_clients.payment_method` resolves to `self_pay`.
- A client deposit may be configured on the contract.
- A labor payment schedule is created when the contract has a positive amount
  remaining after the deposit.
- After signing, the backend creates a QuickBooks deposit invoice only when a
  positive deposit installment exists, remains unpaid, and has no existing
  QuickBooks invoice ID.
- Portal eligibility requires a signed contract, the required deposit to be
  paid, and a card/payment authorization on file.

### Commercial or private insurance

- `phi_clients.payment_method` resolves to `insurance`.
- The client does not receive an automatic deposit invoice from contract
  completion. Insurance billing is handled separately.
- The deposit is not a portal blocker.
- Existing policy still requires a card/payment authorization on file before
  portal invitation, to cover client-responsibility amounts when applicable.

### Medicaid

- `phi_clients.payment_method` resolves to `medicaid`.
- Contract completion does not create a client deposit invoice.
- Deposit payment and card-on-file are not portal blockers.
- A signed contract is sufficient for the billing portion of portal eligibility.

### Full support / payment waived / no payment required

- Labels containing `unable to pay`, `full support`, `no payment`,
  `no client payment`, `payment waived`, or `complimentary` resolve to
  `full_support`.
- Contract completion does not create a client invoice.
- Deposit payment and card-on-file are not portal blockers.
- A signed contract is sufficient for the billing portion of portal eligibility.

### Unknown billing path

- Empty or unrecognized `payment_method` values resolve to `unknown`.
- Invoice creation fails closed: no client invoice is generated.
- Portal invitation remains blocked with `billing_path_unknown` until staff
  corrects the client record.

## End-to-end workflow

### 1. Prepare the client record

1. Staff creates or selects the Cloud SQL `phi_clients` record.
2. Staff confirms the client's name, email, and `payment_method`.
3. The backend normalizes `payment_method` into the billing path above.
4. If the billing path is unknown, contract signing can proceed, but automated
   invoicing is suppressed and portal invitation remains blocked.

### 2. Create the contract

1. An authenticated administrator selects services and pricing in the CRM.
2. The frontend submits the compatibility request to
   `POST /api/contract-signing/generate-contract`.
3. The frontend sends the selected client ID. The backend resolves that ID from
   Cloud SQL and uses the stored name/email; legacy callers fall back to an
   authoritative email lookup.
4. Service totals, discounts, fees, deposit, balance, and installments are
   recalculated in integer cents.
5. The contract is stored as `draft` with an immutable template/version, client,
   field, service, pricing, and payment snapshot.

### 3. Generate and send

1. The backend renders the unsigned PDF from the pinned template.
2. It stores the private PDF in GCS with its SHA-256 hash and object generation.
3. For applicable labor/self-pay contracts, it creates the payment schedule.
4. It creates a random, expiring signing invitation and stores only the token
   hash.
5. The contract transitions to `sent`, and the signer receives the secure
   `/signing/:token` link.
6. Once sent, corrections require voiding the contract and creating a new one.

### 4. Review and sign

1. Opening the link validates expiry/revocation and records `viewed`.
2. The frontend displays the protected PDF and the server-provided frozen field
   manifest.
3. The signer adopts a typed or drawn signature, initials, and electronic
   records consent.
4. Progress saves completed field IDs only; coordinates and timestamps remain
   server-authoritative.
5. Completion requires every required field and is idempotent.

### 5. Complete and archive

1. The backend stamps the signature, initials, date, and evidence into the PDF.
2. It stores the completed PDF privately in GCS with hash/generation metadata.
3. It records the immutable signature and audit events in Cloud SQL.
4. The contract transitions to `signed`.
5. Outbox jobs are queued for the signer copy, internal Sokana copy, portal
   eligibility, client notification, and any eligible QuickBooks deposit
   invoice.
6. The signer receives the signed PDF as an attachment. The same message
   privately BCCs `CONTRACT_SIGNED_COPY_INTERNAL_EMAIL`, which defaults to
   `hello@sokanacollective.com`.

### 6. Decide whether to invoice

The QuickBooks handler first checks the authoritative billing path:

- Only `self_pay` may continue to client deposit invoicing.
- `insurance`, `medicaid`, `full_support`, and `unknown` return
  `client_deposit_not_required`.
- Missing deposit installments return `no_deposit_installment`.
- Legacy zero-dollar deposits return `zero_deposit_amount`.
- Existing QuickBooks IDs return `deposit_invoice_exists`.
- A valid unpaid positive self-pay deposit uses a stable request ID so retries
  cannot create a duplicate invoice.

### 7. Compute portal eligibility

The backend recomputes and stores readiness:

- Every path requires a signed contract.
- Self-pay requires the deposit paid and card/payment authorization on file.
- Insurance does not require a deposit but retains the card-on-file rule.
- Medicaid and full-support/no-payment require neither deposit nor card.
- Unknown billing paths remain blocked until corrected.

Eligibility unlocks the ability to invite the client; signing alone does not
automatically create an authentication account.

### 8. Create and invite the portal account

1. An authenticated administrator calls
   `POST /api/admin/clients/:id/portal/invite`.
2. The backend recomputes eligibility and rejects ineligible clients.
3. It rate-limits repeated invitations and requires a client email.
4. If no auth user exists, the current portal service creates one and links its
   user ID to the Cloud SQL client.
5. It generates a one-time password setup/recovery link and emails the client.
6. The client sets a password, signs in, and accesses only contracts owned by
   the linked Cloud SQL client ID.

The current portal invitation service still performs account creation through
the Supabase Auth admin API. This is separate from contract signing and must be
migrated to the configured Identity Platform provider as part of the remaining
Supabase-exit work.

## Environment behavior

- `CONTRACT_OUTBOX_ENABLED=false` stores signed PDFs and queues downstream work
  but does not execute completion emails, portal updates, or QuickBooks calls.
- Staging should enable the outbox only with QuickBooks sandboxing or an
  explicit billing-side-effect disable switch.
- Production requires the outbox worker enabled and monitored for retries and
  dead letters.
