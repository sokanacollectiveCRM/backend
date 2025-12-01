# Frontend API URL Configuration Debug Prompt

## Issue

The production frontend (`https://sokanacrm.vercel.app`) is trying to call
`http://localhost:5050/quickbooks/disconnect` instead of the production backend
URL (`https://crmbackend-six-wine.vercel.app`).

This causes CORS errors because:

1. Production frontend cannot reach localhost (not accessible from the internet)
2. Local backend doesn't allow CORS from production frontend origin

## Task

Find where the API base URL is configured in the frontend and ensure it uses the
correct URL based on environment.

## What to Check

1. **Search for hardcoded localhost URLs:**

   - Search for: `localhost:5050`, `http://localhost:5050`, `localhost:5050`
   - Check if any API calls have hardcoded localhost URLs

2. **Find API base URL configuration:**

   - Look for environment variables like:
     - `NEXT_PUBLIC_API_URL`
     - `REACT_APP_API_URL`
     - `VITE_API_URL`
     - `API_URL`
     - `BASE_URL`
   - Check `.env`, `.env.local`, `.env.production` files
   - Check Vercel environment variables

3. **Check API client/axios configuration:**

   - Find where fetch/axios is configured
   - Look for base URL settings
   - Check if there's an API client wrapper or utility

4. **Check QuickBooks integration code:**

   - Find the file that calls `/quickbooks/disconnect`
   - Check how it constructs the URL
   - Verify if it uses a base URL or hardcoded path

5. **Verify environment variable usage:**
   - Check if the frontend reads environment variables correctly
   - Ensure production environment variables are set in Vercel
   - Verify the variable name matches what the code expects

## Expected Configuration

**Local Development:**

- API URL: `http://localhost:5050`

**Production:**

- API URL: `https://crmbackend-six-wine.vercel.app`

## What to Report

1. Where the API base URL is configured (file and line)
2. What environment variable is used (if any)
3. If there are any hardcoded localhost URLs
4. What the current production environment variable value is (in Vercel)
5. How the QuickBooks disconnect endpoint is being called

## Fix Required

The frontend should:

- Use `http://localhost:5050` in local development
- Use `https://crmbackend-six-wine.vercel.app` in production
- Read from environment variables, not hardcoded values
