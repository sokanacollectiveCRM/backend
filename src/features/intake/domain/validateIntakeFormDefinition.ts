/**
 * Intake form definition shape and the rules that decide whether a draft
 * can be saved. Answers are not read here; the caller passes the custom
 * types already locked by this tenant's stored answers.
 */
import {
  CONTACT_IDENTITY_KEYS,
  CUSTOM_FIELD_TYPES,
  CustomFieldType,
  MAX_INTAKE_IMAGE_QUESTIONS,
  NAME_IDENTITY_KEYS,
  QuestionShowWhen,
  STANDARD_FIELD_BY_KEY,
  STANDARD_INTAKE_FIELDS,
  STANDARD_INTAKE_STEPS,
  StandardFieldDefinition,
} from './intakeFormCatalog';

export interface IntakeFormQuestionBase {
  key: string;
  label: string;
  required: boolean;
  helpText: string | null;
  /** Hidden questions stay in the draft so an admin can show them again. */
  hidden?: boolean;
  /** Follow-up questions stay tied to the answer that reveals them. */
  showWhen?: QuestionShowWhen;
  /** Grey hint inside an empty text field or dropdown. */
  placeholder?: string | null;
  /** 1 fills the row. 2 shares the row with another field. */
  columns?: 1 | 2;
}

export interface StandardIntakeQuestion extends IntakeFormQuestionBase {
  kind: 'standard';
  /** When set, these replace the catalog choices for this organization's form. */
  options?: string[];
}

export interface CustomIntakeQuestion extends IntakeFormQuestionBase {
  kind: 'custom';
  type: CustomFieldType;
  options: string[];
}

export type IntakeFormQuestion = StandardIntakeQuestion | CustomIntakeQuestion;

export interface IntakeFormStep {
  id: string;
  title: string;
  questions: IntakeFormQuestion[];
}

export interface IntakeFormDefinition {
  logoAssetId: string | null;
  steps: IntakeFormStep[];
}

export interface IntakeFormValidationContext {
  /**
   * Custom key -> type that already has answers for this tenant.
   * Another tenant's answers must not appear in this map.
   */
  lockedCustomTypes: ReadonlyMap<string, string>;
}

const MAX_STEPS = 20;
const MAX_QUESTIONS = 80;
const MAX_LABEL = 200;
const MAX_HELP = 500;
const MAX_PLACEHOLDER = 120;
const MAX_TITLE = 120;
const MAX_OPTIONS = 30;
const MAX_OPTION_LENGTH = 80;
const KEY_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

export function buildStandardIntakeTemplate(): IntakeFormDefinition {
  const questionsByStep = new Map<string, IntakeFormQuestion[]>();
  for (const step of STANDARD_INTAKE_STEPS) {
    questionsByStep.set(step.id, []);
  }
  for (const field of STANDARD_INTAKE_FIELDS) {
    const bucket = questionsByStep.get(field.stepId);
    if (!bucket) continue;
    bucket.push(standardQuestionFromCatalog(field));
  }
  return {
    logoAssetId: null,
    steps: STANDARD_INTAKE_STEPS.map((step) => ({
      id: step.id,
      title: step.title,
      questions: questionsByStep.get(step.id) ?? [],
    })),
  };
}

export function standardQuestionFromCatalog(
  field: StandardFieldDefinition
): StandardIntakeQuestion {
  return {
    kind: 'standard',
    key: field.key,
    label: field.defaultLabel,
    required: field.defaultRequired,
    helpText: field.defaultHelpText,
    ...(field.showWhen ? { showWhen: copyShowWhen(field.showWhen) } : {}),
  };
}

export function withStandardShowWhen(
  definition: IntakeFormDefinition
): IntakeFormDefinition {
  return {
    ...definition,
    steps: definition.steps.map((step) => ({
      ...step,
      questions: step.questions.map((question) => {
        if (question.kind !== 'standard') return question;
        const showWhen = STANDARD_FIELD_BY_KEY.get(question.key)?.showWhen;
        if (!showWhen) {
          if (!question.showWhen) return question;
          const { showWhen: _removed, ...rest } = question;
          return rest;
        }
        return { ...question, showWhen: copyShowWhen(showWhen) };
      }),
    })),
  };
}

