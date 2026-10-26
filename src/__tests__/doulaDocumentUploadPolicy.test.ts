import { DoulaController } from '../controllers/doulaController';
import { getPool } from '../db/cloudSqlPool';
import { DOCUMENT_TYPE_ERROR } from '../security/documentUpload';
import { DOCUMENT_FIXTURES } from '../test/fixtures/documentFiles';
import { type AuthRequest, ROLE } from '../types';

jest.mock('../services/cloudSqlTeamService', () => ({
  CloudSqlTeamService: jest.fn().mockImplementation(() => ({
    getTeamMemberById: jest.fn().mockResolvedValue(null),
    getDoulaByEmail: jest.fn().mockResolvedValue(null),
  })),
}));

jest.mock('../db/cloudSqlPool', () => ({ getPool: jest.fn() }));

describe('DoulaController.uploadDocument document types', () => {
  beforeEach(() => {
    (getPool as jest.Mock).mockReturnValue({
      query: jest
        .fn()
        .mockResolvedValue({ rows: [{ id: 'fictional-target' }] }),
    });
  });
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
        buffer: Buffer.from('%PDF-1.4 fictional fixture'),
      },
    } as unknown as AuthRequest;
  }

  it.each(['background_check'])(
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

  it.each([
    'illinois_medicaid_certification',
    'miscellaneous',
    'w9',
    'direct_deposit_form',
    'cpr',
    'hipaa',
  ])('uploads new document type %s', async (documentType) => {
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
  });

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
  it.each(['jpg', 'jpeg', 'png', 'pdf'])(
    'admin certification uploads accept %s and uppercase extensions',
    async (extension) => {
      const buffer = Buffer.from(
        DOCUMENT_FIXTURES[extension === 'jpeg' ? 'jpg' : extension],
        'base64'
      );
      const mime =
        extension === 'pdf'
          ? 'application/pdf'
          : extension === 'png'
            ? 'image/png'
            : 'image/jpeg';
      const uploadDocument = jest.fn().mockResolvedValue({
        filePath: 'fictional/path',
        fileName: `fictional.${extension}`,
        fileSize: buffer.length,
        mimeType: mime,
      });
      const controller = buildController({
        repo: {
          getCurrentDocumentByType: jest.fn(),
          createDocument: jest.fn().mockResolvedValue({
            id: 'fictional-doc',
            filePath: 'fictional/path',
          }),
          getSignedUrl: jest
            .fn()
            .mockResolvedValue('https://example.test/signed'),
        },
        upload: { uploadDocument },
      });
      (
        controller as any
      ).cloudSqlTeamService.getTeamMemberById.mockResolvedValue({
        role: 'doula',
        id: 'fictional-target',
      });
      for (const suffix of [extension, extension.toUpperCase()]) {
        const req = buildReq('training_certificate');
        req.user = { ...req.user, role: ROLE.ADMIN } as AuthRequest['user'];
        req.tenant = { id: 'fictional-tenant' } as AuthRequest['tenant'];
        req.file = {
          originalname: `fictional.${suffix}`,
          mimetype: mime,
          buffer,
          size: buffer.length,
        } as any;
        const res = buildRes();
        await controller.uploadDocument(req, res, 'fictional-target');
        expect(res.status).toHaveBeenCalledWith(201);
      }
      expect(uploadDocument).toHaveBeenCalledWith(
        expect.anything(),
        'fictional-target',
        'training_certificate'
      );
    }
  );

  it.each(['exe', 'docx', 'gif', 'pdf'])(
    'admin certification rejects unsupported/disguised %s before replacing documents',
    async (extension) => {
      const getCurrentDocumentByType = jest.fn();
      const uploadDocument = jest.fn();
      const controller = buildController({
        repo: { getCurrentDocumentByType },
        upload: { uploadDocument },
      });
      (
        controller as any
      ).cloudSqlTeamService.getTeamMemberById.mockResolvedValue({
        role: 'doula',
      });
      const req = buildReq('training_certificate');
      req.user = { ...req.user, role: ROLE.ADMIN } as AuthRequest['user'];
      req.tenant = { id: 'fictional-tenant' } as AuthRequest['tenant'];
      req.file = {
        originalname: `fictional.${extension}`,
        mimetype: 'application/pdf',
        buffer: Buffer.from('fictional text'),
        size: 14,
      } as any;
      const res = buildRes();
      await controller.uploadDocument(req, res, 'fictional-target');
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: DOCUMENT_TYPE_ERROR });
      expect(getCurrentDocumentByType).not.toHaveBeenCalled();
      expect(uploadDocument).not.toHaveBeenCalled();
    }
  );

  it('does not let doulas target another user through the admin upload helper', async () => {
    const uploadDocument = jest.fn();
    const controller = buildController({ upload: { uploadDocument } });
    const res = buildRes();
    await controller.uploadDocument(
      buildReq('training_certificate'),
      res,
      'fictional-other'
    );
    expect(res.status).toHaveBeenCalledWith(403);
    expect(uploadDocument).not.toHaveBeenCalled();
  });
  it('rejects an admin certificate upload for another organization', async () => {
    (getPool as jest.Mock).mockReturnValue({
      query: jest.fn().mockResolvedValue({ rows: [] }),
    });
    const uploadDocument = jest.fn();
    const controller = buildController({ upload: { uploadDocument } });
    const req = buildReq('training_certificate');
    req.user = { ...req.user, role: ROLE.ADMIN } as AuthRequest['user'];
    req.tenant = { id: 'fictional-tenant' } as AuthRequest['tenant'];
    const res = buildRes();
    await controller.uploadDocument(req, res, 'fictional-other-tenant');
    expect(res.status).toHaveBeenCalledWith(404);
    expect(uploadDocument).not.toHaveBeenCalled();
  });
  it('keeps the current document when replacement storage fails', async () => {
    const current = { id: 'old-document', filePath: 'fictional/old.pdf' };
    const repo = {
      getCurrentDocumentByType: jest.fn().mockResolvedValue(current),
      deleteDocument: jest.fn(),
      createDocument: jest.fn(),
    };
    const upload = {
      uploadDocument: jest
        .fn()
        .mockRejectedValue(new Error('Fictional storage failure')),
      deleteDocument: jest.fn(),
    };
    const controller = buildController({ repo, upload });
    const res = buildRes();
    await controller.uploadDocument(buildReq('w9'), res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(repo.deleteDocument).not.toHaveBeenCalled();
    expect(upload.deleteDocument).not.toHaveBeenCalled();
  });
  it('persists a pending replacement before removing the old file', async () => {
    const events: string[] = [];
    const repo = {
      getCurrentDocumentByType: jest
        .fn()
        .mockResolvedValue({
          id: 'old-document',
          filePath: 'fictional/old.pdf',
        }),
      createDocument: jest.fn().mockImplementation(async () => {
        events.push('persist');
        return {
          id: 'new-document',
          filePath: 'fictional/new.pdf',
          status: 'uploaded',
        };
      }),
      deleteDocument: jest
        .fn()
        .mockImplementation(async () => events.push('remove-old-row')),
      getSignedUrl: jest
        .fn()
        .mockResolvedValue('https://fictional.example/signed'),
    };
    const upload = {
      uploadDocument: jest.fn().mockImplementation(async () => {
        events.push('store');
        return { filePath: 'fictional/new.pdf', fileName: 'fictional-new.pdf' };
      }),
      deleteDocument: jest
        .fn()
        .mockImplementation(async () => events.push('remove-old-file')),
    };
    const controller = buildController({ repo, upload });
    const res = buildRes();
    await controller.uploadDocument(buildReq('direct_deposit_form'), res);
    expect(events).toEqual([
      'store',
      'persist',
      'remove-old-row',
      'remove-old-file',
    ]);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        document: expect.objectContaining({ status: 'uploaded' }),
      })
    );
  });
});
