# Package-by-feature architecture report

Date: 2026-10-09
Scope: `/Users/jerrybony/Documents/GitHub/backend` (`src/`, excluding `.worktrees`)
Purpose: Tell a new developer how the backend is organized, where business rules live, how hard each kind of change is, and whether Gherkin would help.
Method: Static file and line counts, route mounts in `src/server.ts`, feature README, and import checks. No runtime behavior was changed.

Related open work (not done in this report):

- `.cursor/handoffs/open/2026-08-10-backend-architecture-boundary-refactor.md` (in progress; P0 security items are checked, structural P1/P2 remain)
- `.cursor/handoffs/open/2026-08-25-full-supabase-exit-launch-ready.md`

The intended rules already live in `src/features/README.md`. This report scores the tree against those rules.

---

## Verdict

The repo is a **modular monolith in the middle of a package-by-feature move**. The target is clear. The current tree is only partly there.

A new developer can find the *front door* (`src/server.ts`) and the *intended home* (`src/features/`). They cannot yet assume that the business rule for a URL lives in that feature’s `domain/` folder. For the largest product areas (clients, doulas, payments, invoices, documents) the rule still lives in a large HTTP handler or a global service/repository.

About **4.7%** of production TypeScript under `src/` is pure domain code (`features/*/domain`, ~2,200 lines). The single file `src/features/clients/http/clientController.ts` is **3,363 lines**, larger than all extracted domain code combined.

**Gherkin:** useful later as a thin journey layer on top of the existing characterization tests. Adopting Cucumber now would not make files easier to find, change, or delete. The blocker is ownership, not missing Given/When/Then syntax.

Do not rewrite. Finish one feature package at a time, starting with the files a developer actually has to open.

---

## How a developer should navigate today

There are two maps, and both are real.

**Map A — URL to code (what the process actually mounts)**

1. `src/server.ts` mounts Express routers.
2. Most imports still point at `src/routes/*`.
3. Many of those route files are one-line re-exports into `src/features/<feature>/http`.
4. The handler often calls `src/services/*` or `src/repositories/*`, which may themselves be shims back into a feature.

**Map B — business capability (what `src/features/README.md` says to use)**

```text
src/features/<feature>/
  domain/            pure rules
  application/       use cases + ports
  http/              Express routes and controllers
  infrastructure/    Cloud SQL, GCS, QuickBooks, email
  index.ts           only import this from other features
```

Allowed direction: `http → application → domain`, and `infrastructure` implements ports. New business code is supposed to land here, not in `src/controllers`, `src/services`, `src/repositories`, or `src/routes`.

**What the root screenshot hides:** the root (`docs`, `migrations`, `scripts`, `src`) looks like a normal Node service. The difficulty is inside `src`, where the old layer folders and the new feature folders both exist.

---

## Size snapshot

Counts are TypeScript/JavaScript under `src/` on 2026-10-09. `.worktrees` is excluded.

| Area | Files | Lines | Role today |
| --- | ---: | ---: | --- |
| `src/features` | 197 | 27,036 | Target home. Mixed: real packages plus shims and leftover layer folders |
| `src/__tests__` | 73 | 13,567 | Most behavior locks live here, far from the feature |
| `src/services` | 61 | 8,274 | Still holds doulas, team, email, payments, invoices, identity |
| `src/repositories` | 18 | 4,890 | Still holds clients, requests, users, assignments, documents |
| `src/routes` | 20 | 735 | Mostly shims; payments/invoices/financial are still real |
| `src/controllers` | 15 | 289 | Mostly shims; payment methods and debug are still real |
| `src/security` | 14 | 1,068 | Authz, error codes, deprecation telemetry |
| `src/domains` | 7 | 56 | Shared error types only, not product rules |
| Other (`utils`, `config`, `middleware`, `entities`, `dto`, entry files) | — | ~6,200 | Shared shell |

Totals: **465** source files, about **61,100** lines. **87** files (19%) are re-export shims of 20 lines or fewer. **183** route registrations (`get` 96, `post` 59, `put` 13, `patch` 8, `delete` 7). **94** test files: 73 under `src/__tests__`, 21 colocated under features (mostly contracts and tenancy). **0** `.feature` files. **0** paired `.js` sources left under `src/`. **116** markdown files under `docs/`. **96** SQL files under `src/db/migrations` plus 10 under `migrations/`.

