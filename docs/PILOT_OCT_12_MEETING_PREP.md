# Pilot meeting prep — October 12 testing

Use this doc in your meeting to **review what the product does today** on the
**pilot site**, decide **what testers must exercise on the 12th**, and mark
**what stays vs. what waits** for go-live.

**Pilot CRM (testers open this):**  
https://sokana-front-end-dev-46lcr3n2qa-uc.a.run.app

**Public intake (no login):**  
https://sokana-front-end-dev-46lcr3n2qa-uc.a.run.app/request/sokana360

**Client login (families):**  
https://sokana-front-end-dev-46lcr3n2qa-uc.a.run.app/auth/client-login

This environment is **separate from production**. It uses **fictional clients**
in the database, but **email, QuickBooks, and card payments are real** unless
you turn integrations off. Treat charges and invoices as real money.

Step-by-step tester scripts live in [`PILOT_TEST_GUIDE.md`](./PILOT_TEST_GUIDE.md).

---

## How to read this doc

| Column in tables | Meaning |
| ---------------- | ------- |
| **In pilot test (Oct 12)?** | Recommended for hands-on testing that day |
| **Keep for go-live?** | Your decision in the meeting (Yes / No / Later) |
| **As-is today** | What actually happens if someone clicks it now |

Legend for **In pilot test**:

- **Yes** — core path; someone should click it and mark Pass/Fail  
- **Smoke** — open the page only; confirm it loads, don’t deep-test  
- **No** — skip or hide from testers (empty, duplicate, or not ready)  
- **Admin walks it** — only Test Admin tries it; other roles should not  

---

## Roles (who sees what)

| Role | Who they are | How they sign in |
| ---- | ------------ | ---------------- |
| **Admin** | Office / matching / full CRM | Main **Log In** → `hello@sokanacollective.com` (Test Admin) |
| **Doula** | Assigned care staff | Main **Log In** after invite + password set |
| **Client** | Family in portal | **Client login** URL (not staff Log In) |
| **Billing-only** | Money staff, limited menu | Same Log In, but role must be billing-only (see gaps below) |

**Gap today:** Team invite supports **Admin** and **Doula** only — not
billing-only. For the 12th, **Test Admin** walks billing screens unless you
add a billing test account before then.

---

## End-to-end workflows (as built today)

These are the **main stories** in order. Match them to [`PILOT_TEST_GUIDE.md`](./PILOT_TEST_GUIDE.md) sections.

### A. Public intake (no account)

1. Family opens **`/request/sokana360`** (Sokana360 logo + multi-step form).  
2. They complete all steps and submit.  
3. Backend stores the request under tenant **sokana360**; staff get notification email (if email is on).  
4. They are **not** logged into the CRM.

**Pilot:** **Yes** — use **Ary Practice**.

---

### B. Admin finds and opens clients

1. Admin logs in → **Dashboard** home (“Welcome back…”).  
2. **Leads** (`/clients`) — table of people not yet “matched” / in pipeline.  
3. Open a row → **lead profile** (demographics, assignment, portal invite, etc.).  
4. **Customers** (`/clients/new`) — matched/active clients (separate sidebar item; same underlying client system, different list).

**Pilot:** **Yes** — confirm **Ary Practice** opens on Leads after intake. Nancy is the admin.

---

### C. Match doula to client

1. From **Ary’s** profile, admin uses **assign / match**.  
2. Choose the one doula invited in this run.  
3. Save → Ary’s page shows that doula; the doula should see Ary only.

**Pilot:** **Yes** — core Sokana workflow.

---

### D. Invite staff (Team)

1. **Team** → invite person.  
2. Roles available: **Admin**, **Doula** (not billing-only).  
3. Email goes from `hello@sokanacollective.com`; invitee sets password via link.

**Pilot:** **Yes** for **Doula** invite (Sam). Admin invite optional.

---

### E. Doula day-to-day (Doula Dashboard)

After doula can log in:

1. **Profile** — doula’s own bio/info.  
2. **Documents** — doula document uploads.  
3. **Clients** — **only assigned** clients.  
4. **Hours** — log visit time against a client.  
5. **Activities** — notes / activity log (per client).

