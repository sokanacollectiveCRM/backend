# Sokana Collective — Technical HIPAA PHI / Data-Flow Inventory

**Date:** 2026-08-17 (inventory); **board re-verified 2026-08-20**  
**Scope:** `backend` (`/Users/jerrybony/Documents/GitHub/backend`) and
`frontend-crm`
(`/Users/jerrybony/Documents/GitHub/sokana-crm-frontend/frontend-crm`)  
**Method:** Read-only code, schema, and route inspection. No production data was
queried. No credentials, tokens, or client values are included.  
**Status:** Technical foundation for PHI inventory, vendor review,
access-control review, and risk analysis. **Not a legal HIPAA determination.**

**HIPAA board mapping (engineering, not legal):** see
[`HIPAA_BOARD_TECHNICAL_STATUS.md`](./HIPAA_BOARD_TECHNICAL_STATUS.md). Re-check
on 2026-08-20 confirmed the board is outdated: **1 done** (HIPAA-02 BAA,
operational report only), **11 in progress/partial**, **6 not started / not
evidenced**. None of the remaining P0 code findings (CSV export, hours IDOR,
intake email, simulate-payment PAN, hardcoded SMTP, frontend payload logs,
birth-outcomes assignment) have been closed.

Classification of identifiers (name, email, phone, address) as PHI **depends on
whether Sokana is a HIPAA covered entity or business associate**. This inventory
labels those fields `PHI if covered entity; otherwise PII` rather than assuming
PHI solely because they live in a care CRM.

The application constant `PHI_FIELDS` in `src/constants/phiFields.ts` is a
**storage-routing** set (Cloud SQL vs Supabase), not a complete HIPAA inventory.
Many fields treated as “operational” in code are still sensitive.

---

# 1. Executive summary

Sokana’s CRM collects perinatal, insurance, household, and billing data on
public intake, stores the lead on Cloud SQL `public.phi_clients`, and later
exposes subsets to admins, assigned doulas, billing staff, and portal clients.
Auth is Supabase; operational client/PHI storage is intended to be Cloud SQL
(`sokana_private`). SignNow, QuickBooks/Intuit, Gmail SMTP, CloudConvert, and
Supabase Storage receive client-identifying or document data.

**What engineering can already prove**

- Client-identifying and clinical fields are collected on
  `POST /requestService/requestSubmission` and inserted into Cloud SQL
  `phi_clients` (`src/repositories/requestFormRepository.ts`).
- Application roles are `admin`, `billing`, `doula`, `client`
  (`src/security/authorizationPolicies.ts`, frontend
  `src/common/auth/roles.ts`).
- Clinical merge on `GET /clients/:id` is gated by `canAccessSensitive` (admin
  always; doula only if assigned — currently via **Supabase** `assignments`).
- Card-on-file persistence is masked metadata (`last4`, brand, exp, provider
  reference) in `client_payment_methods`. Full PAN/CVC are not schema columns.
- QuickBooks customer create sends `GivenName`, `FamilyName`, `DisplayName`,
  `PrimaryEmailAddr` only (`src/services/customer/buildCustomerPayload.ts`).
- P0 auth/webhook/intake-abuse hardening is documented in
  `docs/SECURITY_P0_HARDENING_SUMMARY.md` and
  `docs/ENDPOINT_AUTHORIZATION_MATRIX.md`.

**Highest-priority technical gaps (not legal conclusions)**

| ID     | Finding                                                                                                                                  | Severity                                                            |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| INV-01 | Public intake emails **full clinical + identity payload** to staff Gmail                                                                 | P0                                                                  |
| INV-02 | `GET /clients/fetchCSV` allows role `client` and exports **all** clients’ names, income, address                                         | P0                                                                  |
| INV-09 | `POST /users/:id/addhours` is session-only: any logged-in user can write hours for any `client_id`                                       | P0                                                                  |
| INV-10 | Live `POST /quickbooks/simulate-payment` (admin) accepts **PAN/CVC** and posts them to Intuit sandbox                                    | P0                                                                  |
| INV-11 | Hardcoded Gmail app password in `src/scripts/sendTestEmail.ts`                                                                           | P0                                                                  |
| INV-03 | `GET /clients/:id` returns name/email/phone/address to **any authenticated doula**, not only assigned                                    | P1                                                                  |
| INV-04 | Assignment checks are split: Cloud SQL `doula_assignments` vs Supabase `assignments`                                                     | P1                                                                  |
| INV-05 | Gmail SMTP, SignNow, QuickBooks, CloudConvert, Supabase Storage receive identifiers/documents; **BAA status cannot be proven from code** | P1                                                                  |
| INV-06 | `self_pay_card_info` is free text on `phi_clients` (possible PAN if typed)                                                               | P1                                                                  |
| INV-12 | `PUT /clients/:id/birth-outcomes` assignment / `canAccessSensitive`                                                                      | **Closed** — `docs/HIPAA_INV12_BIRTH_OUTCOMES_ASSIGNMENT_STATUS.md` |
| INV-13 | `POST/GET /clients/:id/activity(ies)` lack doula assignment checks (unlike `/api/doulas/...`)                                            | P1                                                                  |
| INV-07 | Intake rate-limit keys store plaintext `email:` values                                                                                   | P2                                                                  |
| INV-08 | Frontend logout does not clear `sessionStorage` session token                                                                            | P2                                                                  |

---

# 2. Technical PHI inventory (consolidated)

