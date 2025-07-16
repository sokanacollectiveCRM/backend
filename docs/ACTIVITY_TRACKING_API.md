# Activity Tracking API Documentation

This document describes the new activity tracking system for client management.

## Overview

The activity tracking system provides comprehensive logging of all client-related activities, including status changes, profile updates, and custom activity entries. This enables better client relationship management and audit trails.

## Database Schema

### Client Activities Table

```sql
CREATE TABLE client_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES client_info(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  description TEXT,
  metadata JSONB,
  timestamp TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);
```

### Auto-update Trigger

The `client_info` table already has an auto-update trigger that automatically updates the `updated_at` timestamp whenever any field is modified:

```sql
CREATE OR REPLACE FUNCTION update_client_info_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_client_info_updated_at 
    BEFORE UPDATE ON client_info 
    FOR EACH ROW 
    EXECUTE FUNCTION update_client_info_updated_at();
```

## API Endpoints

### 1. Update Client Status (Enhanced)

**PUT** `/clients/status`

Updates client status and automatically logs the activity.

**Headers:**
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "clientId": "uuid-here",
  "status": "contacted"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "client": {
    "id": "uuid-here",
    "status": "contacted",
    "updatedAt": "2025-01-15T10:30:00Z",
    "firstname": "Jane",
    "lastname": "Doe",
    "email": "jane@example.com",
    "role": "client",
    "serviceNeeded": "Labor Support",
    "requestedAt": "2025-01-10T09:00:00Z"
  },
  "activity": {
    "type": "status_change",
    "field": "status",
    "oldValue": "lead",
    "newValue": "contacted",
    "timestamp": "2025-01-15T10:30:00Z"
  }
}
```

### 2. Update Client Profile

**PUT** `/clients/{id}`

Updates client profile fields and logs changes.

**Headers:**
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "user": {
    "firstname": "Jane",
    "lastname": "Smith",
    "email": "jane.smith@example.com"
  },
  "serviceNeeded": "Postpartum Support"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "client": {
    "id": "uuid-here",
    "updatedAt": "2025-01-15T10:30:00Z",
    "firstname": "Jane",
    "lastname": "Smith",
    "email": "jane.smith@example.com",
    "role": "client",
    "status": "contacted",
    "serviceNeeded": "Postpartum Support",
    "requestedAt": "2025-01-10T09:00:00Z"
  },
  "activity": {
    "type": "profile_update",
    "changedFields": ["firstname", "lastname", "email", "serviceNeeded"],
    "timestamp": "2025-01-15T10:30:00Z"
  }
}
```

### 3. Create Custom Activity

**POST** `/clients/{id}/activity`

Creates a custom activity entry for a client.

**Headers:**
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "type": "note_added",
  "description": "Client called to discuss birth plan",
  "metadata": {
    "noteText": "Client prefers natural birth if possible",
    "category": "birth_planning",
    "contactMethod": "phone"
  }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "activity": {
    "id": "uuid-here",
    "clientId": "uuid-here",
    "type": "note_added",
    "description": "Client called to discuss birth plan",
    "metadata": {
      "noteText": "Client prefers natural birth if possible",
      "category": "birth_planning",
      "contactMethod": "phone"
    },
    "timestamp": "2025-01-15T10:30:00Z"
  }
}
```

## Activity Types

### System-Generated Activities

1. **`status_change`** - Automatically created when client status is updated
   - Metadata: `{ field: "status", oldValue: string, newValue: string }`

2. **`profile_update`** - Automatically created when client profile is updated
   - Metadata: `{ changedFields: string[] }`

### Custom Activity Types

1. **`note_added`** - General notes about the client
2. **`document_uploaded`** - When documents are uploaded
3. **`appointment_scheduled`** - When appointments are scheduled
4. **`contact_made`** - When contact is made with the client
5. **`profile_updated`** - Manual profile updates

## Database Migration

Run this SQL script in your Supabase SQL editor to create the activity tracking table:

```sql
-- Create client_activities table for activity tracking
CREATE TABLE IF NOT EXISTS client_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES client_info(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  description TEXT,
  metadata JSONB,
  timestamp TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_client_activities_client_id ON client_activities(client_id);
CREATE INDEX IF NOT EXISTS idx_client_activities_timestamp ON client_activities(timestamp);
CREATE INDEX IF NOT EXISTS idx_client_activities_type ON client_activities(type);

-- Enable Row Level Security
ALTER TABLE client_activities ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for activity access
CREATE POLICY IF NOT EXISTS "Users can view own client activities" ON client_activities
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM client_info 
            WHERE client_info.id = client_activities.client_id 
            AND client_info.user_id = auth.uid()
        )
    );

