import { Response } from 'express';
import { ClientController } from '../controllers/clientController';
import type { AuthRequest } from '../types';
import * as sensitiveAccess from '../utils/sensitiveAccess';

jest.mock('../utils/sensitiveAccess');

describe('Client document endpoints', () => {
  const authUserId = 'auth-user-1';
  const clientId = '123e4567-e89b-12d3-a456-426614174000';
  const documentId = 'doc-123';

  function buildResponse() {
    const res: Partial<Response> = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
  }

  function buildController(overrides?: {
    clientDocumentRepository?: Record<string, jest.Mock>;
    clientDocumentUploadService?: Record<string, jest.Mock>;
  }) {
    const controller = new ClientController(
      {} as any,
      {} as any,
      {} as any,
      overrides?.clientDocumentRepository as any,
      overrides?.clientDocumentUploadService as any
    );

    (controller as any).cloudSqlAssignmentService = {
      getClientIdByAuthUserId: jest.fn().mockResolvedValue(clientId),
    };

    return controller;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uploads an insurance card for the authenticated client', async () => {
    const uploadDocument = jest.fn().mockResolvedValue({
      filePath: `${clientId}/insurance_card/uploaded.png`,
      fileName: 'insurance-card-front.png',
      fileSize: 1280,
      mimeType: 'image/png',
    });
    const createDocument = jest.fn().mockResolvedValue({
      id: documentId,
      clientId,
      documentType: 'insurance_card',
      fileName: 'insurance-card-front.png',
      filePath: `${clientId}/insurance_card/uploaded.png`,
      fileSize: 1280,
      mimeType: 'image/png',
      uploadedAt: new Date('2026-03-24T18:30:00.000Z'),
      status: 'uploaded',
      createdAt: new Date('2026-03-24T18:30:00.000Z'),
      updatedAt: new Date('2026-03-24T18:30:00.000Z'),
    });
    const controller = buildController({
      clientDocumentUploadService: { uploadDocument },
      clientDocumentRepository: { createDocument },
    });
    const req = {
      user: { id: authUserId, role: 'client', email: 'client@example.com' },
      body: {
        documentType: 'insurance_card',
        document_type: 'insurance_card',
        category: 'billing',
      },
      file: {
        originalname: 'insurance-card-front.png',
        mimetype: 'image/png',
        size: 1280,
        buffer: Buffer.from('fake-image'),
      },
    } as unknown as AuthRequest;
    const res = buildResponse();

    await controller.uploadMyDocument(req, res);

    expect(uploadDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        originalname: 'insurance-card-front.png',
      }),
      clientId,
      'insurance_card'
    );
    expect(createDocument).toHaveBeenCalledWith(expect.objectContaining({
      clientId,
      documentType: 'insurance_card',
      category: 'billing',
    }));
    expect((res.status as jest.Mock)).toHaveBeenCalledWith(201);
    expect((res.json as jest.Mock)).toHaveBeenCalledWith({
      success: true,
      data: {
        id: documentId,
        document_type: 'insurance_card',
        file_name: 'insurance-card-front.png',
        uploaded_at: '2026-03-24T18:30:00.000Z',
        status: 'uploaded',
        content_type: 'image/png',
      },
    });
  });

  it('accepts pdf uploads for insurance cards', async () => {
    const uploadDocument = jest.fn().mockResolvedValue({
      filePath: `${clientId}/insurance_card/uploaded.pdf`,
      fileName: 'insurance-card.pdf',
      fileSize: 1024,
      mimeType: 'application/pdf',
    });
    const createDocument = jest.fn().mockResolvedValue({
      id: documentId,
      clientId,
      documentType: 'insurance_card',
      fileName: 'insurance-card.pdf',
      filePath: `${clientId}/insurance_card/uploaded.pdf`,
      fileSize: 1024,
      mimeType: 'application/pdf',
      uploadedAt: new Date('2026-03-24T18:20:00.000Z'),
    });
    const controller = buildController({
      clientDocumentUploadService: { uploadDocument },
      clientDocumentRepository: { createDocument },
    });
    const req = {
      user: { id: authUserId, role: 'client', email: 'client@example.com' },
      body: {
        documentType: 'insurance_card',
        document_type: 'insurance_card',
        category: 'billing',
      },
      file: {
        originalname: 'insurance-card.pdf',
        mimetype: 'application/pdf',
        size: 1024,
        buffer: Buffer.from('fake-pdf'),
      },
    } as unknown as AuthRequest;
    const res = buildResponse();

    await controller.uploadMyDocument(req, res);

    expect(uploadDocument).toHaveBeenCalledWith(req.file, clientId, 'insurance_card');
    expect((res.status as jest.Mock)).toHaveBeenCalledWith(201);
    expect((res.json as jest.Mock)).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          file_name: 'insurance-card.pdf',
          content_type: 'application/pdf',
        }),
      })
    );
  });

  it('lists documents for the authenticated client', async () => {
    const getDocumentsByClientId = jest.fn().mockResolvedValue([
      {
        id: documentId,
        clientId,
        documentType: 'insurance_card',
        fileName: 'insurance-card-front.png',
        filePath: `${clientId}/insurance_card/uploaded.png`,
        fileSize: 1280,
        mimeType: 'image/png',
        uploadedAt: new Date('2026-03-24T18:30:00.000Z'),
        status: 'uploaded',
        createdAt: new Date('2026-03-24T18:30:00.000Z'),
        updatedAt: new Date('2026-03-24T18:30:00.000Z'),
      },
    ]);
    const controller = buildController({
      clientDocumentRepository: { getDocumentsByClientId },
    });
    const req = {
      user: { id: authUserId, role: 'client', email: 'client@example.com' },
    } as unknown as AuthRequest;
    const res = buildResponse();

    await controller.getMyDocuments(req, res);

    expect(getDocumentsByClientId).toHaveBeenCalledWith(clientId);
    expect((res.json as jest.Mock)).toHaveBeenCalledWith({
      success: true,
      documents: [
        {
          id: documentId,
          document_type: 'insurance_card',
          file_name: 'insurance-card-front.png',
          uploaded_at: '2026-03-24T18:30:00.000Z',
          status: 'uploaded',
          content_type: 'image/png',
        },
      ],
    });
  });

  it('returns a signed URL for the client owner', async () => {
    const getDocumentById = jest.fn().mockResolvedValue({
      id: documentId,
      clientId,
      documentType: 'insurance_card',
      fileName: 'insurance-card-front.png',
      filePath: `${clientId}/insurance_card/uploaded.png`,
      fileSize: 1280,
      mimeType: 'image/png',
      uploadedAt: new Date('2026-03-24T18:30:00.000Z'),
      status: 'uploaded',
      createdAt: new Date('2026-03-24T18:30:00.000Z'),
      updatedAt: new Date('2026-03-24T18:30:00.000Z'),
    });
    const getSignedUrl = jest.fn().mockResolvedValue('https://signed-url.example.com/doc');
    const controller = buildController({
      clientDocumentRepository: { getDocumentById, getSignedUrl },
    });
    const req = {
      user: { id: authUserId, role: 'client', email: 'client@example.com' },
      params: { documentId },
    } as unknown as AuthRequest;
    const res = buildResponse();

    await controller.getMyDocumentUrl(req, res);

    expect((res.json as jest.Mock)).toHaveBeenCalledWith({
      success: true,
      url: 'https://signed-url.example.com/doc',
    });
  });

  it('deletes an insurance card for the authenticated client', async () => {
    const getDocumentById = jest.fn().mockResolvedValue({
      id: documentId,
      clientId,
      documentType: 'insurance_card',
      fileName: 'insurance-card-front.png',
      filePath: `${clientId}/insurance_card/uploaded.png`,
      fileSize: 1280,
      mimeType: 'image/png',
      uploadedAt: new Date('2026-03-24T18:30:00.000Z'),
      status: 'uploaded',
      createdAt: new Date('2026-03-24T18:30:00.000Z'),
      updatedAt: new Date('2026-03-24T18:30:00.000Z'),
    });
    const deleteDocument = jest.fn().mockResolvedValue(undefined);
    const deleteStoredDocument = jest.fn().mockResolvedValue(undefined);
    const controller = buildController({
      clientDocumentRepository: { getDocumentById, deleteDocument },
      clientDocumentUploadService: { deleteDocument: deleteStoredDocument },
    });
    const req = {
      user: { id: authUserId, role: 'client', email: 'client@example.com' },
      params: { documentId },
    } as unknown as AuthRequest;
    const res = buildResponse();

    await controller.deleteMyDocument(req, res);

    expect(deleteStoredDocument).toHaveBeenCalledWith(`${clientId}/insurance_card/uploaded.png`);
    expect(deleteDocument).toHaveBeenCalledWith(documentId);
    expect((res.json as jest.Mock)).toHaveBeenCalledWith({
      success: true,
      message: 'Document deleted successfully',
    });
  });

  it('returns 404 when deleting another clients document', async () => {
    const getDocumentById = jest.fn().mockResolvedValue({
      id: documentId,
      clientId: 'another-client-id',
      documentType: 'insurance_card',
      fileName: 'insurance-card-front.png',
      filePath: `another-client-id/insurance_card/uploaded.png`,
      fileSize: 1280,
      mimeType: 'image/png',
      uploadedAt: new Date('2026-03-24T18:30:00.000Z'),
      status: 'uploaded',
      createdAt: new Date('2026-03-24T18:30:00.000Z'),
      updatedAt: new Date('2026-03-24T18:30:00.000Z'),
    });
    const controller = buildController({
      clientDocumentRepository: { getDocumentById, deleteDocument: jest.fn() },
      clientDocumentUploadService: { deleteDocument: jest.fn() },
    });
    const req = {
      user: { id: authUserId, role: 'client', email: 'client@example.com' },
      params: { documentId },
    } as unknown as AuthRequest;
    const res = buildResponse();

    await controller.deleteMyDocument(req, res);

    expect((res.status as jest.Mock)).toHaveBeenCalledWith(404);
    expect((res.json as jest.Mock)).toHaveBeenCalledWith({
      error: 'Document not found',
    });
  });

  it('rejects unauthorized staff document access', async () => {
    (sensitiveAccess.canAccessSensitive as jest.Mock).mockResolvedValue({
      canAccess: false,
      assignedClientIds: [],
    });
    const controller = buildController({
      clientDocumentRepository: { getDocumentsByClientId: jest.fn() },
    });
    const req = {
      user: { id: 'doula-1', role: 'doula', email: 'doula@example.com' },
      params: { clientId },
    } as unknown as AuthRequest;
    const res = buildResponse();

    await controller.getClientDocuments(req, res);

    expect((res.status as jest.Mock)).toHaveBeenCalledWith(403);
    expect((res.json as jest.Mock)).toHaveBeenCalledWith({
      error: 'Unauthorized staff access',
    });
  });

  it('allows assigned staff to fetch a document URL', async () => {
    (sensitiveAccess.canAccessSensitive as jest.Mock).mockResolvedValue({
      canAccess: true,
      assignedClientIds: [clientId],
    });
    const getDocumentById = jest.fn().mockResolvedValue({
      id: documentId,
      clientId,
      documentType: 'insurance_card',
      fileName: 'insurance-card-front.png',
      filePath: `${clientId}/insurance_card/uploaded.png`,
      fileSize: 1280,
      mimeType: 'image/png',
      uploadedAt: new Date('2026-03-24T18:30:00.000Z'),
      status: 'uploaded',
      createdAt: new Date('2026-03-24T18:30:00.000Z'),
      updatedAt: new Date('2026-03-24T18:30:00.000Z'),
    });
    const getSignedUrl = jest.fn().mockResolvedValue('https://signed-url.example.com/staff-doc');
    const controller = buildController({
      clientDocumentRepository: { getDocumentById, getSignedUrl },
    });
    const req = {
      user: { id: 'doula-1', role: 'doula', email: 'doula@example.com' },
      params: { clientId, documentId },
    } as unknown as AuthRequest;
    const res = buildResponse();

    await controller.getClientDocumentUrl(req, res);

    expect((res.json as jest.Mock)).toHaveBeenCalledWith({
      success: true,
      url: 'https://signed-url.example.com/staff-doc',
    });
  });
});
