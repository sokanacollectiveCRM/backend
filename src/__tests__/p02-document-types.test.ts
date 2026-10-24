import { UPLOADABLE_DOULA_DOCUMENT_TYPES } from '../constants/doulaDocuments';
import {
  DOCUMENT_SIZE_LIMIT,
  DOCUMENT_TYPE_ERROR,
  validateDocumentFile,
} from '../security/documentUpload';
import { ClientDocumentUploadService } from '../services/clientDocumentUploadService';
import { DoulaDocumentUploadService } from '../services/doulaDocumentUploadService';
import { uploadObject } from '../services/gcs/documentStorage';
import { DOCUMENT_FIXTURES } from '../test/fixtures/documentFiles';

jest.mock('../services/gcs/documentStorage', () => ({
  GCS_PREFIX: {
    doulaDocuments: 'doula-documents',
    clientDocuments: 'client-documents',
  },
  objectPath: (prefix: string, path: string) => `${prefix}/${path}`,
  uploadObject: jest.fn().mockResolvedValue(undefined),
}));
const formats = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  pdf: 'application/pdf',
};
const fields = [
  ...UPLOADABLE_DOULA_DOCUMENT_TYPES,
  'insurance_front',
  'insurance_back',
];
const doula = new DoulaDocumentUploadService();
const client = new ClientDocumentUploadService();
function upload(field: string, file: any) {
  return field.startsWith('insurance_')
    ? client.uploadDocument(file, 'fictional-client', 'insurance_card')
    : doula.uploadDocument(file, 'fictional-doula', field);
}
beforeEach(() => jest.clearAllMocks());
describe.each(fields)('P-02 backend document field %s', (field) => {
  it.each(Object.keys(formats) as (keyof typeof formats)[])(
    'accepts real %s bytes and uppercase extensions',
    async (extension) => {
      const buffer = Buffer.from(
        DOCUMENT_FIXTURES[extension === 'jpeg' ? 'jpg' : extension],
        'base64'
      );
      for (const suffix of [extension, extension.toUpperCase()]) {
        await expect(
          upload(field, {
            originalname: `fictional.${suffix}`,
            mimetype: formats[extension],
            buffer,
            size: buffer.length,
          })
        ).resolves.toMatchObject({ mimeType: formats[extension] });
      }
      expect(uploadObject).toHaveBeenCalledTimes(2);
    }
  );
  it.each(['exe', 'docx', 'gif', 'pdf'])(
    'rejects unsupported or disguised %s without storage access',
    async (extension) => {
      await expect(
        upload(field, {
          originalname: `fictional.${extension}`,
          mimetype: 'application/pdf',
          buffer: Buffer.from('fictional text'),
          size: 14,
        })
      ).rejects.toThrow(DOCUMENT_TYPE_ERROR);
      expect(uploadObject).not.toHaveBeenCalled();
    }
  );
});
it('rejects conflicting MIME, extension and oversized content', () => {
  const buffer = Buffer.from(DOCUMENT_FIXTURES.pdf, 'base64');
  expect(
    validateDocumentFile({
      originalname: 'fictional.jpg',
      mimetype: 'image/jpeg',
      buffer,
      size: buffer.length,
    })
  ).toBe(DOCUMENT_TYPE_ERROR);
  expect(
    validateDocumentFile({
      originalname: 'fictional.pdf',
      mimetype: 'image/png',
      buffer,
      size: buffer.length,
    })
  ).toBe(DOCUMENT_TYPE_ERROR);
  expect(
    validateDocumentFile({
      originalname: 'fictional.pdf',
      mimetype: 'application/pdf',
      buffer,
      size: DOCUMENT_SIZE_LIMIT + 1,
    })
  ).toMatch(/10MB/);
});
