import {
  buildStandardIntakeTemplate,
  customTypeChangeAllowed,
  validateIntakeFormDefinition,
} from './validateIntakeFormDefinition';

describe('intake form definition', () => {
  const emptyLocks = new Map<string, string>();

  it('keeps first name, last name, and email or phone on the form', () => {
    const template = buildStandardIntakeTemplate();
    const withoutFirst = {
      ...template,
      steps: template.steps.map((step) => ({
        ...step,
        questions: step.questions.filter(
          (question) => question.key !== 'firstname'
        ),
      })),
    };
    expect(
      validateIntakeFormDefinition(withoutFirst, {
        lockedCustomTypes: emptyLocks,
      }).ok
    ).toBe(false);

    const withoutContact = {
      ...template,
      steps: template.steps.map((step) => ({
        ...step,
        questions: step.questions.filter(
          (question) =>
            question.key !== 'email' && question.key !== 'phone_number'
        ),
      })),
    };
    const missingContact = validateIntakeFormDefinition(withoutContact, {
      lockedCustomTypes: emptyLocks,
    });
    expect(missingContact.ok).toBe(false);

    const phoneOnly = {
      ...template,
      steps: template.steps.map((step) => ({
        ...step,
        questions: step.questions.filter(
          (question) => question.key !== 'email'
        ),
      })),
    };
    expect(
      validateIntakeFormDefinition(phoneOnly, { lockedCustomTypes: emptyLocks })
        .ok
    ).toBe(true);
  });

  it('rejects a standard question whose type is changed', () => {
    const template = buildStandardIntakeTemplate();
    const changed = {
      ...template,
      steps: template.steps.map((step) => ({
        ...step,
        questions: step.questions.map((question) =>
          question.key === 'email' ? { ...question, type: 'yes_no' } : question
        ),
      })),
    };
    const result = validateIntakeFormDefinition(changed, {
      lockedCustomTypes: emptyLocks,
    });
    expect(result.ok).toBe(false);
  });

  it('locks a custom type only after that organization has answers', () => {
    const draft = customDraft('short_text');
    const locked = new Map([['preferred_hospital', 'short_text']]);
    const changed = customDraft('long_text');
    expect(
      validateIntakeFormDefinition(changed, { lockedCustomTypes: locked }).ok
    ).toBe(false);
    expect(
      validateIntakeFormDefinition(draft, { lockedCustomTypes: locked }).ok
    ).toBe(true);
    expect(
      validateIntakeFormDefinition(changed, { lockedCustomTypes: emptyLocks })
        .ok
    ).toBe(true);
  });

  it('does not lock a custom key because another tenant stored answers', () => {
    const tenantALocks = new Map([['preferred_hospital', 'short_text']]);
    const tenantBLocks = new Map<string, string>();
    const nextType = 'long_text';
    expect(
      customTypeChangeAllowed({
        key: 'preferred_hospital',
        nextType,
        lockedCustomTypes: tenantALocks,
      })
    ).toBe(false);
    expect(
      customTypeChangeAllowed({
        key: 'preferred_hospital',
        nextType,
        lockedCustomTypes: tenantBLocks,
      })
    ).toBe(true);
  });

  it('rejects duplicate keys and unknown standard keys', () => {
    const template = buildStandardIntakeTemplate();
    const first = template.steps[0].questions[0];
    const duplicated = {
      logoAssetId: null,
      steps: [
        {
          id: 'only',
          title: 'Only',
          questions: [first, { ...first }],
        },
      ],
    };
    expect(
      validateIntakeFormDefinition(duplicated, {
        lockedCustomTypes: emptyLocks,
      }).ok
    ).toBe(false);

    const unknown = {
      logoAssetId: null,
      steps: [
        {
          id: 'only',
          title: 'Only',
          questions: [
            ...template.steps.flatMap((step) =>
              step.questions.filter((question) =>
                ['firstname', 'lastname', 'email'].includes(question.key)
              )
            ),
            {
              kind: 'standard',
              key: 'not_a_real_field',
              label: 'Nope',
              required: false,
              helpText: null,
            },
          ],
        },
      ],
    };
    expect(
      validateIntakeFormDefinition(unknown, { lockedCustomTypes: emptyLocks })
        .ok
    ).toBe(false);
  });

  it('keeps follow-up questions tied to the answer that shows them', () => {
    const template = buildStandardIntakeTemplate();
    const count = template.steps
      .flatMap((step) => step.questions)
      .find((question) => question.key === 'previous_pregnancies_count');
    expect(count?.showWhen).toEqual({
      questionKey: 'had_previous_pregnancies',
      equals: true,
    });

    const saved = validateIntakeFormDefinition(
      {
        ...template,
        steps: template.steps.map((step) => ({
          ...step,
          questions: step.questions.map((question) =>
            question.key === 'previous_pregnancies_count'
              ? {
                  ...question,
                  showWhen: { questionKey: 'firstname', equals: 'Ada' },
                }
              : question
          ),
        })),
      },
      { lockedCustomTypes: emptyLocks }
    );
    expect(saved.ok).toBe(true);
    if (saved.ok) {
      const kept = saved.definition.steps
        .flatMap((step) => step.questions)
        .find((question) => question.key === 'previous_pregnancies_count');
      expect(kept?.showWhen).toEqual({
        questionKey: 'had_previous_pregnancies',
        equals: true,
      });
    }
  });

  it('lets an admin hide optional core fields and keeps a name and a contact visible', () => {
    const template = buildStandardIntakeTemplate();
    const hiddenAddress = {
      ...template,
      steps: template.steps.map((step) => ({
        ...step,
        questions: step.questions.map((question) =>
          question.key === 'address'
            ? { ...question, hidden: true, required: false }
            : question
        ),
      })),
    };
    expect(
      validateIntakeFormDefinition(hiddenAddress, {
        lockedCustomTypes: emptyLocks,
      }).ok
    ).toBe(true);

    const hiddenName = {
      ...template,
      steps: template.steps.map((step) => ({
        ...step,
        questions: step.questions.map((question) =>
          question.key === 'firstname'
            ? { ...question, hidden: true }
            : question
        ),
      })),
    };
    expect(
      validateIntakeFormDefinition(hiddenName, {
        lockedCustomTypes: emptyLocks,
      }).ok
    ).toBe(false);
  });

  it('allows three image questions and rejects a fourth', () => {
    const base = customDraft('image');
    const extra = (key: string) => ({
      kind: 'custom' as const,
      key,
      label: key,
      required: false,
      helpText: null,
      type: 'image' as const,
      options: [],
    });
    const three = {
      ...base,
      steps: [
        {
          ...base.steps[0],
          questions: [
            ...base.steps[0].questions,
            extra('photo_two'),
            extra('photo_three'),
          ],
        },
      ],
    };
    expect(
      validateIntakeFormDefinition(three, { lockedCustomTypes: emptyLocks }).ok
    ).toBe(true);
    const four = {
      ...three,
      steps: [
        {
          ...three.steps[0],
          questions: [...three.steps[0].questions, extra('photo_four')],
        },
      ],
    };
    expect(
      validateIntakeFormDefinition(four, { lockedCustomTypes: emptyLocks }).ok
    ).toBe(false);
  });

  it('keeps placeholder text and a one- or two-column span', () => {
    const draft = customDraft('short_text');
    const withLayout = {
      ...draft,
      steps: draft.steps.map((step) => ({
        ...step,
        questions: step.questions.map((question) =>
          question.key === 'preferred_hospital'
            ? { ...question, placeholder: 'Hospital name', columns: 1 }
            : question.key === 'firstname'
              ? { ...question, placeholder: 'First', columns: 2 }
              : question
        ),
      })),
    };
    const result = validateIntakeFormDefinition(withLayout, {
      lockedCustomTypes: emptyLocks,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const hospital = result.definition.steps[0].questions.find(
      (question) => question.key === 'preferred_hospital'
    );
    const first = result.definition.steps[0].questions.find(
      (question) => question.key === 'firstname'
    );
    expect(hospital).toMatchObject({
      placeholder: 'Hospital name',
      columns: 1,
    });
    expect(first).toMatchObject({ placeholder: 'First', columns: 2 });
  });

  it('rejects a column span other than one or two', () => {
    const draft = customDraft('short_text');
    const invalid = {
      ...draft,
      steps: draft.steps.map((step) => ({
        ...step,
        questions: step.questions.map((question) =>
          question.key === 'preferred_hospital'
            ? { ...question, columns: 3 }
            : question
        ),
      })),
    };
    expect(
      validateIntakeFormDefinition(invalid, { lockedCustomTypes: emptyLocks })
        .ok
    ).toBe(false);
  });
});

function customDraft(type: string) {
  const template = buildStandardIntakeTemplate();
  const identity = template.steps.flatMap((step) =>
    step.questions.filter((question) =>
      ['firstname', 'lastname', 'phone_number'].includes(question.key)
    )
  );
  return {
    logoAssetId: null,
    steps: [
      {
        id: 'details',
        title: 'Details',
        questions: [
          ...identity,
          {
            kind: 'custom',
            key: 'preferred_hospital',
            label: 'Preferred hospital',
            required: false,
            helpText: null,
            type,
            options: [],
          },
        ],
      },
    ],
  };
}