function copyShowWhen(showWhen: QuestionShowWhen): QuestionShowWhen {
  return {
    questionKey: showWhen.questionKey,
    ...(showWhen.equals !== undefined ? { equals: showWhen.equals } : {}),
    ...(showWhen.includes !== undefined ? { includes: showWhen.includes } : {}),
    ...(showWhen.oneOf ? { oneOf: [...showWhen.oneOf] } : {}),
  };
}

export function listQuestionKeys(definition: IntakeFormDefinition): string[] {
  return definition.steps.flatMap((step) =>
    step.questions.map((question) => question.key)
  );
}

export type IntakeFormValidationResult =
  | { ok: true; definition: IntakeFormDefinition }
  | { ok: false; error: string };

export function validateIntakeFormDefinition(
  input: unknown,
  context: IntakeFormValidationContext
): IntakeFormValidationResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'The form definition is missing.' };
  }
  const raw = input as Record<string, unknown>;
  const logo = raw.logoAssetId;
  if (logo !== null && typeof logo !== 'string') {
    return { ok: false, error: 'The logo must be an uploaded image or empty.' };
  }
  const logoAssetId = typeof logo === 'string' ? logo.trim() : null;
  if (logoAssetId !== null && !/^[0-9a-f-]{36}$/i.test(logoAssetId)) {
    return { ok: false, error: 'The logo reference is not valid.' };
  }

  if (!Array.isArray(raw.steps) || raw.steps.length === 0) {
    return { ok: false, error: 'Add at least one step.' };
  }
  if (raw.steps.length > MAX_STEPS) {
    return { ok: false, error: `A form can have at most ${MAX_STEPS} steps.` };
  }

  const steps: IntakeFormStep[] = [];
  const seenStepIds = new Set<string>();
  const seenKeys = new Set<string>();
  let questionCount = 0;

  for (const stepValue of raw.steps) {
    const parsed = parseStep(stepValue, seenStepIds, seenKeys);
    if (parsed.ok === false) return parsed;
    questionCount += parsed.step.questions.length;
    if (questionCount > MAX_QUESTIONS) {
      return {
        ok: false,
        error: `A form can have at most ${MAX_QUESTIONS} questions.`,
      };
    }
    steps.push(parsed.step);
  }

  const visibleQuestions = steps.flatMap((step) =>
    step.questions.filter((question) => question.hidden !== true)
  );
  const visibleKeys = new Set(visibleQuestions.map((question) => question.key));
  for (const key of NAME_IDENTITY_KEYS) {
    if (!visibleKeys.has(key)) {
      const label = STANDARD_FIELD_BY_KEY.get(key)?.defaultLabel ?? key;
      return {
        ok: false,
        error: `${label} has to stay on the form. A lead needs a first and last name.`,
      };
    }
  }
  const hasContact = CONTACT_IDENTITY_KEYS.some((key) => visibleKeys.has(key));
  if (!hasContact) {
    return {
      ok: false,
      error:
        'Keep email or phone on the form. A lead needs at least one way to reach the person.',
    };
  }
  const imageCount = visibleQuestions.filter(
    (question) => question.kind === 'custom' && question.type === 'image'
  ).length;
  if (imageCount > MAX_INTAKE_IMAGE_QUESTIONS) {
    return {
      ok: false,
      error: `A form can have at most ${MAX_INTAKE_IMAGE_QUESTIONS} image questions.`,
    };
  }

  for (const step of steps) {
    for (const question of step.questions) {
      if (question.kind !== 'custom') continue;
      const locked = context.lockedCustomTypes.get(question.key);
      if (locked && locked !== question.type) {
        return {
          ok: false,
          error: `The answer type for "${question.label}" is locked because this organization already has answers for it.`,
        };
      }
    }
  }

  const definition = withStandardShowWhen({ logoAssetId, steps });
  const keys = new Set(listQuestionKeys(definition));
  for (const question of definition.steps.flatMap((step) => step.questions)) {
    const showWhen = question.showWhen;
    if (!showWhen) continue;
    if (
      showWhen.questionKey === question.key ||
      !keys.has(showWhen.questionKey)
    ) {
      return {
        ok: false,
        error: `"${question.label}" must depend on another question that is on the form.`,
      };
    }
  }

  return { ok: true, definition };
}

