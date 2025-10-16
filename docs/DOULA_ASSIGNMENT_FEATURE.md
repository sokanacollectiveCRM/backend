# Doula Assignment Feature - Implementation Guide

## 📋 Overview

The system already has a **doula-client assignment** infrastructure using an `assignments` table in the database. This document explains:
1. What's already working
2. What needs to be added
3. How to implement doula assignment in the frontend

---

## ✅ What's Already Working

### 1. **Database Structure**
- **`assignments` table** exists with:
  - `doula_id` (UUID) - References the doula's user ID
  - `client_id` (UUID) - References the client's ID from `client_info`

### 2. **Backend Functionality**
- ✅ Doulas can view **only their assigned clients** (filtered by `assignments` table)
- ✅ Admins can view **all clients**
- ✅ The `getClientIdsAssignedToDoula()` method fetches assigned client IDs

### 3. **Existing Endpoints**
```
GET /clients
- Returns all clients for admins
- Returns only assigned clients for doulas
```

---

## 🔧 What Needs to Be Added

### Backend Endpoints

#### 1. **Assign Doula to Client** (POST)
```typescript
POST /clients/:clientId/assign-doula
Body: { doulaId: "uuid" }
```

#### 2. **Unassign Doula from Client** (DELETE)
```typescript
DELETE /clients/:clientId/assign-doula/:doulaId
```

#### 3. **Get All Doulas** (GET)
```typescript
GET /team/doulas
Response: [
  {
    id: "uuid",
    firstname: "Jane",
    lastname: "Doe",
    email: "jane@example.com",
    profile_picture: "url",
    bio: "Experienced doula...",
    // ... other doula profile fields
  }
]
```

#### 4. **Get Assigned Doulas for a Client** (GET)
```typescript
GET /clients/:clientId/assigned-doulas
Response: {
  success: true,
  doulas: [
    {
      id: "uuid",
      firstname: "Jane",
      lastname: "Doe",
      assignedAt: "2025-10-15T20:00:00Z"
    }
  ]
}
```

---

## 🗄️ Database Schema

### Current `assignments` Table Structure
```sql
-- Check the current structure
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'assignments'
ORDER BY ordinal_position;
```

### Recommended Schema (if not already present)
```sql
CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doula_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES client_info(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  assigned_by UUID REFERENCES users(id), -- Admin who made the assignment
  notes TEXT, -- Optional notes about the assignment
  status VARCHAR(50) DEFAULT 'active', -- active, completed, cancelled
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(doula_id, client_id) -- Prevent duplicate assignments
);

-- Create index for faster lookups
CREATE INDEX idx_assignments_doula_id ON assignments(doula_id);
CREATE INDEX idx_assignments_client_id ON assignments(client_id);

-- Enable RLS
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can do everything on assignments"
  ON assignments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Doulas can view their own assignments"
  ON assignments
  FOR SELECT
  TO authenticated
  USING (doula_id = auth.uid());
```

---

## 💻 Backend Implementation

### Step 1: Create Assignment Repository

Create `/src/repositories/supabaseAssignmentRepository.ts`:

