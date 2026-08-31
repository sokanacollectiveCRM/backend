# SignNow to native signing cutover

## Goal and non-goals

New contracts move to Sokana's native, one-client-signer flow without changing
or rewriting historical SignNow records. This cutover does not delete SignNow
data, reinterpret historical provider statuses, or make the legacy callbacks
publicly unauthenticated.

`signing_provider` is the routing boundary:

- `native`: use the native lifecycle, invitations, audit trail, private GCS
  artifacts, and outbox.
- `signnow`: retain the stored SignNow document/invitation IDs and provider
  status; status and callback handling remain provider-specific.
- `NULL` on a pre-cutover row: treat as legacy/SignNow when legacy provider
  identifiers are present. Backfill explicitly before enforcing a non-null
  provider on new rows.

## Preconditions

Before enabling production traffic:

1. Apply the additive native-contract migration and seed immutable template
   versions/manifests.
2. Verify private template objects, hashes, and GCS generations.
3. Configure all native-contract environment variables and secrets.
4. Deploy a revision with the feature flag off and run build, tests, security
   smoke, migration verification, template render/integrity checks, and outbox
   lease/retry tests.
5. Confirm invitation email links use the production `CONTRACT_SIGNING_BASE_URL`
   and that no token, PHI, signature, GCS URL, full IP, or User-Agent reaches
   application logs.
6. Verify a native test contract through create, generate, send, open, consent,
   typed signing, drawn signing, signed-PDF archival, protected download,
   signed-copy delivery, and QuickBooks request-id dedupe.
7. Record the previous Cloud Run revision and database/template seed evidence.

Commands:

```bash
npm run migrate:cloudsql -- src/db/migrations/20260829_add_native_contract_signing.sql
npx tsx scripts/seed-native-contract-templates.ts
npm run build
npm test -- --runInBand
npm run test:security-smoke
```

Migrations are forward-compatible and are never run at application boot. The
template seed is idempotent and must fail if an existing identifier/version has
different bytes or a different manifest.

## Rollout

### Phase 0 — dark deployment

- Deploy schema, templates, and native code with
  `NATIVE_CONTRACTS_ENABLED=false`.
- `/api/contract-signing/generate-contract` returns a stable feature-disabled
  response and never creates a new SignNow document. Native routes may return
  `404` or a stable feature-disabled error.
- Run read-only verification and ensure the worker does not claim native outbox
  jobs while disabled.

### Phase 1 — internal canary

- Enable the flag on a no-client-impact canary revision or approved internal
  cohort.
- Route new canary contract creation through the legacy adapter and native
  endpoints.
- Confirm the adapter preserves `{ success, message, data }`, `data.contractId`,
  and transitional `data.signNow`/`data.emailDelivery` fields while returning no
  private storage path.
- Monitor native status transitions, integrity checks, invitation delivery,
  outbox retries/dead letters, signed artifact creation, and duplicate QBO
  prevention.

### Phase 2 — new-contract cutover

- Shift normal traffic to the enabled revision.
- Every newly created contract uses `signing_provider=native`.
- Existing SignNow contracts continue to use SignNow status, download, and
  callback paths. Never switch an already-sent contract between providers.
- Keep the adapter and historical reads. Frontend migration to provider-neutral
  native endpoints may occur independently.

### Phase 3 — legacy create deprecation

After all supported frontends use native endpoints:

1. Stop direct frontend calls to SignNow create/send tooling.
2. Mark SignNow authentication, upload, field-coordinate, invitation, and
   generate/send endpoints deprecated; keep admin authorization in place.
3. Keep `/api/contract-signing/generate-contract` as a documented native
   compatibility adapter for at least one release window.
4. Instrument adapter use with metadata-only counters. Do not label metrics with
   client data or tokens.
5. Remove the adapter only after a full release window has zero known callers, a
   frontend deploy no longer references it, and an explicit removal change is
   approved.

### Phase 4 — historical retention

- Disable creation of new SignNow documents and invitations.
- Retain provider IDs, normalized historical statuses, raw historical provider
  status fields already approved for storage, callback event keys, timestamps,
  and archived contract metadata for the applicable business/legal retention
  period.
- Keep historical SignNow contract detail and artifact retrieval available to
  authorized admins/owners. Prefer already archived private GCS copies; if a
  provider download is still needed, fetch it server-side and never expose a
  provider token.
- Keep the SignNow callback route and verification secret active while any
  retained contract can still receive a legitimate event.
- Do not delete or rewrite historical status/audit rows during application
  rollback or provider credential retirement.