Largest files (lines):

| Lines | File | Why it matters |
| ---: | --- | --- |
| 3,363 | `features/clients/http/clientController.ts` | Client list, PHI, billing, activities, assignment, documents |
| 1,772 | `features/doulas/http/doulaController.ts` | Doula dashboard, with almost no domain layer |
| 994 | `repositories/supabaseClientRepository.ts` | Legacy client persistence still present |
| 885 | `services/doulasService.ts` | Doula rules outside the doulas package |
| 816 | `repositories/cloudSqlClientRepository.ts` | Current client persistence, outside the clients package |
| 696 | `services/cloudSqlTeamService.ts` | Team data outside `features/team` |
| 689 | `services/emailService.ts` | Shared mail transport (allowed to stay shared) |
| 600 | `features/users/http/userController.ts` | Profile and hours, no domain folder |
| 566 | `features/contracts/infrastructure/contractRepository.ts` | Contract persistence |
| 564 | `features/auth/http/authController.ts` | Login/session, no domain folder |

---

## Where the business domain actually is

“Business domain” here means Sokana rules: who may become a client, when a doula can be assigned, when a portal invite is allowed, how a contract is priced and signed, how intake is normalized. It does **not** mean Express, SQL, or QuickBooks HTTP.

### Extracted and safe to reason about

These folders do not import Express, `pg`, Firebase, Supabase, GCS, axios, or `process.env`. A developer can change a rule here and trust the file is the rule.

| Capability | Domain file | Lines | What it decides |
| --- | --- | ---: | --- |
| Portal eligibility | `features/portal/domain/eligibility.ts` | 402 | Billing path, blockers, allowed actions, lock/unlock |
| Intake normalization | `features/intake/domain/normalizePublicSubmission.ts` | 326 | Public form normalize |
| Intake DTO rules | `features/intake/domain/requestSubmissionDto.ts` | 272 | Submission shape |
| Contract field normalize | `features/contracts/domain/normalization.ts` | 276 | Contract payload normalize |
| Contract pricing | `features/contracts/domain/calculations.ts` | 165 | Price math |
| Contract lifecycle | `features/contracts/domain/statusMachine.ts` | 45 | Status transitions |
| Doula assignment | `features/matching/domain/assignment.ts` | 115 | Service catalog, role, window, messages |
| Client status | `features/clients/domain/clientStatus.ts` | 63 | Status parse, `matched_at`, conversion statuses |
| QuickBooks customer link | `features/clients/domain/quickBooksCustomer.ts` | 76 | Payload, identity, link method |
| Tenancy | `features/tenancy/domain/*` | ~302 | Active membership, staff email domain, tenant session |

Shared `src/domains/errors` is only error classes (`ValidationError`, `NotFoundError`, and so on).

### Still trapped in HTTP or infrastructure

These are product behavior, but they are not in `domain/`:

- **Clients.** `clientController.ts` owns list/detail, CSV export, PHI update, birth outcomes, billing fields, activities, assign/unassign doula, and client documents. `clientRoutes.ts` also mounts team-member routes onto the client router, so “clients” is not one capability.
- **Doulas.** Package is HTTP only (`doulaController.ts` 1,772 lines, route files). Rules and queries sit in `services/doulasService.ts` (885) and document repositories.
- **Payments, invoices, financials.** `src/routes/paymentRoutes.ts` (362), `src/routes/financialRoutes.ts` (173), `src/routes/invoiceRoutes.ts`, and `src/services/payments/*`, `src/services/invoice/*`, `src/services/installmentInvoiceService.ts` (545). The billing feature package only covers the billing portal HTTP plus QuickBooks routes.
- **Auth and identity.** `features/auth` is application + HTTP. Identity Platform, MFA, and email verification remain under `src/services/identityPlatform/`.
- **Documents.** Upload/completeness services and `doulaDocumentRepository.ts` (243) / `clientDocumentRepository.ts` (146) are global. There is no `features/documents` package.
- **Team.** `features/team` has a small domain and `staffInvitationService`, but `cloudSqlTeamService.ts` (696) is still global. Client routes call the user controller for `/team/*`.

### Packages that match the target shape

`D` domain, `A` application, `H` http, `I` infrastructure, `idx` public `index.ts`.

