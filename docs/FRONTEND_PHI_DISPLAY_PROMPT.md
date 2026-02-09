# Frontend PHI Display Alignment – AI Prompt

Run this prompt in the **sokana-crm-frontend** repo to align the frontend with the backend's PHI (Protected Health Information) display rules.

---

## Prompt (copy and run in frontend repo)

```
The backend has been updated so that in production:
- GET /clients (list): Returns first_name, last_name, email for admin and for doulas (only for clients they're assigned to). Others get no PHI.
- GET /clients/:id (detail): Returns full PHI (names, email, phone, address, etc.) when the user is admin or an assigned doula.

Make these frontend changes:

1. **Leads/Clients table**
   - The table displays list data. In production, the list now includes first_name, last_name, email for authorized users (admin, assigned doulas).
   - Ensure the "Client" column uses: first_name + last_name, or email, or "Client {id}" as fallback when both are empty.
   - Ensure the "Contract" column uses service_needed (or serviceNeeded) from the list item. Map both snake_case and camelCase from the API.
   - The API returns snake_case (first_name, last_name, service_needed). The frontend mapClient and schema must handle both.

2. **LeadProfileModal (client detail modal)**
   - When the modal opens, it receives `client` from the parent. In production, when opened by clicking a table row, the row may have come from the list (which can now include names for authorized users).
   - When opened by URL (e.g. /clients/:id), RouteAwareLeadProfileLoader fetches GET /clients/:id and passes the full detail. Good.
   - When opened by row click: the parent passes currentRow (list item). The modal MUST also fetch GET /clients/:id when it opens, and use that as the primary source for display. Do not rely solely on the list row.
   - Fix: On modal open, if client.id exists, always call getClientById(client.id) and use the response as the primary data source for the form (detailSource). Merge into editedData so all fields (first_name, last_name, email, phone_number, service_needed, address, etc.) display correctly.
   - The current fallback only fetches when phone is missing and only merges phone + service_needed. Change it to always fetch on open and use the full response for display.
   - Handle both snake_case (first_name, last_name, phone_number) and camelCase (firstName, lastName, phoneNumber) from the API in getDisplayValue and editedData.

3. **Redaction**
   - Remove or fix any code that redacts [redacted] for email/phone in the detail modal when the user is viewing their own authorized client. The detail modal is for authorized users only – do not redact PHI there.
   - assertNoPhiInListRow / redactPhiForList should apply only to list rows (table), not to the detail modal content. The modal receives detail from GET /clients/:id, which is already gated by backend auth.

4. **Schema and mapping**
   - userListSchema and mapClient must accept list items that have first_name, last_name, email, service_needed (snake_case) or firstname, lastname, email (camelCase). Normalize to a consistent shape for the table.
   - mergeDetailFieldsIntoResult in Clients.tsx should map all relevant fields from the detail API response (snake_case) into the form keys (camelCase/snake_case) used by LeadProfileModal.

5. **Verification**
   - As admin: list shows client names; clicking a row opens modal with full contact info.
   - As assigned doula: list shows names for assigned clients only; modal shows full info for those clients.
   - As unassigned doula or other role: list shows "Client {id}"; clicking may open modal with limited or no PHI (backend enforces this).
```

---

## Summary of backend behavior

| User role    | List (GET /clients)                         | Detail (GET /clients/:id)     |
|-------------|---------------------------------------------|-------------------------------|
| Admin       | first_name, last_name, email for all clients| Full PHI                      |
| Assigned doula | first_name, last_name, email for assigned only | Full PHI for assigned     |
| Others      | No PHI (id, status, portal_status, etc.)    | No PHI                        |