| Data category                                                      | PHI?                                             | Collected at                                                                                            | Stored in                                                                                                     | Transmitted to                                              | Roles with access                                                           | Main risk                            |
| ------------------------------------------------------------------ | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------ |
| Client legal name                                                  | PHI if covered entity; else PII                  | Public intake; admin edit                                                                               | Cloud SQL `phi_clients`; identity cache historically on Supabase `client_info`                                | Gmail intake email; SignNow; QuickBooks; portal emails      | Admin; assigned doula (list/detail); client (own); billing (contract views) | Email + vendor disclosure            |
| Email, phone                                                       | PHI if covered entity; else PII                  | Intake; profile                                                                                         | `phi_clients`                                                                                                 | Gmail; SignNow invite; QB customer; match emails            | Admin; assigned doula; client (own)                                         | Intake email; doula match email      |
| Address / city / state / zip                                       | PHI if combined with care; else PII              | Intake home step                                                                                        | `phi_clients.address_line1` + city/state/zip                                                                  | Gmail intake email                                          | Admin; `GET /clients/:id` operational DTO (any doula — INV-03)              | Location + care context              |
| Date of birth                                                      | PHI/ePHI                                         | Staff profile (not required on public intake schema)                                                    | `phi_clients.date_of_birth`                                                                                   | Not in QB payload                                           | Admin; assigned doula (clinical merge)                                      | Clinical identifier                  |
| Intake age (years)                                                 | PHI if covered entity                            | Intake                                                                                                  | `phi_clients.intake_age_years`                                                                                | Gmail intake (age range / age fields)                       | Admin; assigned doula                                                       | Minimization                         |
| Due date, pregnancy #, babies, birth place/hospital, provider type | PHI/ePHI                                         | Intake pregnancy step                                                                                   | `phi_clients`                                                                                                 | Gmail intake email                                          | Admin; assigned doula (detail merge)                                        | Clinical + email                     |
| Health history, allergies, health notes, medications               | PHI/ePHI                                         | Intake (optional); staff edit                                                                           | `phi_clients`                                                                                                 | **Gmail intake email (INV-01)**                             | Admin; assigned doula                                                       | Email is the largest ePHI disclosure |
| Birth outcomes (induction, delivery type, medications used)        | PHI/ePHI                                         | Staff `PUT /clients/:id/birth-outcomes`                                                                 | `phi_clients`                                                                                                 | Not emailed by default (code)                               | Admin; assigned doula                                                       | Clinical                             |
| Insurance member/policy IDs, payer, policy holder DOB/name         | PHI / payment                                    | Intake payment step; portal billing                                                                     | `phi_clients`                                                                                                 | Not sent to QB customer create                              | Admin; doula billing endpoints; client own billing                          | Mapper labels these “operational”    |
| Medicaid                                                           | Context-dependent                                | Public intake **rejects** label `Medicaid`; CRM billing options still include Medicaid (`paymentRules`) | Possible via staff/portal billing                                                                             | Unknown off-system                                          | Organizational                                                              | Whether Sokana e-bills plans         |
| Annual income / sliding scale                                      | PII / sensitive; PHI if tied to care record      | Intake                                                                                                  | `phi_clients.annual_income`                                                                                   | Gmail intake; CSV export (INV-02)                           | Admin; CSV for client role                                                  | Export + email                       |
| Referral name/email/source                                         | PII; PHI if identifies a patient                 | Intake                                                                                                  | `phi_clients`                                                                                                 | Gmail intake                                                | Admin; detail                                                               | Third-party PII                      |
| Partner/family name & phones                                       | PII                                              | Intake family step                                                                                      | **Emailed**; Cloud SQL insert **does not persist** these columns                                              | Gmail only (unless later written to Supabase `client_info`) | Staff email                                                                 | Data in email but not DB             |
| Doula assignment                                                   | Operational; PHI if it reveals care relationship | Admin match                                                                                             | Cloud SQL `doula_assignments`; also Supabase `assignments`                                                    | Doula/client match emails (name+email)                      | Admin; assigned doula                                                       | Dual-store drift (INV-04)            |
| Hours (`prenatal`/`postpartum`)                                    | Operational; PHI if linked to named client       | Doula dashboard                                                                                         | Cloud SQL `hours`                                                                                             | None by default                                             | Assigned doula; admin                                                       | Record-level OK on doula routes      |
| Notes / activities                                                 | PHI possible (free text)                         | Doula/admin notes                                                                                       | Cloud SQL `client_activities.description` + `metadata` jsonb                                                  | None by default                                             | Assigned doula; admin; possibly client notes API                            | Free-text clinical                   |
| Contracts + SignNow IDs                                            | PII + financial; PHI if name+service             | Admin contract flow                                                                                     | Cloud SQL/Supabase contracts; SignNow                                                                         | SignNow; CloudConvert; Gmail billing “new contract”         | Admin; billing (limited); client own                                        | Vendor BAA                           |
| Invoices / payment schedule                                        | Payment; PHI if named patient                    | Billing / QB                                                                                            | `phi_invoices`, payment_schedules                                                                             | QuickBooks; client email                                    | Admin; billing; doula on `/api/invoices` and `/api/financial`               | Doula over-access                    |
| Card-on-file metadata                                              | Payment (not PAN)                                | Portal/staff save                                                                                       | `client_payment_methods` last4/brand/exp/ref                                                                  | Intuit Payments (token)                                     | Admin; assigned doula; owning client                                        | PCI if `self_pay_card_info` abused   |
| Auth tokens / cookies                                              | Auth/security                                    | Login                                                                                                   | HttpOnly `sb-access-token`; FE `sessionStorage` key `sokana.session-token`; Supabase `localStorage` `sb-auth` | Browser                                                     | Session owner                                                               | XSS vs sessionStorage; logout gap    |
| Doula documents                                                    | Workforce; may be sensitive                      | Doula upload                                                                                            | Supabase Storage `doula-documents`                                                                            | Signed URLs                                                 | Doula (own); admin review                                                   | Not client PHI                       |
| Client insurance card images                                       | PHI / payment                                    | Portal upload                                                                                           | Supabase Storage `client-documents` + `client_documents` metadata                                             | Signed URL to admin/doula/client                            | Admin; doula; owning client                                                 | Image PHI                            |

---

# 3. Part 1 — Client-related field inventory

Sources: public intake `frontend-crm/src/features/request/useRequestForm.ts`;
Cloud SQL insert `src/repositories/requestFormRepository.ts`; DTO
`frontend-crm/src/api/dto/client.dto.ts`; `src/constants/phiFields.ts`;
migrations under `src/db/migrations/`.

## 3.1 Public intake (collected)

| Field / category                             | Example field name                                                                                                                       | Classification                     | Source                         | Stored where                                                           | Used for                  |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------ | ---------------------------------------------------------------------- | ------------------------- |
| Name                                         | `firstname`, `lastname`                                                                                                                  | PHI if CE; else PII                | Intake step 1                  | `phi_clients.first_name/last_name`                                     | CRM, email, contracts, QB |
| Email                                        | `email`                                                                                                                                  | PHI if CE; else PII                | Intake                         | `phi_clients.email`                                                    | Account, notifications    |
| Mobile                                       | `phone_number`                                                                                                                           | PHI if CE; else PII                | Intake                         | `phi_clients.phone`                                                    | Contact                   |
| Pronouns                                     | `pronouns`, `pronouns_other`                                                                                                             | PII / operational                  | Intake                         | `phi_clients`                                                          | Care communication        |
| Preferred name / contact                     | `preferred_name`, `preferred_contact_method`                                                                                             | PII                                | Intake                         | `phi_clients`                                                          | Ops                       |
| Age                                          | `age` → `intake_age_years`                                                                                                               | PHI if CE                          | Intake                         | `phi_clients.intake_age_years`                                         | Matching                  |
| Address                                      | `address`, `city`, `state`, `zip_code`                                                                                                   | PHI if CE                          | Intake home                    | `phi_clients.address_line1` + geo                                      | Matching, email           |
| Home type / access / pets / household counts | `home_type(s)`, `home_access`, `pets`, `home_adults_count`, `home_youth_count`                                                           | Operational; PHI if CE (household) | Intake home                    | `phi_clients`                                                          | Doula safety/logistics    |
| Partner / family                             | `relationship_status`, `first_name`, `last_name`, `middle_name`, `family_email`, `mobile_phone`, `work_phone`, `family_pronouns`         | PII                                | Intake family                  | **Email only** on public submit (not in `INSERT`)                      | Staff notification        |
| Referral                                     | `referral_source`, `referral_source_other`, `referral_name`, `referral_email`                                                            | PII                                | Intake                         | `phi_clients`                                                          | Marketing/ops             |
| Health                                       | `health_history`, `allergies`, `health_notes`                                                                                            | PHI/ePHI                           | Intake (optional)              | `phi_clients`                                                          | Care; **emailed**         |
| Pregnancy                                    | `due_date`, `birth_location`, `birth_hospital`, `number_of_babies`, `baby_name`, `provider_type`, `pregnancy_number`, `hospital`         | PHI/ePHI                           | Intake                         | `phi_clients` (hospital may be alias of birth place)                   | Care; emailed             |
| Past pregnancy                               | `had_previous_pregnancies`, `previous_pregnancies_count`, `living_children_count`, `past_pregnancy_experience`                           | PHI/ePHI                           | Intake                         | `phi_clients`                                                          | Care; emailed             |
| Services                                     | `services_interested`, `service_support_details`, `service_needed`                                                                       | Operational / PHI if CE            | Intake                         | `phi_clients`                                                          | Matching                  |
| Payment method                               | `payment_method` (4 public labels; Medicaid rejected)                                                                                    | Payment / operational              | Intake                         | `phi_clients.payment_method`                                           | Billing path              |
| Insurance                                    | `insurance_provider`, `insurance_member_id`, `policy_number`, holder name/DOB/relationship, `insurance_plan_type`, phones, secondary IDs | PHI / payment                      | Intake when insurance required | `phi_clients`                                                          | Billing                   |
| Income / sliding                             | `annual_income`, `self_pay_sliding_*`                                                                                                    | Sensitive PII                      | Intake                         | `annual_income` on `phi_clients`; sliding fields need schema verify    | Sliding scale             |
| Demographics                                 | `race_ethnicity`, `primary_language`, `client_age_range`, `demographics_multi`                                                           | Sensitive; PHI if CE               | Intake optional                | race/language/age on `phi_clients`; `demographics_multi` not in INSERT | Reporting                 |
| Honeypot                                     | `website`, `company_url`, `fax_number`, `hp_field`                                                                                       | Non-sensitive                      | Intake abuse                   | Not stored as client data                                              | Bot trap                  |

