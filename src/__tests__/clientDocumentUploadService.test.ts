import { ClientDocumentUploadService } from '../services/clientDocumentUploadService';

jest.mock('../supabase', () => ({
  getSupabaseAdmin: jest.fn(),
}));

import { getSupabaseAdmin } from '../supabase';

describe('ClientDocumentUploadService', () => {
  it('creates the client-documents bucket with image/pdf mime types and uploads via service admin client', async () => {
    const upload = jest.fn().mockResolvedValue({ error: null });
    const remove = jest.fn().mockResolvedValue({ error: null });
    const from = jest.fn().mockReturnValue({ upload, remove });
    const createBucket = jest.fn().mockResolvedValue({ error: null });
    const updateBucket = jest.fn().mockResolvedValue({ error: null });
    const getBucket = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'Bucket not found' },
    });

    (getSupabaseAdmin as jest.Mock).mockReturnValue({
      storage: {
        getBucket,
        createBucket,
        updateBucket,
        from,
      },
    });

    const service = new ClientDocumentUploadService();

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

    expect(getBucket).toHaveBeenCalledWith('client-documents');
    expect(createBucket).toHaveBeenCalledWith('client-documents', {
      public: false,
      fileSizeLimit: '10MB',
      allowedMimeTypes: expect.arrayContaining([
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
        'image/heic',
        'image/heif',
        'application/pdf',
      ]),
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

  it('removes objects using the admin storage client', async () => {
    const remove = jest.fn().mockResolvedValue({ error: null });
    const from = jest.fn().mockReturnValue({ remove });
    (getSupabaseAdmin as jest.Mock).mockReturnValue({
      storage: {
        getBucket: jest.fn().mockResolvedValue({ data: { id: 'client-documents' }, error: null }),
        updateBucket: jest.fn().mockResolvedValue({ error: null }),
        from,
      },
    });

    const service = new ClientDocumentUploadService();
    await service.deleteDocument('client-123/insurance_card/x_file.pdf');

    expect(from).toHaveBeenCalledWith('client-documents');
    expect(remove).toHaveBeenCalledWith(['client-123/insurance_card/x_file.pdf']);
  });
});
