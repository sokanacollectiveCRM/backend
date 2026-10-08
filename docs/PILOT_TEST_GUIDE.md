# Sokana360 pilot test guide

This is the **pilot site**. It looks like the live Sokana360 CRM, but it is a
separate environment for testing before go-live.

Use **fictional people only**. Do not enter real patient names, real home
addresses, or anyone’s real medical details.

Email, QuickBooks, and card payments are **live** on this site. Mail goes out
from `hello@sokanacollective.com`. Invoices and charges hit Sokana’s real
QuickBooks company. Only charge a card you intend to charge.

Work through each role (Admin, Doula, Client, Billing), follow the steps, and
mark **Pass** or **Fail** with one sentence about what you saw.

---

## Site

Open this URL:

**https://sokana-front-end-dev-46lcr3n2qa-uc.a.run.app**

You should see **Log In**.

Do not open the API URL. That is not the CRM. It will show a short status
message instead of Sokana screens.

---

## First login

| Field        | Value                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------- |
| Email        | `hello@sokanacollective.com`                                                                |
| Display name | **Test Admin**                                                                              |
| Password     | The password for that Sokana inbox. Ask the person who set up this pilot if you are unsure. |

After login, the home page should say:

**Welcome back, Test Admin!**

If it does not, stop and tell the person running the pilot. Later steps depend
on this account.

A test client named **Maya Tester** is already in the system.

---

## Rules

1. Use fictional names only. Suggested:
   - Client: **Maya Tester**
   - Doula: **Sam Doula**
   - Extra intake (optional): **Jordan Practice**
2. If a button sends email, use it. Mail comes from
   **hello@sokanacollective.com** and should arrive in a real inbox.
3. Card charges and QuickBooks invoices are **real money**. Do not run a payment
   unless you mean it.
4. After each section, check **Pass** or **Fail** and write one sentence.
5. If you get stuck, take a screenshot. Do not guess passwords.

---

## Roles

### Admin (start here)

Office staff with full access. Matches clients to doulas, invites the team, and
can open billing.

### Doula

Care staff. Sees **only assigned clients**. Logs hours and notes. Cannot run the
office.

### Client

The family. Sees **their own** profile, billing, and documents. Cannot see other
families or staff tools.

### Billing

Staff limited to payment schedules and signed contracts. Should not see full
health records or the matching board.

**Billing-only logins today:** the role exists in the product. A billing-only
user should land on **Signed Contracts** and see only the **Billing** menu.

You **cannot** invite a billing user from **Team** yet. Team can add **Admin**
or **Doula** only. For this pilot, **Test Admin** walks the billing screens. A
separate billing login is follow-up work if leadership wants it for go-live.

---

# 1 — Sign in as admin

**Goal:** Confirm Test Admin can open the CRM.

1. Open the pilot site.
2. Enter the Test Admin email.
3. Enter the password you were given.
4. Click **Log In**.
5. Confirm you see **Welcome back, Test Admin!**
6. Check the left menu for **Dashboard**, **Inbox**, **Leads**, **Team**, and
   billing items.

**Pass if:** you are in the CRM, not stuck on Log In.

| Pass | Fail | What I saw |
| ---- | ---- | ---------- |
| ☐    | ☐    |            |

---

# 2 — Submit a client request (no login)

**Goal:** A family can submit an intake form without a staff account.

1. Open a **new browser window** (or a private/incognito window).
2. Go to:  
   **https://sokana-front-end-dev-46lcr3n2qa-uc.a.run.app/request/sokana360**

   (Legacy `/request` redirects to `/request/sokana360`.)

3. You should see the request form, not the staff CRM.
4. If you see **Fill with test data**, you may use it. Change the name to
   **Jordan Practice** if it is not already clearly fictional. Do **not** reuse
   Maya Tester — Maya is already in the CRM.
