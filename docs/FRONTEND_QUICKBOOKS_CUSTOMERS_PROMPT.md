# Frontend Development Prompt: QuickBooks Customers List in Dashboard

## 🎯 Objective

Implement a customers section in the dashboard that displays all customers from
QuickBooks Online. This will allow users to view their QuickBooks customer list
directly in the application.

## 📋 Requirements

### 1. API Endpoint

**Endpoint**: `GET /api/quickbooks/customers`

**Query Parameters** (optional):

- `maxResults` - Maximum number of customers to return (default: 100)

**Response Format**:

```typescript
interface QuickBooksCustomer {
  Id: string;
  DisplayName: string;
  GivenName?: string;
  FamilyName?: string;
  PrimaryEmailAddr?: {
    Address: string;
  };
  PrimaryPhone?: {
    FreeFormNumber?: string;
  };
  Balance?: number;
  BalanceWithJobs?: number;
  Active?: boolean;
}
```

**Example Response**:

```json
[
  {
    "Id": "1",
    "DisplayName": "John Doe",
    "GivenName": "John",
    "FamilyName": "Doe",
    "PrimaryEmailAddr": {
      "Address": "john@example.com"
    },
    "PrimaryPhone": {
      "FreeFormNumber": "555-1234"
    },
    "Balance": 0,
    "BalanceWithJobs": 0,
    "Active": true
  }
]
```

**Error Response** (if QuickBooks not connected):

```json
{
  "error": "Failed to fetch customers from QuickBooks",
  "message": "QuickBooks is not connected. Please connect QuickBooks first."
}
```

### 2. Implementation Location

Add this feature to the **existing Customers page** in the dashboard. The page
currently shows leads with a table structure (Name, Needs, Status, Action
columns).

**Integration Options:**

- **Option A (Recommended)**: Add a toggle/tab switcher at the top to switch
  between "Leads" view and "QuickBooks Customers" view
- **Option B**: Add QuickBooks customers as a separate section below the leads
  table
- **Option C**: Add a filter/dropdown to switch between "All Leads" and
  "QuickBooks Customers"

### 3. UI Components to Create

#### Main Component: `QuickBooksCustomersList` or `CustomersList`

**Features**:

- Display customers in a table or card layout
- Show customer information: Name, Email, Phone, Balance
- Loading state while fetching
- Error handling (show message if QuickBooks not connected)
- Empty state (no customers found)
- Refresh button to reload customers
- Optional: Search/filter functionality
- Optional: Pagination if many customers

#### Table Display Fields (Match Existing UI):

The table should match the existing Customers page design with these columns:

- **Name** (DisplayName) - bold header, left-aligned
- **Email** (PrimaryEmailAddr.Address) - or replace "Needs" column
- **Phone** (PrimaryPhone.FreeFormNumber) - optional column
- **Balance** (formatted as currency: $0.00) - or replace "Status" column
- **Status** (Active/Inactive) - match existing status styling
- **Action** - Optional action buttons (e.g., "View Details", "Sync")

**Note**: Match the existing table styling:

- Clean white background
- Dark gray/black text
- Green action buttons (if adding actions)
- Horizontal row separators
- Same spacing and typography as existing leads table

### 4. Implementation Steps

#### Step 1: Create API Service Function

Create or update your API service file (e.g.,
`src/services/api/quickbooksApi.ts` or similar):

```typescript
interface QuickBooksCustomer {
  Id: string;
  DisplayName: string;
  GivenName?: string;
  FamilyName?: string;
  PrimaryEmailAddr?: {
    Address: string;
  };
  PrimaryPhone?: {
    FreeFormNumber?: string;
  };
  Balance?: number;
  BalanceWithJobs?: number;
  Active?: boolean;
}

export async function getQuickBooksCustomers(
  maxResults?: number
): Promise<QuickBooksCustomer[]> {
  const url = maxResults
    ? `/api/quickbooks/customers?maxResults=${maxResults}`
    : '/api/quickbooks/customers';

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      // Add your auth headers here
      Authorization: `Bearer ${getAuthToken()}`, // Adjust based on your auth setup
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      error.message || 'Failed to fetch customers from QuickBooks'
    );
  }

  return response.json();
}
```

#### Step 2: Update Existing Customers Page Component

Modify your existing Customers page to include a view switcher and QuickBooks
customers table. The component should match your existing UI style.

