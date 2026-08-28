import { DoulaDocumentUploadService } from '../services/doulaDocumentUploadService';
import { deleteObject, uploadObject } from '../services/gcs/documentStorage';

jest.mock('../services/gcs/documentStorage', () => ({
  GCS_PREFIX: { doulaDocuments: 'doula-documents' },
  objectPath: (prefix: string, relative: string) => `${prefix}/${relative}`,
  uploadObject: jest.fn().mockResolvedValue(undefined),
  deleteObject: jest.fn().mockResolvedValue(undefined),
}));

describe('DoulaDocumentUploadService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uploads to GCS under doula-documents/ with relative filePath for DB', async () => {
    const service = new DoulaDocumentUploadService();

    const result = await service.uploadDocument(
      {
        originalname: 'background-check.pdf',
        mimetype: 'application/pdf',
        size: 2048,
        buffer: Buffer.from('fake-pdf'),
      } as any,
      'doula-123',
      'background_check'
    );

    expect(result.fileName).toBe('background-check.pdf');
    expect(result.filePath).toMatch(
      /^doula-123\/background_check\/\d+_background-check\.pdf$/
    );
    expect(uploadObject).toHaveBeenCalledWith(
      expect.stringMatching(
        /^doula-documents\/doula-123\/background_check\/\d+_background-check\.pdf$/
      ),
      expect.any(Buffer),
      'application/pdf',
      false
    );
  });

  it('rejects unsupported mime types before touching GCS', async () => {
    const service = new DoulaDocumentUploadService();

    await expect(
      service.uploadDocument(
        {
          originalname: 'notes.txt',
          mimetype: 'text/plain',
          size: 12,
          buffer: Buffer.from('hello'),
        } as any,
        'doula-123',
        'background_check'
      )
    ).rejects.toThrow(/Unsupported doula document mime type/);

    expect(uploadObject).not.toHaveBeenCalled();
  });

  it('deletes GCS objects using the doula-documents prefix', async () => {
    const service = new DoulaDocumentUploadService();
    await service.deleteDocument('doula-123/background_check/x_file.pdf');

    expect(deleteObject).toHaveBeenCalledWith(
      'doula-documents/doula-123/background_check/x_file.pdf'
    );
  });
});