## 3.2 Staff / portal / workflow fields (not all on public intake)

| Field / category    | Example field name                                                          | Classification                     | Source         | Stored where                          | Used for       |
| ------------------- | --------------------------------------------------------------------------- | ---------------------------------- | -------------- | ------------------------------------- | -------------- |
| Client number       | `client_number`                                                             | Operational                        | Generated      | `phi_clients`                         | Display        |
| Status / portal     | `status`, `portal_status`, invite timestamps                                | Operational                        | Admin          | `phi_clients`                         | Pipeline       |
| DOB                 | `date_of_birth`                                                             | PHI/ePHI                           | Staff profile  | `phi_clients`                         | Identity       |
| Medications         | `medications`                                                               | PHI/ePHI                           | Staff          | `phi_clients`                         | Care           |
| Birth outcomes      | `birth_outcomes_*`                                                          | PHI/ePHI                           | Staff PUT      | `phi_clients`                         | Reporting      |
| QBO link            | `qbo_customer_id`, sync status                                              | Operational / billing              | QB sync        | `phi_clients`                         | Accounting     |
| Card on file        | `card_brand`, `last4`, `exp_*`, `provider_payment_method_reference`         | Payment metadata                   | Payments API   | `client_payment_methods`              | Recurring pay  |
| Self-pay card notes | `self_pay_card_info`                                                        | Payment; **PAN risk if free text** | Intake/billing | `phi_clients`                         | Billing notes  |
| Contract            | `client_name`, `client_email`, `contract_data` jsonb, `signnow_document_id` | PII + financial                    | Contract flow  | contracts tables                      | e-sign         |
| Hours               | `start_time`, `end_time`, `type`                                            | Operational / PHI if CE            | Doula          | `hours`                               | Timekeeping    |
| Notes               | `description`, `metadata`                                                   | PHI possible                       | Doula/admin    | `client_activities`                   | Care notes     |
| Insurance card file | `file_path`, `document_type=insurance_card`                                 | PHI                                | Portal upload  | Supabase Storage + `client_documents` | Billing verify |

**Drop-PHI migration:**
`src/db/migrations/drop_phi_columns_from_client_info.sql` drops clinical columns
from Supabase `client_info`. Address/identity drops are commented. **Whether
this ran in production: needs infrastructure verification.**

---

# 4. Part 2 — PHI entry points

| Entry point                  | Route                                                      | Controller / service                                                                  | AuthZ                                                 | Validation                                     | Destination                                                      |
| ---------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------- |
| Public intake                | `POST /requestService/requestSubmission`                   | `requestFormController.createForm` → `RequestFormService` / `submitPublicRequestForm` | Public + honeypot/rate limit/idempotency              | Zod/domain in intake package + FE `fullSchema` | Cloud SQL `phi_clients`; staff + client emails                   |
| Authenticated request create | `createRequest` in same controller                         | Exists in controller                                                                  | Intended authenticated                                | Body as `RequestFormData`                      | Confirm mount: only `/requestSubmission` is on `requestRoute.ts` |
| Admin/staff client edit      | `PUT /clients/:id`, `PUT /clients/:id/phi`                 | `clientController`                                                                    | `admin`,`doula` + `canAccessSensitive` for PHI writes | `phiFields` split                              | Cloud SQL; optional PHI broker                                   |
| Birth outcomes               | `PUT /clients/:id/birth-outcomes`                          | `clientController`                                                                    | `admin`,`doula` + sensitive check                     | Structured fields                              | `phi_clients`                                                    |
| Billing profile              | `GET/PUT /clients/:id/billing`, `/me/billing`              | `clientController`                                                                    | admin/doula or client-own                             | billing extract/validate                       | `phi_clients` insurance columns                                  |
| Client portal documents      | `POST /clients/me/documents`                               | `clientController.uploadMyDocument`                                                   | `client`                                              | multer 10MB                                    | Supabase `client-documents` + `client_documents`                 |
| Doula hours                  | `POST /api/doulas/hours`                                   | `doulaController`                                                                     | `doula` + Cloud SQL assignment                        | body times                                     | `hours`                                                          |
| Doula notes                  | `POST /api/doulas/clients/:clientId/activities`            | `doulaController`                                                                     | `doula` + assignment                                  | description                                    | `client_activities`                                              |
| Contract generation          | `/api/contract/*`, `/api/pdf-contract/*`, `/api/signnow/*` | contract + SignNow services                                                           | Admin (router)                                        | contract payload                               | temp files, SignNow, DB                                          |
| Card on file                 | `POST /api/payment-methods`                                | `paymentMethodController`                                                             | admin / assigned doula / owning client                | Zod: uuid, `intuit_token`, `request_id`        | Intuit; then masked row                                          |
| QB customer                  | `POST /quickbooks/customer`                                | `createCustomer`                                                                      | admin, billing                                        | name+email                                     | Intuit QBO + `qbo_customer_id`                                   |
| SignNow webhook              | `POST /api/signnow/callback`                               | `signNowWebhookController`                                                            | HMAC                                                  | event ledger                                   | contract status                                                  |
| QB webhook                   | `POST /quickbooks/webhooks/invoice-paid`                   | `quickbooksWebhookController`                                                         | HMAC                                                  | event ledger                                   | invoice/payment status                                           |
| Portal invite                | email via `sendPortalInviteEmail`                          | admin action                                                                          | admin                                                 | email + name                                   | Gmail; portal_status fields                                      |
| Team/doula invite            | `/email/team-invite`, doula invite                         | admin                                                                                 | admin                                                 | name/role/email                                | Gmail (email in signup URL)                                      |
| Imports                      | none found as a first-class importer                       | —                                                                                     | —                                                     | —                                              | Not established                                                  |
| Stripe                       | tables/services exist; **routes not mounted**              | —                                                                                     | `FEATURE_STRIPE`                                      | —                                              | Inactive at runtime                                              |
| DocuSign                     | dependency + unmounted routes                              | —                                                                                     | —                                                     | —                                              | Inactive at runtime                                              |