5. If there is no fill button, enter:
   - First name: Jordan
   - Last name: Practice
   - Email: `hello+pilot.jordan@sokanacollective.com`
   - Phone: `555-010-0102`
   - Labor Support and/or Postpartum Support
   - City/state can be fictional (example: Springfield, IL)
6. Complete every step until the form confirms it was submitted.

**Pass if:** the form confirms receipt and does **not** sign you into the staff
CRM.

| Pass | Fail | What I saw |
| ---- | ---- | ---------- |
| ☐    | ☐    |            |

---

# 3 — Find the client

**Goal:** Admin can see existing and new clients.

1. Return to the window where you are **Test Admin**.
2. Sign in again if needed.
3. Open **Inbox** or **Leads**.
4. Find **Maya Tester**. She should already be there.
5. If you completed section 2, also look for **Jordan Practice**.
6. Open Maya. You should see her name, not a blank page.

**Pass if:** Maya Tester is on a list an admin can open. Jordan is optional if
you finished section 2.

| Pass | Fail | What I saw |
| ---- | ---- | ---------- |
| ☐    | ☐    |            |

---

# 4 — Invite a doula

**Goal:** Admin can add a doula to the team.

1. Stay signed in as **Test Admin**.
2. Open **Team**.
3. Click **Invite** (or the add-person control).
4. Enter:
   - First name: **Sam**
   - Last name: **Doula**
   - Email: `hello+pilot.doula@sokanacollective.com`
   - Role: **Doula** (not Admin)
5. Save / send the invite.
6. Confirm Sam appears on the Team list. Filter to **Doula** if needed.

**Pass if:** Sam Doula is on the Team list as a doula, and an invite email
arrives for `hello+pilot.doula@sokanacollective.com` (that still delivers to the
hello@ inbox).

| Pass | Fail | What I saw |
| ---- | ---- | ---------- |
| ☐    | ☐    |            |

---

# 5 — Assign the doula

**Goal:** Admin can assign Maya to Sam.

1. Stay signed in as **Test Admin**.
2. Open **Leads** and click **Maya Tester**.
3. Find **assign** or **match**.
4. Choose **Sam Doula**.
5. If it asks primary or backup, choose **primary**.
6. Save.
7. Confirm Maya’s page lists Sam as her doula.

**Pass if:** Maya’s record shows Sam as the assigned doula.

| Pass | Fail | What I saw |
| ---- | ---- | ---------- |
| ☐    | ☐    |            |

---

# 6 — Contracts, billing, and QuickBooks

**Goal:** Admin can open billing screens and connect the real QuickBooks
company.

1. Stay signed in as **Test Admin**.
2. Open **Contract Templates**. An empty list is fine; note whether the page
   loads.
3. Open **Signed Contracts**.
4. Open **Payment Schedules**.
5. Open **Payments** and **Invoices** if they appear.
6. Open **Integrations** (QuickBooks). Click **Connect**. Sign in to Sokana’s
   real QuickBooks company if prompted.
7. You should return to Integrations with QuickBooks connected.
8. Any card payment after that is a **real charge**.

**Pass if:** the pages load and QuickBooks shows as connected. Empty lists on
the contract/payment screens still count as a pass.

| Pass | Fail | What I saw |
| ---- | ---- | ---------- |
| ☐    | ☐    |            |

---

# 7 — Doula access

Sam should see **Maya only**, not the full office.

### If Sam can sign in

1. Open your name (usually at the bottom of the left menu) and **Log out**.
2. Sign in with Sam’s email if you have a password for Sam.
3. You should **not** see Team, Leads, or full admin tools.
4. You **should** see Doula Dashboard items: Profile, Documents, Clients, Hours,
   Activities.
5. Open **Clients**. You should see **Maya Tester**.
6. You should not see other real families (this site should only have fictional
   records).
7. Open **Hours**. Add a short visit (today’s date, note such as “pilot visit”).
8. Open **Activities**. Add a short note such as “Pilot check-in.”

