/**
 * Unit tests for Doula Document Completeness service
 */
import { DoulaDocumentCompletenessService } from '../services/doulaDocumentCompletenessService';
import { DoulaDocumentRepository } from '../repositories/doulaDocumentRepository';

describe('DoulaDocumentCompletenessService', () => {
  let mockRepo: jest.Mocked<DoulaDocumentRepository>;
  let service: DoulaDocumentCompletenessService;

  beforeEach(() => {
    mockRepo = {
      getCurrentDocumentsByDoulaId: jest.fn(),
    } as unknown as jest.Mocked<DoulaDocumentRepository>;
    service = new DoulaDocumentCompletenessService(mockRepo);
  });

  it('returns canBeActive false when no documents', async () => {
    (mockRepo.getCurrentDocumentsByDoulaId as jest.Mock).mockResolvedValue([]);

    const result = await service.getCompleteness('doula-1');

    expect(result.totalRequired).toBe(5);
    expect(result.totalComplete).toBe(0);
    expect(result.missingTypes).toHaveLength(5);
    expect(result.hasAllRequiredDocuments).toBe(false);
    expect(result.canBeActive).toBe(false);
    expect(result.items).toHaveLength(5);
  });

  it('returns canBeActive false when some documents uploaded but not approved', async () => {
    (mockRepo.getCurrentDocumentsByDoulaId as jest.Mock).mockResolvedValue([
      { documentType: 'background_check', status: 'uploaded' },
      { documentType: 'liability_insurance_certificate', status: 'approved' },
    ]);

    const result = await service.getCompleteness('doula-1');

    expect(result.totalComplete).toBe(1);
    expect(result.canBeActive).toBe(false);
    expect(result.missingTypes.length).toBeGreaterThan(0);
  });

  it('returns canBeActive true when all 5 required docs are approved', async () => {
    const approved = [
      'background_check',
      'liability_insurance_certificate',
      'training_certificate',
      'w9',
      'direct_deposit_form',
    ].map((t) => ({ documentType: t, status: 'approved' }));

    (mockRepo.getCurrentDocumentsByDoulaId as jest.Mock).mockResolvedValue(approved);

    const result = await service.getCompleteness('doula-1');

    expect(result.totalComplete).toBe(5);
    expect(result.hasAllRequiredDocuments).toBe(true);
    expect(result.canBeActive).toBe(true);
    expect(result.missingTypes).toHaveLength(0);
  });

  it('returns canBeActive false when any doc is rejected', async () => {
    const docs = [
      { documentType: 'background_check', status: 'approved' },
      { documentType: 'liability_insurance_certificate', status: 'approved' },
      { documentType: 'training_certificate', status: 'approved' },
      { documentType: 'w9', status: 'rejected' },
      { documentType: 'direct_deposit_form', status: 'approved' },
    ];

    (mockRepo.getCurrentDocumentsByDoulaId as jest.Mock).mockResolvedValue(docs);

    const result = await service.getCompleteness('doula-1');

    expect(result.canBeActive).toBe(false);
    expect(result.items.some((i) => i.status === 'rejected')).toBe(true);
  });
});