Frontend forms: `RequestForm.tsx` / `RequestFormDesktop.tsx`; CRM client dialogs
under `src/features/clients/`; portal `ClientProfileTab.tsx`; doula `HoursTab` /
`ActivitiesTab`.

---

# 5. Part 3 — Storage inventory

| Storage location                                  | Data stored                                                              | PHI possible?                  | Encryption evidence                                                                  | Retention evidence                                            | Access mechanism                                   |
| ------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------- | -------------------------------------------------- |
| Cloud SQL `sokana_private` `phi_clients`          | Identity, clinical, insurance, intake                                    | Yes                            | Google-managed at rest (`docs/SECURITY_P0_HARDENING_SUMMARY.md`); not app-level/CMEK | Backup 7-day documented; **app retention policy not in code** | Cloud SQL connector / pool                         |
| `hours`, `client_activities`, `doula_assignments` | Time, notes, matches                                                     | Yes (notes)                    | Same                                                                                 | Not in code                                                   | API + assignment checks                            |
| `client_payment_methods`                          | last4/brand/exp/ref                                                      | No PAN in schema               | Same                                                                                 | Not in code                                                   | Payment method API                                 |
| `phi_invoices`, payment schedules                 | Amounts, QBO ids, names via joins                                        | Possible                       | Same                                                                                 | Not in code                                                   | Billing/financial APIs                             |
| `intake_rate_limits`                              | `email:` + raw email as `bucket_key`                                     | PII/PHI possible               | Same                                                                                 | Windowed rows                                                 | Intake abuse                                       |
| `intake_idempotency_keys`                         | key + status + response JSON (success message)                           | Low if body is message-only    | Same                                                                                 | TTL column                                                    | Intake                                             |
| `webhook_events`                                  | provider + event_key (not payload)                                       | Unlikely                       | Same                                                                                 | Not in code                                                   | Webhooks                                           |
| `oauth_states`                                    | OAuth state                                                              | Auth                           | Same                                                                                 | TTL (PR 5)                                                    | QB OAuth                                           |
| Supabase Auth                                     | users, sessions                                                          | Auth identifiers               | **Needs infrastructure verification**                                                | Supabase project settings                                     | JWT/cookies                                        |
| Supabase `client_info`                            | Historical operational + possibly leftover PHI columns                   | Yes if drop not applied        | **Needs infrastructure verification**                                                | Unknown                                                       | Service role from API                              |
| Supabase Storage `client-documents`               | Insurance card bytes                                                     | Yes                            | **Needs infrastructure verification**                                                | Unknown                                                       | Signed URLs                                        |
| Supabase Storage `doula-documents`                | Doula files                                                              | Workforce sensitive            | Same                                                                                 | Unknown                                                       | Signed URLs                                        |
| Supabase contract template bucket                 | Templates                                                                | Unlikely                       | Same                                                                                 | Unknown                                                       | Admin                                              |
| Browser `sessionStorage` `sokana.session-token`   | Session JWT                                                              | Auth                           | N/A (device)                                                                         | Tab lifetime; **not cleared on logout**                       | `sessionAccessToken.ts`                            |
| Browser `localStorage` Supabase `sb-auth`         | Portal session                                                           | Auth                           | N/A                                                                                  | Until signOut                                                 | `@supabase/supabase-js`                            |
| Cookie `sb-access-token`                          | Session                                                                  | Auth                           | HttpOnly; Secure in prod                                                             | 1 hour maxAge                                                 | `sessionCookies.ts`                                |
| Server temp / `/tmp` contract DOCX/PDF            | Contract with client name                                                | Yes                            | Ephemeral disk; Cloud Run encrypted per P0 doc                                       | Process lifetime **unproven cleanup**                         | `signNowContractProcessor.ts`                      |
| SignNow                                           | Document + name/email                                                    | Yes                            | **Needs vendor/infra verification**                                                  | Vendor                                                        | API                                                |
| QuickBooks Online                                 | Customer name/email; invoices                                            | PHI if CE                      | **Needs vendor verification**                                                        | Vendor                                                        | OAuth API                                          |
| QuickBooks Payments                               | Card data (Intuit)                                                       | Payment                        | Intuit                                                                               | Vendor                                                        | `intuit_token`                                     |
| Gmail SMTP                                        | Intake PHI, billing, invites                                             | Yes                            | TLS to SMTP assumed; **not proven**; mailbox retention unknown                       | Google Workspace policy                                       | `emailService.ts`                                  |
| CloudConvert                                      | Full contract DOCX                                                       | Yes                            | **Needs vendor verification**                                                        | Job/export URL                                                | `convertToPdf.ts`                                  |
| Application logs (Pino)                           | Routes, correlation ids; some services still log identifiers in non-prod | Possible in non-prod `console` | Cloud Logging **needs infra verification**                                           | Unknown                                                       | `safeLogging.ts` + logger                          |
| Analytics / Sentry                                | **Not in FE/BE package.json**                                            | No product analytics found     | N/A                                                                                  | N/A                                                           | Demographics UI is internal, not a third-party SDK |

---

# 6. Part 4 / 15 — Vendor / data processor inventory

