/**
 * Standard intake questions. Keys and storage types are fixed so answers
 * still land on existing phi_clients columns. Admins may change label,
 * help text, required, and step. They may not change the type.
 */
import {
  INSURANCE_PLAN_TYPES,
  INSURANCE_POLICY_HOLDER_RELATIONSHIPS,
} from '../../../billing/expandedInsuranceBilling';
import { ALLOWED_REFERRAL_SOURCES } from '../../../constants/referralSource';
import { ProviderType } from '../../../types';
import {
  INTAKE_HOME_PEOPLE_COUNT_OPTIONS,
  INTAKE_PAYMENT_METHOD_OPTIONS,
} from './requestSubmissionDto';

export const CUSTOM_FIELD_TYPES = [
  'short_text',
  'long_text',
  'number',
  'date',
  'email',
  'phone',
  'yes_no',
  'single_select',
  'multi_select',
  'radio',
  'image',
] as const;

/** Types offered in the editor. Older types stay valid if a draft already uses them. */
export const SIMPLE_CUSTOM_FIELD_TYPES = [
  'short_text',
  'number',
  'image',
  'single_select',
  'radio',
] as const;

export const MAX_INTAKE_IMAGE_QUESTIONS = 3;
export const INTAKE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

export type StandardStorageType =
  | 'text'
  | 'long_text'
  | 'number'
  | 'date'
  | 'boolean'
  | 'email'
  | 'phone'
  | 'single_select'
  | 'multi_select';

export type IdentityRole = 'name' | 'contact';

/** When a follow-up question is shown. One of equals, includes, or oneOf. */
export interface QuestionShowWhen {
  questionKey: string;
  equals?: string | boolean;
  includes?: string;
  oneOf?: readonly string[];
}

export interface StandardFieldDefinition {
  key: string;
  storageType: StandardStorageType;
  defaultLabel: string;
  defaultRequired: boolean;
  defaultHelpText: string | null;
  stepId: string;
  identity?: IdentityRole;
  options?: readonly string[];
  showWhen?: QuestionShowWhen;
}

export interface StandardStepDefinition {
  id: string;
  title: string;
}

export const STANDARD_INTAKE_STEPS: readonly StandardStepDefinition[] = [
  { id: 'services', title: 'Services Interested In' },
  { id: 'client_details', title: 'Client Details' },
  { id: 'home', title: 'Home Details' },
  { id: 'referral', title: 'How did you hear about us?' },
  { id: 'health', title: 'Health information' },
  { id: 'pregnancy', title: 'Pregnancy/Baby' },
  { id: 'past_pregnancies', title: 'Past Pregnancies' },
  { id: 'payment', title: 'Payment' },
  { id: 'demographics', title: 'Client Demographics' },
];

const SERVICE_OPTIONS = [
  'Labor Support',
  'Postpartum Support',
  '1st Night Care',
  'Lactation Support',
  'Perinatal Education',
  'Abortion Support',
  'Other',
] as const;

const HOME_TYPE_OPTIONS = [
  'Rent, apartment or house',
  'Own, apartment, condo, or house',
  'Living with family or friends',
  'Subsidized or public housing',
  'Transitional housing',
  'Shelter or emergency housing',
  'Experiencing homelessness',
  'Other',
  'Prefer not to answer',
] as const;

const RACE_OPTIONS = [
  'African American/Black',
  'Asian/Pacific Islander',
  'Caucasian/White',
  'Hispanic',
  'Two or more races',
  'Other',
] as const;

const LANGUAGE_OPTIONS = [
  'English',
  'Spanish',
  'French',
  'Mandarin',
  'Arabic',
  'Other',
] as const;

const AGE_RANGE_OPTIONS = [
  'Under 20',
  '20-25',
  '26-35',
  '36 and older',
] as const;

const DEMOGRAPHICS_MULTI_OPTIONS = [
  'Annual income is less than $30,000',
  'Identify as a person of color',
  'Identify as LGBTQ+',
  'Disabled',
  'Survivor of violence',
  'Experienced pregnancy or birth trauma',
  'Experienced postpartum depression, anxiety/psychosis/mood disorder',
  'Referred from a social service agency',
  'Refugee or religious minority',
  'Active Military or Veteran Status',
  'None apply',
  'Other:',
] as const;