```typescript
import React, { useState, useEffect } from 'react';
import { getQuickBooksCustomers } from '@/services/api/quickbooksApi';

interface QuickBooksCustomer {
  Id: string;
  DisplayName: string;
  GivenName?: string;
  FamilyName?: string;
  PrimaryEmailAddr?: {
    Address: string;
  };
  PrimaryPhone?: {
    FreeFormNumber?: string;
  };
  Balance?: number;
  BalanceWithJobs?: number;
  Active?: boolean;
}

export const CustomersPage: React.FC = () => {
  const [view, setView] = useState<'leads' | 'quickbooks'>('leads');
  const [qbCustomers, setQbCustomers] = useState<QuickBooksCustomer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Your existing leads state and logic here...
  // const [leads, setLeads] = useState([]);

  const fetchQuickBooksCustomers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getQuickBooksCustomers();
      setQbCustomers(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load customers from QuickBooks');
      console.error('Error fetching QuickBooks customers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (view === 'quickbooks') {
      fetchQuickBooksCustomers();
    }
  }, [view]);

  const formatCurrency = (amount: number | undefined) => {
    if (amount === undefined || amount === null) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  return (
    <div className="customers-page">
      {/* Page Header - Match existing style */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Customers</h1>

        {/* View Switcher - Add toggle buttons */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setView('leads')}
            className={`px-4 py-2 rounded ${
              view === 'leads'
                ? 'bg-green-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Leads
          </button>
          <button
            onClick={() => setView('quickbooks')}
            className={`px-4 py-2 rounded ${
              view === 'quickbooks'
                ? 'bg-green-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            QuickBooks Customers
          </button>
        </div>

        {/* Subtitle - Update based on view */}
        <p className="text-gray-600">
          {view === 'leads'
            ? 'Select a lead to convert to customer.'
            : 'View all customers from QuickBooks Online.'}
        </p>
      </div>

      {/* Leads View - Your existing leads table */}
      {view === 'leads' && (
        <div className="leads-table">
          {/* Your existing leads table component here */}
        </div>
      )}

      {/* QuickBooks Customers View */}
      {view === 'quickbooks' && (
        <div className="quickbooks-customers">
          {loading && (
            <div className="flex justify-center items-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              <span className="ml-2">Loading customers from QuickBooks...</span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-red-600">{error}</p>
              {error.includes('not connected') && (
                <button
                  onClick={() => window.location.href = '/dashboard?tab=quickbooks'}
                  className="mt-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Connect QuickBooks
                </button>
              )}
              <button
                onClick={fetchQuickBooksCustomers}
                className="mt-2 ml-2 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && qbCustomers.length === 0 && (
            <div className="text-center p-8 bg-white rounded border">
              <p className="text-gray-500 mb-4">No customers found in QuickBooks.</p>
              <button
                onClick={fetchQuickBooksCustomers}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Refresh
              </button>
            </div>
          )}

          {!loading && !error && qbCustomers.length > 0 && (
            <div className="bg-white rounded border">
              {/* Table - Match existing table styling */}
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-bold text-gray-900">Name</th>
                    <th className="text-left py-3 px-4 font-bold text-gray-900">Email</th>
                    <th className="text-left py-3 px-4 font-bold text-gray-900">Phone</th>
                    <th className="text-left py-3 px-4 font-bold text-gray-900">Balance</th>
                    <th className="text-left py-3 px-4 font-bold text-gray-900">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {qbCustomers.map((customer) => (
                    <tr key={customer.Id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 text-gray-900">
                        {customer.DisplayName}
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {customer.PrimaryEmailAddr?.Address || '—'}
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {customer.PrimaryPhone?.FreeFormNumber || '—'}
                      </td>
                      <td className="py-3 px-4 text-gray-900">
                        {formatCurrency(customer.Balance)}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 text-xs rounded ${
                          customer.Active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {customer.Active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Refresh button - Match existing button style */}
          {!loading && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={fetchQuickBooksCustomers}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Refresh
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
```

#### Step 3: Integration Notes

**Important**: This should be integrated into your **existing Customers page**,
not as a separate component.

**Integration Approach:**

1. Add a view switcher (toggle buttons) at the top of the Customers page
2. Keep your existing "Leads" view unchanged
3. Add the new "QuickBooks Customers" view that shows the QuickBooks data
4. Match the existing table styling exactly:
   - Same column header styling (bold, dark text)
   - Same row styling (border separators, hover effects)
   - Same spacing and padding
   - Same button styling (green buttons matching "Create Customer" style)

**Key Design Elements to Match:**

- Page title: Large, bold, dark font
- Subtitle: Gray text below title (update based on selected view)
- Table: Clean white background, border separators
- Buttons: Green background (#16a34a or your exact green), white text
- Text colors: Dark gray/black for primary text, lighter gray for secondary

### 5. Optional Enhancements

#### Search/Filter

```typescript
const [searchTerm, setSearchTerm] = useState('');

const filteredCustomers = customers.filter(
  (customer) =>
    customer.DisplayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.PrimaryEmailAddr?.Address.toLowerCase().includes(
      searchTerm.toLowerCase()
    )
);
```

#### Pagination

If you expect many customers, implement pagination:

- Use `maxResults` query parameter
- Add "Load More" or pagination controls
- Track current page/offset

#### Sorting

Add sorting by:

- Name (A-Z, Z-A)
- Balance (High to Low, Low to High)
- Status (Active first)

#### Customer Details Modal

Click on a customer row to see more details:

- Full customer information
- Payment history
- Invoices
- Contact information

### 6. Error Handling

Handle these scenarios:

1. **QuickBooks not connected**: Show message with link to connect
2. **Network error**: Show retry button
3. **Empty list**: Show friendly message
4. **Loading state**: Show spinner/skeleton

### 7. Styling Notes

- Use your existing design system/component library
- Ensure responsive design (mobile-friendly table)
- Match existing dashboard styling
- Use consistent spacing and typography

### 8. Testing Checklist

- [ ] Component loads and displays customers
- [ ] Loading state shows while fetching
- [ ] Error state shows when QuickBooks not connected
- [ ] Error state shows on network failure
- [ ] Empty state shows when no customers
- [ ] Refresh button works
- [ ] Table is responsive on mobile
- [ ] Currency formatting is correct
- [ ] Status badges display correctly
- [ ] Component handles missing optional fields gracefully

### 9. API Integration Notes

- **Authentication**: Ensure the API call includes proper auth headers (Bearer
  token, etc.)
- **Base URL**: Use your API base URL (e.g., `process.env.NEXT_PUBLIC_API_URL`
  or similar)
- **CORS**: Ensure backend allows requests from your frontend domain
- **Error Handling**: Parse error responses and display user-friendly messages

### 10. UI Design Specifications

**Match Existing Customers Page Styling:**

1. **Page Header:**

   - Large, bold title: "Customers" (text-3xl or similar)
   - Subtitle text in gray below title
   - View switcher buttons below subtitle

2. **Table Styling:**

   - White background
   - Border separators between rows (horizontal lines)
   - Header row: Bold, dark text
   - Row hover: Light gray background
   - Padding: Match existing table (py-3 px-4 or similar)

3. **Button Styling:**

   - Green buttons: Match your existing "Create Customer" button style
   - Background: Same green color (#16a34a or your exact shade)
   - White text
   - Rounded corners
   - Hover: Slightly darker green

4. **Color Palette:**

   - Primary text: Dark gray/black (#111827 or similar)
   - Secondary text: Medium gray (#6b7280 or similar)
   - Borders: Light gray (#e5e7eb or similar)
   - Green accent: Match existing green buttons

5. **Layout:**
   - Full width table
   - Left-aligned text in cells
   - Consistent spacing throughout
   - No rounded corners on table (sharp edges like existing)

## 📝 Summary

**Update your existing Customers page** to include QuickBooks customers:

1. **Add view switcher** - Toggle between "Leads" and "QuickBooks Customers"
   views
2. **Keep existing Leads view** - Don't modify the current leads functionality
3. **Add QuickBooks view** - New table showing QuickBooks customers
4. **Match existing UI exactly**:
   - Same table structure and styling
   - Same green button style
   - Same spacing, typography, and colors
   - Same page header format
5. **Table columns**: Name, Email, Phone, Balance, Status
6. **Handle states**: Loading, error (with QuickBooks connection prompt), empty
   state
7. **Add refresh button** - Match existing button styling

**Key Point**: This should feel like a natural extension of your existing
Customers page, not a separate feature. The UI should be indistinguishable from
your current design patterns.