```typescript
import { SupabaseClient } from '@supabase/supabase-js';

export interface Assignment {
  id: string;
  doulaId: string;
  clientId: string;
  assignedAt: Date;
  assignedBy?: string;
  notes?: string;
  status: 'active' | 'completed' | 'cancelled';
}

export class SupabaseAssignmentRepository {
  private supabaseClient: SupabaseClient;

  constructor(supabaseClient: SupabaseClient) {
    this.supabaseClient = supabaseClient;
  }

  async assignDoula(clientId: string, doulaId: string, assignedBy?: string): Promise<Assignment> {
    const { data, error } = await this.supabaseClient
      .from('assignments')
      .insert({
        client_id: clientId,
        doula_id: doulaId,
        assigned_by: assignedBy,
        status: 'active'
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to assign doula: ${error.message}`);
    }

    return this.mapToAssignment(data);
  }

  async unassignDoula(clientId: string, doulaId: string): Promise<void> {
    const { error } = await this.supabaseClient
      .from('assignments')
      .delete()
      .eq('client_id', clientId)
      .eq('doula_id', doulaId);

    if (error) {
      throw new Error(`Failed to unassign doula: ${error.message}`);
    }
  }

  async getAssignedDoulas(clientId: string): Promise<any[]> {
    const { data, error } = await this.supabaseClient
      .from('assignments')
      .select(`
        id,
        doula_id,
        assigned_at,
        status,
        users!assignments_doula_id_fkey (
          id,
          firstname,
          lastname,
          email,
          profile_picture,
          bio
        )
      `)
      .eq('client_id', clientId)
      .eq('status', 'active');

    if (error) {
      throw new Error(`Failed to fetch assigned doulas: ${error.message}`);
    }

    return data;
  }

  async getAssignedClients(doulaId: string): Promise<string[]> {
    const { data, error } = await this.supabaseClient
      .from('assignments')
      .select('client_id')
      .eq('doula_id', doulaId)
      .eq('status', 'active');

    if (error) {
      throw new Error(`Failed to fetch assigned clients: ${error.message}`);
    }

    return data.map(a => a.client_id);
  }

  private mapToAssignment(data: any): Assignment {
    return {
      id: data.id,
      doulaId: data.doula_id,
      clientId: data.client_id,
      assignedAt: new Date(data.assigned_at),
      assignedBy: data.assigned_by,
      notes: data.notes,
      status: data.status
    };
  }
}
```

### Step 2: Add Controller Methods

Add to `/src/controllers/clientController.ts`:

```typescript
async assignDoula(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id: clientId } = req.params;
    const { doulaId } = req.body;

    if (!clientId || !doulaId) {
      res.status(400).json({ error: 'Missing clientId or doulaId' });
      return;
    }

    const assignment = await this.assignmentRepository.assignDoula(
      clientId,
      doulaId,
      req.user?.id
    );

    res.json({
      success: true,
      assignment
    });
  } catch (error) {
    const err = this.handleError(error, res);
    res.status(err.status).json({ error: err.message });
  }
}

async unassignDoula(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id: clientId, doulaId } = req.params;

    if (!clientId || !doulaId) {
      res.status(400).json({ error: 'Missing clientId or doulaId' });
      return;
    }

    await this.assignmentRepository.unassignDoula(clientId, doulaId);

    res.json({
      success: true,
      message: 'Doula unassigned successfully'
    });
  } catch (error) {
    const err = this.handleError(error, res);
    res.status(err.status).json({ error: err.message });
  }
}

async getAssignedDoulas(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id: clientId } = req.params;

    if (!clientId) {
      res.status(400).json({ error: 'Missing clientId' });
      return;
    }

    const doulas = await this.assignmentRepository.getAssignedDoulas(clientId);

    res.json({
      success: true,
      doulas
    });
  } catch (error) {
    const err = this.handleError(error, res);
    res.status(err.status).json({ error: err.message });
  }
}
```

### Step 3: Add Routes

Add to `/src/routes/clientRoutes.ts`:

```typescript
// Doula assignment routes
clientRoutes.post('/:id/assign-doula',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin']),
  (req, res) => clientController.assignDoula(req, res)
);

clientRoutes.delete('/:id/assign-doula/:doulaId',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin']),
  (req, res) => clientController.unassignDoula(req, res)
);

clientRoutes.get('/:id/assigned-doulas',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin', 'doula']),
  (req, res) => clientController.getAssignedDoulas(req, res)
);
```

### Step 4: Add Doula List Endpoint

Add to `/src/controllers/userController.ts`:

```typescript
async getAllDoulas(req: AuthRequest, res: Response): Promise<void> {
  try {
    const doulas = await this.userRepository.findUsersByRole('doula');

    res.json({
      success: true,
      doulas: doulas.map(d => ({
        id: d.id,
        firstname: d.firstname,
        lastname: d.lastname,
        email: d.email,
        profile_picture: d.profile_picture,
        bio: d.bio,
        phone_number: d.phone_number
      }))
    });
  } catch (error) {
    const err = this.handleError(error, res);
    res.status(err.status).json({ error: err.message });
  }
}
```

Add route to `/src/routes/clientRoutes.ts`:

```typescript
clientRoutes.get('/team/doulas',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin']),
  (req, res) => userController.getAllDoulas(req, res)
);
```

---

## 🎨 Frontend Implementation

### 1. **Doula Selection Dropdown in Client Profile**

```typescript
// In LeadProfileModal.tsx or ClientProfile.tsx

