# GCS document storage layout

**Decision (2026-08-26):** One private bucket with **type prefixes**, not
separate buckets per document type.

| Item         | Value                                                                   |
| ------------ | ----------------------------------------------------------------------- |
| Project      | `sokana-private-data`                                                   |
| Bucket       | `gs://sokana-private-documents`                                         |
| Region       | `us-central1`                                                           |
| Cloud Run SA | `sokana-private-storage-sa@sokana-private-data.iam.gserviceaccount.com` |
| Access model | Private only; backend issues signed URLs after authz                    |

## Hardening (already on bucket)

- `public_access_prevention: enforced`
- Uniform bucket-level access
- Object versioning + soft delete (7 days)
- Noncurrent version lifecycle cleanup
- Google-managed encryption at rest (CMEK later if required)

## Prefix map (logical separation by type)

| Prefix                | Replaces Supabase bucket | Contents                                |
| --------------------- | ------------------------ | --------------------------------------- |
| `client-documents/`   | `client-documents`       | Insurance cards / client portal uploads |
| `doula-documents/`    | `doula-documents`        | Doula workforce required docs           |
| `contracts/`          | `contracts`              | Signed contract PDFs                    |
| `contract-templates/` | `contract-templates`     | Template PDFs                           |
| `profile-pictures/`   | `profile-pictures`       | Profile images                          |

Object key example:

```text
client-documents/{clientId}/insurance_card/{timestamp}_{filename}
doula-documents/{doulaId}/background_check/{timestamp}_{filename}
contracts/{contractId}/{timestamp}_signed.pdf
```

Prefixes are created automatically on first object write; empty marker objects
are optional and not required.

## Runtime (after code cutover)

1. Upload: FE → Cloud Run → authz → `gs://sokana-private-documents/{prefix}/…` →
   metadata in Cloud SQL
2. Download: FE → Cloud Run → authz → short-lived GCS signed URL (or
   authenticated `/download` stream)

## Env

```bash
GCS_DOCUMENTS_BUCKET=sokana-private-documents
# Optional overrides if split later:
# GCS_CLIENT_DOCUMENTS_PREFIX=client-documents
# GCS_DOULA_DOCUMENTS_PREFIX=doula-documents
# GCS_CONTRACTS_PREFIX=contracts
# GCS_CONTRACT_TEMPLATES_PREFIX=contract-templates
# GCS_PROFILE_PICTURES_PREFIX=profile-pictures
```

## Status

- [x] Bucket provisioned and hardened
- [x] Layout decision: one bucket + prefixes
- [x] Contract templates live in GCS (`contract-templates/`); app
      list/get/upload/delete/preview use GCS
- [x] Client documents live in GCS (`client-documents/`); upload/delete/signed
      URL cut over; smoke: `npx tsx scripts/verify-client-document-gcs.ts`
- [x] Doula documents live in GCS (`doula-documents/`); upload/delete/signed URL
      cut over; smoke: `npx tsx scripts/verify-doula-document-gcs.ts`
- [x] Profile pictures live in GCS (`profile-pictures/{userId}/`); upload +
      resolve-on-read; migrated existing Supabase objects via
      `scripts/migrate-profile-pictures-to-gcs.ts`
- [ ] Signed-contract object cutover
- [ ] Empty Supabase Storage buckets

## Contract templates (cutover 2026-08-26)

| Object        | GCS path                                                                                        |
| ------------- | ----------------------------------------------------------------------------------------------- |
| Postpartum    | `gs://sokana-private-documents/contract-templates/Agreement for Postpartum Doula Services.docx` |
| Labor Support | `gs://sokana-private-documents/contract-templates/Labor Support Agreement for Service.docx`     |

Backend: template methods in `SupabaseContractService` + `contractProcessor` /
`pdfTemplateFiller` read GCS. Frontend preview:
`/contracts/templates/:name/signed-url` (preferred) or `/download` blob
fallback.

Note: V4 signed URLs on Cloud Run need the runtime SA to have
`roles/iam.serviceAccountTokenCreator` on itself. Local user ADC cannot sign;
the FE download fallback covers that.
