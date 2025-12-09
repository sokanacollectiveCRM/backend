# Run Assignments RLS Migration

## Problem
You're getting this error when trying to match doulas with clients:
```
Error: Failed to assign doula: new row violates row-level security policy for table "assignments"
```

## Solution
Run the RLS migration SQL in your Supabase SQL Editor.

## Steps

1. **Open Supabase Dashboard**
   - Go to your Supabase project dashboard
   - Navigate to SQL Editor

2. **Run the Migration**
   - Copy the contents of `src/db/migrations/fix_assignments_rls.sql`
   - Paste it into the SQL Editor
   - Click "Run" or press Cmd/Ctrl + Enter

3. **Verify the Migration**
   - The migration will output a verification query showing all created policies
   - You should see policies like:
     - "Admins can view all assignments"
     - "Admins can insert assignments"
     - "Admins can update assignments"
     - "Admins can delete assignments"
     - "Doulas can view own assignments"

## What This Migration Does

1. **Creates Security Definer Functions:**
   - `is_admin_user()` - Checks if the current user is an admin
   - `is_doula_user()` - Checks if the current user is a doula

2. **Creates RLS Policies:**
   - Admins can SELECT, INSERT, UPDATE, DELETE all assignments
   - Doulas can SELECT their own assignments (where `doula_id = auth.uid()`)

3. **Grants Permissions:**
   - Grants necessary permissions to authenticated users

## After Running

Once the migration is complete, the matching endpoint should work correctly. The admin will be able to create assignments, and doulas will be able to view their assigned clients.

## File Location
`src/db/migrations/fix_assignments_rls.sql`
