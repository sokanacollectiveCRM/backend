# Sokana360 Practice Run

This is a practice website. It looks like the real Sokana360 CRM, but it uses
made-up people only. Do not type real patient names, real card numbers, or real
home addresses.

You try on each hat (Admin, Doula, Client), walk through the day-to-day jobs,
and write down what felt easy, confusing, or broken.

Sonia is not in this run. Her role is still open. Leads starts empty.

---

## Where to go

Open this website, or the direct login page:

**https://sokana-front-end-dev-46lcr3n2qa-uc.a.run.app/login**

Front door:

**https://sokana-front-end-dev-46lcr3n2qa-uc.a.run.app**

You should see **Log In**.

Do not open the API link. That page is only for computers. It will look like a
tiny message, not the Sokana360 screens.

---

## Who is in this run

| Hat | Who | Email |
| --- | --- | --- |
| Admin | Nancy Cowans | `nancy+dev@sokanacollective.com` |
| Family | Ary Practice | `hello+pilot.ary@sokanacollective.com` |
| Doula | One new doula | `hello+pilot.doula@sokanacollective.com` |

Use first name **Sam** and last name **Doula** for that one doula. That name is
made up for this rehearsal.

`hello@sokanacollective.com` is a second admin account named **Test Admin**. It
is not a doula and it is not the family. Use it only if Nancy cannot sign in.
If you use it, the home page says **Welcome back, Test Admin!**

Nancy’s password is the one the setup person gave her. Do not guess.

After Nancy signs in, the home page should greet Nancy. If it does not, stop
and tell the setup person.

Mail from these `hello+...` addresses arrives in the `hello@sokanacollective.com`
inbox. That mail is real.

---

## House rules

1. Use the people in the table above. Do not add a second doula.
2. If a button sends email, use it. Write down if the email does not arrive.
3. Do not charge a card.
4. Do not connect QuickBooks unless the person running this practice run is
   with you and says to. Connecting it uses Sokana’s real books.
5. After each story, check Pass or Fail and write one sentence about what you saw.
6. If you get stuck, take a screenshot.

**Intake form** is hidden in the left menu. Families use the public request
link in Story 2. Do not hunt for an Intake form settings page.

Sample files for the doula are in `pilot-test-documents/doula-portal/`. They are
practice files, not real credentials.

---

## The hats

### 1. Admin (Nancy starts here)

The office manager. Sees almost everything. Moves the family through phases.
Invites the doula. Approves the doula’s documents. Can look at money papers.

### 2. Doula

One care person. Sees only the family they were given. Uploads eligibility
documents. Writes hours and notes. Does not run the whole office.

### 3. Client

The family, Ary. Sees their own profile and billing. Cannot see other families.
Cannot see the staff office.

### 4. Billing person

The money person is a costume in the software. You cannot invite a billing-only
person from Team yet. Team can add Admin or Doula only. Nancy walks the billing
screens in this run.

---

## Story 1 — Nancy opens the office

**Goal:** Prove Nancy can sign in.

1. Open the practice website.
2. Type `nancy+dev@sokanacollective.com`.
3. Type the password you were given.
4. Click **Log In**.
5. Confirm the home page greets Nancy.
6. Look at the left menu. You should see Dashboard, Inbox, Leads, Team, Doulas,
   and billing items.
7. Confirm **Intake form** is not in the menu.

**Pass if:** you are inside the office, not stuck on Log In.

| Pass | Fail | What I saw |
| ---- | ---- | ---------- |
| ☐    | ☐    |            |

---

## Story 2 — Ary asks for help (no login)

**Goal:** The family can fill out the request form without being staff.

1. Open a new private window.
2. Go to:  
   **https://sokana-front-end-dev-46lcr3n2qa-uc.a.run.app/request/sokana360**
3. You should see a form, not the staff office.
4. Type:
   - First name: Ary
   - Last name: Practice
   - Email: `hello+pilot.ary@sokanacollective.com`
   - Phone: `555-010-0102`
   - Labor Support and/or Postpartum Support
   - City and state can be made up (example: Springfield, IL)