function parseStep(
  value: unknown,
  seenStepIds: Set<string>,
  seenKeys: Set<string>
): { ok: true; step: IntakeFormStep } | { ok: false; error: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      ok: false,
      error: 'Each step needs a title and a list of questions.',
    };
  }
  const raw = value as Record<string, unknown>;
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (!KEY_PATTERN.test(id)) {
    return {
      ok: false,
      error:
        'Each step needs an id made of lowercase letters, numbers, and underscores.',
    };
  }
  if (seenStepIds.has(id)) {
    return { ok: false, error: 'Two steps cannot use the same id.' };
  }
  seenStepIds.add(id);
  if (!title || title.length > MAX_TITLE) {
    return {
      ok: false,
      error: 'Each step needs a title of 120 characters or fewer.',
    };
  }
  if (!Array.isArray(raw.questions)) {
    return { ok: false, error: `Step "${title}" needs a list of questions.` };
  }

  const questions: IntakeFormQuestion[] = [];
  for (const questionValue of raw.questions) {
    const parsed = parseQuestion(questionValue, seenKeys);
    if (parsed.ok === false) return parsed;
    questions.push(parsed.question);
  }
  return { ok: true, step: { id, title, questions } };
}

function parseQuestion(
  value: unknown,
  seenKeys: Set<string>
): { ok: true; question: IntakeFormQuestion } | { ok: false; error: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: 'A question is missing its details.' };
  }
  const raw = value as Record<string, unknown>;
  const kind = raw.kind;
  const key = typeof raw.key === 'string' ? raw.key.trim() : '';
  const label = typeof raw.label === 'string' ? raw.label.trim() : '';
  if (kind !== 'standard' && kind !== 'custom') {
    return {
      ok: false,
      error: 'Each question is either a standard field or a custom field.',
    };
  }
  if (!KEY_PATTERN.test(key)) {
    return {
      ok: false,
      error:
        'Each question needs a key made of lowercase letters, numbers, and underscores.',
    };
  }
  if (seenKeys.has(key)) {
    return {
      ok: false,
      error: `The question key "${key}" is used more than once.`,
    };
  }
  if (!label || label.length > MAX_LABEL) {
    return {
      ok: false,
      error: 'Each question needs a label of 200 characters or fewer.',
    };
  }
  if (typeof raw.required !== 'boolean') {
    return { ok: false, error: `Say whether "${label}" is required.` };
  }
  if (raw.hidden != null && typeof raw.hidden !== 'boolean') {
    return { ok: false, error: `Say whether "${label}" is shown.` };
  }
  const hidden = raw.hidden === true;
  const help = parseHelpText(raw.helpText, label);
  if (help.ok === false) return help;
  const helpText = help.helpText;
  const placeholder = parsePlaceholder(raw.placeholder, label);
  if (placeholder.ok === false) return placeholder;
  const columns = parseColumns(raw.columns, label);
  if (columns.ok === false) return columns;
  const presentation = {
    ...(placeholder.placeholder
      ? { placeholder: placeholder.placeholder }
      : {}),
    ...(columns.columns ? { columns: columns.columns } : {}),
  };

  seenKeys.add(key);

  if (kind === 'standard') {
    const catalog = STANDARD_FIELD_BY_KEY.get(key);
    if (!catalog) {
      return {
        ok: false,
        error: `"${key}" is not a standard intake question.`,
      };
    }
    if ('type' in raw && raw.type != null && raw.type !== catalog.storageType) {
      return {
        ok: false,
        error: `The answer type for "${label}" is fixed and cannot be changed.`,
      };
    }
    let options: string[] | undefined;
    if (catalog.options) {
      if (raw.options != null) {
        const parsed = parseOptions(
          raw.options,
          catalog.storageType === 'multi_select'
            ? 'multi_select'
            : 'single_select',
          label
        );
        if (!Array.isArray(parsed)) return parsed;
        options = parsed;
      }
    } else if (
      Array.isArray(raw.options) &&
      raw.options.some((item) => String(item).trim())
    ) {
      return { ok: false, error: `"${label}" does not use choices.` };
    }
    return {
      ok: true,
      question: {
        kind: 'standard',
        key,
        label,
        required: raw.required,
        helpText,
        ...(hidden ? { hidden: true } : {}),
        ...(options ? { options } : {}),
        ...presentation,
      },
    };
  }

  if (STANDARD_FIELD_BY_KEY.has(key)) {
    return {
      ok: false,
      error: `"${key}" is a standard question and cannot be saved as a custom question.`,
    };
  }
  const type = raw.type;
  if (typeof type !== 'string' || !isCustomFieldType(type)) {
    return {
      ok: false,
      error: `"${label}" needs one of the allowed answer types.`,
    };
  }
  const options = parseOptions(raw.options, type, label);
  if (!Array.isArray(options)) return options;
  const showWhen = parseShowWhen(raw.showWhen, label);
  if (showWhen.ok === false) return showWhen;
  return {
    ok: true,
    question: {
      kind: 'custom',
      key,
      label,
      required: raw.required,
      helpText,
      type,
      options,
      ...(hidden ? { hidden: true } : {}),
      ...(showWhen.showWhen ? { showWhen: showWhen.showWhen } : {}),
      ...presentation,
    },
  };
}