| Vendor                                              | Function          | Information shared                                 | PHI potential                | BAA status             | Technical owner (code)                                                 | Action                                                                  |
| --------------------------------------------------- | ----------------- | -------------------------------------------------- | ---------------------------- | ---------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Google Cloud (Cloud SQL, Cloud Run, Secret Manager) | Hosting + DB      | All CRM ePHI in `phi_clients`                      | Yes                          | Needs confirmation     | `src/db/cloudSqlPool.ts`, Cloud Run                                    | Confirm GCP BAA / HIPAA program                                         |
| Google (Gmail SMTP)                                 | Email             | Full intake; names; billing; invites               | Yes                          | Needs confirmation     | `src/services/emailService.ts` (`EMAIL_HOST` default `smtp.gmail.com`) | Stop sending clinical intake over ordinary email; confirm Workspace BAA |
| Supabase                                            | Auth + storage    | Auth users; document bytes; possible `client_info` | Yes (docs); auth identifiers | Needs confirmation     | `src/supabase.ts`, upload services                                     | Confirm BAA; confirm `client_info` PHI columns dropped                  |
| SignNow / airSlate                                  | e-sign            | Name, email, contract PDF/DOCX                     | Yes                          | Needs confirmation     | `src/services/signNowService.ts`, `signNowContractProcessor.ts`        | Vendor BAA                                                              |
| Intuit QuickBooks Online                            | Accounting        | Given/Family/Display name, email; invoices         | PHI if CE                    | Needs confirmation     | `buildCustomerPayload.ts`, invoice services                            | Minimize; BAA/BA review                                                 |
| Intuit QuickBooks Payments                          | Cards             | Payment token; returns last4                       | Payment (not stored PAN)     | Needs confirmation     | `quickbooksPaymentsClient.ts`                                          | PCI + BA review                                                         |
| CloudConvert                                        | DOCX→PDF          | Entire contract file                               | Yes                          | Needs confirmation     | `src/utils/convertToPdf.ts`                                            | Prefer in-process conversion or BAA                                     |
| Stripe                                              | Payments (legacy) | Would be customer/card if enabled                  | Payment                      | Not enough information | `FEATURE_STRIPE`; routes **not mounted**                               | Keep disabled or inventory if re-enabled                                |
| DocuSign                                            | e-sign (legacy)   | Would be contracts                                 | Yes                          | Not enough information | Unmounted routes                                                       | Keep disabled                                                           |
| PHI Broker (optional)                               | Split PHI writes  | PHI patch fields                                   | Yes                          | Internal/org           | `src/services/phiBrokerService.ts`                                     | Confirm if still in prod path                                           |

Env **names** only (no values): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`PHI_BROKER_URL`, `PHI_BROKER_SHARED_SECRET`, `SIGNNOW_WEBHOOK_SECRET`,
`QB_WEBHOOK_VERIFIER_TOKEN`, `EMAIL_HOST`, `EMAIL_USER`, `EMAIL_PASSWORD`,
`CLOUDCONVERT_API_KEY`, `FEATURE_QUICKBOOKS`, `FEATURE_EMAIL`, `FEATURE_STRIPE`.

**Do not claim a BAA exists.** Code never records BAA execution.

---

# 7. Part 5 — Technical data-flow map

## Intake

```text
Family (public SPA RequestForm)
  → POST /requestService/requestSubmission (no session; credentials omit)
  → protectPublicIntakeEarly (honeypot, IP/email rate limit, Idempotency-Key)
  → RequestFormController.createForm
  → persist INSERT phi_clients (Cloud SQL)
  → email full payload to hello@sokanacollective.com (Gmail)
  → confirmation email to submitter (name only in body)
  → Admin CRM list/detail
```

## Client management

```text
Admin / assigned doula
  → GET/PUT /clients, /clients/:id, /clients/:id/phi
  → Cloud SQL phi_clients (clinical merge if canAccessSensitive)
  → Optional PHI broker on some updates
  → Identity cache write-through to Supabase (controller comment)
```

## Doula assignment

```text
Admin match
  → Cloud SQL doula_assignments (dashboard/hours/notes checks)
  → Supabase assignments (canAccessSensitive)
  → emails: doula gets client name+email; client gets doula name+email
  → Doula dashboard GET /api/doulas/clients (Cloud SQL filter)
```

## Contracts / SignNow

```text
Admin CRM
  → generate DOCX (clientName, financial fields, dates — `contractProcessor` / `SignNowContractData`)
  → optional CloudConvert PDF
  → SignNow upload + invite (subject includes clientName)
  → store signnow_document_id
  → webhook HMAC → CRM status
```

Contract fields that may be PHI: `clientName`, `clientEmail`, service type,
dates, and any template merge of clinical data if present in `contract_data`
jsonb / extra keys (`[key: string]: any` on `SignNowContractData`). Default
processor fields inspected are **financial + identity**, not health_history.
**Templates on disk may add more — needs template review.**

## Billing / QuickBooks

```text
Matched client
  → buildCustomerPayload(first, last, email) → QBO Customer
  → installment invoice → QBO Invoice (CustomerRef, memo/line items)
  → payment link / invoice email (name, amount, invoice #)
  → webhook invoice-paid → CRM
```

**Not sent to QBO customer create:** health history, due date, insurance IDs,
address (current payload).

## Card-on-file

```text
Client/staff
  → POST /api/payment-methods { client_id, intuit_token, request_id }
  → Intuit Payments
  → persist last4, brand, exp, provider_payment_method_reference
```

Full PAN/CVC/raw Intuit token are **not** Cloud SQL columns. `intuit_token` is
request-scoped. If Intuit returns `card.number`, code derives last4 in memory
only (`quickbooksPaymentsClient.ts`).

## Client portal

Eligible clients (portal eligibility service) after invite: own profile +
billing (`/profile`, `/billing`), own documents, own payment method, own
contract payment summary/schedule with ownership checks. Clinical staff fields
are not the portal’s purpose; `ClientProfileTab` still edits
demographics/billing/insurance and uploads insurance cards.

## Email notifications (summary)

See Part 12.

---

# 8. Part 6 — Role / access matrix

Roles in code: `admin`, `billing`, `doula`, `client`
(`authorizationPolicies.ts`). Frontend billing-only users are routed to
`/billing/contracts` (`canAccessFullCrm`).

Legend: **T** = technically enforced on API; **F** = UI hide only; **—** = no;
**Partial** = some routes yes, some no.

| Resource                                    | Admin          | Billing                                                                   | Doula                                                     | Client                                                 | Other |
| ------------------------------------------- | -------------- | ------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------ | ----- |
| Client list demographics (name/email/phone) | T (all)        | — (not on `GET /clients`)                                                 | T assigned list; **P any-id detail operational (INV-03)** | Own via `GET /clients/:id` ownership                   | —     |
| Intake / health history                     | T detail merge | —                                                                         | T if `canAccessSensitive` (Supabase assignment)           | Own if merged (`canAccessForResponse` includes client) | —     |
| Insurance / billing profile                 | T              | Payment schedule T; **not** `GET /clients/:id/billing` (admin/doula only) | T `GET /:id/billing` (assignment not same helper)         | T `/me/billing`                                        | —     |
| Doula assignments                           | T              | —                                                                         | T own                                                     | Portal scheduling subset                               | —     |
| Contracts                                   | T              | T limited billing views                                                   | Payment summary T with roles including doula              | Own contract T                                         | —     |
| Card metadata                               | T              | — (not on payment-method roles list)                                      | T if assigned                                             | T own                                                  | —     |
| Payment schedule                            | T              | T                                                                         | T some payment routes                                     | T own                                                  | —     |
| Invoices list `/api/invoices`               | T              | —                                                                         | **T all invoices (no assignment filter)**                 | —                                                      | —     |
| Financial reconciliation CSV                | T              | —                                                                         | **T**                                                     | —                                                      | —     |
| Reports / demographics page                 | FE staff CRM   | FE blocked billing-only                                                   | FE staff CRM                                              | —                                                      | —     |
| CSV export `/clients/fetchCSV`              | T all rows     | —                                                                         | —                                                         | **T all rows (INV-02)**                                | —     |

SPA guards (`StaffCrmRoute`, `BillingPortalRoute`, `ClientPortalRoute`) are
**not** authorization. Matrix above is API-derived. Frontend-only: sidebar
hiding of CRM for billing-only / clients.

