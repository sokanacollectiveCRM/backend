import express from 'express';
import request from 'supertest';
import { RequestFormController } from '../controllers/requestFormController';
import { RequestFormRepository } from '../repositories/requestFormRepository';
import { NodemailerService } from '../services/emailService';
import { RequestFormService } from '../services/RequestFormService';
import { ClientAgeRange, HomeType, IncomeLevel, Pronouns, ProviderType, RelationshipStatus, ServiceTypes, STATE } from '../types';

// Mock modules at the top level
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({
      messageId: 'test-message-id',
    }),
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

describe('Request Endpoint Tests', () => {
  let app: express.Application;
  let requestFormController: RequestFormController;
  let requestFormService: RequestFormService;
  let requestFormRepository: RequestFormRepository;
  let emailService: NodemailerService;

  const mockFormData = {
    // Step 1: Client Details
    firstname: 'Jane',
    lastname: 'Doe',
    email: 'jane.doe@example.com',
    phone_number: '555-123-4567',
    age: 30,
    pronouns: Pronouns.SHE_HER,
    pronouns_other: '',

    // Step 2: Home Details
    address: '123 Main St',
    city: 'Anytown',
    state: STATE.CA,
    zip_code: '90210',
    home_phone: '555-987-6543',
    home_type: HomeType.HOUSE,
    home_adults_count: '2',
    home_youth_count: '1',
    home_access: 'Front door accessible',
    pets: '2 dogs, 1 cat',

    // Step 3: Family Members
    relationship_status: RelationshipStatus.MARRIED,
    first_name: 'John',
    last_name: 'Doe',
    middle_name: 'Michael',
    mobile_phone: '555-456-7890',
    work_phone: '555-789-0123',

    // Step 4: Referral
    referral_source: 'Google',
    referral_name: 'Sarah Smith',
    referral_email: 'sarah@example.com',
    referral_source_other: '',

    // Step 5: Health History
    health_history: 'Previous C-section',
    allergies: 'Latex allergy',
    health_notes: 'Gestational diabetes',

    // Step 6: Payment Info
    payment_method: 'Private/Commercial Insurance',
    insurance_provider: 'Blue Cross Blue Shield',
    insurance_member_id: 'MEM-12345',
    insurance_policy_holder_name: 'Jane Q Client',
    insurance_policy_holder_dob: '1990-04-12',
    insurance_policy_holder_relationship: 'Self',
    insurance_plan_type: 'PPO',
    policy_number: 'POL-67890',
    insurance_phone_number: '800-555-1212',
    has_secondary_insurance: false,
    secondary_insurance_provider: null,
    secondary_insurance_member_id: null,
    secondary_policy_number: null,
    self_pay_card_info: null,
    annual_income: IncomeLevel.FROM_45000_TO_64999,
    service_needed: ServiceTypes.LABOR_SUPPORT,
    service_specifics: 'Need overnight support',

    // Step 7: Pregnancy/Baby
    due_date: new Date('2024-06-15'), // Use Date object
    birth_location: 'Hospital',
    birth_hospital: 'City General Hospital',
    number_of_babies: 1,
    baby_name: 'Baby Doe',
    provider_type: ProviderType.OB,
    pregnancy_number: 2,

    // Step 8: Past Pregnancies
    had_previous_pregnancies: true,
    previous_pregnancies_count: 1,
    living_children_count: 1,
    past_pregnancy_experience: 'Emergency C-section',

    // Step 9: Services Interested
    services_interested: [ServiceTypes.LABOR_SUPPORT, ServiceTypes.POSTPARTUM_SUPPORT],
    service_support_details: 'Need help with breastfeeding',

    // Step 10: Client Demographics
    race_ethnicity: 'Caucasian',
    primary_language: 'English',
    client_age_range: ClientAgeRange.AGE_25_34,
    insurance: 'Blue Cross Blue Shield',
    demographics_multi: ['First-time parent', 'LGBTQ+']
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create fresh instances
    requestFormRepository = new RequestFormRepository({} as any);
    requestFormService = new RequestFormService(requestFormRepository);
    requestFormController = new RequestFormController(requestFormService);
    emailService = new NodemailerService();

    // Create Express app for testing
    app = express();
    app.use(express.json());

    // Mount the request route
    app.post('/requestService/requestSubmission',
      (req, res) => requestFormController.createForm(req, res));
  });

  describe('POST /requestService/requestSubmission', () => {
    it('should successfully submit a complete form', async () => {
      // Mock the service to return the saved form
      jest.spyOn(requestFormService, 'newForm').mockResolvedValue(mockFormData);

      const response = await request(app)
        .post('/requestService/requestSubmission')
        .send(mockFormData)
        .expect(200);

      expect(response.body).toEqual({
        message: 'Form data received, onto processing'
      });

      // Check that the service was called with the form data
      expect(requestFormService.newForm).toHaveBeenCalledWith(expect.objectContaining({
        firstname: 'Jane',
        lastname: 'Doe',
        email: 'jane.doe@example.com',
        service_needed: ServiceTypes.LABOR_SUPPORT
      }));
    });

    it('should handle missing request body', async () => {
      const response = await request(app)
        .post('/requestService/requestSubmission')
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should handle empty request body', async () => {
      const response = await request(app)
        .post('/requestService/requestSubmission')
        .send({})
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should handle service errors gracefully', async () => {
      // Mock service to throw an error
      jest.spyOn(requestFormService, 'newForm').mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .post('/requestService/requestSubmission')
        .send(mockFormData)
        .expect(400);

      expect(response.body.error).toBe('Database connection failed');
    });

    it('should handle email sending errors without blocking form submission', async () => {
      // Mock successful form save but failed email
      jest.spyOn(requestFormService, 'newForm').mockResolvedValue(mockFormData);

      // Mock email service to throw error
      const nodemailer = require('nodemailer');
      nodemailer.createTransport().sendMail.mockRejectedValue(
        new Error('Email service unavailable')
      );

      const response = await request(app)
        .post('/requestService/requestSubmission')
        .send(mockFormData)
        .expect(200);

      // Form should still be submitted successfully even if email fails
      expect(response.body.message).toBe('Form data received, onto processing');
    });

    it('should handle optional fields correctly', async () => {
      const minimalData = {
        firstname: 'Jane',
        lastname: 'Doe',
        email: 'jane@example.com',
        phone_number: '555-123-4567',
        age: 28,
        address: '123 Main St',
        city: 'Anytown',
        state: STATE.CA,
        zip_code: '90210',
        home_adults_count: '1',
        home_youth_count: '0',
        service_needed: ServiceTypes.LABOR_SUPPORT,
        payment_method: 'Self-Pay',
        self_pay_card_info: 'Visa ending 4242',
        referral_source: 'Google',
        referral_source_other: '',
        provider_type: ProviderType.OB,
        due_date: new Date('2026-06-01'),
      };

      jest.spyOn(requestFormService, 'newForm').mockResolvedValue(minimalData);

      const response = await request(app)
        .post('/requestService/requestSubmission')
        .send(minimalData)
        .expect(200);

      expect(response.body.message).toBe('Form data received, onto processing');
    });
  });

  describe('Email functionality', () => {
    it('should send email with correct recipient', async () => {
      jest.spyOn(requestFormService, 'newForm').mockResolvedValue(mockFormData);

      const nodemailer = require('nodemailer');
      const mockSendMail = jest.fn().mockResolvedValue({
        messageId: 'test-message-id'
      });
      nodemailer.createTransport().sendMail = mockSendMail;

      await request(app)
        .post('/requestService/requestSubmission')
        .send(mockFormData)
        .expect(200);

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'hello@sokanacollective.com',
          subject: 'New Lead Submitted via Request Form'
        })
      );
    });

    it('should include form data in email', async () => {
      jest.spyOn(requestFormService, 'newForm').mockResolvedValue(mockFormData);

      const nodemailer = require('nodemailer');
      const mockSendMail = jest.fn().mockResolvedValue({
        messageId: 'test-message-id'
      });
      nodemailer.createTransport().sendMail = mockSendMail;

      await request(app)
        .post('/requestService/requestSubmission')
        .send(mockFormData)
        .expect(200);

      const emailCall = mockSendMail.mock.calls[0][0];

      // Check that email contains key form data
      expect(emailCall.text).toContain('Jane Doe');
      expect(emailCall.text).toContain('jane.doe@example.com');
      expect(emailCall.text).toContain('555-123-4567');
      expect(emailCall.text).toContain('Labor Support');
      expect(emailCall.text).toContain('Anytown');
      expect(emailCall.text).toContain('CA');

      // Check HTML version
      expect(emailCall.html).toContain('Jane Doe');
      expect(emailCall.html).toContain('jane.doe@example.com');
      expect(emailCall.html).toContain('555-123-4567');
      expect(emailCall.html).toContain('Labor Support');
    });

    it('should send confirmation email to the person who submitted the request', async () => {
      jest.spyOn(requestFormService, 'newForm').mockResolvedValue(mockFormData);

      const nodemailer = require('nodemailer');
      const mockSendMail = jest.fn().mockResolvedValue({
        messageId: 'test-message-id'
      });
      nodemailer.createTransport().sendMail = mockSendMail;

      await request(app)
        .post('/requestService/requestSubmission')
        .send(mockFormData)
        .expect(200);

      // Check that two emails were sent (notification + confirmation)
      expect(mockSendMail).toHaveBeenCalledTimes(2);

      // Check the confirmation email (second call)
      const confirmationEmailCall = mockSendMail.mock.calls[1][0];
      expect(confirmationEmailCall.to).toBe('jane.doe@example.com');
      expect(confirmationEmailCall.subject).toBe('Request Received - We\'re Working on Your Match');
      expect(confirmationEmailCall.text).toContain('Dear Jane Doe');
      expect(confirmationEmailCall.text).toContain('Thank you for submitting your request for doula services');
      expect(confirmationEmailCall.text).toContain('Thank you for submitting your request for doula services');
      expect(confirmationEmailCall.text).toContain('We have received your information and are working on finding the perfect match for you');
      expect(confirmationEmailCall.html).toContain('Request Received');
      expect(confirmationEmailCall.html).toContain('Dear Jane Doe');
      expect(confirmationEmailCall.html).toContain('Thank you for submitting your request for doula services');
    });
  });

  describe('Edge cases', () => {
    it('should handle very long text fields', async () => {
      const longTextData = {
        ...mockFormData,
        health_notes: 'A'.repeat(1000),
        service_specifics: 'B'.repeat(1000)
      };

      jest.spyOn(requestFormService, 'newForm').mockResolvedValue(longTextData);

      const response = await request(app)
        .post('/requestService/requestSubmission')
        .send(longTextData)
        .expect(200);

      expect(response.body.message).toBe('Form data received, onto processing');
    });

    it('should handle special characters in text fields', async () => {
      const specialCharData = {
        ...mockFormData,
        firstname: 'José',
        lastname: 'O\'Connor',
        address: '123 Main St, Apt #4',
        health_notes: 'Allergies: Peanuts, Shellfish, Latex'
      };

      jest.spyOn(requestFormService, 'newForm').mockResolvedValue(specialCharData);

      const response = await request(app)
        .post('/requestService/requestSubmission')
        .send(specialCharData)
        .expect(200);

      expect(response.body.message).toBe('Form data received, onto processing');
    });

    it('should handle empty arrays', async () => {
      const emptyArrayData = {
        ...mockFormData,
        services_interested: [],
        demographics_multi: []
      };

      jest.spyOn(requestFormService, 'newForm').mockResolvedValue(emptyArrayData);

      const response = await request(app)
        .post('/requestService/requestSubmission')
        .send(emptyArrayData)
        .expect(200);

      expect(response.body.message).toBe('Form data received, onto processing');
    });
  });

  // NEW: Service Layer Tests
  describe('RequestFormService Tests', () => {
    it('should validate required fields correctly', async () => {
      const invalidData = {
        // Missing firstname and lastname
        email: 'test@example.com',
        phone_number: '555-123-4567',
        service_needed: ServiceTypes.LABOR_SUPPORT,
        address: '123 Main St',
        city: 'Anytown',
        state: STATE.CA,
        zip_code: '90210'
      };

      await expect(requestFormService.newForm(invalidData)).rejects.toThrow(
        'Missing required fields: first name and last name'
      );
    });

    it('should validate email format correctly', async () => {
      const invalidEmailData = {
        ...mockFormData,
        email: 'invalid-email'
      };

      await expect(requestFormService.newForm(invalidEmailData)).rejects.toThrow(
        'Valid email is required'
      );
    });

    it('should validate phone number format correctly', async () => {
      const invalidPhoneData = {
        ...mockFormData,
        phone_number: 'invalid-phone'
      };

      await expect(requestFormService.newForm(invalidPhoneData)).rejects.toThrow(
        'Invalid phone number format'
      );
    });

    it('should validate zip code format correctly', async () => {
      const invalidZipData = {
        ...mockFormData,
        zip_code: 'invalid-zip'
      };

      await expect(requestFormService.newForm(invalidZipData)).rejects.toThrow(
        'Invalid zip code format'
      );
    });

    it('should validate complete address is provided', async () => {
      const incompleteAddressData = {
        ...mockFormData,
        address: '', // Missing address
        city: 'Anytown',
        state: STATE.CA,
        zip_code: '90210'
      };

      await expect(requestFormService.newForm(incompleteAddressData)).rejects.toThrow(
        'Complete address is required'
      );
    });

    it('should validate service_needed is provided', async () => {
      const missingServiceData = {
        ...mockFormData,
        service_needed: undefined
      };

      await expect(requestFormService.newForm(missingServiceData)).rejects.toThrow(
        'Missing required field: service_needed'
      );
    });

    it('should require referral_source on intake', async () => {
      const { referral_source: _rs, referral_source_other: _ro, ...rest } = mockFormData as any;
      await expect(requestFormService.newForm(rest)).rejects.toThrow('referral_source is required');
    });

    it('should require referral_source_other when referral_source is Other', async () => {
      const bad = {
        ...mockFormData,
        referral_source: 'Other',
        referral_source_other: '   ',
      };
      await expect(requestFormService.newForm(bad)).rejects.toThrow('Please describe how you heard about Sokana.');
    });

    it('should reject invalid referral_source', async () => {
      const bad = { ...mockFormData, referral_source: 'Friend' };
      await expect(requestFormService.newForm(bad)).rejects.toThrow('referral_source must be one of:');
    });

    it('should accept Other with referral_source_other', async () => {
      jest.spyOn(requestFormRepository, 'saveData').mockResolvedValue({
        ...mockFormData,
        referral_source: 'Other',
        referral_source_other: 'Neighborhood group',
      } as any);
      const payload = {
        ...mockFormData,
        referral_source: 'Other',
        referral_source_other: 'Neighborhood group',
      };
      await expect(requestFormService.newForm(payload)).resolves.toBeDefined();
      expect(requestFormRepository.saveData).toHaveBeenCalledWith(
        expect.objectContaining({
          referral_source: 'Other',
          referral_source_other: 'Neighborhood group',
        })
      );
    });

    it('should successfully process valid form data', async () => {
      // Mock the repository to return success
      jest.spyOn(requestFormRepository, 'saveData').mockResolvedValue(mockFormData as any);

      const result = await requestFormService.newForm(mockFormData);

      expect(result).toBeDefined();
      expect(requestFormRepository.saveData).toHaveBeenCalledWith(
        expect.objectContaining({
          firstname: 'Jane',
          lastname: 'Doe',
          email: 'jane.doe@example.com',
          home_adults_count: '2',
          home_youth_count: '1',
          home_types: ['House'],
          service_needed: ServiceTypes.LABOR_SUPPORT,
          payment_method: 'Commercial Insurance',
          insurance_provider: 'Blue Cross Blue Shield',
          insurance_member_id: 'MEM-12345',
          insurance_policy_holder_name: 'Jane Q Client',
          insurance_policy_holder_dob: '1990-04-12',
          insurance_policy_holder_relationship: 'Self',
          insurance_plan_type: 'PPO',
          policy_number: 'POL-67890',
          insurance_phone_number: '800-555-1212',
          has_secondary_insurance: false,
          self_pay_card_info: null,
        })
      );
    });

    it('should accept commercial insurance intake and persist billing fields', async () => {
      const payload = {
        ...mockFormData,
        payment_method: 'Private/Commercial Insurance',
        insurance_provider: 'Blue Cross Blue Shield',
        insurance_member_id: 'MEM-12345',
        insurance_plan_type: 'PPO',
        policy_number: 'POL-67890',
        insurance_phone_number: '800-555-1212',
        insurance: 'Blue Cross Blue Shield',
        has_secondary_insurance: false,
        secondary_insurance_provider: null,
        secondary_insurance_member_id: null,
        secondary_policy_number: null,
        self_pay_card_info: null,
      };

      jest.spyOn(requestFormRepository, 'saveData').mockResolvedValue(payload as any);

      await expect(requestFormService.newForm(payload)).resolves.toBeDefined();
      expect(requestFormRepository.saveData).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_method: 'Commercial Insurance',
          insurance_provider: 'Blue Cross Blue Shield',
          insurance_member_id: 'MEM-12345',
          insurance_plan_type: 'PPO',
          policy_number: 'POL-67890',
        })
      );
    });

    it('should reject Medicaid on public intake', async () => {
      const payload = {
        ...mockFormData,
        payment_method: 'Medicaid',
        insurance_provider: 'State Medicaid',
        insurance_member_id: 'MCD-99',
        insurance_plan_type: 'Medicaid',
        policy_number: '',
      };
      await expect(requestFormService.newForm(payload)).rejects.toThrow(/Medicaid/i);
    });

    it('should accept self-pay sliding scale submissions and null out insurance fields', async () => {
      const payload = {
        ...mockFormData,
        payment_method: 'Self-Pay, Sliding Scale Available',
        insurance_provider: 'Should be cleared',
        insurance_member_id: 'Should be cleared',
        policy_number: 'Should be cleared',
        insurance_phone_number: '800-555-1212',
        insurance: 'Should be cleared',
        self_pay_card_info: 'Visa ending 4242',
      };

      jest.spyOn(requestFormRepository, 'saveData').mockResolvedValue(payload as any);

      await expect(requestFormService.newForm(payload)).resolves.toBeDefined();
      expect(requestFormRepository.saveData).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_method: 'Self-Pay, Sliding Scale Available',
          insurance: null,
          insurance_provider: null,
          insurance_member_id: null,
          policy_number: null,
          insurance_phone_number: null,
          has_secondary_insurance: false,
          secondary_insurance_provider: null,
          secondary_insurance_member_id: null,
          secondary_policy_number: null,
          self_pay_card_info: 'Visa ending 4242',
        })
      );
    });

    it('should map CRM Private/Commercial Insurance to Commercial Insurance before save', async () => {
      jest.spyOn(requestFormRepository, 'saveData').mockResolvedValue(mockFormData as any);
      const payload = {
        ...mockFormData,
        payment_method: 'Private/Commercial Insurance',
      };
      await expect(requestFormService.newForm(payload)).resolves.toBeDefined();
      expect(requestFormRepository.saveData).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_method: 'Commercial Insurance',
        })
      );
    });

    it('should reject missing birth_hospital when birth_location is Hospital', async () => {
      await expect(
        requestFormService.newForm({ ...mockFormData, birth_hospital: '  ' })
      ).rejects.toThrow('Please enter the hospital name.');
    });

    it.each([
      ['Home', '123 Oak St, Springfield, IL 62704'],
      ['Birth Center', 'Sunrise Birth Center'],
      ['Other', 'Community birth suite'],
    ])('should accept birth_location %s with place name', async (birth_location, birth_hospital) => {
      jest.spyOn(requestFormRepository, 'saveData').mockResolvedValue(mockFormData as any);
      await expect(
        requestFormService.newForm({ ...mockFormData, birth_location, birth_hospital })
      ).resolves.toBeDefined();
      expect(requestFormRepository.saveData).toHaveBeenCalledWith(
        expect.objectContaining({ birth_location, birth_hospital })
      );
    });

    it('should map CRM Family Doctor provider label to Family Physician', async () => {
      jest.spyOn(requestFormRepository, 'saveData').mockResolvedValue({
        ...mockFormData,
        provider_type: ProviderType.FAMILY_PHYSICIAN,
      } as any);
      const payload = {
        ...mockFormData,
        provider_type: 'Family Doctor',
      };
      await expect(requestFormService.newForm(payload)).resolves.toBeDefined();
      expect(requestFormRepository.saveData).toHaveBeenCalledWith(
        expect.objectContaining({
          provider_type: ProviderType.FAMILY_PHYSICIAN,
        })
      );
    });

    it('should reject invalid client age', async () => {
      await expect(
        requestFormService.newForm({ ...mockFormData, age: 0 })
      ).rejects.toThrow('age must be between 1 and 120');
    });

    it('should require secondary insurance fields when the secondary path is enabled', async () => {
      const payload = {
        ...mockFormData,
        payment_method: 'Private/Commercial Insurance',
        has_secondary_insurance: true,
        secondary_insurance_provider: 'Kaiser Secondary',
        secondary_insurance_member_id: 'SEC-12345',
        secondary_policy_number: 'SEC-POL-1',
        insurance_plan_type: 'PPO',
      };

      jest.spyOn(requestFormRepository, 'saveData').mockResolvedValue(payload as any);

      await expect(requestFormService.newForm(payload)).resolves.toBeDefined();
      expect(requestFormRepository.saveData).toHaveBeenCalledWith(
        expect.objectContaining({
          has_secondary_insurance: true,
          secondary_insurance_provider: 'Kaiser Secondary',
          secondary_insurance_member_id: 'SEC-12345',
          secondary_policy_number: 'SEC-POL-1',
        })
      );
    });
  });

  // NEW: Repository Layer Tests
  describe('RequestFormRepository Tests', () => {
    it('should save form data to database successfully', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ client_number: 'CL-00001' }],
      });

      const repository = new RequestFormRepository({} as any);
      const result = await repository.saveData(mockFormData);

      expect(result).toEqual(expect.objectContaining({
        firstname: 'Jane',
        lastname: 'Doe',
        email: 'jane.doe@example.com',
        payment_method: 'Private/Commercial Insurance',
        insurance_provider: 'Blue Cross Blue Shield',
      }));
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO phi_clients'),
        expect.arrayContaining([
          expect.any(String),
          'Jane',
          'Doe',
          'jane.doe@example.com',
        ])
      );
    });

    it('should handle database errors gracefully', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Database connection failed'));
      const repository = new RequestFormRepository({} as any);

      await expect(repository.saveData(mockFormData)).rejects.toThrow(
        'Database connection failed'
      );
    });

    it('should include all form fields in database insert', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ client_number: 'CL-00001' }],
      });
      const repository = new RequestFormRepository({} as any);
      await repository.saveData(mockFormData);

      const [sql, params] = mockQuery.mock.calls[0];

      // Check that all form fields are included
      expect(sql).toContain('insurance_phone_number');
      expect(sql).toContain('has_secondary_insurance');
      expect(sql).toContain('secondary_insurance_provider');
      expect(sql).toContain('secondary_insurance_member_id');
      expect(sql).toContain('secondary_policy_number');
      expect(sql).toContain('self_pay_card_info');
      expect(sql).toContain('insurance_policy_holder_name');
      expect(sql).toContain('insurance_plan_type');
      expect(sql).toContain('referral_source');
      expect(sql).toContain('referral_source_other');
      expect(sql).toContain('city');
      expect(sql).toContain('intake_age_years');
      expect(sql).toContain('services_interested');
      expect(sql).toContain('home_adults_count');
      expect(sql).toContain('home_types');
      expect(params[17]).toBe('Front door accessible');
      expect(params[18]).toEqual(['House']);
      expect(params[20]).toBe('2');
      expect(params[21]).toBe('1');
      expect(params[42]).toBe('Google');
      expect(params[43]).toBe('Sarah Smith');
      expect(params[44]).toBe('sarah@example.com');
      expect(params[45]).toBeNull();
      expect(params[46]).toBe('Blue Cross Blue Shield');
      expect(params[9]).toBe('Hospital');
      expect(params[10]).toBe('City General Hospital');
      expect(params[47]).toBe('Private/Commercial Insurance');
      expect(params[48]).toBe('Blue Cross Blue Shield');
      expect(params[49]).toBe('MEM-12345');
      expect(params[50]).toBe('Jane Q Client');
      expect(params[51]).toBe('1990-04-12');
      expect(params[52]).toBe('Self');
      expect(params[53]).toBe('PPO');
      expect(params[54]).toBe('POL-67890');
      expect(params[55]).toBe('800-555-1212');
      expect(params[56]).toBe(false);
      expect(params[57]).toBeNull();
      expect(params[58]).toBeNull();
      expect(params[59]).toBeNull();
      expect(params[60]).toBeNull();
      expect(params[61]).toBe('lead');
      expect(params[62]).toBe(mockFormData.service_needed);
      expect(params[63]).toBe('not_invited');
      expect(params[64]).toEqual(expect.any(String));
    });

    it('should null out insurance fields for Self-Pay submissions before persisting and returning the record', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ client_number: 'CL-00002' }],
      });
      const repository = new RequestFormRepository({} as any);

      const result = await repository.saveData({
        ...mockFormData,
        payment_method: 'Self-Pay',
        insurance: 'Should be cleared',
        insurance_provider: 'Should be cleared',
        insurance_member_id: 'Should be cleared',
        policy_number: 'Should be cleared',
        insurance_phone_number: '800-555-1212',
        has_secondary_insurance: true,
        secondary_insurance_provider: 'Should be cleared',
        secondary_insurance_member_id: 'Should be cleared',
        secondary_policy_number: 'Should be cleared',
        self_pay_card_info: 'Visa ending 4242',
      });

      expect(result).toEqual(expect.objectContaining({
        payment_method: 'Self-Pay',
        insurance: null,
        insurance_provider: null,
        insurance_member_id: null,
        insurance_policy_holder_name: null,
        insurance_policy_holder_dob: null,
        insurance_policy_holder_relationship: null,
        insurance_plan_type: null,
        policy_number: null,
        insurance_phone_number: null,
        has_secondary_insurance: false,
        secondary_insurance_provider: null,
        secondary_insurance_member_id: null,
        secondary_policy_number: null,
        self_pay_card_info: 'Visa ending 4242',
      }));

      const [, params] = mockQuery.mock.calls[0];
      expect(params[42]).toBe('Google');
      expect(params[43]).toBe('Sarah Smith');
      expect(params[44]).toBe('sarah@example.com');
      expect(params[45]).toBeNull();
      expect(params[46]).toBeNull();
      expect(params[47]).toBe('Self-Pay');
      expect(params[48]).toBeNull();
      expect(params[49]).toBeNull();
      expect(params[50]).toBeNull();
      expect(params[51]).toBeNull();
      expect(params[52]).toBeNull();
      expect(params[53]).toBeNull();
      expect(params[54]).toBeNull();
      expect(params[55]).toBeNull();
      expect(params[56]).toBe(false);
      expect(params[57]).toBeNull();
      expect(params[58]).toBeNull();
      expect(params[59]).toBeNull();
      expect(params[60]).toBe('Visa ending 4242');
      expect(params[61]).toBe('lead');
      expect(params[62]).toBe(mockFormData.service_needed);
      expect(params[63]).toBe('not_invited');
      expect(params[64]).toEqual(expect.any(String));
    });
  });

  // NEW: Email Service Tests
  describe('Email Service Tests', () => {
    it('should send email with correct configuration', async () => {
      const mockTransporter = {
        sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' })
      };

      const emailService = new NodemailerService();
      (emailService as any).transporter = mockTransporter;

      await emailService.sendEmail(
        'test@example.com',
        'Test Subject',
        'Test text content',
        '<p>Test HTML content</p>'
      );

      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: expect.any(String),
        to: 'test@example.com',
        subject: 'Test Subject',
        text: 'Test text content',
        html: '<p>Test HTML content</p>'
      });
    });

    it('should handle email sending errors', async () => {
      const mockTransporter = {
        sendMail: jest.fn().mockRejectedValue(new Error('SMTP error'))
      };

      const emailService = new NodemailerService();
      (emailService as any).transporter = mockTransporter;

      await expect(emailService.sendEmail(
        'test@example.com',
        'Test Subject',
        'Test content'
      )).rejects.toThrow('Failed to send email: SMTP error');
    });
  });
});