function parseShowWhen(
  value: unknown,
  label: string
):
  | { ok: true; showWhen: QuestionShowWhen | null }
  | { ok: false; error: string } {
  if (value == null) return { ok: true, showWhen: null };
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      ok: false,
      error: `"${label}" has a show rule that is not valid.`,
    };
  }
  const raw = value as Record<string, unknown>;
  const questionKey =
    typeof raw.questionKey === 'string' ? raw.questionKey.trim() : '';
  if (!KEY_PATTERN.test(questionKey)) {
    return {
      ok: false,
      error: `"${label}" must depend on another question on the form.`,
    };
  }
  const modes = [
    raw.equals !== undefined,
    raw.includes !== undefined,
    Array.isArray(raw.oneOf),
  ].filter(Boolean).length;
  if (modes !== 1) {
    return {
      ok: false,
      error: `"${label}" needs one answer to match before it is shown.`,
    };
  }
  if (raw.equals !== undefined) {
    if (typeof raw.equals === 'boolean') {
      return { ok: true, showWhen: { questionKey, equals: raw.equals } };
    }
    if (
      typeof raw.equals === 'string' &&
      raw.equals.trim() &&
      raw.equals.trim().length <= 80
    ) {
      return { ok: true, showWhen: { questionKey, equals: raw.equals.trim() } };
    }
    return { ok: false, error: `"${label}" needs a short answer to match.` };
  }
  if (raw.includes !== undefined) {
    if (
      typeof raw.includes !== 'string' ||
      !raw.includes.trim() ||
      raw.includes.trim().length > 80
    ) {
      return {
        ok: false,
        error: `"${label}" needs a short choice to include.`,
      };
    }
    return {
      ok: true,
      showWhen: { questionKey, includes: raw.includes.trim() },
    };
  }
  const oneOf = (raw.oneOf as unknown[]).map((item) =>
    typeof item === 'string' ? item.trim() : ''
  );
  if (
    oneOf.length === 0 ||
    oneOf.length > 12 ||
    oneOf.some((item) => !item || item.length > 80)
  ) {
    return {
      ok: false,
      error: `"${label}" needs a short list of matching answers.`,
    };
  }
  return { ok: true, showWhen: { questionKey, oneOf } };
}

