import { createHash } from 'crypto';
import express from 'express';
import request from 'supertest';

import { SigningController } from '../controllers/signingController';
import { createSigningRoutes } from '../routes/signingRoutes';
import {
  ContractInvitationRecord,
  InvalidInvitationError,
  InvitationRepository,
  InvitationService,
} from '../services/invitationService';
import { RateLimitService } from '../services/rateLimitService';
import {
  InvalidSigningAccessSessionError,
  SigningAccessSessionService,
  VerifiedSigningContext,
} from '../services/signingAccessSessionService';
import {
  SIGNING_SESSION_DOCUMENT_PATH,
  SigningInputError,
  SigningSessionRepository,
  SigningSessionService,
} from '../services/signingSessionService';

const INVITATION_SECRET = 'a'.repeat(43);
const INVITATION_ID = '11111111-1111-4111-8111-111111111111';
const INVITATION_TOKEN = `${INVITATION_ID}.${INVITATION_SECRET}`;
const SESSION_SECRET = 'b'.repeat(43);
const SESSION_ID = '22222222-2222-4222-8222-222222222222';
const SESSION_TOKEN = `${SESSION_ID}.${SESSION_SECRET}`;

function verifiedContext(
  overrides: Partial<VerifiedSigningContext> = {}
): VerifiedSigningContext {
  return {
    sessionId: SESSION_ID,
    invitationId: INVITATION_ID,
    contractId: 'contract-1',
    clientId: 'client-1',
    invitationExpiresAt: new Date(Date.now() + 60_000),
    sessionExpiresAt: new Date(Date.now() + 60_000),
    ...overrides,
  };
}

