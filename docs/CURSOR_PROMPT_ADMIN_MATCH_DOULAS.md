# Frontend Implementation: Admin Doula Matching Feature

## Overview

Implement a UI in the **Admin Doulas Tab** that allows admins to match doulas
with clients. Only clients in the `'matching'` phase can be assigned to doulas.
This should be integrated into the existing doulas management interface, similar
to how the "Invite Doula" feature is implemented.

## Integration Location

**Primary Location:** Admin Dashboard > Doulas Tab

Add a "Match Client" button/action for each doula in the doulas list, similar to
how you might have an "Invite Doula" button. This keeps all doula management
actions in one place.

## API Endpoints

### 1. Get Matching Clients

```
GET /api/admin/clients/matching
Authorization: Bearer <admin_token>
```

**Response:**

```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "id": "client-uuid",
      "name": "Jane Doe",
      "email": "jane@example.com",
      "phoneNumber": "123-456-7890",
      "serviceNeeded": "Labor Support",
      "status": "matching",
      "dueDate": "2025-06-15",
      "hospital": "City Hospital",
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ]
}
```

### 2. Match Doula with Client

```
POST /api/admin/assignments/match
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "clientId": "client-uuid",
  "doulaId": "doula-uuid",
  "notes": "Optional assignment notes"
}
```

**Success Response (201):**

```json
{
  "success": true,
  "message": "Doula successfully matched with client",
  "data": {
    "assignment": {
      "id": "assignment-uuid",
      "clientId": "client-uuid",
      "doulaId": "doula-uuid",
      "assignedAt": "2025-12-08T20:00:00Z",
      "assignedBy": "admin-uuid",
      "notes": "Optional assignment notes",
      "status": "active"
    },
    "client": {
      "id": "client-uuid",
      "name": "Jane Doe",
      "status": "matching"
    },
    "doula": {
      "id": "doula-uuid",
      "name": "Sarah Smith",
      "email": "sarah@example.com"
    }
  }
}
```

**Error Responses:**

- `400`: Client not in matching phase, doula already assigned, invalid input
- `404`: Client or doula not found
- `403`: Not an admin
- `500`: Server error

## UI/UX Requirements

### 1. Location: Admin Doulas Tab

- **Primary Implementation:** Add to the existing Admin Doulas list/table
- Each doula row should have a "Match Client" button/action
- Opens a modal to select a client in matching phase
- Follows the same UI patterns as the "Invite Doula" feature

### 2. Recommended Implementation: Modal from Doula Row

**In the Doulas List/Table:**

- Add a "Match Client" button/icon in each doula's row
- Button opens a modal with:
  - Doula info display (read-only) at top
  - Client selection dropdown (shows only clients with status `'matching'`)
  - Optional notes textarea
  - Submit/Cancel buttons
- Modal follows same design patterns as Invite Doula modal

### 3. Client Selection

- Fetch list of clients in matching phase using:
  `GET /api/admin/clients/matching`
- Display client name, email, service needed, due date
- Support search/filter if many clients
- Show clear indication that only matching-phase clients are shown

### 4. User Feedback

- Loading states during API calls
- Success message/toast after successful match
- Error messages for validation failures
- Disable submit button while processing

## Implementation Guide

### Step 1: Create API Service Functions

```typescript
// services/adminService.ts or similar
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5050/api';

export const adminService = {
  // Get clients in matching phase
  async getMatchingClients(token: string) {
    const response = await axios.get(`${API_BASE}/admin/clients/matching`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  },

  // Match doula with client
  async matchDoulaWithClient(
    token: string,
    clientId: string,
    doulaId: string,
    notes?: string
  ) {
    const response = await axios.post(
      `${API_BASE}/admin/assignments/match`,
      { clientId, doulaId, notes },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  },

  // Get all doulas (if endpoint exists, otherwise use existing user endpoint)
  async getAllDoulas(token: string) {
    // Use existing endpoint or create new one
    const response = await axios.get(`${API_BASE}/users?role=doula`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  },
};
```

### Step 2: Create Match Client Modal Component

