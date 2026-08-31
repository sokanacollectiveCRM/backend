import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'crypto';

import { nativeContracts } from '../../../config/env';
import {
  SigningAccessSessionRepository,
  hashSigningAccessToken,
} from '../repositories/signingAccessSessionRepository';
import { InvalidInvitationError, InvitationService } from './invitationService';
import { RateLimitService } from './rateLimitService';
import { RequestEvidence } from './signingSessionService';

export class InvalidSigningAccessSessionError extends Error {
  readonly statusCode = 401;

  constructor() {
    super('Signing session is invalid or unavailable');
  }
}

export interface ExchangedSigningAccessSession {
  sessionToken: string;
  expiresAt: string;
}

/** Bound invitation context derived from a valid access session. */
export interface VerifiedSigningContext {
  sessionId: string;
  invitationId: string;
  contractId: string;
  clientId: string;
  invitationExpiresAt: Date;
  sessionExpiresAt: Date;
}

export class SigningAccessSessionService {
  constructor(
    private readonly invitations: InvitationService,
    private readonly sessions: SigningAccessSessionRepository,
    private readonly rateLimits: RateLimitService,
    private readonly sessionTtlMs = nativeContracts.signingSessionTtlSeconds *
      1000
  ) {}

  async exchange(
    invitationToken: string,
    evidence: RequestEvidence = {}
  ): Promise<ExchangedSigningAccessSession> {
    const verified = await this.verifyInvitationForExchange(
      invitationToken,
      evidence.ipAddress
    );
    await this.sessions.revokeForInvitation(verified.invitation.id);
    const prepared = this.prepareSession();
    const sessionExpiresAt = this.sessionExpiresAt(
      verified.invitation.expiresAt
    );
    await this.sessions.create({
      id: prepared.id,
      invitationId: verified.invitation.id,
      tokenHash: prepared.tokenHash,
      expiresAt: sessionExpiresAt,
    });
    return {
      sessionToken: prepared.token,
      expiresAt: sessionExpiresAt.toISOString(),
    };
  }

  async authorize(
    sessionToken: string,
    evidence: RequestEvidence = {}
  ): Promise<VerifiedSigningContext> {
    const sessionId = this.extractSessionId(sessionToken);
    const session = await this.sessions.findById(sessionId);
    const presentedHash = hashSigningAccessToken(sessionToken);
    const storedHash = session?.tokenHash ?? Buffer.alloc(presentedHash.length);
    const hashMatches =
      storedHash.length === presentedHash.length &&
      timingSafeEqual(storedHash, presentedHash);

    if (!session || !hashMatches) {
      throw new InvalidSigningAccessSessionError();
    }
    if (session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
      throw new InvalidSigningAccessSessionError();
    }

    await this.rateLimits.assertAllowed({
      invitationId: session.invitationId,
      tokenFingerprint: presentedHash.toString('hex'),
      networkAddress: evidence.ipAddress,
    });

    const verified = await this.invitations.verifySessionInvitation(
      session.invitationId
    );

    await this.sessions.touchLastUsed(session.id);

    return {
      sessionId: session.id,
      invitationId: verified.invitation.id,
      contractId: verified.contract.id,
      clientId: verified.contract.clientId,
      invitationExpiresAt: verified.invitation.expiresAt,
      sessionExpiresAt: session.expiresAt,
    };
  }

  private async verifyInvitationForExchange(
    invitationToken: string,
    networkAddress?: string | null
  ) {
    const tokenFingerprint = createHash('sha256')
      .update(String(invitationToken), 'utf8')
      .digest('hex');
    const candidateId = String(invitationToken).split('.', 1)[0];
    await this.rateLimits.assertAllowed({
      invitationId: /^[0-9a-f-]{36}$/i.test(candidateId)
        ? candidateId
        : 'invalid',
      tokenFingerprint,
      networkAddress,
    });
    try {
      return await this.invitations.verify(invitationToken);
    } catch (error) {
      if (error instanceof InvalidInvitationError) throw error;
      throw error;
    }
  }

  private prepareSession(): {
    id: string;
    token: string;
    tokenHash: string;
  } {
    const id = randomUUID();
    const token = `${id}.${randomBytes(32).toString('base64url')}`;
    return {
      id,
      token,
      tokenHash: hashSigningAccessToken(token).toString('hex'),
    };
  }

  private sessionExpiresAt(invitationExpiresAt: Date): Date {
    const capped = new Date(Date.now() + this.sessionTtlMs);
    return capped.getTime() < invitationExpiresAt.getTime()
      ? capped
      : invitationExpiresAt;
  }

  private extractSessionId(sessionToken: string): string {
    if (typeof sessionToken !== 'string' || sessionToken.length > 512) {
      throw new InvalidSigningAccessSessionError();
    }
    const separator = sessionToken.indexOf('.');
    const id = separator > 0 ? sessionToken.slice(0, separator) : '';
    const secret = separator > 0 ? sessionToken.slice(separator + 1) : '';
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        id
      ) ||
      Buffer.from(secret, 'base64url').length < 32
    ) {
      throw new InvalidSigningAccessSessionError();
    }
    return id;
  }
}