| Feature | D | A | H | I | idx | Developer experience |
| --- | --- | --- | --- | --- | --- | --- |
| intake | yes | yes | yes | yes | yes | Best onboarding example. Domain is the rule. HTTP is the edge. |
| portal | yes | yes | yes | yes | yes | Eligibility is the clearest business module in the repo. |
| clients | yes | yes | yes | yes | yes | Status and QuickBooks link are extracted. The controller is not. |
| contracts | yes | yes | yes | yes | yes | Real package, plus leftover `controllers/`, `services/`, `repositories/`, `routes/`, `pdf/`, `validation/` (many are shims). 102 files, 10,265 lines. |
| matching | yes | yes | no | yes | yes | Rules are extracted. HTTP still lives in client and admin controllers. |
| tenancy | yes | yes | no | yes | yes | Cross-cutting kernel. Other features import it. Correct as shared, easy to misuse. |
| billing | no | no | yes | yes | yes | Portal and QuickBooks HTTP moved. Payments/invoices did not. |
| auth | no | yes | yes | no | no | Login/session moved. No domain folder. No barrel. |
| users | no | yes | yes | no | yes | Profile/hours controller only. |
| doulas | no | no | yes | no | no | Files moved, rules did not. |
| admin | no | no | yes | no | yes | HTTP façade over team and matching. |
| email | no | no | yes | no | yes | HTTP only. Transport stays in `services/emailService.ts` on purpose. |
| dashboard | no | no | yes | no | yes | Stats routes only. |
| team | yes | yes | no | no | no | Invitation slice only. |
| assignments | no | no | no | no | yes | Notification email helper, not a package. |
| invoices | no | no | no | no | no | One stray `InvoicesPage.tsx` inside the backend. Not a feature. |

Four packages have all four layers and a public barrel: **intake, portal, clients, contracts**. Only intake and portal are small enough to learn the pattern from. Contracts is the cautionary example of moving files without deleting the old names.

---

## How hard each kind of change is

Scale: **Easy** means one obvious file and a nearby test. **Medium** means a few files and a documented path. **Hard** means several trees, a very large file, and tests that live somewhere else.

| Intent | Rating | Start here | What gets in the way |
| --- | --- | --- | --- |
| Discover which URL exists | Medium | `src/server.ts` | Duplicate mounts (`/clients`, `/client`, `/api/clients`, `/api/client`). Same router is mounted more than once. |
| Discover a rule that was already extracted | Easy | `features/<name>/domain` | README lists these. Characterization tests are under `src/__tests__`, not beside the domain file (except contracts). |
| Update portal eligibility | Easy | `features/portal/domain/eligibility.ts` | Callers still import `src/constants/portalEligibility.ts` and `src/services/portalEligibilityService.ts` (shims). Behavior lock: `portalEligibilityServiceCharacterization.test.ts`. |
| Update public intake validation | Easy | `features/intake/domain/` | Flag `INTAKE_USE_FEATURE_PACKAGE` still selects the write path. Abuse limits live in infrastructure, not domain. |
| Update doula assignment rules | Medium | `features/matching/domain/assignment.ts` | Two HTTP entry points (client assign vs admin match) with different status codes. Controllers still own the response. |
| Update client status / QuickBooks link decision | Medium | `features/clients/domain/` | `PUT /clients/status` remains in the giant controller. Frontend may still sync QuickBooks itself. |
| Update client profile, PHI, activities, documents | Hard | `clientController.ts` then `cloudSqlClientRepository.ts` | One class, many methods (`getClients`, `updateClientPhi`, `updateClientBirthOutcomes`, `createActivity`, `assignDoula`, document CRUD). Supabase client repository (994 lines) still exists beside Cloud SQL. |
| Update doula dashboard | Hard | `doulaController.ts` and `services/doulasService.ts` | No domain or application layer. Documents are a third cluster of services. |
| Update payments, invoices, card on file | Hard | `src/routes/paymentRoutes.ts`, `src/services/payments/`, `src/services/invoice/` | Not inside `features/billing`. QuickBooks routes are feature-flagged in `server.ts`; card-on-file is mounted even when QuickBooks is off. |
| Update auth / MFA | Medium | `features/auth/http` and `services/identityPlatform/` | Split across feature HTTP and global identity services. Tenancy is pulled in from the auth controller. |
| Add a new capability | Medium | New folder under `src/features/<name>` following the README | Nothing stops a new file from landing in `src/services`. `server.ts` will not see the feature until a route is mounted, usually via a `src/routes` shim. |
| Remove a route or alias | Hard | `server.ts` deprecation helper, then both mounts, then frontend | Aliases are intentionally kept until telemetry says they are unused. Deleting a shim breaks old import paths and Jest mocks. |
| Remove Supabase data access | Hard | `supabaseClientRepository.ts`, `supabaseUserRepository.ts`, `supabaseAssignmentRepository.ts`, `supabase.ts` | Open handoff `2026-08-25-full-supabase-exit-launch-ready.md`. Auth/documents may still depend on it. |
| Delete a whole feature | Hard | Mounts, shims, repos, migrations, `docs/` | 87 shims and 116 docs mean “deleted from `features/`” is not “gone”. |

