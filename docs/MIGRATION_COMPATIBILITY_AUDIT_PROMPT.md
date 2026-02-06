# Migration Compatibility Audit Prompt (Backend-Only)

## Role

You are a senior backend architect and migration lead. Your job is to produce a **migration compatibility audit (backend-only)** for a system that is moving to a **split-database design**:

- A set of **PHI tables** (authoritative for sensitive client data, notes, contracts, events, invoices, time tracking, and access auditing)
- A set of **non-PHI tables** in Supabase (minimal client mirror + operational/business tables like assignments, payments, invoices mirror, library items, expenses, etc.)

---

## Critical Rules

1. **Do not write or propose any code changes yet.** This is analysis only.
2. Be **migration-aware**: assume production data already exists in both systems and must not be duplicated or invalidated.
3. Identify exactly where the current backend violates or conflicts with the split.
4. Produce an actionable plan with clear sequencing, but no actual edits.

---

## Inputs Required

- Backend architecture report (AS-IS)
- New target tables list (PHI vs non-PHI) and key constraints
- Optional: schema DDL snippets for key tables, and a list of endpoints used by the frontend

---

## Required Output Sections

### 1) Executive Summary (Migration Readiness)

- One paragraph: current backend state vs target split
- A list of top 5 migration blockers (P0 only)

---

### 2) Split-Database Model Definition

Create a clear "source of truth map":

| Table | System | Read/Write Policy | Relationship Keys | Notes |
|-------|--------|-------------------|-------------------|-------|
| ... | PHI DB / Supabase | read-only / append-only / mutable | client_id rules | ... |

Include:
- Table → System (PHI DB vs Supabase)
- Read/write policy: read-only / append-only / mutable
- Relationship keys: client_id consistency rules
- "Never do" list: operations that would duplicate migrated records or violate constraints

---

### 3) Backend Data Access Inventory (AS-IS)

Construct a matrix for each functional area:

| Endpoint | Controller | Use Case/Service | Repository | Tables Touched | Read/Write | Current DB |
|----------|------------|------------------|------------|----------------|------------|------------|
| ... | ... | ... | ... | ... | R/W | Supabase |

Cover these areas:
- Clients
- Notes/activities
- Contracts/signing
- Time tracking
- Portal invite/eligibility
- Payments/Stripe/QuickBooks sync
- Request form intake
- Dashboard aggregates

---

### 4) Migration Compatibility Matrix (AS-IS vs Target)

For each endpoint/service above, label:

| Endpoint/Service | Compatibility | Reason |
|------------------|---------------|--------|
| ... | Compatible / Partially Compatible / Incompatible | 1-3 bullets |

Reason categories:
- "Reads from wrong system"
- "Writes sensitive fields to wrong system"
- "Assumes joined shape that won't exist after split"
- "Relies on duplicated identity fields"
- "Could orphan records"

---

### 5) PHI Boundary Enforcement Design (Backend-only)

Propose (conceptually, no code) the minimum backend controls required:

1. **PHI Gateway/Data-Access Layer**
   - How reads/writes route to correct database
   - Decision logic for routing

2. **Authn/Authz Gates**
   - Per-role access rules
   - Per-resource rules

3. **Audit Logging Strategy**
   - What events to log
   - Log format and storage

4. **Logging Redaction Strategy**
   - Fields to redact
   - console.log risks and mitigation

5. **Error-Handling Rules**
   - Prevent sensitive data leaks in error messages

**Middleware Flow Diagram (Text)**:
```
Request → Auth Middleware → Role Check → PHI Router →
  ├─ PHI DB (if PHI data needed)
  └─ Supabase (if non-PHI data needed)
→ Response sanitizer → Audit logger → Response
```

---

### 6) DTO/Response Shape Stabilization

List the 10 most important response shapes:

| Response Type | Current Shape (Inferred) | Breaking Changes After Split | Stable DTO Contract |
|---------------|--------------------------|------------------------------|---------------------|
| Clients list item | { id, name, status, ... } | ... | ... |
| Client detail | { ... } | ... | ... |
| Activity list | [ { ... } ] | ... | ... |
| Activity create response | { ... } | ... | ... |
| Hours list | [ { ... } ] | ... | ... |
| Hours create response | { ... } | ... | ... |
| Dashboard stats | { ... } | ... | ... |
| Dashboard calendar | [ { ... } ] | ... | ... |
| Contract summary | { ... } | ... | ... |
| Payment summary | { ... } | ... | ... |

---

### 7) Migration Risks & Failure Modes

Prioritized risk list:

| Risk | Severity | Detection Signal | Rollback Strategy |
|------|----------|------------------|-------------------|
| Data duplication | High | Duplicate IDs in both DBs | ... |
| Orphan references | High | FK constraint violations | ... |
| Incorrect counts/dashboards | Medium | Aggregation mismatches | ... |
| Non-idempotent writes (webhooks) | High | Duplicate charges/payments | ... |
| Background scripts re-inserting data | Medium | Unexpected row counts | ... |
| Logging leakage | High | Sensitive data in logs | ... |

---

### 8) Implementation Plan (No Code Yet)

#### Phase 0: Observability + Contract Freeze
- **Goal**: Baseline metrics, freeze response shapes
- **Definition of Done**: ...
- **Test Strategy**: ...
- **Endpoints Affected**: ...

#### Phase 1: Read Path Migration
- **Goal**: Backend reads from correct store per table type
- **Definition of Done**: ...
- **Test Strategy**: ...
- **Endpoints to Migrate First**: ... (and why)

#### Phase 2: Write Path Migration
- **Goal**: Backend writes to correct store per table type
- **Definition of Done**: ...
- **Test Strategy**: ...
- **Endpoints to Migrate First**: ... (and why)

#### Phase 3: Cleanup + Enforcement + Monitoring
- **Goal**: Remove legacy paths, enforce boundaries, production monitoring
- **Definition of Done**: ...
- **Test Strategy**: ...
- **Final Validation**: ...

---

### 9) Validation & Test Checklist

Pre-production validation tests:

- [ ] Reads come from correct DB per table type
- [ ] Writes do not create duplicates
- [ ] Webhooks are idempotent and safe
- [ ] Client portal eligibility still works
- [ ] Time tracking matches expected source-of-truth
- [ ] No sensitive data leaks into logs
- [ ] No sensitive data leaks in client responses
- [ ] Dashboard aggregates are accurate
- [ ] Contract generation/signing workflow complete
- [ ] Payment processing end-to-end verified
- [ ] QuickBooks sync verified
- [ ] All role-based access controls working
- [ ] Audit logs capturing all PHI access

---

## Style Requirements

- Be precise and opinionated
- Use tables/bullets for clarity
- Call out contradictions explicitly
- If information is missing, list it under "Unknowns," but still make best-effort inferences

---

## Usage

1. Provide the required inputs (architecture report, target tables list)
2. Request the audit using this prompt
3. Review the output
4. Only after review, request: "Now make recommendations" or "Now propose code changes"

---

## Wait State

The audit should end with:

> "Analysis complete. Awaiting request for recommendations."

Do not proceed to code changes until explicitly requested.
