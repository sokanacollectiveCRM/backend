# Request for Service API Documentation

This document describes the API endpoints for the Request for Service form system.

## Base URL
```
https://your-api-domain.com/api
```

## Authentication
All endpoints require authentication using JWT tokens. Include the token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### 1. Submit Request Form
**POST** `/requests`

Submit a new request for service with all form data.

**Headers:**
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  // Step 1: Client Details
  "firstname": "Jane",
  "lastname": "Doe",
  "email": "jane.doe@example.com",
  "phone_number": "555-123-4567",
  "pronouns": "she/her",
  "pronouns_other": "custom pronouns",
  
  // Step 2: Home Details
  "address": "123 Main St",
  "city": "Anytown",
  "state": "CA",
  "zip_code": "90210",
  "home_phone": "555-987-6543",
  "home_type": "House",
  "home_access": "Front door accessible",
  "pets": "2 dogs, 1 cat",
  
  // Step 3: Family Members
  "relationship_status": "Married",
  "first_name": "John",
  "last_name": "Doe",
  "middle_name": "Michael",
  "mobile_phone": "555-456-7890",
  "work_phone": "555-789-0123",
  
  // Step 4: Referral
  "referral_source": "Friend",
  "referral_name": "Sarah Smith",
  "referral_email": "sarah@example.com",
  
  // Step 5: Health History
  "health_history": "Previous C-section",
  "allergies": "Latex allergy",
  "health_notes": "Gestational diabetes",
  
  // Step 6: Payment Info
  "annual_income": "$45,000 - $64,999",
  "service_needed": "Labor Support",
  "service_specifics": "Need overnight support",
  
  // Step 7: Pregnancy/Baby
  "due_date": "2024-06-15",
  "birth_location": "Hospital",
  "birth_hospital": "City General Hospital",
  "number_of_babies": 1,
  "baby_name": "Baby Doe",
  "provider_type": "OB",
  "pregnancy_number": 2,
  
  // Step 8: Past Pregnancies
  "had_previous_pregnancies": true,
  "previous_pregnancies_count": 1,
  "living_children_count": 1,
  "past_pregnancy_experience": "Emergency C-section",
  
  // Step 9: Services Interested
  "services_interested": ["Labor Support", "Postpartum Support"],
  "service_support_details": "Need help with breastfeeding",
  
  // Step 10: Client Demographics (Optional)
  "race_ethnicity": "Caucasian",
  "primary_language": "English",
  "client_age_range": "25-34",
  "insurance": "Blue Cross Blue Shield",
  "demographics_multi": ["First-time parent", "LGBTQ+"]
}
```

**Response (201 Created):**
```json
{
  "message": "Request form submitted successfully",
  "data": {
    "id": "uuid-here",
    "status": "pending",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z",
    "user_id": "user-uuid",
    "firstname": "Jane",
    "lastname": "Doe",
    // ... all other fields
  }
}
```

### 2. Get User's Requests
**GET** `/requests`

Get all requests submitted by the authenticated user.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response (200 OK):**
```json
{
  "message": "User requests retrieved successfully",
  "data": [
    {
      "id": "uuid-1",
      "status": "pending",
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z",
      "user_id": "user-uuid",
      "firstname": "Jane",
      "lastname": "Doe",
      // ... all other fields
    },
    {
      "id": "uuid-2",
      "status": "approved",
      // ... another request
    }
  ]
}
```

### 3. Get Specific Request
**GET** `/requests/:id`

Get a specific request by ID (user can only access their own requests).

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response (200 OK):**
```json
{
  "message": "Request retrieved successfully",
  "data": {
    "id": "uuid-here",
    "status": "pending",
    // ... all request fields
  }
}
```

**Response (404 Not Found):**
```json
{
  "error": "Request not found"
}
```

## Admin Endpoints

### 4. Get All Requests (Admin Only)
**GET** `/admin/requests`

Get all requests in the system (admin access required).

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response (200 OK):**
```json
{
  "message": "All requests retrieved successfully",
  "data": [
    {
      "id": "uuid-1",
      "status": "pending",
      // ... all request fields
    }
    // ... more requests
  ]
}
```

### 5. Get Specific Request (Admin Only)
**GET** `/admin/requests/:id`

Get a specific request by ID (admin can access any request).

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response (200 OK):**
```json
{
  "message": "Request retrieved successfully",
  "data": {
    "id": "uuid-here",
    "status": "pending",
    // ... all request fields
  }
}
```

### 6. Update Request Status (Admin Only)
**PATCH** `/admin/requests/:id/status`

Update the status of a request (admin only).

**Headers:**
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "status": "approved"
}
```

**Valid Status Values:**
- `pending` - Initial status
- `reviewing` - Under review
- `approved` - Approved
- `rejected` - Rejected
- `completed` - Completed

**Response (200 OK):**
```json
{
  "message": "Request status updated successfully",
  "data": {
    "id": "uuid-here",
    "status": "approved",
    // ... all request fields
  }
}
```

**Response (400 Bad Request):**
```json
{
  "error": "Invalid status value",
  "validStatuses": ["pending", "reviewing", "approved", "rejected", "completed"]
}
```

