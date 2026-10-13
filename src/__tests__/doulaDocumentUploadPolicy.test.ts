import { DoulaController } from '../controllers/doulaController';
import type { AuthRequest } from '../types';

jest.mock('../services/cloudSqlTeamService', () => ({
  CloudSqlTeamService: jest.fn().mockImplementation(() => ({
    getTeamMemberById: jest.fn().mockResolvedValue(null),
    getDoulaByEmail: jest.fn().mockResolvedValue(null),
  })),
}));

describe('DoulaController.uploadDocument document types', () => {
  const doulaId = 'doula-owner-1';

  function buildController(overrides: {
    repo?: Record<string, jest.Mock>;
    upload?: Record<string, jest.Mock>;
  }) {
    return new DoulaController(
      (overrides.repo ?? {}) as any,
      {} as any,
      {} as any,
      {} as any,
      (overrides.upload ?? {}) as any,
      {} as any,
      {} as any
    );
  }

  function buildRes() {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  }

  function buildReq(documentType: string) {
    return {
      user: { id: doulaId, role: 'doula' },
      body: { document_type: documentType },
      file: {
        originalname: 'certificate.pdf',
        mimetype: 'application/pdf',
        size: 1024,
        buffer: Buffer.from('%PDF'),
      },
    } as unknown as AuthRequest;
  }

  it.each(['background_check', 'w9', 'direct_deposit_form'])(
    'returns 400 when uploading retired type %s',
    async (documentType) => {
      const uploadDocument = jest.fn();
      const controller = buildController({
        upload: { uploadDocument },
      });
      const res = buildRes();

      await controller.uploadDocument(buildReq(documentType), res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: expect.stringMatching(/no longer accepted/i),
      });
      expect(uploadDocument).not.toHaveBeenCalled();
    }
  );

  it.each(['illinois_medicaid_certification', 'miscellaneous'])(
    'uploads new document type %s',
    async (documentType) => {
      const uploadDocument = jest.fn().mockResolvedValue({
        filePath: `${doulaId}/${documentType}/file.pdf`,
        fileName: 'certificate.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
      });
      const createDocument = jest.fn().mockResolvedValue({
        id: 'doc-1',
        documentType,
        fileName: 'certificate.pdf',
        filePath: `${doulaId}/${documentType}/file.pdf`,
        fileSize: 1024,
        uploadedAt: new Date('2026-10-13T12:00:00.000Z'),
        status: 'uploaded',
      });
      const getSignedUrl = jest
        .fn()
        .mockResolvedValue('https://example.test/file.pdf');
      const getCurrentDocumentByType = jest.fn();
      const controller = buildController({
        repo: {
          createDocument,
          getSignedUrl,
          getCurrentDocumentByType,
          deleteDocument: jest.fn(),
        },
        upload: { uploadDocument, deleteDocument: jest.fn() },
      });
      const res = buildRes();

      await controller.uploadDocument(buildReq(documentType), res);

      expect(uploadDocument).toHaveBeenCalledWith(
        expect.objectContaining({ mimetype: 'application/pdf' }),
        doulaId,
        documentType
      );
      expect(createDocument).toHaveBeenCalledWith(
        expect.objectContaining({ documentType, doulaId })
      );
      expect(res.status).toHaveBeenCalledWith(201);
      if (documentType === 'miscellaneous') {
        expect(getCurrentDocumentByType).not.toHaveBeenCalled();
      }
    }
  );

  it('keeps every miscellaneous upload instead of replacing the previous file', async () => {
    const uploadDocument = jest.fn().mockResolvedValue({
      filePath: `${doulaId}/miscellaneous/file.pdf`,
      fileName: 'notes.pdf',
      fileSize: 100,
      mimeType: 'application/pdf',
    });
    const deleteStored = jest.fn();
    const createDocument = jest.fn().mockResolvedValue({
      id: 'doc-2',
      documentType: 'miscellaneous',
      fileName: 'notes.pdf',
      filePath: `${doulaId}/miscellaneous/file.pdf`,
      fileSize: 100,
      uploadedAt: new Date('2026-10-13T12:00:00.000Z'),
      status: 'uploaded',
    });
    const controller = buildController({
      repo: {
        createDocument,
        getSignedUrl: jest.fn().mockResolvedValue('https://example.test/file'),
        getCurrentDocumentByType: jest.fn().mockResolvedValue({
          id: 'existing',
          filePath: 'old.pdf',
        }),
        deleteDocument: jest.fn(),
      },
      upload: { uploadDocument, deleteDocument: deleteStored },
    });
    const res = buildRes();

    await controller.uploadDocument(buildReq('miscellaneous'), res);

    expect(deleteStored).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
