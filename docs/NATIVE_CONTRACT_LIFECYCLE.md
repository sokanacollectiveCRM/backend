# Native contract lifecycle

This is the backend contract for Sokana's provider-neutral signing flow. It
applies only to rows whose `signing_provider` is `native`. Historical SignNow
rows remain readable under their stored provider and status.

## Invariants

- A native contract has exactly one signer: the client identified by
  `phi_contracts.client_id`. Staff prepare and send the contract but are not
  signers. A client ID supplied by a browser is never trusted; authenticated
  client routes derive it from the session and invitation routes derive it from
  the invitation record.
- A contract pins one immutable template identifier/version and a complete
  field/pricing snapshot before it is sent.
- All money is calculated and stored as integer cents. API adapters may accept
  legacy dollar strings but normalize them before persistence.
- Raw invitation tokens, typed signatures, drawn signatures, contract field
  values, PDFs, and PHI must never be written to application logs.
- Contract PDFs and drawn-signature bytes are private objects. The database
  stores object paths, SHA-256 hashes, and immutable GCS generations, never
  public URLs.

## Statuses and exact transitions

| Status             | Meaning                                                                                | Allowed next status                                                     |
| ------------------ | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `draft`            | Editable contract and pricing snapshot; no final PDF is available.                     | `ready`, `voided`                                                       |
| `ready`            | Template and fields validate and the unsigned artifact is ready to send.               | `sent`, `voided`                                                        |
| `sent`             | An active invitation has been issued and the source snapshot is frozen.                | `viewed`, `partially_signed`, `signed`, `declined`, `expired`, `voided` |
| `viewed`           | The client opened the signing package.                                                 | `partially_signed`, `signed`, `declined`, `expired`, `voided`           |
| `partially_signed` | The client saved required signing progress but has not completed every required field. | `signed`, `declined`, `expired`, `voided`                               |
| `signed`           | All required fields, consent, signature adoption, and signed PDF archival completed.   | none                                                                    |
| `declined`         | The client declined.                                                                   | none                                                                    |
| `expired`          | No usable invitation remains before its expiry.                                        | none                                                                    |
| `voided`           | An admin cancelled the contract.                                                       | none                                                                    |

An idempotent write of the current status is allowed but emits no duplicate
transition event. All other transitions are rejected. In particular, terminal
statuses cannot be reopened; create a new contract instead.

### Freeze behavior

Before `sent`, corrections are made while the contract remains `draft`. Once it
reaches `ready`, it may only be sent or voided.

The first successful `ready → sent` transition permanently freezes:

- `client_id` and `signing_provider`;
- template identifier and version;
- complete field, service, pricing, and payment snapshot;
- unsigned PDF object path, SHA-256 hash, and GCS generation.

Resending rotates the invitation but does not unfreeze or regenerate the
contract. Corrections after send require voiding the contract and creating a new
one. Signed artifact metadata is written once during completion and cannot be
replaced through normal application paths.

## Template registry and manifests

`contract_template_versions` is the registry. A row is identified by
`(identifier, version)`, references a private GCS PDF, stores its SHA-256 hash,
and contains a JSON field manifest. Published versions are immutable. Only one
version per identifier may be active; activation of a newer version does not
change contracts already pinned to an older version.

Each manifest entry has:

- stable `id`;
- `kind`: `snapshot_text`, `initials`, `signature`, `signing_date`, or
  `acknowledgment`;
- for `snapshot_text`, an allowlisted `source` such as `client.name`,
  `serviceType`, or a calculated `pricing.*Cents` value;
- one-based `page`;
- normalized `x`, `y`, `width`, and `height` coordinates in the inclusive range
  0 through 1;
- `required`, with optional bounded `fontSize` and display `label`.

The seed process downloads each source template, calculates SHA-256, validates
page bounds and unique field IDs, uploads with create-only semantics, records
the returned GCS generation, and activates the intended version transactionally.
Never modify bytes at an existing registry version.

## Private object layout and integrity

The bucket is `GCS_DOCUMENTS_BUCKET`; prefixes are configurable through
`GCS_CONTRACTS_PREFIX` and `GCS_CONTRACT_TEMPLATES_PREFIX`.

```text
gs://<bucket>/<contract-templates-prefix>/<identifier>/v<version>/<sha256>.pdf
gs://<bucket>/<contracts-prefix>/<contract-id>/unsigned/<sha256>.pdf
gs://<bucket>/<contracts-prefix>/<contract-id>/signatures/<sha256>.png
gs://<bucket>/<contracts-prefix>/<contract-id>/completed/<sha256>.pdf
```