const [assignedDoulas, setAssignedDoulas] = useState([]);
const [availableDoulas, setAvailableDoulas] = useState([]);
const [selectedDoulaId, setSelectedDoulaId] = useState('');

// Fetch available doulas
useEffect(() => {
  const fetchDoulas = async () => {
    const response = await fetch('http://localhost:5050/clients/team/doulas', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();
    setAvailableDoulas(data.doulas);
  };
  fetchDoulas();
}, []);

// Fetch assigned doulas for this client
useEffect(() => {
  const fetchAssignedDoulas = async () => {
    const response = await fetch(
      `http://localhost:5050/clients/${clientId}/assigned-doulas`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await response.json();
    setAssignedDoulas(data.doulas);
  };
  fetchAssignedDoulas();
}, [clientId]);

// Assign doula
const handleAssignDoula = async () => {
  await fetch(`http://localhost:5050/clients/${clientId}/assign-doula`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ doulaId: selectedDoulaId })
  });
  // Refresh assigned doulas
};

// Unassign doula
const handleUnassignDoula = async (doulaId) => {
  await fetch(
    `http://localhost:5050/clients/${clientId}/assign-doula/${doulaId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  // Refresh assigned doulas
};
```

### 2. **UI Component Example**

```tsx
<div className="doula-assignment-section">
  <h3>Assigned Doulas</h3>

  {/* List of assigned doulas */}
  <div className="assigned-doulas-list">
    {assignedDoulas.map(doula => (
      <div key={doula.id} className="doula-card">
        <img src={doula.users.profile_picture} alt={doula.users.firstname} />
        <div>
          <p>{doula.users.firstname} {doula.users.lastname}</p>
          <small>Assigned {new Date(doula.assigned_at).toLocaleDateString()}</small>
        </div>
        <button onClick={() => handleUnassignDoula(doula.doula_id)}>
          Remove
        </button>
      </div>
    ))}
  </div>

  {/* Assign new doula */}
  <div className="assign-doula-form">
    <select
      value={selectedDoulaId}
      onChange={(e) => setSelectedDoulaId(e.target.value)}
    >
      <option value="">Select a doula...</option>
      {availableDoulas.map(doula => (
        <option key={doula.id} value={doula.id}>
          {doula.firstname} {doula.lastname}
        </option>
      ))}
    </select>
    <button onClick={handleAssignDoula} disabled={!selectedDoulaId}>
      Assign Doula
    </button>
  </div>
</div>
```

---

## 📸 Doula Profile Picture Upload

If you need to add profile picture upload for doulas:

### Backend (Already exists in user profile)
```typescript
// Profile picture is already stored in the users table
// You can update it via PUT /clients/:id with profile_picture field
```

### Frontend
```typescript
const handleProfilePictureUpload = async (file: File) => {
  // Option 1: Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from('profile-pictures')
    .upload(`doulas/${userId}/${file.name}`, file);

  if (!error) {
    const publicUrl = supabase.storage
      .from('profile-pictures')
      .getPublicUrl(data.path).data.publicUrl;

    // Update user profile with the URL
    await fetch(`http://localhost:5050/clients/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ profile_picture: publicUrl })
    });
  }
};
```

---

## 🚀 Next Steps

1. **Check Database Schema**: Run the SQL query to verify the `assignments` table structure
2. **Implement Backend**: Add the repository, controller methods, and routes
3. **Test Endpoints**: Use Postman or curl to test the new endpoints
4. **Implement Frontend**: Add the doula assignment UI to the client profile modal
5. **Add Permissions**: Ensure only admins can assign/unassign doulas

---

## 📝 Summary

**What's Working:**
- ✅ Doulas can only see their assigned clients
- ✅ Database structure exists (`assignments` table)

**What to Add:**
- 🔧 POST endpoint to assign doula to client
- 🔧 DELETE endpoint to unassign doula
- 🔧 GET endpoint to fetch all doulas
- 🔧 GET endpoint to fetch assigned doulas for a client
- 🔧 Frontend UI for doula assignment in client profile

Let me know which part you'd like to implement first!