5. Click through every step until the form says it was sent.

**Pass if:** the form thanks you or says the request was received. It should
not drop you into the staff dashboard.

| Pass | Fail | What I saw |
| ---- | ---- | ---------- |
| ☐    | ☐    |            |

---

## Story 3 — Nancy finds Ary and moves the phases

**Goal:** The office can see the request and move Ary forward.

1. Go back to Nancy’s window.
2. Open **Leads**. Inbox can stay empty. The new request shows on Leads.
3. Open **Ary Practice**.
4. Confirm the status is **Lead**.
5. Change the status to **Contacted** and save.
6. Leave Ary on **Leads**. Do not choose **Matched** yet. Matched moves Ary to
   **Customers**, and you cannot assign a doula from there.

**Pass if:** Ary is on Leads, the name matches what you typed, and the status
is Contacted.

| Pass | Fail | What I saw |
| ---- | ---- | ---------- |
| ☐    | ☐    |            |

---

## Story 4 — Nancy invites one doula

**Goal:** The office adds one care person.

1. Stay signed in as Nancy.
2. Open **Team**.
3. Click **Invite Member**.
4. Enter:
   - First name: Sam
   - Last name: Doula
   - Email: `hello+pilot.doula@sokanacollective.com`
   - Role: **Doula**
5. Send the invite.
6. Confirm Sam Doula appears on the Team list. Filter to Doula if you need to.
7. Confirm the invite email arrives in the hello@ inbox.

**Pass if:** Sam is on the Team list as a doula and the invite email arrived.

| Pass | Fail | What I saw |
| ---- | ---- | ---------- |
| ☐    | ☐    |            |

---

## Story 5 — The doula uploads eligibility documents

**Goal:** The doula turns in the papers required before they can be active.

Do this after the invite email arrives.

1. Open the invite for `hello+pilot.doula@sokanacollective.com`.
2. Set a password and sign in.
3. Confirm the left menu shows Profile, Documents, Clients, Hours, and
   Activities.
4. Confirm you do not see Team, Leads, or billing tools.
5. Open **Documents**.
6. Upload these files. Choose the type in the form. PDF, PNG, or JPEG under
   10 MB.

| File | Type to choose |
| --- | --- |
| `01-background-check.pdf` | Background Check |
| `02-liability-insurance-certificate.pdf` | Liability Insurance Certificate |
| `03-training-certificate.pdf` | Training Certificate |
| `04-w9.pdf` | W9 |
| `05-direct-deposit-form.pdf` | Direct Deposit Form |
| `06-license-optional.pdf` | License (optional) |

7. Tell Nancy the five required files are uploaded. You stay inactive until
   Nancy approves those five.

**Pass if:** all five required files show as uploaded.

| Pass | Fail | What I saw |
| ---- | ---- | ---------- |
| ☐    | ☐    |            |

---

## Story 6 — Nancy approves the documents and assigns Ary

**Goal:** Nancy reviews the papers, then gives Ary to that doula.

1. Sign back in as Nancy.
2. Open Sam’s documents.
3. Approve all five required files. The license is optional.
4. Open **Leads** and open **Ary Practice**.
5. Set Ary to the matching phase and save. The assign control only works in
   that phase. If the screen says Ary is not in the matching phase, stop and
   tell the setup person. Do not set **Matched** to force it.
6. Assign **Sam Doula** as the primary doula and save.
7. Confirm Ary’s page lists Sam.
8. After the assignment works, you may set status to **Matched**. That moves
   Ary from Leads to **Customers**.

**Pass if:** the five documents are approved and Ary’s page lists Sam.

| Pass | Fail | What I saw |
| ---- | ---- | ---------- |
| ☐    | ☐    |            |

---

## Story 7 — Nancy invites Ary to the portal and sends the contract

**Goal:** Ary gets a login and a contract email with a sign-by date.

1. Stay signed in as Nancy.
2. On Ary’s page, send **Invite to portal**.
3. Confirm that email arrives for `hello+pilot.ary@sokanacollective.com`.
4. Send Ary a contract.
5. Open the contract email. It should say **Please review and sign**, include
   a signing link, and show a sign-by date 7 days after today.
