/** A dedicated HR identity never inherits general CRM access, even on routes
 * which historically require authentication without a role allowlist. */
export function hrRequestAllowed(method: string, originalUrl: string): boolean {
  const path = originalUrl.split('?')[0];
  if (method === 'GET')
    return /^\/api\/hr\/doulas(?:\/[^/]+(?:\/documents(?:\/[^/]+\/url)?)?)?\/?$/.test(
      path
    );
  return (
    method === 'PATCH' &&
    /^\/api\/hr\/doulas\/[^/]+\/background-check\/?$/.test(path)
  );
}
