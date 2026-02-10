# Frontend Implementation Prompt: PHI Profile Update

## Context

The backend now has a dedicated PHI endpoint that **only accepts PHI (Protected Health Information) fields** and updates Google Cloud SQL. This is separate from the general profile update endpoint.

### Backend Endpoints

**New Endpoint:**
- `PUT /clients/:id/phi` - Updates **ONLY** PHI fields (rejects operational fields)

**Existing Endpoint:**
- `PUT /clients/:id` - Updates both PHI and operational fields (auto-splits)

---

## Task: Implement PHI Profile Update in Frontend

### Requirements

1. **Update the client profile form** to use the new PHI endpoint when updating PHI fields
2. **Add proper error handling** for the new validation (rejects non-PHI fields)
3. **Show user-friendly error messages** when validation fails
4. **Maintain backward compatibility** with existing profile update flow

---

## PHI Fields (Accept these ONLY)

### Identity Fields
- `first_name` (string)
- `last_name` (string)
- `email` (string)
- `phone_number` (string)

### Date Fields
- `date_of_birth` (string, ISO 8601 format: "YYYY-MM-DD")
- `due_date` (string, ISO 8601 format: "YYYY-MM-DD")

### Address Fields
- `address_line1` (string)
- `address` (string, alias for address_line1)
- `city` (string)
- `state` (string)
- `zip_code` (string)
- `country` (string)

### Clinical/Health Fields
- `health_history` (string)
- `health_notes` (string)
- `allergies` (string)
- `medications` (string)

### ❌ Non-PHI Fields (These will be REJECTED)
- `status` - Use `PUT /clients/:id` instead
- `service_needed` - Use `PUT /clients/:id` instead
- `portal_status` - Use `PUT /clients/:id` instead
- Any other operational fields

---

## API Specifications

### Endpoint: `PUT /clients/:id/phi`

**Request Headers:**
```
Content-Type: application/json
Authorization: Bearer {token}
```

**Request Body Example:**
```json
{
  "first_name": "Jane",
  "last_name": "Doe",
  "phone_number": "555-1234",
  "email": "jane.doe@example.com",
  "health_history": "No known medical conditions",
  "allergies": "Peanuts, shellfish",
  "medications": "Prenatal vitamins"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "PHI fields updated successfully"
  }
}
```

**Error Response - Non-PHI Fields (400):**
```json
{
  "success": false,
  "error": "This endpoint only accepts PHI fields. Non-PHI fields not allowed: status, service_needed",
  "code": "VALIDATION_ERROR"
}
```

**Error Response - Unauthorized (403):**
```json
{
  "success": false,
  "error": "Not authorized to update PHI fields",
  "code": "FORBIDDEN"
}
```

**Error Response - Client Not Found (404):**
```json
{
  "success": false,
  "error": "Client not found",
  "code": "NOT_FOUND"
}
```

**Error Response - Empty Body (400):**
```json
{
  "success": false,
  "error": "No fields to update",
  "code": "VALIDATION_ERROR"
}
```

---

## Implementation Requirements

### 1. Create TypeScript Types

```typescript
// File: types/client.ts or types/phi.ts

/**
 * PHI (Protected Health Information) fields that can be updated
 * via PUT /clients/:id/phi endpoint
 */
export interface PhiUpdatePayload {
  // Identity
  first_name?: string;
  last_name?: string;
  email?: string;
  phone_number?: string;

  // Dates
  date_of_birth?: string; // ISO 8601 format
  due_date?: string;      // ISO 8601 format

  // Address
  address_line1?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;

  // Clinical
  health_history?: string;
  health_notes?: string;
  allergies?: string;
  medications?: string;
}

export interface PhiUpdateResponse {
  success: boolean;
  data?: {
    message: string;
  };
  error?: string;
  code?: string;
}
```

### 2. Create API Service Function

```typescript
// File: services/clientApi.ts or api/clients.ts

import { PhiUpdatePayload, PhiUpdateResponse } from '@/types/client';

/**
 * Update ONLY PHI fields for a client
 *
 * ⚠️ IMPORTANT: This endpoint rejects operational fields (status, service_needed, etc.)
 * If you need to update both PHI and operational fields, use updateClient() instead
 *
 * @param clientId - The client UUID
 * @param phiData - PHI fields to update
 * @returns Promise<PhiUpdateResponse>
 * @throws Error if request fails or validation fails
 */
export async function updateClientPhi(
  clientId: string,
  phiData: PhiUpdatePayload
): Promise<PhiUpdateResponse> {
  const response = await fetch(`/api/clients/${clientId}/phi`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`, // Replace with your auth method
    },
    body: JSON.stringify(phiData),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || 'Failed to update PHI');
  }

  return result;
}
```

### 3. Update Profile Form Component

**Requirement:**
- Detect which fields are being updated (PHI vs operational)
- Use `PUT /clients/:id/phi` if only PHI fields are present
- Use `PUT /clients/:id` if operational fields are present
- Show appropriate error messages

**Example Implementation (React/TypeScript):**

```typescript
// File: components/ClientProfileForm.tsx

