# Lead Request API Documentation

## Overview
The Lead Request API handles form submissions for doula services. This endpoint processes comprehensive 10-step forms and sends notification emails to administrators and confirmation emails to clients.

## Endpoint

### POST `/requestService/requestSubmission`

**Description:** Submit a new lead request for doula services

**Content-Type:** `application/json`

## Request Body

### Required Fields
```json
{
  "firstname": "string",           // Required - Client's first name
  "lastname": "string",           // Required - Client's last name
  "email": "string",              // Required - Valid email address
  "phone_number": "string",       // Required - Phone number (digits only)
  "service_needed": "string",     // Required - Service type from enum
  "address": "string",            // Required - Street address
  "city": "string",               // Required - City name
  "state": "string",              // Required - State code (2 letters)
  "zip_code": "string"            // Required - ZIP code (5 digits or 5+4 format)
}
```

### Optional Fields

#### Step 1: Client Details
```json
{
  "pronouns": "string",           // "he/him" | "she/her" | "they/them" | "other"
  "pronouns_other": "string",     // Custom pronouns if "other" selected
  "children_expected": "string"   // Free text
}
```

#### Step 2: Home Details
```json
{
  "home_phone": "string",         // Phone number
  "home_type": "string",          // "House" | "Apartment" | "Condo" | "Townhouse" | "Other"
  "home_access": "string",        // Free text
  "pets": "string"                // Free text
}
```

#### Step 3: Family Members
```json
{
  "relationship_status": "string", // "Single" | "Married" | "Partnered" | "Divorced" | "Widowed" | "Other"
  "first_name": "string",         // Partner's first name
  "last_name": "string",          // Partner's last name
  "middle_name": "string",        // Partner's middle name
  "mobile_phone": "string",       // Partner's mobile
  "work_phone": "string"          // Partner's work phone
}
```

#### Step 4: Referral
```json
{
  "referral_source": "string",    // Free text
  "referral_name": "string",      // Free text
  "referral_email": "string"      // Email format
}
```

#### Step 5: Health History
```json
{
  "health_history": "string",     // Free text
  "allergies": "string",          // Free text
  "health_notes": "string"        // Free text
}
```

#### Step 6: Payment Info
```json
{
  "annual_income": "string",      // Income level enum
  "service_specifics": "string"   // Free text
}
```

#### Step 7: Pregnancy/Baby
```json
{
  "due_date": "string",           // Date (ISO format or Date object)
  "birth_location": "string",     // Free text
  "birth_hospital": "string",     // Free text
  "number_of_babies": "number",   // Integer
  "baby_name": "string",          // Free text
  "provider_type": "string",      // "OB" | "Midwife" | "Family Physician" | "Other"
  "pregnancy_number": "number",   // Integer
  "hospital": "string"            // Free text
}
```

#### Step 8: Past Pregnancies
```json
{
  "had_previous_pregnancies": "boolean",     // true/false
  "previous_pregnancies_count": "number",    // Integer
  "living_children_count": "number",         // Integer
  "past_pregnancy_experience": "string"      // Free text
}
```

#### Step 9: Services Interested
```json
{
  "services_interested": ["string"],         // Array of strings
  "service_support_details": "string"        // Free text
}
```

#### Step 10: Client Demographics
```json
{
  "race_ethnicity": "string",               // Free text
  "primary_language": "string",             // Free text
  "client_age_range": "string",             // Age range enum
  "insurance": "string",                    // Free text
  "demographics_multi": ["string"]          // Array of strings
}
```

## Enums

### ServiceTypes
```typescript
enum ServiceTypes {
  LABOR_SUPPORT = "Labor Support",
  POSTPARTUM_SUPPORT = "Postpartum Support",
  PERINATAL_EDUCATION = "Perinatal Education",
  FIRST_NIGHT = "First Night Care",
  LACTATION_SUPPORT = "Lactation Support",
  PHOTOGRAPHY = "Photography",
  OTHER = "Other"
}
```

### HomeType
```typescript
enum HomeType {
  HOUSE = "House",
  APARTMENT = "Apartment",
  CONDO = "Condo",
  TOWNHOUSE = "Townhouse",
  OTHER = "Other"
}
```

### RelationshipStatus
```typescript
enum RelationshipStatus {
  SINGLE = "Single",
  MARRIED = "Married",
  PARTNERED = "Partnered",
  DIVORCED = "Divorced",
  WIDOWED = "Widowed",
  OTHER = "Other"
}
```

### ProviderType
```typescript
enum ProviderType {
  OB = "OB",
  MIDWIFE = "Midwife",
  FAMILY_PHYSICIAN = "Family Physician",
  OTHER = "Other"
}
```

### ClientAgeRange
```typescript
enum ClientAgeRange {
  UNDER_18 = "Under 18",
  AGE_18_24 = "18-24",
  AGE_25_34 = "25-34",
  AGE_35_44 = "35-44",
  AGE_45_54 = "45-54",
  AGE_55_PLUS = "55+"
}
```

### Pronouns
```typescript
enum Pronouns {
  HE_HIM = "he/him",
  SHE_HER = "she/her",
  THEY_THEM = "they/them",
  OTHER = "other"
}
```

### IncomeLevel
```typescript
enum IncomeLevel {
  FROM_0_TO_24999 = "$0 - $24,999",
  FROM_25000_TO_44999 = "$25,000 - $44,999",
  FROM_45000_TO_64999 = "$45,000 - $64,999",
  FROM_65000_TO_84999 = "$65,000 - $84,999",
  FROM_85000_TO_99999 = "$85,000 - $99,999",
  ABOVE_100000 = "$100,000 and above"
}
```