---

# 9. Part 7 — Record-level authorization

**Present**

- Client `GET /clients/:id`: maps auth user → own `client_id`; 403 if another id
  (`clientController.getClientById`).
- Payment methods: `resolveAuthorizedClientId` (admin / own client / Cloud SQL
  assignment).
- Doula hours/activities/client details under `/api/doulas/*`: Cloud SQL
  `doula_assignments`.
- Payment contract summary/schedule: client ownership via contract `client_id`
  (matrix doc).
- `canAccessSensitive`: admin always; doula via **Supabase** `assignments`
  status `active`; others denied. Billing denied for clinical merge.

**Gaps / IDOR-BOLA**

| Risk                                                          | Evidence                                                                                                 | Notes                                                                                |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Any doula `GET /clients/:id` for another family               | Operational DTO returned when `canAccessSensitive` is false                                              | Name, email, phone, address, insurance fields if selected                            |
| Dual assignment stores                                        | `sensitiveAccess.ts` vs `cloudSqlDoulaAssignmentService`                                                 | Grant/deny mismatch                                                                  |
| Client CSV export                                             | `clientUseCase.exportCSV` allows `role == "client"` and dumps **all** `phi_clients` names/income/address | P0                                                                                   |
| Hours write IDOR                                              | `POST /users/:id/addhours` — no role, no assignment; body `doula_id` + `client_id`                       | P0                                                                                   |
| Birth outcomes write                                          | `updateClientBirthOutcomes` — no `canAccessSensitive`                                                    | P1                                                                                   |
| Notes IDOR                                                    | `POST /clients/:id/activity`, `GET /clients/:id/activities` vs assignment-checked `/api/doulas/...`      | P1                                                                                   |
| Status / operational patch                                    | `PUT /clients/status` and operational `PUT /clients/:id`                                                 | No doula assignment                                                                  |
| Staff directory                                               | `GET /auth/users` — any session                                                                          | P2                                                                                   |
| Doula `GET /api/invoices` and `/api/financial/reconciliation` | Role allowlist admin\|doula; no client filter                                                            | Cross-family financial identifiers                                                   |
| `GET /clients?detailed=true`                                  | Admin `SELECT *` then list mapper                                                                        | Server loads full PHI; response mapper omits clinical — residual memory/logging risk |
| Billing vs least privilege                                    | Billing cannot list clients but can see contract client names                                            | Product decision                                                                     |

---

# 10. Part 8 — Logging review

Safe request logger allowlists method/route/status/duration/correlation id
(`src/common/utils/safeLogging.ts`). Production `console.*` is no-op.

| Location                                                                            | Category logged                                                                                            | Classification                                           |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `createSafeRequestLogger`                                                           | Route metadata only                                                                                        | Safe                                                     |
| `emailService.sendEmail` success                                                    | service/operation/status                                                                                   | Safe                                                     |
| `USE_TEST_EMAIL=true`                                                               | `to`, `subject`, **full `text`**                                                                           | PHI exposure risk if enabled outside true test           |
| `requestFormController.createForm`                                                  | `savedForm.id`; email failures                                                                             | Needs review (id); email path is the disclosure          |
| `ensureCustomerInQuickBooks` `console.log` customer ids                             | QBO ids                                                                                                    | Needs review (non-prod)                                  |
| `signNowContractProcessor` `console.log` contractId, clientName in related services | Identifiers                                                                                                | PHI exposure risk in non-prod; prod console guarded      |
| `quickbooksAuthService` token expiry timestamps                                     | Auth operational                                                                                           | Needs review (no token values in the snippets inspected) |
| `ClientMapper.toDetailDTO` logs whether phone is set, not value                     | Safe-ish                                                                                                   | Safe                                                     |
| `paymentScheduleService` contractId                                                 | Operational id                                                                                             | Needs review                                             |
| Frontend `logger.ts`                                                                | no-op in production                                                                                        | Safe in prod; **dev can print anything callers pass**    |
| FE raw `console.log` of client list/detail/assigned clients                         | Names, emails, phones, health (`LeadProfileModal.tsx`, `Clients.tsx`, `doulaService.ts`, `ClientsTab.tsx`) | PHI exposure risk in browser; bypasses `logger.ts`       |
| FE `updateClient.ts` debug logs                                                     | Client ID, **full update payload**, error response body, returned client                                   | PHI in browser/devtools — still present 2026-08-20       |
| FE `deleteClient.ts` / `createContract.ts`                                          | Client ID; contract body                                                                                   | Same class of leak                                       |
| `UserContext` `console.log(data)` on password reset                                 | Auth response                                                                                              | Needs review                                             |

Do not treat production console-guard as a substitute for removing PHI from Pino
fields or test-email mode.

---

# 11. Part 9 — Frontend PHI handling

| Mechanism                               | Finding                                                                        | Remediation flag                                                                                             |
| --------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `sessionStorage` `sokana.session-token` | Session JWT                                                                    | XSS-sensitive; **logout does not call `clearSessionAccessToken`** though it is imported in `UserContext.tsx` |
| `handleSessionExpiration`               | Comment “clear token” but only redirects                                       | Flag                                                                                                         |
| Supabase `localStorage` auth            | Portal sessions                                                                | Known P2 leftover (`SECURITY_P0_HARDENING_SUMMARY.md`)                                                       |
| `config/phi.ts`                         | Documents not to persist PHI in web storage                                    | Policy only                                                                                                  |
| Intake                                  | In React state / context; not localStorage for contract verification (P0)      | OK                                                                                                           |
| URL                                     | Doula invite puts `email` and `invite_token` in query (`sendDoulaInviteEmail`) | Flag minimization                                                                                            |
| Analytics SDKs                          | None found                                                                     | OK                                                                                                           |
| Console                                 | Dev logger + some `console.error`                                              | Prod FE logger no-op                                                                                         |
| Global state                            | `UserContext` user object (name/email/role)                                    | Expected                                                                                                     |
| Idle timeout                            | Calls `logout`                                                                 | Token still in sessionStorage until tab close                                                                |

---

# 12. Part 10 — SignNow

Workflow: `processContractWithSignNow`
(`src/utils/signNowContractProcessor.ts`): generate DOCX → PDF/CloudConvert or
buffer → upload → signature fields → invite → store document id → webhook.

| Item                            | Evidence                                                                                                          |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Fields in `SignNowContractData` | `clientName`, `clientEmail`, service/financial dates; index signature allows extra keys                           |
| Temp files                      | `docxPath` / `pdfPath` via `fs-extra`                                                                             |
| Invite                          | SignNow email; subjects include client name (`signNowPdfService.ts`, `signNowService.js`)                         |
| Webhook                         | HMAC `X-SignNow-Signature`; `webhook_events`                                                                      |
| PHI in contract                 | Name/email/service definitely; clinical **not required** by processor — **do not assume templates are minimized** |
| SignNow BAA                     | Organizational/vendor confirmation required                                                                       |

---

# 13. Part 11 — QuickBooks

