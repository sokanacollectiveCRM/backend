# Frontend prompt: QuickBooks Integration page UI update

## Objective

Update the **QuickBooks Integration** page (route: `/integrations/quickbooks`) so that:

1. **Loading state:** The loading indicator is **centered** in the middle of the viewport while the page is loading (e.g. while fetching connection status).
2. **Layout:** The main integration content (heading, status, Connect/Disconnect button) is **moved up** — less empty space above it, so the block sits higher on the page.
3. **Polish:** The section looks **cleaner and more intentional** (spacing, typography, card or container, alignment).

---

## Context

- **URL:** `/integrations/quickbooks`
- **Behavior:** Page fetches QuickBooks connection status (e.g. `GET /api/quickbooks/status` or equivalent). While loading, a spinner or skeleton is shown; when loaded, it shows “QuickBooks is currently disconnected” with a “Connect QuickBooks” button (or “Connected” with a “Disconnect” option).
- **Issue:** Loading indicator is not centered; there is too much space above the integration block; the block could look nicer.

---

## Requirements

### 1. Loading state

- **While loading** (e.g. `status === 'loading'` or `!status`):
  - Show a **single loading indicator** (spinner or skeleton).
  - **Center it in the viewport** (vertical and horizontal), e.g.:
    - Use flexbox: `display: flex; align-items: center; justify-content: center; min-height: 60vh` (or full viewport height) on a wrapper.
    - Or position the indicator in the middle of the main content area.
  - Avoid showing the “QuickBooks Integration” heading or Connect button until loading is done.

### 2. Layout — move integration up

- **When loaded:**
  - Reduce top spacing so the integration block is **higher on the page** (e.g. smaller `margin-top` or `padding-top` on the main content, or use a max-width container with less top gap).
  - Keep the block visually grouped (e.g. one card or container) and aligned (e.g. centered or left-aligned with a max width).

### 3. Polish

- **Visual:**
  - Use a card or bordered container for the integration block so it doesn’t float on a bare background.
  - Consistent spacing (e.g. padding 24–32px inside the card).
  - Clear hierarchy: one main heading (“QuickBooks Integration”), then status text, then primary action (Connect / Disconnect).
  - If the app has a design system (tokens, buttons, typography), use it for the button and text.
- **Responsiveness:** On small screens, the block should still be readable and the button tappable; avoid excessive width.

---

## Example structure (conceptual)

```tsx
// Loading: centered in viewport
if (loading) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <Spinner />  {/* or your app's loading component */}
    </div>
  );
}

// Loaded: content higher, in a card
return (
  <div className="container" style={{ marginTop: '1.5rem' }}>  {/* or less */}
    <div className="card" style={{ maxWidth: 480, margin: '0 auto', padding: '2rem' }}>
      <h1>QuickBooks Integration</h1>
      <p>{connected ? 'QuickBooks is connected.' : 'QuickBooks is currently disconnected.'}</p>
      <Button>{connected ? 'Disconnect' : 'Connect QuickBooks'}</Button>
    </div>
  </div>
);
```

Adjust class names and styles to match your app (Tailwind, MUI, CSS modules, etc.).

---

## Acceptance criteria

- [ ] While the page is loading, the only visible content is a loading indicator **centered** in the middle of the viewport (or main content area).
- [ ] After load, the integration block (heading + status + button) appears **higher** on the page than before (less top space).
- [ ] The integration block is in a card or container and looks **clean and consistent** with the rest of the app.

---

## Backend reference

- **Status:** `GET /api/quickbooks/status` or `GET /quickbooks/status` (auth required) — returns e.g. `{ connected: true }` or `{ connected: false }`.
- **Connect:** User is sent to auth URL (e.g. from `GET /api/quickbooks/auth/url` or `/quickbooks/auth` redirect); after OAuth, backend redirects to `FRONTEND_URL/integrations/quickbooks?quickbooks=connected`.
- **Disconnect:** `POST /api/quickbooks/disconnect` (auth required).

No backend changes are required for this UI update.