Doula should **not** see Team, Leads, Integrations, or full admin billing.

**Pilot:** **Yes** if Sam can log in; otherwise **Admin walks Doulas** (`/hours`) and note “doula login blocked.”

---

### F. Contracts & signing (staff + public)

1. **Contract Templates** (`/contracts`) — admin template list (may be empty).  
2. Staff sends contract / signing link (from client workflows — depends on data).  
3. Signer opens **`/signing`** (token link) — public signing, no CRM login.  
4. **Signed Contracts** (`/billing/contracts`) — billing view of signed agreements.  
5. **`/contract-signed`** — thank-you page after signing.

**Pilot:** **Smoke** templates + signed contracts list; full sign flow **Yes** only if you seed a contract before the 12th.

---

### G. Billing & money (admin + billing role)

1. **Payment Schedules** (`/billing/payment-schedules`) — plans tied to contracts.  
2. **Signed Contracts** — open contract → payment detail screens.  
3. **Payments** (`/payments`) — payment operations (admin).  
4. **Reconciliation** (`/payments/reconciliation`) — match invoices to payments.  
5. **Invoices** (`/invoices`) — invoice list / QuickBooks-related invoicing.  
6. **Integrations → QuickBooks** — connect **real** QuickBooks company (tokens shared with prod — reconnect prod if needed).

**Pilot:** **Smoke** all pages load; **Yes** QuickBooks connect only if leadership accepts live books; **No** random card charges.

---

### H. Client portal (family)

1. Client uses **`/auth/client-login`**.  
2. Sees **Profile Information** and **Billing Information** only.  
3. Cannot open staff menus (Team, Leads, Doula Dashboard).

Invite path: admin may **Invite to portal** from lead profile; email + set password.

**Pilot:** **Yes** if Ary’s portal invite works; else **Yes** for “send invite + check email.”

---

### I. Analytics

1. **Demographics** (`/demographics`) — admin reporting slice.

**Pilot:** **Smoke** or **No** unless leadership cares about reports on the 12th.

---

### J. Staff utilities (easy to forget)

| Item | Route | Today |
| ---- | ----- | ----- |
| My account | `/my-account` | Staff profile/settings (if linked in UI) |
| Accept invite | `/accept-invite` | New doula/admin from email link |
| Set password | `/auth/set-password` | Password setup from invite |
| Pipeline board | `/pipeline` | **Exists but not in left menu** — legacy/kanban; use **Leads** for pilot |

---

## Left menu — by role (what appears today)

Built from the live sidebar config. Hidden items simply don’t show for that role.

### Admin (Test Admin)

| Section | Menu item | Route | In pilot test (Oct 12)? | Keep for go-live? | As-is today |
| ------- | --------- | ----- | ------------------------ | ----------------- | ----------- |
| General | Dashboard | `/` | Yes | ☐ Yes ☐ No ☐ Later | Home welcome |
| General | Inbox | `/inbox` | No | ☐ | **Placeholder** — “No notifications” only |
| General | Leads | `/clients` | Yes | ☐ | Client/lead table + profile |
| General | Customers | `/clients/new` | Smoke | ☐ | Matched clients list |
| Billing | Payment Schedules | `/billing/payment-schedules` | Smoke | ☐ | Billing portal list |
| Billing | Signed Contracts | `/billing/contracts` | Yes | ☐ | Signed contract list/detail |
| Billing | Contract Templates | `/contracts` | Smoke | ☐ | Template admin |
| Manage | Team | `/team` | Yes | ☐ | Invite admin/doula |
| Manage | Doulas | `/hours` | Smoke | ☐ | Admin view of doulas/hours |
| Manage | Payments | `/payments` | Smoke | ☐ | Payments UI |
| Manage | Reconciliation | `/payments/reconciliation` | No | ☐ | Finance power-user |
| Manage | Invoices | `/invoices` | Smoke | ☐ | Invoice list |
| Integrations | QuickBooks | `/integrations/quickbooks` | Admin walks it | ☐ | OAuth connect |
| Analytics | Demographics | `/demographics` | No | ☐ | Demographics report |