### Cross-feature imports

Seventeen imports cross feature boundaries. Most are acceptable (HTTP calling another feature’s public API, or tenancy as a kernel). Two violate the README:

- `features/contracts/domain/billing.ts` imports `features/portal` (domain should not depend on another feature).
- `features/billing/infrastructure/billingContractDownloadService.ts` imports `features/contracts/services/contractService` (internal path, and `services/` is a legacy folder).

Tenancy is the shared kernel in practice: auth, intake, users, and team all import it. That is reasonable if every import goes through `features/tenancy/index.ts`. Some imports reach `features/tenancy/application/tenantRequestStore` directly.

---

## Why onboarding feels heavier than the folder list

1. **Two homes for the same concept.** A search for “client” hits `features/clients`, `controllers/clientController.ts` (shim), `routes/clientRoutes.ts` (shim), `repositories/cloudSqlClientRepository.ts`, `repositories/supabaseClientRepository.ts`, and dozens of docs.
2. **Shims preserve old paths on purpose.** They keep Jest mocks and existing imports working. They also double every navigation. Contracts is the extreme: 43 of the 87 shims live under `src/features`.
3. **The composition root was not moved.** README wants `src/bootstrap`. Reality is `src/server.ts` (224 lines) plus `src/index.ts`, with `require()` for QuickBooks, native contracts, and debug routes.
4. **Tests explain behavior, but they are not next to the code.** Four characterization suites are the real spec for migrated slices:
   - `src/__tests__/portalEligibilityServiceCharacterization.test.ts`
   - `src/__tests__/matchingAssignmentCharacterization.test.ts`
   - `src/__tests__/clientStatusQuickBooksSyncCharacterization.test.ts`
   - `src/__tests__/contractsFeatureCharacterization.test.ts`
5. **`docs/` is a prompt archive, not a map.** 116 markdown files include HIPAA signoffs, frontend prompts, and old API notes. `src/features/README.md` is the only architecture map a new developer should trust first.
6. **Client routes are a grab bag.** `/clients/team/*` is user/team behavior mounted on the client router.

---

## Would a Gherkin file help?

Gherkin is the Given/When/Then language used by Cucumber. A `.feature` file describes observable behavior. It does not describe folders.

### Recommendation

**Do not add a Cucumber runner or a tree of `.feature` files as the next architecture step.**

**Do add a short journey spec, in Given/When/Then, for the six workflows below — but only as the names and assertions of the characterization tests that already exist (or a single `docs/JOURNEYS.md` that points at those tests).** Promote a scenario to a real `.feature` file only when that journey’s use case lives in `features/<name>/application` and the test runs in CI beside it.

### Why Gherkin looks attractive here

- The product is workflow-shaped: intake → match a doula → contract → portal invite → billing.
- Those workflows cross files, so a file tree never tells the story.
- Product and clinical staff can read Given/When/Then. They cannot read `clientController.ts`.
- The architecture handoff already says “preserve behavior before restructuring.” Gherkin is one way to write that behavior down.

### Why it would not fix discovery or edits

- The hard part is finding the owning file. A `.feature` file does not point at `clientController.ts` line 2408 unless someone maintains that link.
- Behavior for the migrated slices is already locked by Jest characterization tests. A second spec will drift from those tests and from the 116 docs.
- Most unmigrated behavior is not a clean use case. Gherkin written against a 3,363-line controller becomes a description of HTTP accidents (status codes, alias paths, cookie names), which is the wrong layer.
- HIPAA: examples must be synthetic. A feature file full of realistic patient stories is a bad place to keep PHI-shaped fixtures.

