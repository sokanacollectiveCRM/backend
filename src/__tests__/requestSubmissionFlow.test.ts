import express from 'express';
import request from 'supertest';
import { RequestFormController } from '../controllers/requestFormController';
import { RequestFormRepository } from '../repositories/requestFormRepository';
import { RequestFormService } from '../services/RequestFormService';
import { ClientAgeRange, HomeType, IncomeLevel, Pronouns, ProviderType, RelationshipStatus, ServiceTypes, STATE } from '../types';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
  }),
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn().mockReturnValue({
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    then: jest.fn().mockResolvedValue({ data: null, error: null }),
  }),
}));

const mockQuery = jest.fn();
jest.mock('../db/cloudSqlPool', () => ({
  getPool: jest.fn(() => ({
    query: mockQuery,
  })),
}));

/** Mirrors CRM `DUMMY_TEST_LEAD` + submit transforms (`number_of_babies` number, `service_needed` from services). */
function buildCrmLikeSubmitBody(): Record<string, unknown> {
  const due = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return {
    services_interested: ['Labor Support', 'Postpartum Support'],
    service_support_details:
      'Looking for labor and postpartum support. Would like overnight care for first 2 weeks.',
    firstname: 'Test',
    lastname: 'Lead',
    email: 'test.lead@example.com',
    phone_number: '555-123-4567',
    pronouns: 'She/Her',
    preferred_contact_method: 'Email',
    preferred_name: 'Test',
    age: '30',
    children_expected: '1',
    address: '123 Test Street',
    city: 'Springfield',
    state: 'IL',
    zip_code: '62704',
    home_type: HomeType.HOUSE,
    home_access: 'Front door, no stairs',
    pets: 'None',
    relationship_status: RelationshipStatus.PARTNERED,
    first_name: 'Alex',
    last_name: 'Lead',
    middle_name: 'J',
    family_email: 'alex.lead@example.com',
    mobile_phone: '5559876543',
    work_phone: '',
    family_pronouns: 'They/Them',
    referral_source: 'Google',
    referral_source_other: '',
    referral_name: 'N/A',
    referral_email: '',
    health_history: 'No major health issues',
    allergies: 'None',
    health_notes: 'First pregnancy',
    due_date: due,
    birth_location: 'Hospital',
    birth_hospital: 'Springfield General Hospital',
    number_of_babies: 1,
    baby_name: '',
    provider_type: 'Midwife',
    pregnancy_number: 1,
    hospital: 'Springfield General',
    had_previous_pregnancies: false,
    previous_pregnancies_count: 0,
    living_children_count: 0,
    past_pregnancy_experience: '',
    payment_method: 'Private/Commercial Insurance',
    insurance_policy_holder_name: 'Test Lead',
    insurance_policy_holder_dob: '1990-05-15',
    insurance_policy_holder_relationship: 'Self',
    insurance_provider: 'Blue Cross Blue Shield',
    insurance_member_id: 'BCBS-123456',
    policy_number: 'GRP-001',
    insurance_plan_type: 'PPO',
    insurance_phone_number: '8005551212',
    has_secondary_insurance: true,
    secondary_insurance_provider: 'Secondary Health Plan',
    secondary_insurance_member_id: 'SEC-MEMBER-789',
    secondary_policy_number: 'SEC-POL-456',
    annual_income: IncomeLevel.FROM_45000_TO_64999,
    service_needed: 'Labor Support, Postpartum Support',
    service_specifics: 'Labor support for hospital birth',
    race_ethnicity: 'Caucasian/White',
    primary_language: 'English',
    client_age_range: ClientAgeRange.AGE_25_34,
    insurance: 'Private',
    demographics_multi: [],
  };
}

describe('POST /requestService/requestSubmission flow', () => {
  let app: express.Application;
  let requestFormController: RequestFormController;
  let requestFormService: RequestFormService;
  let requestFormRepository: RequestFormRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    requestFormRepository = new RequestFormRepository({} as any);
    requestFormService = new RequestFormService(requestFormRepository);
    requestFormController = new RequestFormController(requestFormService);
    app = express();
    app.use(express.json());
    app.post('/requestService/requestSubmission', (req, res) =>
      requestFormController.createForm(req, res)
    );
  });

  describe('handler with mocked persistence', () => {
    it('returns 200 when newForm succeeds', async () => {
      const saved = {
        id: 'lead-uuid',
        firstname: 'Test',
        lastname: 'Lead',
        email: 'test.lead@example.com',
        phone_number: '555-123-4567',
        address: '123 Test Street',
        city: 'Springfield',
        state: STATE.IL,
        zip_code: '62704',
        service_needed: 'Labor Support, Postpartum Support',
        referral_source: 'Google',
      };
      jest.spyOn(requestFormService, 'newForm').mockResolvedValue(saved as any);

      const res = await request(app)
        .post('/requestService/requestSubmission')
        .send({ ...buildCrmLikeSubmitBody(), firstname: 'Test' })
        .expect(200);

      expect(res.body).toEqual({ message: 'Form data received, onto processing' });
      expect(requestFormService.newForm).toHaveBeenCalled();
    });

    it('returns 400 when newForm throws', async () => {
      jest.spyOn(requestFormService, 'newForm').mockRejectedValue(new Error('boom'));

      const res = await request(app)
        .post('/requestService/requestSubmission')
        .send(buildCrmLikeSubmitBody())
        .expect(400);

      expect(res.body.error).toBe('boom');
    });
  });

  describe('validation → 400 (real service)', () => {
    it('returns 400 when has_secondary_insurance is true but secondary_policy_number is missing', async () => {
      const body = {
        ...buildCrmLikeSubmitBody(),
        secondary_policy_number: '',
      };

      const res = await request(app).post('/requestService/requestSubmission').send(body).expect(400);

      expect(res.body.error).toContain('secondary_policy_number');
    });
  });

  describe('integration: CRM-shaped body persists expected Cloud SQL columns', () => {
    it('writes number_of_babies, service_needed, normalized payment, and secondary billing fields', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ client_number: 'CL-00042' }] });

      const res = await request(app).post('/requestService/requestSubmission').send(buildCrmLikeSubmitBody());

      expect(res.status).toBe(200);
      expect(mockQuery).toHaveBeenCalled();
      const [, params] = mockQuery.mock.calls[0];
      expect(params[6]).toBe('Springfield');
      expect(params[7]).toBe('IL');
      expect(params[8]).toBe('62704');
      expect(params[9]).toBe('Hospital');
      expect(params[11]).toBe('Midwife');
      expect(params[19]).toBe(30);
      expect(params[34]).toBe(1);
      expect(params[42]).toBe('Commercial Insurance');
      expect(params[43]).toBe('Blue Cross Blue Shield');
      expect(params[51]).toBe(true);
      expect(params[52]).toBe('Secondary Health Plan');
      expect(params[53]).toBe('SEC-MEMBER-789');
      expect(params[54]).toBe('SEC-POL-456');
      expect(params[57]).toBe('Labor Support, Postpartum Support');
    });
  });
});