describe('DELETE /clients/delete', () => {
  let app: express.Application;
  let mockDeleteClient: jest.Mock;

  beforeEach(() => {
    mockDeleteClient = jest.fn();

    app = express();
    app.use(express.json());

    // Create a simple route that mimics the controller behavior
    app.delete('/clients/delete', (req, res) => {
      const { id } = req.body;

      if (!id) {
        res.status(400).json({ error: 'Missing client ID' });
        return;
      }

      try {
        mockDeleteClient(id);
        res.status(204).send();
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  });

  it('should delete a client when given a valid ID', async () => {
    const response = await request(app)
      .delete('/clients/delete')
      .send({ id: 'test-client-id' })
      .expect(204);

    expect(mockDeleteClient).toHaveBeenCalledWith('test-client-id');
  });

  it('should return 400 if no ID is provided', async () => {
    const response = await request(app)
      .delete('/clients/delete')
      .send({})
      .expect(400);

    expect(response.body.error).toBe('Missing client ID');
  });

  it('should handle repository errors gracefully', async () => {
    mockDeleteClient.mockImplementation(() => {
      throw new Error('DB error');
    });

    const response = await request(app)
      .delete('/clients/delete')
      .send({ id: 'test-client-id' })
      .expect(500);

    expect(response.body.error).toBe('DB error');
  });
});
