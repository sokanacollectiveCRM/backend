# Why client details might not populate in the form

GET **/clients/:id** returns a **single merged client object** (Supabase + PHI Broker). If the form stays empty, the cause is almost always one of these two.

---

## 1. Using the wrong part of the response

The HTTP body is:

```json
{ "success": true, "data": { "id": "...", "first_name": "Test", "last_name": "Client", "email": "...", "phone_number": "+15551234567", "date_of_birth": "1990-01-15", "address_line1": "123 Test St", "due_date": "2025-06-01", ... } }
```

The **client** object is the value of **`data`**, not the whole body.

- With **axios**: `response.data` is the whole body, so the client is **`response.data.data`**.
- If your API client already unwraps and returns `body.data`, then that unwrapped value is the client.

**Fix:** Use the object at **`body.data`** (e.g. `response.data.data` with axios) as the source for the modal/form. Do not pass the full `{ success, data }` object into the form.

Example:

```ts
const res = await api.get('/clients/' + id);
const client = res.data?.data;   // client object for form
if (client) setFormSource(client);
```

---

## 2. Field names: backend is snake_case, form may expect camelCase

The backend returns **snake_case** keys, for example:

- `first_name`, `last_name`
- `email`, `phone_number`
- `date_of_birth`, `address_line1`, `due_date`
- `service_needed`, `portal_status`, `requested_at`, `updated_at`
- `health_history`, `allergies`, `medications`, etc.

If the form state or field names use **camelCase** (`firstName`, `phoneNumber`, `dateOfBirth`, `dueDate`, `addressLine1`, …), then the keys don’t match and the form won’t show the values.

**Fix (pick one):**

- **A)** Initialize form state from the client object by **mapping snake_case → camelCase** before calling `setState` / `setValues`, e.g.  
  `firstName: client.first_name`,  
  `phoneNumber: client.phone_number`,  
  `dateOfBirth: client.date_of_birth`,  
  `dueDate: client.due_date`,  
  `addressLine1: client.address_line1`,  
  etc.
- **B)** Use the **same snake_case keys** in the form state and in the form fields so you can use the client object as-is (e.g. `client.first_name`, `client.phone_number`).

---

## Quick check

1. In the browser, open the **Network** tab, call GET **/clients/ced55ced-c62c-48c0-81fb-353fe4a99cc4**, and inspect the response body. You should see `{ success: true, data: { ... } }` with snake_case fields inside `data`.
2. In the frontend, log the value you pass into the form (e.g. `detailSource` or `initialValues`). It should be the **object inside `data`**, and its keys should match what your form reads (either snake_case or after mapping to camelCase).

If both are correct, the form will populate.