function field(partial: StandardFieldDefinition): StandardFieldDefinition {
  return partial;
}

const WHEN_INSURANCE_DETAILS: QuestionShowWhen = {
  questionKey: 'payment_method',
  oneOf: ['Private/Commercial Insurance'],
};

const WHEN_SECONDARY_INSURANCE: QuestionShowWhen = {
  questionKey: 'has_secondary_insurance',
  equals: true,
};

export const STANDARD_INTAKE_FIELDS: readonly StandardFieldDefinition[] = [
  field({
    key: 'services_interested',
    storageType: 'multi_select',
    defaultLabel: 'Services interested in',
    defaultRequired: true,
    defaultHelpText: null,
    stepId: 'services',
    options: SERVICE_OPTIONS,
  }),
  field({
    key: 'service_support_details',
    storageType: 'long_text',
    defaultLabel: 'Describe the support you are looking for',
    defaultRequired: true,
    defaultHelpText: null,
    stepId: 'services',
  }),
  field({
    key: 'firstname',
    storageType: 'text',
    defaultLabel: 'First name',
    defaultRequired: true,
    defaultHelpText: null,
    stepId: 'client_details',
    identity: 'name',
  }),
  field({
    key: 'lastname',
    storageType: 'text',
    defaultLabel: 'Last name',
    defaultRequired: true,
    defaultHelpText: null,
    stepId: 'client_details',
    identity: 'name',
  }),
  field({
    key: 'email',
    storageType: 'email',
    defaultLabel: 'Email',
    defaultRequired: true,
    defaultHelpText: null,
    stepId: 'client_details',
    identity: 'contact',
  }),
  field({
    key: 'phone_number',
    storageType: 'phone',
    defaultLabel: 'Mobile phone',
    defaultRequired: true,
    defaultHelpText: null,
    stepId: 'client_details',
    identity: 'contact',
  }),
  field({
    key: 'pronouns',
    storageType: 'single_select',
    defaultLabel: 'Pronouns',
    defaultRequired: true,
    defaultHelpText: null,
    stepId: 'client_details',
    options: ['She/Her', 'He/Him', 'They/Them', 'Ze/Hir/Zir', 'None', 'Other'],
  }),
  field({
    key: 'pronouns_other',
    storageType: 'text',
    defaultLabel: 'Pronouns, if other',
    defaultRequired: false,
    defaultHelpText: null,
    stepId: 'client_details',
    showWhen: { questionKey: 'pronouns', equals: 'Other' },
  }),
  field({
    key: 'preferred_contact_method',
    storageType: 'single_select',
    defaultLabel: 'Preferred contact method',
    defaultRequired: true,
    defaultHelpText: null,
    stepId: 'client_details',
    options: ['Phone', 'Text', 'Email'],
  }),
  field({
    key: 'preferred_name',
    storageType: 'text',
    defaultLabel: 'Preferred name, if different from first name',
    defaultRequired: false,
    defaultHelpText: null,
    stepId: 'client_details',
  }),
  field({
    key: 'age',
    storageType: 'number',
    defaultLabel: 'Age',
    defaultRequired: true,
    defaultHelpText: null,
    stepId: 'client_details',
  }),
  field({
    key: 'children_expected',
    storageType: 'text',
    defaultLabel: 'Children expected',
    defaultRequired: false,
    defaultHelpText: null,
    stepId: 'client_details',
  }),
  field({
    key: 'address',
    storageType: 'text',
    defaultLabel: 'Address',
    defaultRequired: true,
    defaultHelpText: null,
    stepId: 'home',
  }),
  field({
    key: 'city',
    storageType: 'text',
    defaultLabel: 'City',
    defaultRequired: true,
    defaultHelpText: null,
    stepId: 'home',
  }),
  field({
    key: 'state',
    storageType: 'text',
    defaultLabel: 'State',
    defaultRequired: true,
    defaultHelpText: null,
    stepId: 'home',
  }),
  field({
    key: 'zip_code',
    storageType: 'text',
    defaultLabel: 'Zip code',
    defaultRequired: true,
    defaultHelpText: null,
    stepId: 'home',
  }),
  field({
    key: 'home_type',
    storageType: 'multi_select',
    defaultLabel: 'Housing',
    defaultRequired: false,
    defaultHelpText: null,
    stepId: 'home',
    options: HOME_TYPE_OPTIONS,
  }),
  field({
    key: 'home_type_other',
    storageType: 'text',
    defaultLabel: 'Housing, if other',
    defaultRequired: false,
    defaultHelpText: null,
    stepId: 'home',
    showWhen: { questionKey: 'home_type', includes: 'Other' },
  }),
  field({
    key: 'home_access',
    storageType: 'text',
    defaultLabel: 'Home access notes',
    defaultRequired: false,
    defaultHelpText: null,
    stepId: 'home',
  }),
  field({
    key: 'pets',
    storageType: 'text',
    defaultLabel: 'Pets or animals in the home',
    defaultRequired: true,
    defaultHelpText: null,
    stepId: 'home',
  }),
  field({
    key: 'home_adults_count',
    storageType: 'single_select',
    defaultLabel: 'Adults in the home',
    defaultRequired: true,
    defaultHelpText: null,
    stepId: 'home',
    options: INTAKE_HOME_PEOPLE_COUNT_OPTIONS,
  }),
  field({
    key: 'home_youth_count',
    storageType: 'single_select',
    defaultLabel: 'Youth in the home',
    defaultRequired: true,
    defaultHelpText: null,
    stepId: 'home',
    options: INTAKE_HOME_PEOPLE_COUNT_OPTIONS,
  }),
  field({
    key: 'referral_source',
    storageType: 'single_select',
    defaultLabel: 'How did you hear about us?',
    defaultRequired: true,
    defaultHelpText: null,
    stepId: 'referral',
    options: ALLOWED_REFERRAL_SOURCES,
  }),
  field({
    key: 'referral_source_other',
    storageType: 'text',
    defaultLabel: 'How you heard about us, if other',
    defaultRequired: false,
    defaultHelpText: null,
    stepId: 'referral',
    showWhen: { questionKey: 'referral_source', equals: 'Other' },
  }),
  field({
    key: 'referral_name',
    storageType: 'text',
    defaultLabel: 'Referral name',
    defaultRequired: false,
    defaultHelpText: null,
    stepId: 'referral',
  }),
  field({
    key: 'referral_email',
    storageType: 'text',
    defaultLabel: 'Referral contact',
    defaultRequired: false,
    defaultHelpText: null,
    stepId: 'referral',
  }),
  field({
    key: 'health_history',
    storageType: 'long_text',
    defaultLabel: 'Health history',
    defaultRequired: false,
    defaultHelpText: null,
    stepId: 'health',
  }),
  field({
    key: 'allergies',
    storageType: 'long_text',
    defaultLabel: 'Allergies',
    defaultRequired: false,
    defaultHelpText: null,
    stepId: 'health',
  }),
  field({
    key: 'health_notes',
    storageType: 'long_text',
    defaultLabel:
      'Anything we should know about pregnancy, baby, or postpartum',
    defaultRequired: false,
    defaultHelpText: null,
    stepId: 'health',
  }),
  field({
    key: 'due_date',
    storageType: 'date',
    defaultLabel: 'Due date',
    defaultRequired: true,
    defaultHelpText: null,
    stepId: 'pregnancy',
  }),
  field({
    key: 'birth_location',
    storageType: 'single_select',
    defaultLabel: 'Birth location',
    defaultRequired: true,
    defaultHelpText: null,
    stepId: 'pregnancy',
    options: ['Hospital', 'Home', 'Birth Center', 'Other'],
  }),
  field({
    key: 'birth_hospital',
    storageType: 'text',
    defaultLabel: 'Name of hospital, birth center, or home',
    defaultRequired: false,
    defaultHelpText: null,
    stepId: 'pregnancy',
  }),
  field({
    key: 'number_of_babies',
    storageType: 'single_select',
    defaultLabel: 'Number of babies',
    defaultRequired: true,
    defaultHelpText: null,
    stepId: 'pregnancy',
    options: ['Singleton', 'Twins', 'Triplets', 'Quadruplets'],
  }),
  field({
    key: 'baby_name',
    storageType: 'text',
    defaultLabel: 'Baby name',
    defaultRequired: false,
    defaultHelpText: null,
    stepId: 'pregnancy',
  }),
  field({
    key: 'provider_type',
    storageType: 'single_select',
    defaultLabel: 'Provider type',
    defaultRequired: true,
    defaultHelpText: null,
    stepId: 'pregnancy',
    options: [...Object.values(ProviderType), 'Family Doctor'],
  }),
  field({
    key: 'pregnancy_number',
    storageType: 'number',
    defaultLabel: 'Pregnancy number',
    defaultRequired: true,
    defaultHelpText: null,
    stepId: 'pregnancy',
  }),
  field({
    key: 'had_previous_pregnancies',
    storageType: 'boolean',
    defaultLabel: 'Have you had past pregnancies?',
    defaultRequired: true,
    defaultHelpText: null,
    stepId: 'past_pregnancies',
  }),
  field({
    key: 'previous_pregnancies_count',
    storageType: 'number',
    defaultLabel: 'Number of previous pregnancies',
    defaultRequired: false,
    defaultHelpText: null,
    stepId: 'past_pregnancies',
    showWhen: { questionKey: 'had_previous_pregnancies', equals: true },
  }),
  field({
    key: 'living_children_count',
    storageType: 'number',
    defaultLabel: 'Number of living children',
    defaultRequired: false,
    defaultHelpText: null,
    stepId: 'past_pregnancies',
    showWhen: { questionKey: 'had_previous_pregnancies', equals: true },
  }),
  field({
    key: 'past_pregnancy_experience',
    storageType: 'long_text',
    defaultLabel: 'Past pregnancy experience',
    defaultRequired: false,
    defaultHelpText: null,
    stepId: 'past_pregnancies',
    showWhen: { questionKey: 'had_previous_pregnancies', equals: true },
  }),
  field({
    key: 'payment_method',
    storageType: 'single_select',
    defaultLabel: 'Payment method',
    defaultRequired: true,
    defaultHelpText: null,
    stepId: 'payment',
    options: INTAKE_PAYMENT_METHOD_OPTIONS,
  }),
  field({
    key: 'insurance_policy_holder_name',
    storageType: 'text',
    defaultLabel: 'Policy holder name',
    defaultRequired: false,
    defaultHelpText: null,
    stepId: 'payment',
    showWhen: WHEN_INSURANCE_DETAILS,
  }),
  field({
    key: 'insurance_policy_holder_dob',
    storageType: 'date',
    defaultLabel: 'Policy holder date of birth',
    defaultRequired: false,
    defaultHelpText: null,
    stepId: 'payment',
    showWhen: WHEN_INSURANCE_DETAILS,
  }),
  field({
    key: 'insurance_policy_holder_relationship',
    storageType: 'single_select',
    defaultLabel: 'Policy holder relationship',
    defaultRequired: false,
    defaultHelpText: null,
    stepId: 'payment',
    options: [...INSURANCE_POLICY_HOLDER_RELATIONSHIPS],
    showWhen: WHEN_INSURANCE_DETAILS,
  }),
  field({
    key: 'insurance_provider',
    storageType: 'text',
    defaultLabel: 'Insurance provider',
    defaultRequired: false,
    defaultHelpText: null,
    stepId: 'payment',
    showWhen: WHEN_INSURANCE_DETAILS,
  }),
  field({
    key: 'insurance_member_id',
    storageType: 'text',
    defaultLabel: 'Member ID',
    defaultRequired: false,
    defaultHelpText: null,
    stepId: 'payment',
    showWhen: WHEN_INSURANCE_DETAILS,
  }),
  field({
    key: 'policy_number',
    storageType: 'text',
    defaultLabel: 'Group number',
    defaultRequired: false,
    defaultHelpText: null,
    stepId: 'payment',
    showWhen: WHEN_INSURANCE_DETAILS,
  }),
  field({
    key: 'insurance_plan_type',
    storageType: 'single_select',
    defaultLabel: 'Plan type',
    defaultRequired: false,
    defaultHelpText: null,
    stepId: 'payment',
    options: [...INSURANCE_PLAN_TYPES],
    showWhen: WHEN_INSURANCE_DETAILS,
  }),
  field({
    key: 'insurance_phone_number',
    storageType: 'phone',
    defaultLabel: 'Insurance phone',
    defaultRequired: false,
    defaultHelpText: null,
    stepId: 'payment',
    showWhen: WHEN_INSURANCE_DETAILS,
  }),
  field({
    key: 'has_secondary_insurance',
    storageType: 'boolean',
    defaultLabel: 'Secondary insurance',
    defaultRequired: false,
    defaultHelpText: null,
    stepId: 'payment',
    showWhen: WHEN_INSURANCE_DETAILS,
  }),
  field({
    key: 'secondary_insurance_provider',
    storageType: 'text',
    defaultLabel: 'Secondary insurance provider',
    defaultRequired: false,
    defaultHelpText: null,
    stepId: 'payment',
    showWhen: WHEN_SECONDARY_INSURANCE,
  }),
  field({
    key: 'secondary_insurance_member_id',
    storageType: 'text',
    defaultLabel: 'Secondary member ID',
    defaultRequired: false,
    defaultHelpText: null,
    stepId: 'payment',
    showWhen: WHEN_SECONDARY_INSURANCE,
  }),
  field({
    key: 'secondary_policy_number',
    storageType: 'text',
    defaultLabel: 'Secondary group number',
    defaultRequired: false,
    defaultHelpText: null,
    stepId: 'payment',
    showWhen: WHEN_SECONDARY_INSURANCE,
  }),
  field({
    key: 'annual_income',
    storageType: 'text',
    defaultLabel: 'Annual income',
    defaultRequired: false,
    defaultHelpText: null,
    stepId: 'payment',
  }),
  field({
    key: 'race_ethnicity',
    storageType: 'single_select',
    defaultLabel: 'Race/ethnicity/nationality',
    defaultRequired: false,
    defaultHelpText: null,
    stepId: 'demographics',
    options: RACE_OPTIONS,
  }),
  field({
    key: 'primary_language',
    storageType: 'single_select',
    defaultLabel: 'Primary language',
    defaultRequired: false,
    defaultHelpText: null,
    stepId: 'demographics',
    options: LANGUAGE_OPTIONS,
  }),
  field({
    key: 'client_age_range',
    storageType: 'single_select',
    defaultLabel: 'Age range',
    defaultRequired: false,
    defaultHelpText: null,
    stepId: 'demographics',
    options: AGE_RANGE_OPTIONS,
  }),
  field({
    key: 'insurance',
    storageType: 'single_select',
    defaultLabel: 'Medical insurance coverage',
    defaultRequired: false,
    defaultHelpText: null,
    stepId: 'demographics',
    options: [
      'Private',
      'Public Aid',
      "Currently don't have medical insurance",
    ],
  }),
  field({
    key: 'demographics_multi',
    storageType: 'multi_select',
    defaultLabel: 'Please select all that apply',
    defaultRequired: false,
    defaultHelpText: null,
    stepId: 'demographics',
    options: DEMOGRAPHICS_MULTI_OPTIONS,
  }),
];

export const STANDARD_FIELD_BY_KEY: ReadonlyMap<
  string,
  StandardFieldDefinition
> = new Map(STANDARD_INTAKE_FIELDS.map((item) => [item.key, item]));

export const NAME_IDENTITY_KEYS = ['firstname', 'lastname'] as const;
export const CONTACT_IDENTITY_KEYS = ['email', 'phone_number'] as const;
