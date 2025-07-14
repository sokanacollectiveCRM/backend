# Updated Request for Service API

## Simple Update: Enhanced Existing Endpoint

Your existing endpoint now handles all 10-step form fields!

## Endpoint

**POST** `/requestService/requestSubmission`

Same endpoint, enhanced functionality.

## Request Body

Now accepts all fields from your 10-step form:

```json
{
  // Step 1: Client Details
  "firstname": "Jane",
  "lastname": "Doe", 
  "email": "jane@example.com",
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

## Response

```json
{
  "message": "Form data received, onto processing"
}
```

## What Changed

1. **Database**: Added all missing fields to `client_info` table
2. **Validation**: Enhanced validation for all fields
3. **Same Endpoint**: Still uses `/requestService/requestSubmission`
4. **Backward Compatible**: Old form data still works

## Frontend Usage

No changes needed to your frontend! Just send all the form data to the same endpoint:

```javascript
const submitForm = async (formData) => {
  const response = await fetch('/requestService/requestSubmission', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(formData)
  });
  
  return response.json();
};
```

## Database Migration

Run this SQL in your Supabase SQL editor:

```sql
-- Add all missing fields to client_info table
-- (See scripts/update_client_info_table.sql for full script)
```

That's it! Your existing endpoint now handles all your 10-step form fields. 