CREATE POLICY IF NOT EXISTS "Admins can view all client activities" ON client_activities
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

CREATE POLICY IF NOT EXISTS "Doulas can view assigned client activities" ON client_activities
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM assignments 
            WHERE assignments.client_id = client_activities.client_id 
            AND assignments.doula_id = auth.uid()
        )
    );

CREATE POLICY IF NOT EXISTS "Users can insert own client activities" ON client_activities
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM client_info 
            WHERE client_info.id = client_activities.client_id 
            AND client_info.user_id = auth.uid()
        )
    );

CREATE POLICY IF NOT EXISTS "Admins can insert all client activities" ON client_activities
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );
```

## Frontend Integration Examples

### Update Client Status

```javascript
const updateClientStatus = async (clientId, newStatus) => {
  try {
    const response = await fetch('/api/clients/status', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        clientId,
        status: newStatus
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('Status updated:', result.client);
      console.log('Activity logged:', result.activity);
      
      // Update UI with new status and activity
      updateClientInUI(result.client);
      addActivityToTimeline(result.activity);
    }
  } catch (error) {
    console.error('Error updating status:', error);
  }
};
```

### Update Client Profile

```javascript
const updateClientProfile = async (clientId, updateData) => {
  try {
    const response = await fetch(`/api/clients/${clientId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('Profile updated:', result.client);
      
      if (result.activity) {
        console.log('Changes tracked:', result.activity);
        addActivityToTimeline(result.activity);
      }
    }
  } catch (error) {
    console.error('Error updating profile:', error);
  }
};
```

### Create Custom Activity

```javascript
const createActivity = async (clientId, activityData) => {
  try {
    const response = await fetch(`/api/clients/${clientId}/activity`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(activityData)
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('Activity created:', result.activity);
      addActivityToTimeline(result.activity);
    }
  } catch (error) {
    console.error('Error creating activity:', error);
  }
};

// Example usage
createActivity('client-uuid', {
  type: 'note_added',
  description: 'Client called to discuss birth plan',
  metadata: {
    noteText: 'Client prefers natural birth if possible',
    category: 'birth_planning'
  }
});
```

## Benefits

1. **Complete Audit Trail** - Every client interaction is logged with timestamps
2. **Automatic Activity Logging** - Status changes and profile updates are automatically tracked
3. **Custom Activity Support** - Add custom activities for notes, documents, appointments, etc.
4. **Role-Based Access** - Different user roles can view appropriate activities
5. **Performance Optimized** - Indexed database queries for fast activity retrieval
6. **Flexible Metadata** - JSONB fields allow for rich activity data

## Security Features

1. **Row Level Security (RLS)** - Users can only access activities for their assigned clients
2. **Role-Based Access Control** - Admins can view all activities, doulas see assigned clients
3. **JWT Authentication** - All endpoints require valid authentication
4. **Input Validation** - Comprehensive validation of all activity data
5. **Audit Trail** - All activities are timestamped and linked to the user who created them

## Migration Notes

- The existing `PUT /clients/status` endpoint has been enhanced to include activity tracking
- The `updated_at` field in `client_info` is automatically updated via database trigger
- All new endpoints follow the existing authentication and authorization patterns
- Backward compatibility is maintained for existing client management functionality 