Objects are private with `private, max-age=0`. Uploads use create-only
preconditions where an artifact is immutable. For every template, unsigned PDF,
drawn signature, and signed PDF, calculate SHA-256 over the exact uploaded bytes
and retain the returned GCS generation. Reads used for signing or download must
address or verify that generation and hash. API responses expose only
authenticated streaming responses or short-lived V4 read URLs whose TTL is
bounded by `CONTRACT_PDF_URL_TTL_SECONDS`.

## Invitation and signer security

Generate invitation tokens as `<invitation-uuid>.<base64url-secret>`, where the
secret is 32 bytes produced independently for each invitation by the operating
system cryptographic random generator. Email the token once and persist only its
32-byte SHA-256 digest. The UUID is only an indexed lookup key; verification
hashes the complete presented token and uses a timing-safe comparison. The raw
token is never stored or logged.

An invitation is usable only when it belongs to the contract's one client, has
not expired, completed, or been revoked, and the contract is in a signable
status. Resend atomically revokes all prior active invitations, increments
resend history, creates a fresh token and expiry, and queues one email under a
unique idempotency key. Completion revokes any other outstanding invitation.

The public invitation surface is rate-limited using an HMAC of the token and
network discriminator with `SIGNING_RATE_LIMIT_HMAC_SECRET`; rate-limit keys
must not reveal either value. The configured request limit/window applies to
open, progress, consent, signature, and decline attempts.

Typed signatures are trimmed Unicode text and are rejected when empty or over
200 characters or 512 UTF-8 bytes; optional font-family names are limited to 100
characters. Initials are limited to 16 characters and 64 UTF-8 bytes. Drawn
signatures must be a decoded PNG, not an arbitrary data URL, and are rejected
over `CONTRACT_DRAWN_SIGNATURE_MAX_BYTES`. Every required manifest field must be
present. The client must affirm electronic-signature consent in the completion
request.

## API

Errors contain a safe message but no provider payload, token, signature, PHI, or
stack. Admin and client routes require the normal authenticated session and role
middleware. Invitation routes authenticate with the opaque invitation token.

### Admin endpoints

| Method and path                           | Purpose                                                                                                         |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `POST /api/contracts/drafts`              | Create a `draft` for one existing client; returns `{ contract }`.                                               |
| `GET /api/contracts/:contractId`          | Read admin contract detail and safe signature metadata; returns `{ contract }`.                                 |
| `POST /api/contracts/:contractId/send`    | Render/freeze the unsigned PDF, move the contract to `sent`, create an invitation, and return `{ contract }`.   |
| `POST /api/contracts/:contractId/resend`  | Revoke active invitations and send a new invitation without changing the frozen source; returns `{ contract }`. |
| `POST /api/contracts/:contractId/void`    | Move a nonterminal pre-signature contract to `voided`, revoke invitations, and return `{ contract }`.           |
| `GET /api/contracts/:contractId/audit`    | Return the ordered append-only timeline as `{ events }`.                                                        |
| `GET /api/contracts/:contractId/download` | Return `{ url, expiresInSeconds }` for the signed PDF when available, otherwise the frozen unsigned PDF.        |

### Authenticated client endpoints

| Method and path                              | Purpose                                                              |
| -------------------------------------------- | -------------------------------------------------------------------- |
| `GET /api/clients/me/contracts`              | Return `{ contracts }` owned by the session client.                  |
| `GET /api/clients/me/contracts/:id`          | Return one owned contract as `{ contract }`.                         |
| `GET /api/clients/me/contracts/:id/download` | Return `{ url, expiresInSeconds }` for the owned protected artifact. |

These routes must be mounted before any generic client `/:id` route.

### Invitation endpoints

The invitation token is a path segment. The route middleware replaces it with
`[redacted]` in Express URL fields before completion-time HTTP logging, and
responses set `Cache-Control: no-store` and `Referrer-Policy: no-referrer`.

| Method and path                 | Purpose                                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `GET /signing/:token`           | Validate the token, idempotently record first view, move `sent → viewed`, and return the safe package and progress. |
| `POST /signing/:token/progress` | Validate known field IDs, persist server-timestamped progress, and return the updated safe signing session.         |
| `POST /signing/:token/complete` | Atomically validate consent, required fields, initials, and signature; archive the signed PDF and return `signed`.  |