function parsePlaceholder(
  value: unknown,
  label: string
): { ok: true; placeholder: string | null } | { ok: false; error: string } {
  if (value == null || value === '') return { ok: true, placeholder: null };
  if (typeof value !== 'string') {
    return {
      ok: false,
      error: `Placeholder text for "${label}" must be plain text.`,
    };
  }
  const trimmed = value.trim();
  if (trimmed.length > MAX_PLACEHOLDER) {
    return {
      ok: false,
      error: `Placeholder text for "${label}" must be ${MAX_PLACEHOLDER} characters or fewer.`,
    };
  }
  return { ok: true, placeholder: trimmed.length > 0 ? trimmed : null };
}

function parseColumns(
  value: unknown,
  label: string
): { ok: true; columns?: 1 | 2 } | { ok: false; error: string } {
  if (value == null || value === '') return { ok: true };
  if (value === 1 || value === 2) return { ok: true, columns: value };
  return {
    ok: false,
    error: `"${label}" must use one column or two columns.`,
  };
}

function parseHelpText(
  value: unknown,
  label: string
): { ok: true; helpText: string | null } | { ok: false; error: string } {
  if (value == null || value === '') return { ok: true, helpText: null };
  if (typeof value !== 'string') {
    return { ok: false, error: `Help text for "${label}" must be plain text.` };
  }
  const trimmed = value.trim();
  if (trimmed.length > MAX_HELP) {
    return {
      ok: false,
      error: `Help text for "${label}" must be ${MAX_HELP} characters or fewer.`,
    };
  }
  return { ok: true, helpText: trimmed.length > 0 ? trimmed : null };
}

function parseOptions(
  value: unknown,
  type: CustomFieldType,
  label: string
): string[] | { ok: false; error: string } {
  const needsOptions =
    type === 'single_select' || type === 'multi_select' || type === 'radio';
  if (!needsOptions) return [];
  if (!Array.isArray(value)) {
    return { ok: false, error: `"${label}" needs at least one choice.` };
  }
  const filled = value.filter(
    (item) => typeof item === 'string' && item.trim()
  );
  if (filled.length === 0) {
    return { ok: false, error: `"${label}" needs at least one choice.` };
  }
  if (filled.length > MAX_OPTIONS) {
    return {
      ok: false,
      error: `"${label}" can have at most ${MAX_OPTIONS} choices.`,
    };
  }
  const options: string[] = [];
  const seen = new Set<string>();
  for (const item of filled) {
    if (typeof item !== 'string') {
      return { ok: false, error: `Choices for "${label}" must be plain text.` };
    }
    const trimmed = item.trim();
    if (!trimmed || trimmed.length > MAX_OPTION_LENGTH) {
      return {
        ok: false,
        error: `Each choice for "${label}" needs 1 to ${MAX_OPTION_LENGTH} characters.`,
      };
    }
    const folded = trimmed.toLowerCase();
    if (seen.has(folded)) {
      return { ok: false, error: `"${label}" has a duplicate choice.` };
    }
    seen.add(folded);
    options.push(trimmed);
  }
  return options;
}

function isCustomFieldType(value: string): value is CustomFieldType {
  return (CUSTOM_FIELD_TYPES as readonly string[]).includes(value);
}

/**
 * Type changes are locked per organization. The same custom key in another
 * tenant is a different question.
 */
export function customTypeChangeAllowed(input: {
  key: string;
  nextType: string;
  lockedCustomTypes: ReadonlyMap<string, string>;
}): boolean {
  const locked = input.lockedCustomTypes.get(input.key);
  if (!locked) return true;
  return locked === input.nextType;
}
