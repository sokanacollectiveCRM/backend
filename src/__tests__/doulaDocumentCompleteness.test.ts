import { REQUIRED_DOULA_DOCUMENT_TYPES } from '../constants/doulaDocuments';
/**
 * Unit tests for Doula Document Completeness service
 */
import { DoulaDocumentRepository } from '../repositories/doulaDocumentRepository';
import { DoulaDocumentCompletenessService } from '../services/doulaDocumentCompletenessService';

describe('DoulaDocumentCompletenessService', () => {
  let mockRepo: jest.Mocked<DoulaDocumentRepository>;
  let service: DoulaDocumentCompletenessService;

  beforeEach(() => {
    mockRepo = {
      getCurrentDocumentsByDoulaId: jest.fn(),
    } as unknown as jest.Mocked<DoulaDocumentRepository>;
    service = new DoulaDocumentCompletenessService(mockRepo);
  });

  it('treats the configured uploads as required', async () => {
    (mockRepo.getCurrentDocumentsByDoulaId as jest.Mock).mockResolvedValue([]);

    const result = await service.getCompleteness('doula-1');

    expect(result.totalRequired).toBe(3);
    expect(result.totalComplete).toBe(0);
    expect(result.missingTypes).toEqual(REQUIRED_DOULA_DOCUMENT_TYPES);
    expect(result.hasAllRequiredDocuments).toBe(false);
    expect(result.canBeActive).toBe(false);
    expect(result.items).toHaveLength(3);
    expect(result.items[0].documentType).toBe('training_certificate');
  });

  it('returns canBeActive false when the training certificate is uploaded but not approved', async () => {
    (mockRepo.getCurrentDocumentsByDoulaId as jest.Mock).mockResolvedValue([
      { documentType: 'training_certificate', status: 'uploaded' },
      { documentType: 'liability_insurance_certificate', status: 'approved' },
    ]);

    const result = await service.getCompleteness('doula-1');

    expect(result.totalComplete).toBe(0);
    expect(result.canBeActive).toBe(false);
    expect(result.missingTypes).toEqual(['w9', 'direct_deposit_form']);
    expect(result.items[0].status).toBe('uploaded');
  });

  it('returns canBeActive true when the training certificate is approved', async () => {
    (mockRepo.getCurrentDocumentsByDoulaId as jest.Mock).mockResolvedValue([
      { documentType: 'training_certificate', status: 'approved' },
      { documentType: 'w9', status: 'approved' },
      { documentType: 'direct_deposit_form', status: 'approved' },
    ]);

    const result = await service.getCompleteness('doula-1');

    expect(result.totalComplete).toBe(3);
    expect(result.hasAllRequiredDocuments).toBe(true);
    expect(result.canBeActive).toBe(true);
    expect(result.missingTypes).toHaveLength(0);
  });

  it('treats liability insurance as optional', async () => {
    (mockRepo.getCurrentDocumentsByDoulaId as jest.Mock).mockResolvedValue([
      { documentType: 'training_certificate', status: 'approved' },
      { documentType: 'w9', status: 'approved' },
      { documentType: 'direct_deposit_form', status: 'approved' },
    ]);

    const result = await service.getCompleteness('doula-1');

    expect(result.canBeActive).toBe(true);
    expect(result.items.map((item) => item.documentType)).toEqual([
      'training_certificate',
      'w9',
      'direct_deposit_form',
    ]);
  });

  it('returns canBeActive false when the training certificate is rejected', async () => {
    (mockRepo.getCurrentDocumentsByDoulaId as jest.Mock).mockResolvedValue([
      { documentType: 'training_certificate', status: 'rejected' },
    ]);

    const result = await service.getCompleteness('doula-1');

    expect(result.canBeActive).toBe(false);
    expect(result.items.some((i) => i.status === 'rejected')).toBe(true);
  });

  it('ignores archived rows when the training certificate is approved', async () => {
    (mockRepo.getCurrentDocumentsByDoulaId as jest.Mock).mockResolvedValue([
      { documentType: 'training_certificate', status: 'approved' },
      { documentType: 'w9', status: 'approved' },
      { documentType: 'direct_deposit_form', status: 'approved' },
      { documentType: 'background_check', status: 'uploaded' },
      { documentType: 'cpr', status: 'rejected' },
      { documentType: 'direct_deposit_form', status: 'approved' },
      { documentType: 'liability_insurance_certificate', status: 'missing' },
    ]);

    const result = await service.getCompleteness('doula-1');

    expect(result.canBeActive).toBe(true);
    expect(result.totalRequired).toBe(3);
    expect(result.missingTypes).toEqual([]);
  });
});