### STATE
```typescript
enum STATE {
  AL = "AL", AK = "AK", AZ = "AZ", AR = "AR", CA = "CA", CO = "CO",
  CT = "CT", DE = "DE", FL = "FL", GA = "GA", HI = "HI", ID = "ID",
  IL = "IL", IN = "IN", IA = "IA", KS = "KS", KY = "KY", LA = "LA",
  ME = "ME", MD = "MD", MA = "MA", MI = "MI", MN = "MN", MS = "MS",
  MO = "MO", MT = "MT", NE = "NE", NV = "NV", NH = "NH", NJ = "NJ",
  NM = "NM", NY = "NY", NC = "NC", ND = "ND", OH = "OH", OK = "OK",
  OR = "OR", PA = "PA", RI = "RI", SC = "SC", SD = "SD", TN = "TN",
  TX = "TX", UT = "UT", VT = "VT", VA = "VA", WA = "WA", WV = "WV",
  WI = "WI", WY = "WY"
}
```

## Validation Rules

### Required Field Validation
- `firstname` and `lastname` must be provided
- `email` must be a valid email format with `@` symbol
- `phone_number` must contain only digits (spaces/dashes removed)
- `service_needed` must be provided
- Complete address (`address`, `city`, `state`, `zip_code`) must be provided

### Format Validation
- **Email:** Must match pattern `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- **Phone:** Must match pattern `/^[\+]?[1-9][\d]{0,15}$/` (digits only)
- **ZIP Code:** Must match pattern `/^\d{5}(-\d{4})?$/` (5 digits or 5+4 format)

## Response

### Success Response (200)
```json
{
  "message": "Form data received, onto processing"
}
```

### Error Responses (400)
```json
{
  "error": "Missing required fields: first name and last name"
}
```
```json
{
  "error": "Valid email is required"
}
```
```json
{
  "error": "Phone number is required"
}
```
```json
{
  "error": "Complete address is required"
}
```
```json
{
  "error": "Invalid email format"
}
```
```json
{
  "error": "Invalid phone number format"
}
```
```json
{
  "error": "Invalid zip code format"
}
```

## Email Notifications

### Admin Notification Email
- **To:** `jerrybony5@gmail.com`
- **Subject:** "New Lead Submitted via Request Form"
- **Content:** Comprehensive HTML and text email with all form data organized in sections:
  - Client Details
  - Home Details
  - Family Members
  - Referral
  - Health History
  - Payment Info
  - Pregnancy/Baby
  - Past Pregnancies
  - Services Interested
  - Demographics
  - Form Submission Details (Submission Date + Status: "lead")

### Client Confirmation Email
- **To:** Client's email address
- **Subject:** "Request Received - We're Working on Your Match"
- **Content:** Confirmation message thanking the client for their submission

## Example Request

```json
{
  "firstname": "Jane",
  "lastname": "Doe",
  "email": "jane.doe@example.com",
  "phone_number": "555-123-4567",
  "service_needed": "Labor Support",
  "address": "123 Main St",
  "city": "Springfield",
  "state": "IL",
  "zip_code": "62704",
  "pronouns": "she/her",
  "home_phone": "555-987-6543",
  "home_type": "House",
  "home_access": "Front door, no stairs",
  "pets": "Dog",
  "relationship_status": "Partner",
  "referral_source": "Google",
  "referral_name": "Sokana",
  "referral_email": "referral@example.com",
  "health_history": "No significant health history",
  "allergies": "None",
  "health_notes": "Generally healthy",
  "due_date": "2024-06-15",
  "birth_hospital": "Springfield Memorial Hospital",
  "birth_location": "Hospital",
  "number_of_babies": 1,
  "baby_name": "Baby Doe",
  "provider_type": "OB/GYN",
  "pregnancy_number": 1,
  "had_previous_pregnancies": true,
  "previous_pregnancies_count": 2,
  "living_children_count": 2,
  "past_pregnancy_experience": "ok",
  "services_interested": ["Labor Support", "Postpartum Support"],
  "service_support_details": "Looking for comprehensive labor and postpartum support. Need help with labor techniques and overnight postpartum care for 2 weeks.",
  "race_ethnicity": "Caucasian/White",
  "primary_language": "English",
  "client_age_range": "26-35",
  "insurance": "Private",
  "demographics_multi": ["Annual income is less than $30,000"]
}
```

## Database Storage

The form data is stored in the database with the following structure:
- All form fields are saved to the `requests` table
- The record is automatically assigned a status of "lead"
- A unique ID is generated for each submission
- Timestamps are automatically added (`created_at`, `updated_at`)

## Error Handling

- **Email Failures:** If email sending fails, the form submission still succeeds
- **Validation Errors:** Return 400 status with specific error message
- **Database Errors:** Return 400 status with database error message
- **Service Errors:** Return 400 status with service error message

## Security Considerations

- Input validation prevents injection attacks
- Email addresses are validated before sending
- Phone numbers are sanitized
- ZIP codes are validated for proper format
- All optional fields are safely handled with null checks

## Testing

The endpoint includes comprehensive test coverage:
- Required field validation
- Optional field handling
- Email sending functionality
- Error scenarios
- Edge cases (long text, special characters, empty arrays)

## Dependencies

- **Express.js:** Web framework
- **Nodemailer:** Email service
- **Supabase:** Database
- **TypeScript:** Type safety
- **Jest:** Testing framework 