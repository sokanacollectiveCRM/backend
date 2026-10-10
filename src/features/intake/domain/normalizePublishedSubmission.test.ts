import { ValidationError } from '../../../domains/errors';
import { resolveIntakeEditorTenant } from './intakeEditorAccess';
import { normalizePublishedIntakeSubmission } from './normalizePublishedSubmission';
import { buildStandardIntakeTemplate } from './validateIntakeFormDefinition';

describe('published intake submission', () => {
  it('accepts phone without email and stores custom answers beside standard fields', () => {
    const template = buildStandardIntakeTemplate();
    const definition = {
      logoAssetId: null,
      steps: [
        {
          id: 'details',
          title: 'Details',
          questions: [
            ...template.steps.flatMap((step) =>
              step.questions.filter((question) =>
                ['firstname', 'lastname', 'phone_number'].includes(question.key)
              )
            ),
            {
              kind: 'custom' as const,
              key: 'preferred_hospital',
              label: 'Preferred hospital',
              required: false,
              helpText: null,
              type: 'short_text' as const,
              options: [],
            },
          ],
        },
      ],
    };

    const prepared = normalizePublishedIntakeSubmission(
      {
        firstname: 'Ada',
        lastname: 'Lovelace',
        phone_number: '8015550100',
        preferred_hospital: 'University Hospital',
        is_test: true,
      },
      definition
    );

    expect(prepared.data.firstname).toBe('Ada');
    expect(prepared.data.email).toBe('');
    expect(prepared.customAnswers).toEqual({
      preferred_hospital: 'University Hospital',
    });
    expect(prepared.data).not.toHaveProperty('preferred_hospital');
  });

  it('rejects a lead with neither email nor phone', () => {
    const template = buildStandardIntakeTemplate();
    const definition = {
      logoAssetId: null,
      steps: [
        {
          id: 'details',
          title: 'Details',
          questions: template.steps.flatMap((step) =>
            step.questions.filter((question) =>
              ['firstname', 'lastname'].includes(question.key)
            )
          ),
        },
      ],
    };
    expect(() =>
      normalizePublishedIntakeSubmission(
        { firstname: 'Ada', lastname: 'Lovelace' },
        definition
      )
    ).toThrow(ValidationError);
  });
});

describe('intake editor access', () => {
  it('refuses doula, billing, and client even when they pass a tenant id', () => {
    for (const role of ['doula', 'billing', 'client']) {
      const decision = resolveIntakeEditorTenant({
        sessionRole: role,
        platformSupport: false,
        sessionTenantId: '11111111-1111-4111-8111-111111111111',
        requestedTenantId: '22222222-2222-4222-8222-222222222222',
      });
      expect(decision.ok).toBe(false);
      if (decision.ok === false) expect(decision.status).toBe(403);
    }
  });

  it('lets platform support choose a tenant and keeps org admins on their own', () => {
    const support = resolveIntakeEditorTenant({
      sessionRole: 'doula',
      platformSupport: true,
      sessionTenantId: null,
      requestedTenantId: '22222222-2222-4222-8222-222222222222',
    });
    expect(support).toEqual({
      ok: true,
      tenantId: '22222222-2222-4222-8222-222222222222',
      platformSupport: true,
    });

    const admin = resolveIntakeEditorTenant({
      sessionRole: 'admin',
      platformSupport: false,
      sessionTenantId: '11111111-1111-4111-8111-111111111111',
      requestedTenantId: '22222222-2222-4222-8222-222222222222',
    });
    expect(admin.ok).toBe(false);
  });
});