```typescript
// components/admin/MatchClientModal.tsx
// Follows same pattern as InviteDoulaModal
import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/adminService';
import { useAuth } from '../../contexts/AuthContext'; // Adjust to your auth context

interface MatchClientModalProps {
  doula: {
    id: string;
    firstname: string;
    lastname: string;
    email: string;
  };
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface Client {
  id: string;
  name: string;
  email: string;
  phoneNumber?: string;
  serviceNeeded?: string;
  dueDate?: string;
  status: string;
}

export const MatchClientModal: React.FC<MatchClientModalProps> = ({
  doula,
  isOpen,
  onClose,
  onSuccess
}) => {
  const { token } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [fetchingClients, setFetchingClients] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchMatchingClients();
    }
  }, [isOpen]);

  const fetchMatchingClients = async () => {
    try {
      setFetchingClients(true);
      const data = await adminService.getMatchingClients(token);
      setClients(data.data || []);
    } catch (err: any) {
      setError('Failed to load clients in matching phase');
      console.error(err);
    } finally {
      setFetchingClients(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedClientId) {
      setError('Please select a client');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await adminService.matchDoulaWithClient(
        token,
        selectedClientId,
        doula.id,
        notes.trim() || undefined
      );

      // Success
      onSuccess();
      onClose();
      // Show success toast/notification
      // Example: toast.success(`Successfully matched ${doula.firstname} ${doula.lastname} with client`);
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
        'Failed to match doula with client'
      );
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = clients.filter(client => {
    const name = client.name.toLowerCase();
    const email = client.email.toLowerCase();
    const search = searchTerm.toLowerCase();
    return name.includes(search) || email.includes(search);
  });

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Match Client to Doula</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* Doula Info */}
          <div className="doula-info">
            <h3>Doula Information</h3>
            <p><strong>Name:</strong> {doula.firstname} {doula.lastname}</p>
            <p><strong>Email:</strong> {doula.email}</p>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Client Selection */}
            <div className="form-group">
              <label htmlFor="client-select">
                Select Client (Matching Phase Only) <span className="required">*</span>
              </label>

              {fetchingClients ? (
                <div className="loading-state">Loading clients...</div>
              ) : clients.length === 0 ? (
                <div className="empty-state">
                  <p>No clients are currently in the matching phase.</p>
                  <p className="text-muted">Clients must have status 'matching' to be assigned to doulas.</p>
                </div>
              ) : (
                <>
                  {/* Search/Filter */}
                  <input
                    type="text"
                    placeholder="Search clients by name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="search-input"
                  />

                  <select
                    id="client-select"
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    required
                    disabled={loading}
                    className="form-select"
                  >
                    <option value="">-- Select a client --</option>
                    {filteredClients.map(client => (
                      <option key={client.id} value={client.id}>
                        {client.name} ({client.email})
                        {client.serviceNeeded && ` - ${client.serviceNeeded}`}
                        {client.dueDate && ` - Due: ${new Date(client.dueDate).toLocaleDateString()}`}
                      </option>
                    ))}
                  </select>

                  {selectedClientId && (
                    <div className="selected-client-info">
                      {(() => {
                        const selected = clients.find(c => c.id === selectedClientId);
                        return selected ? (
                          <div className="info-box">
                            <p><strong>Selected Client:</strong> {selected.name}</p>
                            <p><strong>Email:</strong> {selected.email}</p>
                            {selected.phoneNumber && <p><strong>Phone:</strong> {selected.phoneNumber}</p>}
                            {selected.serviceNeeded && <p><strong>Service:</strong> {selected.serviceNeeded}</p>}
                            {selected.dueDate && <p><strong>Due Date:</strong> {new Date(selected.dueDate).toLocaleDateString()}</p>}
                          </div>
                        ) : null;
                      })()}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Notes */}
            <div className="form-group">
              <label htmlFor="notes">Assignment Notes (Optional)</label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this assignment..."
                rows={4}
                className="form-textarea"
                disabled={loading}
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="alert alert-error">
                {error}
              </div>
            )}

            {/* Action Buttons */}
            <div className="modal-actions">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !selectedClientId || clients.length === 0}
                className="btn btn-primary"
              >
                {loading ? 'Matching...' : 'Match Client'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
```

### Step 3: Integrate into Client List/Profile

```typescript
// In your client list component
import { MatchDoulaModal } from '../components/admin/MatchDoulaModal';

const ClientList = () => {
  const [selectedClient, setSelectedClient] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleMatchDoula = (client) => {
    if (client.status === 'matching') {
      setSelectedClient(client);
      setIsModalOpen(true);
    }
  };

  const handleMatchSuccess = () => {
    // Refresh client list or update client status
    fetchClients();
    // Show success notification
  };

  return (
    <>
      {/* Client list */}
      {clients.map(client => (
        <div key={client.id} className="client-card">
          <h3>{client.name}</h3>
          <p>Status: {client.status}</p>

          {client.status === 'matching' && (
            <button
              onClick={() => handleMatchDoula(client)}
              className="btn btn-primary"
            >
              Match Doula
            </button>
          )}
        </div>
      ))}

      {/* Modal */}
      {selectedClient && (
        <MatchDoulaModal
          client={selectedClient}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedClient(null);
          }}
          onSuccess={handleMatchSuccess}
        />
      )}
    </>
  );
};
```

### Step 4: Alternative - Matching Page View