**QBO accounting:** `GivenName`, `FamilyName`, `DisplayName`,
`PrimaryEmailAddr.Address` (`buildCustomerPayload.ts`). Invoices: `CustomerRef`,
line items, memo (`buildInvoicePayload.ts`). Sync status refresh queries QBO
Customer by id (`refreshCustomerQuickBooksSyncStatus.ts`).

**Payments:** `intuit_token` + `request_id` to Intuit; store reference +
last4/brand/exp only (`create_client_payment_methods_table.sql`).

**CRM does not store (schema):** full PAN, CVC, raw Intuit payment token.

**Contrary / watch:** `self_pay_card_info` text; in-memory `card.number` used
only to compute last4; Stripe tables exist but unmounted. **Live**
`POST /quickbooks/simulate-payment` (admin, `FEATURE_QUICKBOOKS`) accepts
`card.number` / CVC and forwards them to Intuit sandbox (`createCharge.ts`).
Unmount that route. QBO OAuth tokens sit in plaintext Cloud SQL columns
(`quickbooks_tokens`).

OAuth: public `/quickbooks/auth` + `/callback`; stored single-use state. Webhook
HMAC on invoice-paid.

---

# 14. Part 12 — Email exposure

Transport: Nodemailer, default Gmail (`EMAIL_HOST`). Recipient
`hello@sokanacollective.com` hardcoded for intake (`requestFormController.ts`).
Billing mailbox from `BILLING_NOTIFICATION_EMAIL`.

| Trigger             | Recipient                          | Subject (pattern)                            | Client fields in body                                                                                           | Links                                  | PHI may be included      |
| ------------------- | ---------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ------------------------ |
| Public intake       | Staff `hello@sokanacollective.com` | New Lead Submitted via Request Form          | **Nearly entire intake including health, address, income, due date, partner, insurance-related display fields** | CRM profile URL                        | **Yes — P0**             |
| Intake confirmation | Submitter                          | Request Received…                            | Name                                                                                                            | None                                   | Name only                |
| Portal invite       | Client                             | Welcome to Your Sokana Client Portal         | Name                                                                                                            | Set-password URL                       | Name + auth link         |
| Client approval     | Client                             | Account request approved                     | Name                                                                                                            | Signup URL                             | Name                     |
| Team invite         | Staff                              | Welcome to the Sokana CRM Team               | Name, role                                                                                                      | Signup                                 | Workforce                |
| Doula invite        | Doula                              | Welcome to the Sokana Doula Team             | Name; **email in URL**                                                                                          | Signup with email + token              | Identifier in URL        |
| Doula match         | Doula                              | New Client Assignment                        | **Client name + email** + assignment notes                                                                      | Dashboard                              | Yes if CE                |
| Client match        | Client                             | Your Doula Match                             | Doula name + email                                                                                              | None                                   | PII                      |
| Contract initiated  | Billing mailbox                    | New contract initiated                       | Client name, type, totals                                                                                       | Billing view URL                       | Name + financial         |
| Invoice             | Customer                           | Invoice {n} from Sokana CRM                  | Name, amount, dates; PDF attach                                                                                 | Pay link (sandbox URL in default HTML) | Financial + name         |
| Billing reminders   | Client                             | Payment overdue / card declined / etc.       | Contract type                                                                                                   | Unknown in snippet                     | Financial                |
| SignNow             | Signer (vendor-sent)               | `{clientName} - Contract Signature Required` | Name                                                                                                            | SignNow URL                            | Name                     |
| Test mode           | Console                            | Full body                                    | Full                                                                                                            | —                                      | If `USE_TEST_EMAIL=true` |

Health information **is** placed in ordinary staff email on every public intake
(INV-01).

---

# 15. Part 13 — Data-minimization findings (recommendations only)

1. Stop putting `health_history`, allergies, health notes, address, income, and
   due date in Gmail; notify with client_number + CRM link only.
2. Do not send insurance IDs to roles that only need payment status;
   `toDetailDTO` currently treats insurance as operational.
3. Remove `client` from CSV export; never export all families’ income/address.
4. Tighten `GET /clients/:id` so unassigned doulas get 403, not an operational
   profile.
5. Align assignment source of truth (Cloud SQL only).
6. Drop or strictly validate `self_pay_card_info` (no PAN).
7. Hash intake rate-limit email keys.
8. Avoid CloudConvert for PHI documents unless BAA + retention are confirmed;
   prefer local conversion.
9. Doula access to `/api/invoices` and reconciliation CSV is broader than
   assignment.
10. Hash/remove email from doula invite query string.
11. Clear `sessionStorage` on logout.
12. Confirm templates do not merge clinical fields into SignNow documents.
13. Partner/family fields: either persist under access control or stop emailing
    them.
14. `SELECT *` detailed list for admins loads full PHI into the API process —
    use column lists.

---

# 16. Part 14 — Engineering-known vs leadership-required

## A. Determined from the application

- Data collected on intake and staff screens (field names above).
- Cloud SQL as intended PHI store; Supabase for auth and document bytes;
  split-write remnants.
- Routes, roles, webhook HMAC, session cookie name, QB payload, SignNow flow,
  card metadata schema.
- Logging allowlist + production console guard.
- Frontend storage keys and route guards.
- Email templates and Gmail default transport.
- Encryption-at-rest **Google-managed** for Cloud SQL as documented 2026-08-14 —
  not CMEK, not column encryption.

## B. Information required from Sokana leadership

Only items that cannot be answered from code: HIPAA ownership, workforce
(employee vs contractor doulas), off-system PHI (Gmail/Drive/WhatsApp/paper),
executed BAAs, retention periods, incident-response owners, intended access
(especially billing vs doula vs CSV), payer/Medicaid/hospital relationships,
whether Sokana is a covered entity or BA.

---

# 17. Part 17 — Prioritized gaps