**Pass if:** Sam sees Maya, can log hours and notes, and cannot open Team or
other families.

### If Sam cannot sign in yet

Stay as Test Admin.

1. Open **Doulas**.
2. Open **Sam Doula** if present.
3. Note: “Doula login not ready. Admin can still see Sam on the team.”

| Pass | Fail | What I saw |
| ---- | ---- | ---------- |
| ☐    | ☐    |            |

---

# 8 — Client portal

Maya should see **only Maya’s** information.

### If Maya can sign in

Client login is separate from staff login:

**https://sokana-front-end-dev-46lcr3n2qa-uc.a.run.app/auth/client-login**

| Field    | Value                                     |
| -------- | ----------------------------------------- |
| Email    | `hello+pilot.client@sokanacollective.com` |
| Password | Ask the person who set up this pilot      |

1. Log out of staff if you are still Test Admin or Sam.
2. Open the client login link above.
3. Sign in as Maya.
4. You should see **Profile Information** and **Billing Information**.
5. You should **not** see Team, Leads, Inbox, or Doula Dashboard.
6. Open Profile. The name should be Maya.
7. Open Billing. You should see Maya’s billing only.

**Pass if:** Maya can see only Maya’s records.

### If Maya cannot sign in yet

Stay as Test Admin.

1. Open Maya’s client page.
2. Look for **Invite to portal** or similar.
3. Send the invite if you can.
4. Confirm whether an email arrived. Mail should send from
   `hello@sokanacollective.com`.

| Pass | Fail | What I saw |
| ---- | ---- | ---------- |
| ☐    | ☐    |            |

---

# 9 — Billing role

**Intended access**

A billing user is staff, limited to money:

- **Can** open Payment Schedules and Signed Contracts
- **Can** review a contract’s payment plan
- **Cannot** match doulas
- **Cannot** see the full health file the way an admin can
- **Cannot** use the Doula Dashboard
- **Cannot** use the client portal

A true billing-only login should open **Signed Contracts**, with a left menu
that shows **Billing** only.

**What you can test now (as Test Admin)**

1. Sign in as **Test Admin**.
2. Open **Signed Contracts**.
3. Open **Payment Schedules**.
4. If a contract exists, open it and confirm the page is about money (dates,
   amounts, status), not health notes.
5. Confirm you still see Admin menus (you are Test Admin, not billing-only).

**What you cannot test now**

You cannot invite a billing-only user from **Team**. If go-live needs a separate
money login, that role has to be added to Team invites and given its own test
account.

| Pass | Fail | What I saw |
| ---- | ---- | ---------- |
| ☐    | ☐    |            |

---

# 10 — Access control

Confirm people cannot open screens they should not see.

1. As **Test Admin**, copy a staff page from the address bar, for example
   `/team`.
2. Log out.
3. Paste that address while logged out. You should be sent to Log In.
4. If you have a **client** login, sign in as Maya and try `/team`. You should
   be blocked, not shown the team list.
5. If you have a **doula** login, sign in as Sam and try `/team`. Sam should not
   manage the full team.

**Pass if:** each role is kept out of screens it should not use.

| Pass | Fail | What I saw |
| ---- | ---- | ---------- |
| ☐    | ☐    |            |

---

## Not in scope for this pilot

Mark **N/A** instead of Fail:

- Inviting a billing-only teammate from Team

Email, QuickBooks, and card charges **are** in scope. Treat them as live: real
mail, real books, real money. Keep using fictional client names.

---

## After you finish

Tester name: \***\*\*\*\*\***\_\_\***\*\*\*\*\***

Date: \***\*\*\*\*\***\_\_\***\*\*\*\*\***

1. What was straightforward?

2. What was unclear?

3. What was broken?

4. Are we ready to use this with real families?  
   ☐ Yes  ☐ Not yet  ☐ Not sure

Return this page (or photos of the checkboxes) to the person running the pilot.
