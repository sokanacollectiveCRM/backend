# Contract signing credential migration

## Summary

New invitation emails use fragment-based links that keep the invitation secret
in the browser only:

`https://<frontend>/signing#invitation=<credential>`

The frontend exchanges that credential once via `POST /signing/session/exchange`
(JSON body). All signing operations then use credential-free paths with an
in-memory `X-Signing-Session` header.

## Existing invitations

- **Already emailed path links** (`/signing/<credential>`) remain valid for one
  browser visit: the frontend legacy route immediately rewrites the URL to
  `/signing` and exchanges the credential over POST. The **first** request to
  frontend or backend path URLs may still appear in hosting logs; this cannot be
  undone retroactively.
- **Backend legacy API routes** (`GET/POST /signing/:token*`) now return **410
  Gone** with code `LEGACY_SIGNING_ROUTE`. Deploy frontend before or with
  backend so signers are not left on an old bundle that still calls token paths.
- **No bulk revoke/resend** is performed by this change. Operators may resend
  individual contracts from the CRM when a signer reports trouble.

## Transition timeline

1. Deploy backend migration `20260831_add_signing_access_sessions.sql`.
2. Deploy backend + frontend together.
3. New sends/resends use fragment links automatically.
4. After all active signers are on the new frontend (typically one invitation
   TTL), legacy frontend route `/signing/:token` may be removed in a follow-up.

## Post-deployment verification (synthetic only)

1. Create a test contract and capture the new `#invitation=` link from logs or
   admin tooling (do not use real client data).
2. Open the link in a private window; confirm the address bar becomes `/signing`
   with no credential visible.
3. Complete review/signing with synthetic data.
4. In Cloud Run request logs for **backend**, filter for the synthetic
   invitation UUID prefix and session UUID prefix — neither full credential
   should appear in `requestUrl` for `/signing/session/*` calls.
5. Confirm `GET /signing/<credential>` returns 410 without invoking signing
   logic.

## Remaining risks

- First click on old emailed path links still logs the credential once on the
  frontend load balancer.
- Page refresh after exchange loses the in-memory session; signers must reopen
  the email link (by design — no localStorage/sessionStorage).
- Cross-origin session transport relies on `X-Signing-Session`; cookies are
  intentionally not used to avoid third-party cookie blocking.
