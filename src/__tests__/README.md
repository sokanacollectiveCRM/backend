# Request Endpoint Testing

This directory contains comprehensive tests for the request endpoint (`/requestService/requestSubmission`).

## Test Coverage

The tests cover the following scenarios:

### ✅ Core Functionality
- **Successful form submission** - Tests complete form data submission
- **Missing request body** - Tests handling of requests without body
- **Empty request body** - Tests handling of empty JSON body
- **Service errors** - Tests graceful handling of database/service errors
- **Email errors** - Tests that form submission succeeds even when email fails

### ✅ Email Functionality
- **Correct recipient** - Verifies emails are sent to `jerrybony5@gmail.com`
- **Form data inclusion** - Verifies all form data is included in email content
- **Confirmation email** - Verifies confirmation email is sent to the person who submitted the request

### ✅ Edge Cases
- **Long text fields** - Tests handling of very long text inputs
- **Special characters** - Tests handling of special characters and Unicode
- **Empty arrays** - Tests handling of empty array fields
- **Optional fields** - Tests submission with minimal required fields

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Test Structure

### Mock Setup
- **Nodemailer** - Mocked to prevent actual emails during testing
- **Supabase** - Mocked to prevent database calls during testing
- **Service Layer** - Mocked to test controller behavior independently

### Test Data
The tests use comprehensive mock data that includes all 10 form steps:
1. Client Details (name, email, phone, pronouns)
2. Home Details (address, city, state, zip, home info)
3. Family Members (partner info, contact details)
4. Referral (source, referral contact)
5. Health History (medical info, allergies)
6. Payment Info (income, service needed)
7. Pregnancy/Baby (due date, birth location, baby info)
8. Past Pregnancies (previous experience, children count)
9. Services Interested (service preferences)
10. Demographics (race, language, age, insurance)

## Key Test Features

### Validation Testing
- Tests proper validation of required fields
- Tests email format validation
- Tests phone number format validation
- Tests zip code format validation

### Error Handling
- Tests graceful error handling without crashing
- Tests that email failures don't block form submission
- Tests proper HTTP status codes for different scenarios

### Email Content Verification
- Tests that email contains all submitted form data
- Tests both text and HTML email formats
- Tests correct email recipient and subject

### Edge Case Handling
- Tests very long text inputs
- Tests special characters and Unicode
- Tests empty arrays and optional fields
- Tests various data types (strings, numbers, booleans, arrays)

## Test Output

When tests pass, you should see:
```
PASS  src/__tests__/requestEndpoint.test.ts
  Request Endpoint Tests
    POST /requestService/requestSubmission
      ✓ should successfully submit a complete form
      ✓ should handle missing request body
      ✓ should handle empty request body
      ✓ should handle service errors gracefully
      ✓ should handle email sending errors without blocking form submission
      ✓ should handle optional fields correctly
    Email functionality
      ✓ should send email with correct recipient
      ✓ should include form data in email
      ✓ should send confirmation email to the person who submitted the request
    Edge cases
      ✓ should handle very long text fields
      ✓ should handle special characters in text fields
      ✓ should handle empty arrays

Test Suites: 1 passed, 1 total
Tests:       12 passed, 12 total
```

## Adding New Tests

To add new tests:

1. Add test cases to the appropriate `describe` block
2. Use the existing mock data structure
3. Mock the service layer as needed
4. Test both success and error scenarios
5. Verify email content when testing email functionality

## Dependencies

- **Jest** - Testing framework
- **Supertest** - HTTP testing library
- **Express** - Web framework for test server
- **TypeScript** - Type checking and compilation 