### Doula

| Section | Menu item | In pilot test? | Keep for go-live? |
| ------- | --------- | -------------- | ----------------- |
| General | Dashboard | Smoke | ☐ |
| General | Inbox | No (empty) | ☐ |
| Doula Dashboard | Profile | Yes | ☐ |
| Doula Dashboard | Documents | Smoke | ☐ |
| Doula Dashboard | Clients | Yes | ☐ |
| Doula Dashboard | Hours | Yes | ☐ |
| Doula Dashboard | Activities | Yes | ☐ |

### Client (portal)

| Menu item | In pilot test? | Keep for go-live? |
| --------- | -------------- | ----------------- |
| Profile Information | Yes | ☐ |
| Billing Information | Yes | ☐ |

### Billing-only (intended — if account exists)

| Menu item | In pilot test? | Keep for go-live? |
| --------- | -------------- | ----------------- |
| Payment Schedules | Yes | ☐ |
| Signed Contracts | Yes | ☐ |

*No billing-only invite from Team yet — use Test Admin for billing smoke tests.*

---

## Client profile / Leads — tabs and actions (inside one lead)

When admin opens a person from **Leads**, the **lead profile** is the main
workspace. Exact tab names can vary by record state; reviewers should click
through and note:

| Area | Typical purpose | In pilot test? | Keep for go-live? |
| ---- | ---------------- | -------------- | ----------------- |
| Demographics / intake fields | What came from request form | Yes | ☐ |
| Doula assignment | Match primary doula | Yes | ☐ |
| Portal invite | Client login email | Yes | ☐ |
| Notes / status | Office workflow | Smoke | ☐ |
| Contracts / billing hooks | Jump to money workflow | Smoke | ☐ |

**Meeting action:** Walk Ary’s lead screen-by-screen and check off what
testers must touch vs. ignore.

---

## Recommended “must test” list for October 12

Minimum path if time is short:

1. Public intake (`/request/sokana360`) as Ary Practice  
2. Admin Nancy: Leads → Ary → move phases → assign the one doula  
3. Team → invite that one doula  
4. Doula uploads the five required sample documents; Nancy approves them  
5. Doula: Clients / Hours / Activities  
6. Client portal login OR portal invite email for Ary  
7. Contract email shows a sign-by date 7 days out  
8. Signed Contracts + Payment Schedules (load + one drill-in)  
9. QuickBooks connect — **only if** leadership approves live connect  
10. Access check: Ary cannot open `/team`; logged-out user sent to Log In  

Everything else: **Smoke** or **No** per tables above.

---

## Explicitly out of scope for the 12th (unless you change scope)

| Item | Why |
| ---- | --- |
| Billing-only user via Team invite | Role not on invite form |
| Inbox as a real notification center | UI is empty placeholder |
| `/pipeline` kanban | Not in menu; Leads is the supported path |
| Production CRM URL | Testers must use **pilot** URL only |
| Real patient names / real addresses | Use fictional pilot names only |

---

## Meeting checklist (fill in live)

**Date of meeting:** _______________  
**Attendees:** _______________

1. Confirm pilot URL and Test Admin password owner.  
2. For each **Admin menu row**, mark **In pilot test** and **Keep for go-live**.  
3. For **Doula** and **Client** menus, same.  
4. Decide: QuickBooks connect on pilot — **Yes / No**.  
5. Decide: Card payment test — **Yes / No** (default **No**).  
6. Assign owner for any **No** item that must be hidden before testers start.  
7. Point testers to [`PILOT_TEST_GUIDE.md`](./PILOT_TEST_GUIDE.md) for Pass/Fail sheets.

**Notes:**

_______________________________________________________________________________

_______________________________________________________________________________

_______________________________________________________________________________

---

## After the meeting

- Update [`PILOT_TEST_GUIDE.md`](./PILOT_TEST_GUIDE.md) if URLs or steps change.  
- Share this doc + test guide with testers.  
- Track failures in one place (spreadsheet or doc section 4 in test guide).
