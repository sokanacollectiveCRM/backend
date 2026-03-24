import { ClientDocumentUploadService } from '../services/clientDocumentUploadService';

describe('ClientDocumentUploadService', () => {
  it('creates the client-documents bucket with image and pdf mime types', async () => {
    const upload = jest.fn().mockResolvedValue({ error: null });
    const from = jest.fn().mockReturnValue({ upload });
    const createBucket = jest.fn().mockResolvedValue({ error: null });
    const getBucket = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'Bucket not found' },
    });

    const supabaseClient = {
      storage: {
        getBucket,
        createBucket,
        from,
      },
    } as any;

    const service = new ClientDocumentUploadService(supabaseClient);

    await service.uploadDocument(
      {
        originalname: 'insurance-card.pdf',
        mimetype: 'application/pdf',
        size: 1024,
        buffer: Buffer.from('fake-pdf'),
      } as any,
      'client-123',
      'insurance_card'
    );

    expect(createBucket).toHaveBeenCalledWith('client-documents', {
      public: false,
      fileSizeLimit: '10MB',
      allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
    });
    expect(from).toHaveBeenCalledWith('client-documents');
    expect(upload).toHaveBeenCalledWith(
      expect.stringMatching(/^client-123\/insurance_card\/\d+_insurance-card\.pdf$/),
      expect.any(Buffer),
      {
        contentType: 'application/pdf',
        upsert: false,
      }
    );
  });
});