6. If you resend the contract, the sign-by date stays the same. Use the newest
   link. The older link stops working.
7. Add a short office note on Ary, such as “Practice check-in.” Do not write
   medical details. Sam should get an email that a note was added. The email
   must not include the note text.

**Pass if:** the portal invite arrived and the contract email shows the
sign-by date.

| Pass | Fail | What I saw |
| ---- | ---- | ---------- |
| ☐    | ☐    |            |

---

## Story 8 — Nancy looks at billing papers

**Goal:** The office can open money screens without taking a payment.

1. Stay signed in as Nancy.
2. Open **Contract Templates**. An empty list is okay.
3. Open **Signed Contracts**.
4. Open **Payment Schedules**.
5. Open **Payments** and **Invoices** if you see them.
6. Skip **QuickBooks** unless the person running this run tells you to connect
   it.
7. Do not charge a card.

**Pass if:** those pages open. Empty lists still count as a pass.

| Pass | Fail | What I saw |
| ---- | ---- | ---------- |
| ☐    | ☐    |            |

---

## Story 9 — Put on the doula hat

Sam should see Ary only.

1. Log out of Nancy.
2. Sign in as `hello+pilot.doula@sokanacollective.com`.
3. Open **Clients**. You should see **Ary Practice** only.
4. Open **Hours**. Add a visit for today with a short note such as “practice
   visit.”
5. Open **Activities**. Add a short note such as “Practice check-in.” Do not
   include medical details.
6. Try to open `/team`. You should not get the staff team list.
7. Log out.

**Pass if:** Sam sees Ary, can write hours and a note, and cannot open Team.

| Pass | Fail | What I saw |
| ---- | ---- | ---------- |
| ☐    | ☐    |            |

---

## Story 10 — Put on the family hat

Ary should see only Ary’s things.

The family door is different from staff login:

**https://sokana-front-end-dev-46lcr3n2qa-uc.a.run.app/auth/client-login**

1. Open the portal invite for `hello+pilot.ary@sokanacollective.com`.
2. Set a password if you have not already, then sign in.
3. Confirm the left menu shows **Profile Information** and **Billing
   Information** only.
4. Open Profile. The name should be Ary Practice.
5. Open Billing. You should see only this family’s billing, even if the page
   is empty.
6. You should not see Team, Leads, Doulas, or the doula menu.
7. Try to open `/team`. You should be blocked.
8. Log out.
9. Open the contract email and the signing link if you are testing the
   signature. Signing does not charge a card.

**Pass if:** Ary sees only Ary’s profile and billing, and the contract link
opens.

| Pass | Fail | What I saw |
| ---- | ---- | ---------- |
| ☐    | ☐    |            |

---

## Story 11 — Wrong-door checks

1. As Nancy, copy `/team` from the address bar.
2. Log out.
3. Paste that address while logged out. You should be sent to Log In.
4. Signed in as Ary, open `/team`. You should not see the team list.
5. Signed in as Sam, open `/team`. Sam should not manage the whole team.

**Pass if:** the wrong hat cannot open the wrong room.

| Pass | Fail | What I saw |
| ---- | ---- | ---------- |
| ☐    | ☐    |            |

---

## What this practice run will not finish today

Write **N/A** instead of Fail for these. There is no button to force them.

- The day-3 “any questions?” signing reminder
- The day-7 cancel if the contract is still unsigned
- The admin notice if the contract is signed and the deposit is still unpaid
- Birth-outcome reminders (they start 5 days after the due date)
- The email that goes out when no note has been added for 7 days
- Inviting a billing-only teammate from Team
- A card charge
- Connecting QuickBooks, unless the person running the run says to

---

## End of run

Tester name: ______________________

Date: ______________________

1. What felt easy?
2. What felt confusing?
3. What was broken?
4. Are we ready to try this with real families?  
   ☐ Yes  ☐ Not yet  ☐ Not sure

Send this page, or photos of the checkboxes, back to the person running the
practice run.
