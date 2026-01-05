# Frontend Supabase Configuration for Portal Auth

## Required Environment Variables

Your frontend needs these environment variables to connect to Supabase for password setting and client login:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

## How to Get These Values

### Option 1: From Supabase Dashboard

1. Go to your Supabase project dashboard: https://app.supabase.com
2. Select your project
3. Go to **Settings** → **API**
4. You'll see:
   - **Project URL** → This is your `VITE_SUPABASE_URL`
   - **anon/public key** → This is your `VITE_SUPABASE_ANON_KEY`

### Option 2: From Backend .env File

Your backend `.env` file should have:
```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

**Important:**
- Use the same `SUPABASE_URL` for frontend `VITE_SUPABASE_URL`
- **DO NOT** use `SUPABASE_SERVICE_ROLE_KEY` in the frontend (security risk!)
- You need the **anon/public key** instead (found in Supabase Dashboard → Settings → API)

## Frontend Supabase Client Setup

Your frontend should have a Supabase client configured like this:

```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});
```

## Why Different Keys?

- **Backend (Service Role Key)**: Full access, bypasses RLS - used for admin operations
- **Frontend (Anon Key)**: Limited access, respects RLS - safe for client-side use

## Testing the Configuration

After setting up the environment variables, test the connection:

```typescript
// Test Supabase connection
const { data, error } = await supabase.auth.getSession();
console.log('Supabase connected:', !error);
```

## Security Notes

⚠️ **Never expose the service role key in frontend code!**
- The anon key is safe for frontend use
- The service role key should ONLY be used in backend/server code
- The anon key respects Row Level Security (RLS) policies

## Example .env File (Frontend)

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYxNjIzOTAyMiwiZXhwIjoxOTMxODE1MDIyfQ.example_signature

# Frontend URL (for redirects)
VITE_FRONTEND_URL=http://localhost:3001
```

## Quick Setup Checklist

- [ ] Get Supabase Project URL from dashboard
- [ ] Get Supabase anon/public key from dashboard
- [ ] Add `VITE_SUPABASE_URL` to frontend `.env`
- [ ] Add `VITE_SUPABASE_ANON_KEY` to frontend `.env`
- [ ] Restart frontend dev server
- [ ] Test Supabase connection
- [ ] Test password set flow
- [ ] Test client login flow