## Audit trail

`contract_events` is append-only: database triggers reject `UPDATE` and
`DELETE`; foreign keys prevent deleting referenced contracts and clients. Every
lifecycle, invitation, consent, signature, delivery, and archival action adds an
event in the same transaction as its state change.

Events contain actor type/ID, server timestamp, correlation ID, event type,
contract/client IDs, safe metadata, the approved full source IP address, and a
sanitized User-Agent capped at 512 characters. Sanitization removes control
characters and line breaks before truncation. Do not place client names, emails,
document fields, tokens, signature representations, PDFs, or arbitrary request
bodies in event metadata.

## Outbox, retries, and idempotency

Email, PDF generation, archival, signed-copy delivery, and downstream billing
run through `contract_outbox`; request handlers do not rely on an external side
effect completing before the database transaction commits.

Workers claim up to `CONTRACT_OUTBOX_BATCH_SIZE` eligible rows with
`FOR UPDATE SKIP LOCKED`, set `processing`, `lease_owner`, `leased_at`, and
`lease_expires_at`, then commit before doing work. An expired lease is
reclaimable. Success sets `completed` once. Retryable failure increments
`attempts`, stores only a sanitized bounded error classification, clears the
lease, and schedules exponential backoff with jitter. At
`CONTRACT_OUTBOX_MAX_ATTEMPTS`, the row becomes `dead_letter`; permanent
validation errors may dead-letter immediately.

Every row has a unique semantic idempotency key, such as
`contract:<id>:invitation:<invitation-id>` or
`contract:<id>:signed-pdf:<signature-id>`. Handlers must be safe after a crash
between provider success and outbox completion. Email message identity, GCS
create-only paths, and database uniqueness constraints enforce deduplication.

When a signed contract triggers QuickBooks invoice creation, derive one stable
request ID from the contract and billing operation (for example,
`native-contract:<contract-id>:deposit-invoice:v1`) and pass it on every retry.
Persist the request/result mapping locally and send the same QuickBooks
request-id so a retry cannot create a second invoice.

## Logging and observability

Allowed logs are metadata-only: operation name, correlation ID, status class,
duration, attempt number, and internal non-PHI identifiers when approved. Never
log PHI, request/response bodies, raw or hashed invitation tokens,
cookies/authorization headers, typed or drawn signatures, template field values,
PDF bytes/URLs, full IP addresses, or User-Agent strings. Full approved IP and
sanitized User-Agent belong only in the restricted append-only audit table.

Metrics should cover status transitions, invitation sends/failures, completion
latency, outbox depth/lease expiry/dead letters, integrity failures, and QBO
dedupe outcomes without high-cardinality sensitive labels.

## Legacy generate-contract adapter

`POST /api/contract-signing/generate-contract` remains admin-only. When
`NATIVE_CONTRACTS_ENABLED=true`, it accepts both the current flat payload and
the legacy nested `contractData` payload, creates/generates/sends a native
contract, and preserves this response envelope:

```json
{
  "success": true,
  "message": "Contract generated and sent for signature",
  "data": {
    "success": true,
    "contractId": "<uuid>",
    "clientName": "<name>",
    "clientEmail": "<email>",
    "docxPath": "",
    "pdfPath": "",
    "signNow": {
      "documentId": "",
      "invitationSent": true,
      "status": "invitation_sent"
    },
    "emailDelivery": {
      "provider": "native",
      "sent": true,
      "message": "Signing invitation sent"
    }
  }
}
```

Empty provider/path placeholders are compatibility fields only and must not
contain GCS paths or signed URLs. New consumers use the native endpoints and
provider-neutral status.

## Migration and seed

Migrations never run at application boot. From a Cloud SQL Proxy-connected,
authorized shell:

```bash
npm run migrate:cloudsql -- src/db/migrations/20260829_add_native_contract_signing.sql
npx tsx scripts/seed-native-contract-templates.ts
```

Run the seed first in dry-run mode when supported by the script, verify source
hashes and manifests, then run apply mode. The seed must be repeatable: an
identical version/hash is a no-op and conflicting bytes for an existing
identifier/version fail closed.

For billing-path decisions, post-signing invoicing, portal eligibility, and
client account invitation, see
[`CONTRACT_TO_PORTAL_WORKFLOW.md`](./CONTRACT_TO_PORTAL_WORKFLOW.md).