### Journeys worth a scenario list (in this order)

| Journey | Why a scenario helps | Where the rule lives today | Gherkin now? |
| --- | --- | --- | --- |
| Public intake submit | Many fields, normalization, abuse limits | `features/intake/domain` | Yes, as Jest names. The use case exists. |
| Portal eligibility | Many blockers, one decision | `features/portal/domain/eligibility.ts` | Yes. This is the best first `.feature` if you add any. |
| Admin match vs client assign-doula | Two routes, different failure codes | `features/matching/domain` plus two controllers | Yes, one scenario per route. |
| Client status `matched` links QuickBooks customer | Easy to “fix” in the wrong layer | `features/clients/domain` plus controller | Yes, after the controller call is a one-liner. |
| Send contract and complete native signing | Long lifecycle | `features/contracts` domain + application | Later. Package still has two folder dialects. |
| Record a payment / show card on file | Money, QuickBooks, feature flag | `src/services/payments`, `src/routes/paymentRoutes.ts` | No. Extract the use case first, then write the scenario. |

Example of the shape that would help, without adopting Cucumber yet:

```gherkin
Feature: Portal invite eligibility

  Scenario: Deposit paid but contract unsigned
    Given a client on the installment billing path
    And the deposit installment is paid
    And no contract is signed
    When eligibility is computed
    Then the client is not eligible for a portal invite
    And the primary blocker is the unsigned contract
```

That scenario should call `features/portal/domain/eligibility.ts` directly. It should not boot Express.

### What not to put in Gherkin

- Route alias deprecation and CORS header lists
- Webhook HMAC and replay windows
- Cookie names and token transport
- SQL migration order
- “File X should re-export file Y”

Those are technical contracts. Keep them as Jest tests (`authorizationMatrix`, `securitySmoke`, http contract tests).

### If you do add files later

- One `features/<feature>/<feature>.feature` per package, 5–15 scenarios, synthetic data only.
- Step definitions live next to the application use case and call the use case, not Supertest, except for one HTTP smoke scenario.
- Do not generate a feature file per endpoint. 183 routes would become unread noise.
- Delete or archive the matching prose doc when the feature file becomes the spec. Do not keep both.

---

## Suggested order for a later refactor (not started here)

This matches the open architecture handoff. It is sequenced for a new developer’s ability to find code, not for a new folder aesthetic.

1. **Teach the map in one place.** Keep `src/features/README.md` as the entry. Add a one-page URL → feature table generated from `server.ts` mounts. Point `docs/` readers there; do not add another architecture essay under `docs/` beyond this report.
2. **Split `clientController.ts` by use case** (profile, PHI, activities, documents, assignment) into `features/clients/application`, leaving the controller as mapping only. This is the highest-leverage discoverability change.
3. **Move `doulasService.ts` behind `features/doulas/application` and a real `domain/`.** The dashboard is the other daily edit surface.
4. **Move payment and invoice services into `features/billing`** only after a characterization test locks current responses.
5. **Delete shim folders only after imports and Jest mocks are updated.** Contracts’ inner `controllers/`, `services/`, `repositories/`, `routes/`, `pdf/` shims are the first deletion candidate because they sit inside the feature and confuse the package layout.
6. **Add journey scenarios** for portal, intake, and matching at the moment each use case is the only writer of that rule.
7. **Leave `emailService` and `security/` global.** They are shared infrastructure, not features.

---

## Bottom line for Grokbot

- Architecture style: Express modular monolith, package-by-feature **target**, layer-folders **still on the runtime path**.
- Business rules that are already isolated: portal eligibility, intake normalization, matching assignment, client status, QuickBooks customer identity, contract pricing/status, tenancy membership.
- Business rules that are not isolated: client aggregate (PHI, activities, documents), doula dashboard, payments, invoices, documents, most of auth/MFA.
- Change difficulty: easy inside `domain/` files that exist; hard anywhere the word “client”, “doula”, or “payment” is the task.
- Gherkin: **helpful as a few journey specs after use cases exist; harmful as a new parallel documentation system today.**
- First file to split if the goal is “another developer can change the product”: `src/features/clients/http/clientController.ts`.