describe('SigningSessionService', () => {
  const invitations = {
    verify: jest.fn(),
    verifySessionInvitation: jest.fn(),
  };
  const rateLimits = {
    assertAllowed: jest.fn(),
  };
  const finalizer = {
    finalize: jest.fn(),
  };
  const documents = {
    signedReadUrl: jest.fn().mockResolvedValue('https://signed.test/document'),
    download: jest.fn().mockResolvedValue(Buffer.from('unsigned contract')),
  };
  let repository: jest.Mocked<SigningSessionRepository>;

  beforeEach(() => {
    documents.signedReadUrl
      .mockReset()
      .mockResolvedValue('https://signed.test/document');
    invitations.verifySessionInvitation.mockResolvedValue({
      invitation: {
        id: INVITATION_ID,
        expiresAt: new Date(Date.now() + 60_000),
      },
      contract: { id: 'contract-1', clientId: 'client-1', status: 'viewed' },
    });
    rateLimits.assertAllowed.mockResolvedValue(undefined);
    finalizer.finalize.mockResolvedValue({
      objectName: 'private/completed.pdf',
      sha256: 'a'.repeat(64),
      generation: '1',
      signatureObjectPath: null,
    });
    repository = {
      getContract: jest.fn().mockResolvedValue({
        id: 'contract-1',
        clientId: 'client-1',
        status: 'viewed',
        clientName: 'Client',
        serviceType: 'Labor Support Services',
        templateIdentifier: 'labor_support',
        templateVersion: 1,
        snapshot: {
          contractId: 'contract-1',
          templateId: 'labor_support',
          templateVersion: 1,
          serviceType: 'Labor Support Services',
          client: { id: 'client-1', name: 'Client', email: 'client@test' },
          fields: [],
          selectedServices: [],
          pricing: {
            servicesSubtotalCents: 100,
            discountRate: 0,
            discountCents: 0,
            servicesAfterDiscountCents: 100,
            adminFeeCents: 0,
            totalCents: 100,
            depositCents: 0,
            balanceCents: 100,
            installmentCents: [100],
          },
          createdAt: new Date().toISOString(),
        },
        unsignedPdfObject: 'private/unsigned.pdf',
        unsignedPdfSha256: 'a'.repeat(64),
        unsignedPdfGeneration: '1',
        signingManifest: [
          {
            id: 'signature',
            kind: 'signature',
            page: 1,
            required: true,
            coordinates: { x: 0, y: 0, width: 0.2, height: 0.1 },
          },
        ],
      }),
      getProgress: jest.fn().mockResolvedValue([]),
      recordFirstViewed: jest.fn().mockResolvedValue(undefined),
      saveProgress: jest
        .fn()
        .mockImplementation(
          async (_invitation, _contract, progress) => progress
        ),
      withCompletionLock: jest
        .fn()
        .mockImplementation(async (_invitation, work) => work({})),
      findSignedResult: jest.fn().mockResolvedValue(null),
      getContractForCompletion: jest.fn(),
      finalizeCompletion: jest.fn(),
    };
  });

  it('falls back to the session-protected PDF route when URL signing fails', async () => {
    documents.signedReadUrl.mockRejectedValueOnce(
      new Error('signBlob unavailable')
    );
    const service = new SigningSessionService(
      invitations as any,
      repository,
      rateLimits as any,
      finalizer,
      documents
    );

    await expect(service.get(verifiedContext())).resolves.toMatchObject({
      pdfUrl: SIGNING_SESSION_DOCUMENT_PATH,
    });
  });

  it('accepts only server-known progress fields and assigns server timestamps', async () => {
    const service = new SigningSessionService(
      invitations as any,
      repository,
      rateLimits as any,
      finalizer,
      documents
    );
    const result = await service.saveProgress(verifiedContext(), ['signature']);

    expect(result.progress[0].completedAt).toMatch(/Z$/);
    const persisted = repository.saveProgress.mock.calls[0][2][0];
    expect(persisted.completedAt).toBeInstanceOf(Date);
    await expect(
      service.saveProgress(verifiedContext(), ['unknown'])
    ).rejects.toBeInstanceOf(SigningInputError);
  });

  it('returns an existing signed result without finalizing another PDF', async () => {
    const existing = {
      contractId: 'contract-1',
      status: 'signed' as const,
      signedAt: new Date().toISOString(),
      signature: {
        id: 'signature-1',
        signerId: 'client-1',
        signerName: 'Client',
        type: 'typed' as const,
        signedAt: new Date().toISOString(),
        completedFieldIds: ['signature'],
      },
    };
    repository.findSignedResult.mockResolvedValue(existing);
    const service = new SigningSessionService(
      invitations as any,
      repository,
      rateLimits as any,
      finalizer,
      documents
    );

    await expect(
      service.complete(verifiedContext(), {
        initials: 'C',
        consent: true,
        signature: { type: 'typed', text: 'Client' },
        completedFieldIds: ['signature'],
      })
    ).resolves.toEqual(existing);
    expect(finalizer.finalize).not.toHaveBeenCalled();
    expect(repository.finalizeCompletion).not.toHaveBeenCalled();
  });

  it('denies cross-client contract access via context binding', async () => {
    const service = new SigningSessionService(
      invitations as any,
      repository,
      rateLimits as any,
      finalizer,
      documents
    );

    await expect(
      service.get(
        verifiedContext({ clientId: 'other-client', contractId: 'contract-1' })
      )
    ).rejects.toBeInstanceOf(SigningInputError);
  });
});