import { useState } from 'react';
import { updateClientPhi, updateClient } from '@/services/clientApi';

export function ClientProfileForm({ clientId, initialData }) {
  const [formData, setFormData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Determine which fields have changed
  const getChangedFields = () => {
    const changes: Record<string, any> = {};
    for (const [key, value] of Object.entries(formData)) {
      if (value !== initialData[key]) {
        changes[key] = value;
      }
    }
    return changes;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const changes = getChangedFields();

    if (Object.keys(changes).length === 0) {
      setError('No changes detected');
      setLoading(false);
      return;
    }

    try {
      // Option 1: Always use PHI endpoint for PHI fields
      // (assumes this form only handles PHI fields)
      const result = await updateClientPhi(clientId, changes);

      if (result.success) {
        setSuccess(true);
        // Optional: Show toast notification
        console.log('✅', result.data?.message);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Update failed';
      setError(errorMessage);

      // Log for debugging
      console.error('PHI update failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Update Client Profile</h2>

      {/* Success Message */}
      {success && (
        <div className="alert alert-success">
          ✅ Profile updated successfully!
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="alert alert-error">
          ❌ {error}
        </div>
      )}

      {/* Personal Information Section */}
      <section>
        <h3>Personal Information</h3>

        <input
          type="text"
          name="first_name"
          placeholder="First Name"
          value={formData.first_name || ''}
          onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
          required
        />

        <input
          type="text"
          name="last_name"
          placeholder="Last Name"
          value={formData.last_name || ''}
          onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
          required
        />

        <input
          type="email"
          name="email"
          placeholder="Email"
          value={formData.email || ''}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        />

        <input
          type="tel"
          name="phone_number"
          placeholder="Phone Number"
          value={formData.phone_number || ''}
          onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
        />
      </section>

      {/* Address Section */}
      <section>
        <h3>Address</h3>

        <input
          type="text"
          name="address_line1"
          placeholder="Street Address"
          value={formData.address_line1 || ''}
          onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
        />

        <input
          type="text"
          name="city"
          placeholder="City"
          value={formData.city || ''}
          onChange={(e) => setFormData({ ...formData, city: e.target.value })}
        />

        <input
          type="text"
          name="state"
          placeholder="State"
          value={formData.state || ''}
          onChange={(e) => setFormData({ ...formData, state: e.target.value })}
        />

        <input
          type="text"
          name="zip_code"
          placeholder="ZIP Code"
          value={formData.zip_code || ''}
          onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
        />
      </section>

      {/* Health Information Section */}
      <section>
        <h3>Health Information</h3>

        <textarea
          name="health_history"
          placeholder="Health History"
          value={formData.health_history || ''}
          onChange={(e) => setFormData({ ...formData, health_history: e.target.value })}
          rows={4}
        />

        <textarea
          name="allergies"
          placeholder="Allergies"
          value={formData.allergies || ''}
          onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
          rows={3}
        />

        <textarea
          name="medications"
          placeholder="Current Medications"
          value={formData.medications || ''}
          onChange={(e) => setFormData({ ...formData, medications: e.target.value })}
          rows={3}
        />
      </section>

      {/* Submit Button */}
      <button type="submit" disabled={loading}>
        {loading ? 'Updating...' : 'Update Profile'}
      </button>
    </form>
  );
}
```

### 4. Advanced: Smart Endpoint Selection

If your form has both PHI and operational fields:

```typescript
// Utility function to determine which endpoint to use
function shouldUsePHIEndpoint(changedFields: Record<string, any>): boolean {
  const PHI_FIELDS = new Set([
    'first_name', 'last_name', 'email', 'phone_number',
    'date_of_birth', 'due_date',
    'address_line1', 'address', 'city', 'state', 'zip_code', 'country',
    'health_history', 'health_notes', 'allergies', 'medications'
  ]);

  const fieldKeys = Object.keys(changedFields);

  // Check if ALL changed fields are PHI fields
  return fieldKeys.every(key => PHI_FIELDS.has(key));
}

// In your form submit handler:
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  const changes = getChangedFields();

  try {
    if (shouldUsePHIEndpoint(changes)) {
      // Use PHI endpoint (strict validation)
      await updateClientPhi(clientId, changes);
    } else {
      // Use general endpoint (auto-splits PHI and operational)
      await updateClient(clientId, changes);
    }
    setSuccess(true);
  } catch (err) {
    setError(err.message);
  }
};
```

---

## Testing Requirements

### Manual Testing Checklist

- [ ] **Test valid PHI update**
  - Update first_name, last_name, phone_number
  - Verify success message appears
  - Verify data persists in database

- [ ] **Test health information update**
  - Update health_history, allergies, medications
  - Verify success message appears

- [ ] **Test address update**
  - Update address_line1, city, state, zip_code
  - Verify success message appears

- [ ] **Test error: mixed PHI + operational fields**
  - Try to update first_name + status in same request
  - Verify error message: "Non-PHI fields not allowed: status"

- [ ] **Test authorization**
  - Test as admin (should succeed)
  - Test as assigned doula (should succeed)
  - Test as unassigned doula (should fail with 403)
  - Test as client (should fail with 403)

- [ ] **Test empty form submission**
  - Submit without changes
  - Verify appropriate error message

- [ ] **Test invalid client ID**
  - Use invalid UUID
  - Verify 400 error

- [ ] **Test network error handling**
  - Disconnect network
  - Verify friendly error message

### Automated Testing (Optional)

```typescript
// Example Jest/Vitest test
describe('updateClientPhi', () => {
  it('should update PHI fields successfully', async () => {
    const result = await updateClientPhi('client-id', {
      first_name: 'Jane',
      phone_number: '555-1234'
    });

    expect(result.success).toBe(true);
    expect(result.data?.message).toBe('PHI fields updated successfully');
  });

  it('should reject non-PHI fields', async () => {
    await expect(
      updateClientPhi('client-id', {
        first_name: 'Jane',
        status: 'active' // Non-PHI field
      })
    ).rejects.toThrow('Non-PHI fields not allowed');
  });
});
```

---

## User Experience Considerations

### Success Messages
✅ "Profile updated successfully!"
✅ "Health information saved"
✅ "Contact details updated"

### Error Messages
❌ "This form can only update contact and health information. Please use the status update form to change client status."
❌ "You don't have permission to update this client's information."
❌ "Client not found. Please refresh the page."

### Loading States
- Show spinner or "Updating..." text during save
- Disable form inputs during submission
- Disable submit button during submission

### Validation
- Validate email format before submission
- Validate phone number format (if applicable)
- Validate required fields (first_name, last_name)

---

## Deliverables

1. **Updated API service** with `updateClientPhi()` function
2. **Updated TypeScript types** for PHI fields
3. **Updated profile form** using new endpoint
4. **Error handling** for new validation rules
5. **User-friendly error messages**
6. **Manual testing** completed (checklist above)

---

## Example Implementation Files

### File Structure
```
src/
├── types/
│   └── client.ts           # PhiUpdatePayload, PhiUpdateResponse types
├── services/
│   └── clientApi.ts        # updateClientPhi() function
├── components/
│   └── ClientProfileForm.tsx  # Updated form component
└── utils/
    └── phiValidation.ts    # Helper functions (optional)
```

---

## Questions to Consider

1. **Form Layout**: Should PHI and operational fields be in separate forms/tabs?
2. **Validation**: Do we need client-side validation for PHI fields before submission?
3. **Permissions**: How do we handle different user roles (admin vs doula)?
4. **Error Display**: Should we show field-level errors or form-level errors?
5. **Success Flow**: Should we redirect after successful update or stay on page?

---

## Additional Resources

- Backend implementation: `docs/PHI_ENDPOINT_IMPLEMENTATION_SUMMARY.md`
- Testing guide: `docs/PHI_ENDPOINT_TESTING.md`
- API verification script: `scripts/verify-phi-endpoint.ts`

---

## Implementation Notes

- The backend normalizes field names (camelCase → snake_case), so both formats work
- The endpoint validates authorization on every request (admin or assigned doula only)
- PHI updates are logged with audit trails (field counts, not values - HIPAA compliant)
- Identity fields (first_name, last_name, email, phone_number) are cached in Supabase for list views

---

**Ready to implement?** If you have questions about the implementation, refer to the testing guide or backend documentation listed above.