| Finding                                                      | Evidence                                                                                                  | Risk                                          | Severity | Recommended action                                                                                             |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | --------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------- |
| Full intake ePHI emailed via Gmail                           | `requestFormController.createForm`                                                                        | Unmanaged mailbox copy of clinical + identity | P0       | Minimize email; confirm BAA or stop using Gmail for ePHI                                                       |
| Client-role CSV of all families                              | `clientRoutes` `GET /fetchCSV`; `clientUseCase.exportCSV`                                                 | IDOR / bulk PII                               | P0       | Admin-only; scope rows; drop income/address or tokenize                                                        |
| Any authenticated user can log hours for any client          | `src/routes/specificUserRoutes.ts` `POST /:id/addhours`; `userController.addNewHours`                     | Write IDOR / false care record                | P0       | Require `doula`/`admin` + assignment; ignore body `doula_id` except admin                                      |
| Admin simulate-payment accepts PAN/CVC                       | `quickbooksRoutes.ts` `POST /simulate-payment`; `paymentsController.ts`; `createCharge.ts` sandbox Intuit | PCI — raw card in API memory                  | P0       | Unmount in all environments; hosted-fields token path only                                                     |
| Hardcoded SMTP app password in repo                          | `src/scripts/sendTestEmail.ts`                                                                            | Credential exposure; mailbox takeover         | P0       | Rotate the Gmail app password; delete hardcoded secret; use env only. **Do not copy the secret into tickets.** |
| Unassigned doula can read operational profile by id          | `getClientById` returns DTO before/without assignment deny                                                | BOLA                                          | P1       | 403 unless assigned (same as `/api/doulas/clients/:id`)                                                        |
| Unassigned doula can write birth outcomes                    | `clientController.updateClientBirthOutcomes`                                                              | Clinical write IDOR                           | P1       | Call `canAccessSensitive` before update                                                                        |
| Notes/activities on `/clients/:id` not assignment-scoped     | `createActivity` / `getClientActivities` vs `/api/doulas/clients/:id/activities`                          | Note PHI IDOR                                 | P1       | Same assignment check as doula dashboard                                                                       |
| FE `console.log` of client payloads                          | `LeadProfileModal.tsx`, `Clients.tsx`, `doulaService.ts`, `ClientsTab.tsx`                                | PHI in browser/dev tools                      | P1       | Use `logger.ts` (prod no-op) or remove                                                                         |
| Demographics copy says answers are not tied to name          | `Step3Home.tsx` optional demographics section; same `requestSubmission` payload                           | Misleading minimization                       | P2       | Change copy or split anonymous grant survey                                                                    |
| Billing `mailto:` puts name/email in URL                     | `frontend-crm/src/features/billing-portal/billingOutreach.ts`                                             | PHI in Referer/history                        | P2       | Open mail composer without putting PHI in `href`                                                               |
| QBO tokens plaintext in Cloud SQL                            | `quickbooks_tokens` columns                                                                               | Credential at rest                            | P2       | Secret Manager / envelope encryption                                                                           |
| `GET /auth/users` no role gate                               | `authController.getAllUsers`                                                                              | Staff directory leak                          | P2       | Admin-only                                                                                                     |
| Dual assignment tables                                       | `sensitiveAccess.ts` vs Cloud SQL assignments                                                             | Incorrect allow/deny                          | P1       | Single source of truth                                                                                         |
| Vendor BAAs unknown                                          | Integrations listed                                                                                       | Unauthorized disclosure if CE                 | P1       | Leadership + legal vendor list                                                                                 |
| `self_pay_card_info` free text                               | `phi_clients` column; intake mapping                                                                      | PCI                                           | P1       | Disallow PAN; use card-on-file only                                                                            |
| Doula global invoices/reconciliation                         | `invoiceRoutes.ts`, `financialRoutes.ts`                                                                  | Excess financial PHI/PII                      | P1       | Admin/billing only or assignment filter                                                                        |
| Insurance on “operational” DTO                               | `ClientMapper.toDetailDTO`                                                                                | Excess data                                   | P2       | Gate with `canAccessSensitive`                                                                                 |
| Rate limit stores raw email                                  | `intakeAbuseProtection.ts` `email:${email}`                                                               | PII at rest                                   | P2       | Hash key                                                                                                       |
| Logout leaves sessionStorage token                           | `UserContext.tsx` logout                                                                                  | Stolen JWT in same tab                        | P2       | `clearSessionAccessToken()`                                                                                    |
| CloudConvert contract upload                                 | `convertToPdf.ts`                                                                                         | Extra processor                               | P2       | BAA or local convert                                                                                           |
| Supabase `client_info` leftover PHI                          | drop migration not proven applied                                                                         | Dual store                                    | P2       | Verify production schema                                                                                       |
| Template/default placeholder names in `contractProcessor.ts` | hardcoded sample names in fallbacks                                                                       | Not prod PHI; quality                         | P3       | Remove dummy names                                                                                             |
| No product analytics SDK                                     | package.json                                                                                              | Lower third-party risk                        | —        | Keep it that way                                                                                               |

---

# 18. Questions for Sokana leadership

Use this list in the meeting. Do not ask leadership to explain the stack.

### 1. HIPAA ownership

- Who is privacy officer / security officer?
- Who approves workforce and vendor access?
- Is Sokana a covered entity, a business associate, or neither (and why)?

### 2. Staff / access decisions

- Confirm intended access: admin vs billing vs doula vs client vs any extra
  managers.
- Should doulas see unassigned families’ names/contact/address? (Code currently
  can.)
- Should billing see clinical data? (Code clinical merge: no.)
- Who may export CSV / download insurance cards / download signed contracts?
- Are doulas employees, contractors, or both? Offboarding SLA for access revoke?

### 3. PHI handled outside the CRM

- Is client information also in Gmail, Drive, personal phones, WhatsApp, SMS,
  spreadsheets, paper, printed contracts, other apps?

### 4. Vendors and BAAs

- Executed BAAs: Google (GCP + Workspace/Gmail), Supabase, SignNow, Intuit,
  CloudConvert, others?
- Hospital or payer agreements that impose HIPAA/security terms?

### 5. Retention

- How long to keep client records, signed contracts, billing, doula notes,
  insurance card images, email copies?

### 6. Incident response

- Who is called on a suspected privacy incident? Who decides breach
  notification? Existing IR policy?

### 7. Payer / provider relationships

- Does Sokana electronically bill health plans or Medicaid?
- Receive PHI from plans, hospitals, or providers?
- Public intake rejects Medicaid; CRM still has Medicaid billing options — which
  is the business rule?

### 8. Business-policy decisions

- Is full-intake staff email required, or is a CRM link enough?
- Sliding-scale income: keep in chart or collect out of band?
- Partner/family contacts: required in system of record?

---

# 19. Recommended next actions

Engineering order (re-confirmed 2026-08-20; see
`HIPAA_BOARD_TECHNICAL_STATUS.md`):

1. Contain remaining P0s in code: CSV client-role export (INV-02), hours IDOR
   (INV-09), intake email (INV-01), unmount simulate-payment (INV-10), **rotate
   and remove** the hardcoded SMTP secret (INV-11), revoke/reconnect exposed
   QuickBooks OAuth.
2. Remove FE `console.log` of client update payloads (`updateClient.ts` and
   siblings); close birth-outcomes assignment (INV-12); minimize
   doula-assignment email (client email + notes).
3. Close doula BOLA on `GET /clients/:id` and `/clients/:id` notes; unify
   assignment checks on Cloud SQL.
4. Complete vendor BAA / CE determination with leadership using Section 18.
5. Infra: Cloud SQL public IP off (hardening Phase 7); retire Vercel origins;
   decide Supabase Storage for client files vs move to Cloud SQL/GCS.
6. Do not claim HIPAA compliance from this inventory; it is the technical input
   to a risk analysis.

---

## Classification note (business context)

| Code label                                        | HIPAA-oriented reading                                                                                                      |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `PHI_FIELDS` / “no PHI on list” in `ClientMapper` | Engineering split-db convention. List still returns names/emails/phones.                                                    |
| Frontend `PHI_KEYS`                               | Broader; includes identity and insurance.                                                                                   |
| This inventory                                    | Clinical + insurance IDs + due date = PHI/ePHI. Identity of a person in a doula-care record = PHI **if** Sokana is a CE/BA. |

Requires organizational confirmation: covered-entity status, all BAAs,
retention, off-system PHI, workforce model.