## Error Responses

### 401 Unauthorized
```json
{
  "error": "User not authenticated"
}
```

### 403 Forbidden
```json
{
  "error": "Admin access required"
}
```

### 400 Bad Request
```json
{
  "error": "Missing required fields: first name and last name"
}
```

### 500 Internal Server Error
```json
{
  "error": "Database query failed: connection error"
}
```

## Data Types

### Enums

**ServiceTypes:**
- `Labor Support`
- `Postpartum Support`
- `Perinatal Education`
- `First Night Care`
- `Lactation Support`
- `Photography`
- `Other`

**Pronouns:**
- `he/him`
- `she/her`
- `they/them`
- `other`

**RequestStatus:**
- `pending`
- `reviewing`
- `approved`
- `rejected`
- `completed`

**HomeType:**
- `House`
- `Apartment`
- `Condo`
- `Townhouse`
- `Other`

**RelationshipStatus:**
- `Single`
- `Married`
- `Partnered`
- `Divorced`
- `Widowed`
- `Other`

**ProviderType:**
- `OB`
- `Midwife`
- `Family Physician`
- `Other`

**ClientAgeRange:**
- `Under 18`
- `18-24`
- `25-34`
- `35-44`
- `45-54`
- `55+`

**IncomeLevel:**
- `$0 - $24,999`
- `$25,000 - $44,999`
- `$45,000 - $64,999`
- `$65,000 - $84,999`
- `$85,000 - $99,999`
- `$100,000 and above`

**STATE:**
- All US state abbreviations (AL, AK, AZ, etc.)

## Frontend Integration Example

```javascript
// Submit a new request
const submitRequest = async (formData) => {
  try {
    const response = await fetch('/api/requests', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('Request submitted:', result.data);
    } else {
      const error = await response.json();
      console.error('Error:', error.error);
    }
  } catch (error) {
    console.error('Network error:', error);
  }
};

// Get user's requests
const getUserRequests = async () => {
  try {
    const response = await fetch('/api/requests', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.ok) {
      const result = await response.json();
      return result.data;
    }
  } catch (error) {
    console.error('Error fetching requests:', error);
  }
};

// Update request status (admin only)
const updateRequestStatus = async (requestId, status) => {
  try {
    const response = await fetch(`/api/admin/requests/${requestId}/status`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('Status updated:', result.data);
    }
  } catch (error) {
    console.error('Error updating status:', error);
  }
};
```

## Database Schema

The requests are stored in a `requests` table with the following structure:

```sql
CREATE TABLE requests (
    id UUID PRIMARY KEY,
    -- Step 1: Client Details
    firstname VARCHAR(255) NOT NULL,
    lastname VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    pronouns VARCHAR(50),
    pronouns_other VARCHAR(100),
    
    -- Step 2: Home Details
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(2) NOT NULL,
    zip_code VARCHAR(10) NOT NULL,
    home_phone VARCHAR(20),
    home_type VARCHAR(100),
    home_access TEXT,
    pets TEXT,
    
    -- Step 3: Family Members
    relationship_status VARCHAR(100),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    middle_name VARCHAR(255),
    mobile_phone VARCHAR(20),
    work_phone VARCHAR(20),
    
    -- Step 4: Referral
    referral_source VARCHAR(255),
    referral_name VARCHAR(255),
    referral_email VARCHAR(255),
    
    -- Step 5: Health History
    health_history TEXT,
    allergies TEXT,
    health_notes TEXT,
    
    -- Step 6: Payment Info
    annual_income VARCHAR(100),
    service_needed VARCHAR(255) NOT NULL,
    service_specifics TEXT,
    
    -- Step 7: Pregnancy/Baby
    due_date DATE,
    birth_location VARCHAR(255),
    birth_hospital VARCHAR(255),
    number_of_babies INTEGER,
    baby_name VARCHAR(255),
    provider_type VARCHAR(100),
    pregnancy_number INTEGER,
    
    -- Step 8: Past Pregnancies
    had_previous_pregnancies BOOLEAN DEFAULT FALSE,
    previous_pregnancies_count INTEGER,
    living_children_count INTEGER,
    past_pregnancy_experience TEXT,
    
    -- Step 9: Services Interested
    services_interested TEXT[],
    service_support_details TEXT,
    
    -- Step 10: Client Demographics
    race_ethnicity VARCHAR(255),
    primary_language VARCHAR(100),
    client_age_range VARCHAR(50),
    insurance VARCHAR(255),
    demographics_multi TEXT[],
    
    -- System fields
    status VARCHAR(50) DEFAULT 'pending',
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Security Features

1. **Row Level Security (RLS)** - Users can only access their own requests
2. **JWT Authentication** - All endpoints require valid authentication
3. **Role-based Access** - Admin endpoints require admin role
4. **Input Validation** - Comprehensive validation of all form fields
5. **Rate Limiting** - Protection against abuse
6. **Error Logging** - Comprehensive error tracking

## Migration Notes

The new API replaces the legacy `/requestSubmission` endpoint while maintaining backward compatibility. The legacy endpoint will continue to work but is deprecated. 