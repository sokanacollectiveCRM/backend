import {
  diffIntakeShadowSlices,
  mapIntakeResponseToRequestForm,
  normalizePublicIntakeSubmission,
  pickIntakeShadowCompareSlice,
  PUBLIC_INTAKE_SUCCESS_MESSAGE,
  submitPublicRequestForm,
} from '../features/intake';
import { ValidationError } from '../domains/errors';

describe('PR 8 intake domain normalize', () => {
  const base = {
    firstname: 'Ada',
    lastname: 'Lovelace',
    email: 'ada@example.com',
    phone_number: '5551234567',
    address: '1 Analytical Eng',
    city: 'London',
    state: 'MA',
    zip_code: '02139',
    service_needed: 'Labor Support',
    referral_source: 'Google',
    age: 32,
    provider_type: 'Midwife',
    home_adults_count: '2',
    home_youth_count: '0',
    birth_location: 'Hospital',
    birth_hospital: 'General Hospital',
    payment_method: 'Self-Pay, Sliding Scale Available',
  };

  it('normalizes a valid public submission', () => {
    const normalized = normalizePublicIntakeSubmission(base);
    expect(normalized.firstname).toBe('Ada');
    expect(normalized.payment_method).toBe('Self-Pay, Sliding Scale Available');
    expect(normalized.intake_age_years).toBe(32);
    expect(normalized.birth_location).toBe('Hospital');
  });

  it('maps commercial insurance payment label', () => {
    const normalized = normalizePublicIntakeSubmission({
      ...base,
      payment_method: 'Private/Commercial Insurance',
      insurance_provider: 'Aetna',
      insurance_member_id: 'M1',
      insurance_policy_holder_name: 'Ada Lovelace',
      insurance_policy_holder_dob: '1990-01-01',
      insurance_policy_holder_relationship: 'Self',
      insurance_plan_type: 'PPO',
    });
    expect(normalized.payment_method).toBe('Commercial Insurance');
  });

  it('rejects invalid email with legacy ValidationError message', () => {
    expect(() =>
      normalizePublicIntakeSubmission({ ...base, email: 'bad@' }),
    ).toThrow(ValidationError);
    expect(() =>
      normalizePublicIntakeSubmission({ ...base, email: 'bad@' }),
    ).toThrow(/Invalid email format/);
  });

  it('shadow compare slice is stable and PHI-light', () => {
    const a = pickIntakeShadowCompareSlice(normalizePublicIntakeSubmission(base));
    const b = pickIntakeShadowCompareSlice(normalizePublicIntakeSubmission(base));
    expect(diffIntakeShadowSlices(a, b)).toEqual([]);
    expect(JSON.stringify(a)).not.toMatch(/Analytical Eng|health_history/i);
  });
});

describe('PR 8 intake use case', () => {
  it('persists via port and maps response entity', async () => {
    const saved: any[] = [];
    const form = await submitPublicRequestForm(
      {
        firstname: 'Ada',
        lastname: 'Lovelace',
        email: 'ada@example.com',
        phone_number: '5551234567',
        address: '1 Analytical Eng',
        city: 'London',
        state: 'MA',
        zip_code: '02139',
        service_needed: 'Labor Support',
        referral_source: 'Google',
        age: 32,
        provider_type: 'Midwife',
        home_adults_count: '2',
        home_youth_count: '0',
        birth_location: 'Hospital',
        birth_hospital: 'General Hospital',
        payment_method: 'Self-Pay, Sliding Scale Available',
      },
      {
        saveLead: async (data) => {
          saved.push(data);
          return {
            id: 'lead-1',
            firstname: data.firstname,
            lastname: data.lastname,
            email: data.email,
            phone_number: data.phone_number,
            service_needed: data.service_needed,
            address: data.address,
            city: data.city,
            state: data.state,
            zip_code: data.zip_code,
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as any;
        },
      },
    );

    expect(saved).toHaveLength(1);
    expect(form.id).toBe('lead-1');
    expect(form.email).toBe('ada@example.com');
  });

  it('mapIntakeResponseToRequestForm preserves ids', () => {
    const entity = mapIntakeResponseToRequestForm({
      id: 'x',
      firstname: 'A',
      lastname: 'B',
      email: 'a@b.c',
      phone_number: '1',
      service_needed: 'Labor Support',
      address: 'a',
      city: 'c',
      state: 'MA',
      zip_code: '02139',
      status: 'pending',
    } as any);
    expect(entity.id).toBe('x');
  });

  it('keeps public success message contract', () => {
    expect(PUBLIC_INTAKE_SUCCESS_MESSAGE).toBe('Form data received, onto processing');
  });
});
