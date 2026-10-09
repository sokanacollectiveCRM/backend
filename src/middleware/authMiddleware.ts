import { NextFunction, Response } from 'express';

import { logger } from '../common/utils/logger';
import { SAFE_INTERNAL_ERROR_MESSAGE } from '../common/utils/safeLogging';
import {
  TENANT_HEADER,
  isTenancyEnforced,
  resolveTenantGate,
  runWithTenant,
} from '../features/tenancy';
import { identityTokenService } from '../index';
import { isCurrentAccountActive } from '../security/accountAccess';
import { recordAuthTransport } from '../security/authTransportTelemetry';
import {
  isEmailVerificationExemptRequest,
  roleRequiresVerifiedEmail,
} from '../security/emailVerificationPolicy';
import { ApiErrorCode } from '../security/errorCodes';
import { SESSION_COOKIE } from '../security/sessionCookies';
import { type AuthRequest, ROLE } from '../types';

/** Cookie and header names for session token (canonical). */
export { SESSION_COOKIE } from '../security/sessionCookies';
export const SESSION_HEADER = 'x-session-token';

export type SessionSource =
  | 'cookie'
  | 'header'
  | 'bearer'
  | 'legacy_session_cookie';

/**
 * Resolve session token from request.
 * Priority: sokana_session_token cookie, then X-Session-Token, then Authorization Bearer.
 * Body/query tokens are not accepted for API auth.
 */
export function getSessionToken(req: AuthRequest): string | undefined {
  return getSessionTokenAndSource(req).token;
}

/** For introspection / telemetry: which source provided the token. */
export function getSessionTokenAndSource(req: AuthRequest): {
  token?: string;
  source?: SessionSource;
} {
  if (req.cookies?.[SESSION_COOKIE]) {
    return { token: req.cookies[SESSION_COOKIE], source: 'cookie' };
  }
  const headerToken = req.headers[SESSION_HEADER] as string | undefined;
  if (headerToken && typeof headerToken === 'string' && headerToken.trim()) {
    return { token: headerToken.trim(), source: 'header' };
  }
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) return { token, source: 'bearer' };
  }
  return {};
}

function recordTokenSource(
  source: SessionSource | undefined,
  req: AuthRequest
): void {
  if (!source) return;
  if (source === 'cookie')
    recordAuthTransport('token_source.cookie', {
      path: req.path,
      method: req.method,
    });
  else if (source === 'header')
    recordAuthTransport('token_source.header', {
      path: req.path,
      method: req.method,
    });
  else if (source === 'bearer')
    recordAuthTransport('token_source.bearer', {
      path: req.path,
      method: req.method,
    });
  else if (source === 'legacy_session_cookie') {
    recordAuthTransport('token_source.legacy_session_cookie', {
      path: req.path,
      method: req.method,
    });
    recordAuthTransport('legacy.session_cookie_seen', {
      path: req.path,
      method: req.method,
    });
  }
}

const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Measure query-token attempts without accepting them for session auth.
    const queryToken =
      (typeof req.query?.access_token === 'string' && req.query.access_token) ||
      (typeof req.query?.token === 'string' && req.query.token);
    if (queryToken) {
      recordAuthTransport('legacy.query_access_token', {
        path: req.path,
        method: req.method,
      });
    }

    const { token, source } = getSessionTokenAndSource(req);

    if (!token) {
      logger.warn(
        {
          context: 'authMiddleware',
          path: req.path,
          method: req.method,
        },
        'No token provided'
      );
      res.status(401).json({
        error: 'No session token provided',
        code: ApiErrorCode.UNAUTHENTICATED,
        hint: 'Provide Cookie or X-Session-Token header',
      });
      return;
    }

    recordTokenSource(source, req);

    let user_entity;
    let emailVerified = true;
    try {
      const resolved = await identityTokenService.resolveSessionUser(token);
      user_entity = resolved.user;
      emailVerified = resolved.emailVerified;
    } catch (verifyError) {
      logger.warn(
        {
          context: 'authMiddleware',
          path: req.path,
          errMessage:
            verifyError instanceof Error ? verifyError.message : undefined,
        },
        'Invalid or expired token'
      );
      res.status(401).json({
        error: 'Invalid or expired session token',
        code: ApiErrorCode.UNAUTHENTICATED,
      });
      return;
    }

    if (
      !emailVerified &&
      roleRequiresVerifiedEmail(user_entity.role) &&
      !isEmailVerificationExemptRequest(req)
    ) {
      res.status(403).json({
        error: 'Verify your email before accessing this resource.',
        code: ApiErrorCode.EMAIL_NOT_VERIFIED,
      });
      return;
    }

    if (!(await isCurrentAccountActive(user_entity))) {
      logger.warn(
        {
          service: 'backend-authn',
          event: 'inactive_account_denied',
          userId: String(user_entity.id || ''),
          role: String(user_entity.role || '').toLowerCase(),
          method: req.method,
          path: req.path,
          status: 403,
        },
        'Inactive account denied'
      );
      res.status(403).json({
        error: 'Account is inactive',
        code: ApiErrorCode.FORBIDDEN,
      });
      return;
    }

    req.user = user_entity;
    const headerValue = req.header(TENANT_HEADER);
    const gate = await resolveTenantGate({
      userId: String(user_entity.id || ''),
      email: user_entity.email,
      requestedTenant: headerValue?.trim() || null,
      currentRole: user_entity.role ? String(user_entity.role) : null,
    });

    if (gate.action === 'deny') {
      logger.warn(
        {
          service: 'backend-authz',
          event: 'tenant_access_denied',
          userId: String(user_entity.id || ''),
          method: req.method,
          path: req.path,
          status: gate.status,
          errorCode: gate.code,
        },
        'Tenant access denied'
      );
      res.status(gate.status).json({
        error: gate.error,
        code: gate.code,
        ...(gate.tenants ? { tenants: gate.tenants } : {}),
      });
      return;
    }

    if (gate.action === 'attach') {
      req.tenant = gate.tenant;
      if (isTenancyEnforced()) {
        user_entity.role = gate.tenant.role as ROLE;
      }
      runWithTenant(gate.tenant.id, () => {
        next();
      });
      return;
    }

    next();
  } catch (err: any) {
    logger.error(
      { err, context: 'authMiddleware', path: req.path },
      'Middleware error'
    );
    res.status(500).json({
      error: SAFE_INTERNAL_ERROR_MESSAGE,
      code: ApiErrorCode.INTERNAL_ERROR,
    });
  }
};

export default authMiddleware;
