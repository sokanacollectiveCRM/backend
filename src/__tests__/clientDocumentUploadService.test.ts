import { ClientDocumentUploadService } from '../services/clientDocumentUploadService';
import { deleteObject, uploadObject } from '../services/gcs/documentStorage';

jest.mock('../services/gcs/documentStorage', () => ({
  GCS_PREFIX: { clientDocuments: 'client-documents' },
  objectPath: (prefix: string, relative: string) => `${prefix}/${relative}`,
  uploadObject: jest.fn().mockResolvedValue(undefined),
  deleteObject: jest.fn().mockResolvedValue(undefined),
}));

describe('ClientDocumentUploadService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uploads to GCS under client-documents/ with relative filePath for Cloud SQL', async () => {
    const service = new ClientDocumentUploadService();

    const result = await service.uploadDocument(
      {
        originalname: 'insurance-card.pdf',
        mimetype: 'application/pdf',
        size: 1024,
        buffer: Buffer.from('%PDF-1.4 fictional fixture'),
      } as any,
      'client-123',
      'insurance_card'
    );

    expect(result.fileName).toBe('insurance-card.pdf');
    expect(result.filePath).toMatch(
      /^client-123\/insurance_card\/\d+_insurance-card\.pdf$/
    );
    expect(uploadObject).toHaveBeenCalledWith(
      expect.stringMatching(
        /^client-documents\/client-123\/insurance_card\/\d+_insurance-card\.pdf$/
      ),
      expect.any(Buffer),
      'application/pdf',
      false
    );
  });

  it('rejects unsupported mime types before touching GCS', async () => {
    const service = new ClientDocumentUploadService();

    await expect(
      service.uploadDocument(
        {
          originalname: 'notes.txt',
          mimetype: 'text/plain',
          size: 12,
          buffer: Buffer.from('hello'),
        } as any,
        'client-123',
        'insurance_card'
      )
    ).rejects.toThrow(/Please upload a JPEG, PNG or PDF/);

    expect(uploadObject).not.toHaveBeenCalled();
  });

  it('deletes GCS objects using the client-documents prefix', async () => {
    const service = new ClientDocumentUploadService();
    await service.deleteDocument('client-123/insurance_card/x_file.pdf');

    expect(deleteObject).toHaveBeenCalledWith(
      'client-documents/client-123/insurance_card/x_file.pdf'
    );
  });
});
