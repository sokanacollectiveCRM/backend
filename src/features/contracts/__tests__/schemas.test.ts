import {
  adminDraftBodySchema,
  adminResendBodySchema,
  adminSendBodySchema,
  adminVoidBodySchema,
  signingCompleteBodySchema,
  signingProgressBodySchema,
} from '../validation/schemas';

const baseDraft = {
  templateId: 'template-1',
  clientId: 'client-1',
  clientName: 'Ada Lovelace',
  clientEmail: 'ada@example.test',
  serviceType: 'Labor Support Services',
};

describe('admin contract schemas', () => {
  it('accepts a bounded draft and rejects unknown keys', () => {
    expect(adminDraftBodySchema.parse(baseDraft)).toMatchObject({
      ...baseDraft,
      selectedServices: [],
    });
    expect(
      adminDraftBodySchema.safeParse({ ...baseDraft, providerEnvelopeId: 'x' })
        .success
    ).toBe(false);
  });

  it('validates send, resend, and void bodies strictly', () => {
    expect(
      adminSendBodySchema.safeParse({
        subject: 'Please sign',
      }).success
    ).toBe(true);
    expect(adminResendBodySchema.safeParse({}).success).toBe(true);
    expect(
      adminVoidBodySchema.safeParse({
        reason: 'Created in error',
      }).success
    ).toBe(true);
    expect(
      adminVoidBodySchema.safeParse({
        reason: '',
      }).success
    ).toBe(false);
  });
});

describe('native signing schemas', () => {
  it('accepts partial progress with typed signature data', () => {
    expect(
      signingProgressBodySchema.safeParse({
        completedFieldIds: ['initials-1'],
      }).success
    ).toBe(true);
  });

  it('requires consent and completion of every required field', () => {
    const complete = {
      signature: {
        type: 'drawn' as const,
        dataUrl: 'data:image/png;base64,aGVsbG8=',
      },
      consent: true as const,
      initials: 'AL',
      completedFieldIds: ['signature-1', 'initials-1'],
    };

    expect(signingCompleteBodySchema.safeParse(complete).success).toBe(true);
    expect(signingCompleteBodySchema.safeParse(complete).success).toBe(true);
    expect(
      signingCompleteBodySchema.safeParse({ ...complete, consent: false })
        .success
    ).toBe(false);
  });

  it('rejects unbounded or malformed signature and ID payloads', () => {
    expect(
      signingProgressBodySchema.safeParse({
        contractId: '../contract',
        completedFieldIds: [],
      }).success
    ).toBe(false);
    expect(
      signingCompleteBodySchema.safeParse({
        signature: { type: 'drawn', dataUrl: 'data:image/svg+xml;base64,AAAA' },
        consent: true,
        initials: 'AL',
        completedFieldIds: [],
      }).success
    ).toBe(false);
  });
});