describe('SigningSessionService with InvitationService', () => {
  const contracts = {
    findInvitationContract: jest.fn(),
  };
  const rateLimits = {
    assertAllowed: jest.fn().mockResolvedValue(undefined),
  };
  const finalizer = {
    finalize: jest.fn(),
  };
  const documents = {
    signedReadUrl: jest.fn().mockResolvedValue('https://signed.test/document'),
    download: jest.fn(),
  };
  let invitationRows: Map<string, ContractInvitationRecord>;
  let invitationRepository: InvitationRepository;
  let invitationService: InvitationService;
  let sessionRepository: jest.Mocked<SigningSessionRepository>;
  let unsignedBytes: Buffer;
  let unsignedHash: string;

  beforeEach(() => {
    unsignedBytes = Buffer.from('unsigned contract');
    unsignedHash = createHash('sha256').update(unsignedBytes).digest('hex');
    documents.download.mockResolvedValue(unsignedBytes);

    invitationRows = new Map();
    invitationRepository = {
      findById: jest.fn(async (id) => invitationRows.get(id) ?? null),
      create: jest.fn(async (input) => {
        const row: ContractInvitationRecord = {
          ...input,
          revokedAt: null,
          createdAt: new Date(),
        };
        invitationRows.set(row.id, row);
        return row;
      }),
      replaceActive: jest.fn(async (_contractId, input) => {
        for (const row of invitationRows.values()) row.revokedAt = new Date();
        const replacement: ContractInvitationRecord = {
          ...input,
          revokedAt: null,
          createdAt: new Date(),
        };
        invitationRows.set(replacement.id, replacement);
        return replacement;
      }),
      expireContractForInvitation: jest.fn(),
    };
    invitationService = new InvitationService(invitationRepository, contracts);
    contracts.findInvitationContract.mockResolvedValue({
      id: 'contract-1',
      clientId: 'client-1',
      status: 'signed',
    });
    sessionRepository = {
      getContract: jest.fn().mockResolvedValue({
        id: 'contract-1',
        clientId: 'client-1',
        status: 'signed',
        clientName: 'Client',
        serviceType: 'Labor Support Services',
        templateIdentifier: 'labor_support',
        templateVersion: 1,
        snapshot: {
          contractId: 'contract-1',
          templateId: 'labor_support',
          templateVersion: 1,
          serviceType: 'Labor Support Services',
          client: { id: 'client-1', name: 'Client', email: 'client@test' },
          fields: [],
          selectedServices: [],
          pricing: {
            servicesSubtotalCents: 100,
            discountRate: 0,
            discountCents: 0,
            servicesAfterDiscountCents: 100,
            adminFeeCents: 0,
            totalCents: 100,
            depositCents: 0,
            balanceCents: 100,
            installmentCents: [100],
          },
          createdAt: new Date().toISOString(),
        },
        unsignedPdfObject: 'private/unsigned.pdf',
        unsignedPdfSha256: unsignedHash,
        unsignedPdfGeneration: '1',
        signingManifest: [
          {
            id: 'signature',
            kind: 'signature',
            page: 1,
            required: true,
            coordinates: { x: 0, y: 0, width: 0.2, height: 0.1 },
          },
        ],
      }),
      getProgress: jest.fn().mockResolvedValue([]),
      recordFirstViewed: jest.fn().mockResolvedValue(undefined),
      saveProgress: jest.fn(),
      withCompletionLock: jest
        .fn()
        .mockImplementation(async (_invitation, work) => work({})),
      findSignedResult: jest.fn(),
      getContractForCompletion: jest.fn(),
      finalizeCompletion: jest.fn(),
    };
  });

  function createService(): SigningSessionService {
    return new SigningSessionService(
      invitationService,
      sessionRepository,
      rateLimits as any,
      finalizer,
      documents
    );
  }

  it('rejects expired completed invitations for session and document access', async () => {
    const issued = await invitationService.issue('contract-1', 'client-1');
    issued.invitation.completedAt = new Date();
    issued.invitation.expiresAt = new Date(Date.now() - 1);
    createService();

    await expect(
      invitationService.verifySessionInvitation(issued.invitation.id)
    ).rejects.toBeInstanceOf(InvalidInvitationError);
    expect(sessionRepository.getContract).not.toHaveBeenCalled();
    expect(documents.download).not.toHaveBeenCalled();
    expect(
      invitationRepository.expireContractForInvitation
    ).not.toHaveBeenCalled();
  });

  it('allows completion confirmation retries before expiration', async () => {
    const issued = await invitationService.issue('contract-1', 'client-1');
    issued.invitation.completedAt = new Date();
    const existing = {
      contractId: 'contract-1',
      status: 'signed' as const,
      signedAt: new Date().toISOString(),
      signature: {
        id: 'signature-1',
        signerId: 'client-1',
        signerName: 'Client',
        type: 'typed' as const,
        signedAt: new Date().toISOString(),
        completedFieldIds: ['signature'],
      },
    };
    sessionRepository.findSignedResult.mockResolvedValue(existing);
    const service = createService();

    await expect(
      service.complete(
        verifiedContext({ invitationId: issued.invitation.id }),
        {
          initials: 'C',
          consent: true,
          signature: { type: 'typed', text: 'Client' },
          completedFieldIds: ['signature'],
        }
      )
    ).resolves.toEqual(existing);
    expect(finalizer.finalize).not.toHaveBeenCalled();
    expect(sessionRepository.finalizeCompletion).not.toHaveBeenCalled();
  });
});