### Phase 5 — callback retirement

Callback/status retirement happens only in this order:

1. Confirm there are no nonterminal SignNow contracts and no accepted
   operational reason for a late callback.
2. Export and verify any required signed artifacts and provider audit evidence
   into private GCS, including hashes and immutable generations.
3. Record the final provider status synchronization and retention owner.
4. Disable SignNow webhook subscriptions at the provider.
5. Continue serving the callback endpoint for an observation window; verified
   callbacks are idempotently acknowledged and recorded, but must not mutate
   native contracts.
6. After the observation window has no legitimate traffic, deploy the callback
   as `410 Gone` while retaining replay-safe request handling and metadata-only
   monitoring.
7. Remove the route and webhook secret in a later release.
8. Revoke SignNow OAuth credentials only after no historical download/status
   operation depends on them.
9. Remove provider SDK/code in a separate reviewed change. Preserve database
   columns and historical records until their retention period ends.

## Historical callback and status behavior

`POST /api/signnow/callback` remains authenticated by the configured SignNow
HMAC verification, replay protected, and idempotent by provider event key.
During coexistence it:

- locates only a SignNow/legacy contract by provider document ID;
- records the callback receipt once;
- applies only an allowed SignNow status normalization;
- never changes a native contract, issues a native invitation, or replaces a
  native artifact;
- returns the existing safe acknowledgment for duplicates and supported late
  events;
- logs only provider/operation metadata and correlation identifiers, never the
  callback body, client data, document content, signature, or token.

Historical polling endpoints continue to return the stored provider status and
safe normalized status. Native statuses are not sent to SignNow and SignNow
statuses are not forced through the native lifecycle.

## Operations

### Routine checks

- Contract counts by `signing_provider` and status.
- Native contracts stuck in `ready`, `sent`, or `partially_signed`.
- Active invitation expiry and revocation consistency.
- Outbox pending age, expired leases, retry counts, and dead letters.
- Template, unsigned, signature, and signed-document hash/generation failures.
- Invitation delivery and signed-copy delivery failures.
- QBO invoice request-id mapping and dedupe outcomes.
- SignNow callback verification failures, replay duplicates, and nonterminal
  historical contracts.

All dashboards and alerts use aggregate or internal identifiers only. The
approved full source IP and sanitized User-Agent exist only in the restricted
append-only contract audit table.

### Dead-letter recovery

Investigate the safe error classification and correlation ID. Repair the
underlying dependency or data only through approved admin tooling, then requeue
with the original semantic idempotency key. Never create a replacement outbox
row merely to bypass uniqueness. For QBO, verify the stable request ID and local
request/result mapping before retrying.

### Incident containment

For suspected token exposure, revoke the invitation, create a fresh token, and
review append-only events. For artifact-integrity mismatch, stop signing and
downloads for that contract, preserve evidence, and do not overwrite the object.
For unexpected duplicate invoices, stop the billing outbox kind and reconcile by
stable QBO request ID before resuming.

## Rollback

`NATIVE_CONTRACTS_ENABLED=false` stops new native contract creation through the
adapter; it is not a data rollback and must not strand already-sent native
contracts.

Rollback procedure:

1. Stop traffic to the affected revision and disable creation/send operations.
2. Keep the native worker running only for already-committed safe jobs, or pause
   it deliberately after recording leases; expired leases are reclaimable.
3. Route traffic to the previous known-good Cloud Run revision.
4. Do not down-migrate or drop additive tables/columns, delete events, overwrite
   private objects, revoke valid invitations, or reclassify native rows as
   SignNow.
5. If the previous revision cannot serve in-flight native signing, keep a
   minimal enabled revision for invitation completion and protected artifact
   access while new creation remains disabled.
6. Verify health, authentication, legacy SignNow access/callback acknowledgment,
   in-flight native contracts, outbox leases, and QBO dedupe.
7. Fix forward and redeploy. Database cleanup, if ever required, is a separate
   retention-approved migration.

Rollback never sends an already-sent native contract through SignNow. If an
in-flight contract cannot safely complete, an admin voids it and creates a new
contract only after the replacement path is healthy.

## Completion criteria

SignNow is fully retired only when:

- all new contracts have used native signing for the approved stability window;
- no nonterminal SignNow contract remains;
- required historical PDFs/audit evidence are verified in private storage;
- direct SignNow create/send and adapter callers are zero;
- callback observation and `410` stages are complete;
- retention ownership and historical read behavior are documented;
- OAuth/webhook credentials are revoked and no runtime path requires them;
- rollback and restore exercises have passed.