```typescript
// pages/admin/MatchingClients.tsx
import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/adminService';
import { MatchDoulaModal } from '../../components/admin/MatchDoulaModal';

export const MatchingClientsPage: React.FC = () => {
  const { token } = useAuth();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchMatchingClients();
  }, []);

  const fetchMatchingClients = async () => {
    try {
      setLoading(true);
      const data = await adminService.getMatchingClients(token);
      setClients(data.data || []);
    } catch (err) {
      console.error('Failed to fetch matching clients:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMatchSuccess = () => {
    fetchMatchingClients(); // Refresh list
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="matching-clients-page">
      <h1>Clients Ready for Matching</h1>
      <p>These clients are in the matching phase and can be assigned to doulas.</p>

      {clients.length === 0 ? (
        <div className="empty-state">
          <p>No clients are currently in the matching phase.</p>
        </div>
      ) : (
        <div className="clients-grid">
          {clients.map(client => (
            <div key={client.id} className="client-card">
              <h3>{client.name}</h3>
              <p><strong>Email:</strong> {client.email}</p>
              <p><strong>Phone:</strong> {client.phoneNumber}</p>
              <p><strong>Service:</strong> {client.serviceNeeded}</p>
              <p><strong>Due Date:</strong> {client.dueDate ? new Date(client.dueDate).toLocaleDateString() : 'N/A'}</p>

              <button
                onClick={() => {
                  setSelectedClient(client);
                  setIsModalOpen(true);
                }}
                className="btn btn-primary"
              >
                Match Doula
              </button>
            </div>
          ))}
        </div>
      )}

      {selectedClient && (
        <MatchDoulaModal
          client={selectedClient}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedClient(null);
          }}
          onSuccess={handleMatchSuccess}
        />
      )}
    </div>
  );
};
```

## Styling Recommendations

```css
/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  padding: 24px;
  max-width: 600px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  border-bottom: 1px solid #e0e0e0;
  padding-bottom: 16px;
}

.client-info {
  background: #f5f5f5;
  padding: 16px;
  border-radius: 4px;
  margin-bottom: 20px;
}

.search-input {
  width: 100%;
  padding: 8px;
  margin-bottom: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.form-select {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
}

.required {
  color: red;
}

.alert {
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 16px;
}

.alert-warning {
  background: #fff3cd;
  border: 1px solid #ffc107;
  color: #856404;
}

.alert-error {
  background: #f8d7da;
  border: 1px solid #f5c6cb;
  color: #721c24;
}
```

## Error Handling

Handle these specific error cases:

1. **Client not in matching phase:**

   - Show warning message
   - Disable submit button
   - Explain that client status must be 'matching'

2. **Doula already assigned:**

   - Show error message
   - Suggest viewing existing assignments

3. **Network errors:**

   - Show retry option
   - Log error for debugging

4. **Validation errors:**
   - Highlight required fields
   - Show inline error messages

## Testing Checklist

- [ ] Modal opens when "Match Doula" is clicked
- [ ] Only clients with status 'matching' show the button
- [ ] Doula list loads correctly
- [ ] Search/filter works for doulas
- [ ] Form validation works (required fields)
- [ ] Successful match shows success message
- [ ] Error messages display correctly
- [ ] Loading states work properly
- [ ] Modal closes on success
- [ ] Client list refreshes after successful match
- [ ] Notes field is optional and saves correctly

## Additional Considerations

1. **Get All Doulas Endpoint:**

   - If you don't have an endpoint to get all doulas, you may need to:
     - Use existing user endpoint with role filter
     - Create new endpoint: `GET /api/admin/doulas`
     - Or fetch from your user management system

2. **Assignment Management:**

   - Consider adding ability to view existing assignments
   - Add ability to unassign doulas if needed
   - Show assignment history

3. **Notifications:**

   - Consider sending notifications to doula when assigned
   - Notify client when doula is matched

4. **Status Updates:**
   - After matching, you may want to update client status
   - Consider moving client from 'matching' to 'interviewing' or 'active'

## Example API Call Flow

```typescript
// Complete flow example
const matchDoula = async () => {
  try {
    // 1. Get matching clients (optional - if using dedicated page)
    const matchingClients = await adminService.getMatchingClients(token);

    // 2. Get all doulas
    const doulas = await adminService.getAllDoulas(token);

    // 3. User selects client and doula, fills form

    // 4. Submit match
    const result = await adminService.matchDoulaWithClient(
      token,
      selectedClientId,
      selectedDoulaId,
      notes
    );

    // 5. Handle success
    console.log('Match successful:', result.data);
    // Refresh UI, show success message
  } catch (error) {
    // Handle error
    console.error('Match failed:', error);
  }
};
```

## Summary

This feature allows admins to:

1. View clients in the matching phase
2. Select a doula to match with a client
3. Add optional notes about the assignment
4. Create the assignment with proper validation

The backend enforces that only clients with status `'matching'` can be assigned,
ensuring data integrity.