describe('RateLimitService', () => {
  it('uses distributed invitation/token keys and an HMAC network bucket', async () => {
    const increment = jest.fn().mockResolvedValue(1);
    const limiter = new RateLimitService(
      { increment },
      'a-secret-with-at-least-thirty-two-bytes',
      10,
      60
    );

    await limiter.assertAllowed({
      invitationId: 'invitation-1',
      tokenFingerprint: 'token-hash',
      networkAddress: '203.0.113.10',
    });

    const keys = increment.mock.calls.map((call) => call[0]);
    expect(keys).toContain('invitation:invitation-1');
    expect(keys).toContain('token:token-hash');
    expect(keys.some((key) => key.includes('203.0.113.10'))).toBe(false);
  });
});

describe('signing routes security', () => {
  const signing = {
    get: jest.fn().mockResolvedValue({
      contractId: 'contract-1',
      pdfUrl: SIGNING_SESSION_DOCUMENT_PATH,
    }),
    saveProgress: jest.fn(),
    getDocument: jest.fn().mockResolvedValue(Buffer.from('pdf')),
    complete: jest.fn(),
  };
  const accessSessions = {
    exchange: jest.fn().mockResolvedValue({
      sessionToken: SESSION_TOKEN,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    }),
    authorize: jest.fn().mockResolvedValue(verifiedContext()),
  };
  const controller = new SigningController(
    signing as any,
    accessSessions as any
  );
  const app = express();
  app.use(express.json());
  app.use('/signing', createSigningRoutes(controller));

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exchanges invitations over POST without putting credentials in the URL', async () => {
    const response = await request(app)
      .post('/signing/session/exchange')
      .send({ invitation: INVITATION_TOKEN })
      .expect(200);

    expect(response.body.sessionToken).toBe(SESSION_TOKEN);
    expect(accessSessions.exchange).toHaveBeenCalledWith(
      INVITATION_TOKEN,
      expect.any(Object)
    );
    expect(JSON.stringify(response.body)).not.toContain(INVITATION_SECRET);
  });

  it('serves session routes with cache and referrer protections', async () => {
    const response = await request(app)
      .get('/signing/session')
      .set('X-Signing-Session', SESSION_TOKEN)
      .expect(200, {
        contractId: 'contract-1',
        pdfUrl: SIGNING_SESSION_DOCUMENT_PATH,
      });

    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['referrer-policy']).toBe('no-referrer');
    expect(signing.get).toHaveBeenCalled();
  });

  it('rejects legacy token-bearing routes with 410', async () => {
    const response = await request(app)
      .get(`/signing/${encodeURIComponent(INVITATION_TOKEN)}`)
      .expect(410);

    expect(response.body.code).toBe('LEGACY_SIGNING_ROUTE');
    expect(JSON.stringify(response.body)).not.toContain(INVITATION_SECRET);
    expect(signing.get).not.toHaveBeenCalled();
  });

  it('does not echo session tokens in error bodies', async () => {
    accessSessions.authorize.mockRejectedValueOnce(
      new InvalidSigningAccessSessionError()
    );

    const response = await request(app)
      .get('/signing/session')
      .set('X-Signing-Session', SESSION_TOKEN)
      .expect(401);

    expect(JSON.stringify(response.body)).not.toContain(SESSION_SECRET);
  });
});
