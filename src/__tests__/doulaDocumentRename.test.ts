import { DoulaController } from '../controllers/doulaController';
import type { AuthRequest } from '../types';

describe('DoulaController.renameDocument', () => {
  const ownerId = 'doula-owner-1';
  const otherDoulaId = 'doula-other-1';
  const documentId = 'doc-123';

  function buildController(repoOverrides: Record<string, jest.Mock>) {
    return new DoulaController(
      repoOverrides as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
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

  it('renames a document for the owner and returns expected fields', async () => {
    const now = new Date('2026-03-24T15:30:00.000Z');
    const getDocumentById = jest.fn().mockResolvedValue({
      id: documentId,
      doulaId: ownerId,
      documentType: 'background_check',
      fileName: 'old-name.pdf',
      uploadedAt: new Date('2026-03-20T10:00:00.000Z'),
      updatedAt: new Date('2026-03-20T10:00:00.000Z'),
      status: 'uploaded',
    });
    const updateDocumentMetadata = jest.fn().mockResolvedValue({
      id: documentId,
      doulaId: ownerId,
      documentType: 'background_check',
      fileName: 'new-name.pdf',
      uploadedAt: new Date('2026-03-20T10:00:00.000Z'),
      updatedAt: now,
      status: 'uploaded',
    });
    const controller = buildController({ getDocumentById, updateDocumentMetadata });
    const req = {
      user: { id: ownerId, email: 'doula@example.com', role: 'doula' },
      params: { documentId },
      body: { file_name: '  new-name  ' },
    } as unknown as AuthRequest;
    const res = buildRes();

    await controller.renameDocument(req, res as any);

    expect(updateDocumentMetadata).toHaveBeenCalledWith(documentId, {
      fileName: 'new-name.pdf',
      documentType: undefined,
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      document: expect.objectContaining({
        id: documentId,
        document_type: 'background_check',
        file_name: 'new-name.pdf',
        status: 'uploaded',
        uploaded_at: '2026-03-20T10:00:00.000Z',
        updated_at: '2026-03-24T15:30:00.000Z',
      }),
    });
  });

  it.each([
    { label: 'empty name', value: '   ' },
    { label: 'path traversal marker', value: '../secret.pdf' },
  ])('returns 400 for invalid file_name ($label)', async ({ value }) => {
    const controller = buildController({
      getDocumentById: jest.fn(),
      updateDocumentMetadata: jest.fn(),
    });
    const req = {
      user: { id: ownerId, email: 'doula@example.com', role: 'doula' },
      params: { documentId },
      body: { file_name: value },
    } as unknown as AuthRequest;
    const res = buildRes();

    await controller.renameDocument(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
  });

  it('returns 401 when user is not authenticated', async () => {
    const controller = buildController({
      getDocumentById: jest.fn(),
      updateDocumentMetadata: jest.fn(),
    });
    const req = {
      params: { documentId },
      body: { file_name: 'new-name.pdf' },
    } as unknown as AuthRequest;
    const res = buildRes();

    await controller.renameDocument(req, res as any);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
  });

  it('returns 403 when document belongs to a different doula', async () => {
    const getDocumentById = jest.fn().mockResolvedValue({
      id: documentId,
      doulaId: otherDoulaId,
      documentType: 'background_check',
      fileName: 'old-name.pdf',
      uploadedAt: new Date('2026-03-20T10:00:00.000Z'),
      updatedAt: new Date('2026-03-20T10:00:00.000Z'),
      status: 'uploaded',
    });
    const updateDocumentMetadata = jest.fn();
    const controller = buildController({ getDocumentById, updateDocumentMetadata });
    const req = {
      user: { id: ownerId, email: 'doula@example.com', role: 'doula' },
      params: { documentId },
      body: { file_name: 'new-name.pdf' },
    } as unknown as AuthRequest;
    const res = buildRes();

    await controller.renameDocument(req, res as any);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'You do not have permission to rename this document' });
    expect(updateDocumentMetadata).not.toHaveBeenCalled();
  });

  it('returns 404 when document is missing', async () => {
    const controller = buildController({
      getDocumentById: jest.fn().mockResolvedValue(null),
      updateDocumentMetadata: jest.fn(),
    });
    const req = {
      user: { id: ownerId, email: 'doula@example.com', role: 'doula' },
      params: { documentId },
      body: { file_name: 'new-name.pdf' },
    } as unknown as AuthRequest;
    const res = buildRes();

    await controller.renameDocument(req, res as any);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Document not found' });
  });

  it('updates document_type when provided', async () => {
    const getDocumentById = jest.fn().mockResolvedValue({
      id: documentId,
      doulaId: ownerId,
      documentType: 'background_check',
      fileName: 'old-name.pdf',
      uploadedAt: new Date('2026-03-20T10:00:00.000Z'),
      updatedAt: new Date('2026-03-20T10:00:00.000Z'),
      status: 'uploaded',
    });
    const updateDocumentMetadata = jest.fn().mockResolvedValue({
      id: documentId,
      doulaId: ownerId,
      documentType: 'w9',
      fileName: 'old-name.pdf',
      uploadedAt: new Date('2026-03-20T10:00:00.000Z'),
      updatedAt: new Date('2026-03-24T15:30:00.000Z'),
      status: 'uploaded',
    });
    const controller = buildController({ getDocumentById, updateDocumentMetadata });
    const req = {
      user: { id: ownerId, email: 'doula@example.com', role: 'doula' },
      params: { documentId },
      body: { document_type: 'w9' },
    } as unknown as AuthRequest;
    const res = buildRes();

    await controller.renameDocument(req, res as any);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      document: expect.objectContaining({
        id: documentId,
        document_type: 'w9',
        file_name: 'old-name.pdf',
      }),
    });
    expect(updateDocumentMetadata).toHaveBeenCalledWith(documentId, {
      fileName: undefined,
      documentType: 'w9',
    });
  });

  it('returns 400 when neither file_name nor document_type is provided', async () => {
    const controller = buildController({
      getDocumentById: jest.fn(),
      updateDocumentMetadata: jest.fn(),
    });
    const req = {
      user: { id: ownerId, email: 'doula@example.com', role: 'doula' },
      params: { documentId },
      body: {},
    } as unknown as AuthRequest;
    const res = buildRes();

    await controller.renameDocument(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
  });
});
