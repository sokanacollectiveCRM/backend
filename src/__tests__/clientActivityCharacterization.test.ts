/**
 * Characterization of ClientController.createActivity
 * (POST /clients/:id/activity and the /client, /api/clients, /api/client aliases).
 *
 * Pins the status codes and response bodies the handler returns today.
 * Synthetic ids only.
 */
import { Response } from 'express';

import { ClientController } from '../controllers/clientController';
import { ValidationError } from '../domains/errors';
import { Activity } from '../entities/Activity';
import { AuthRequest, ROLE } from '../types';
import * as sensitiveAccess from '../utils/sensitiveAccess';

jest.mock('../utils/sensitiveAccess');

const clientId = '123e4567-e89b-12d3-a456-426614174010';
const otherTenantId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const requestTenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function buildController(options?: {
  client?: Record<string, unknown> | null;
  createActivity?: jest.Mock;
}) {
  const getClientById = jest.fn().mockImplementation(async (id: string) => {
    if (options && 'client' in options) {
      return options.client && id === clientId ? options.client : null;
    }
    return id === clientId ? { id } : null;
  });
  const createActivity =
    options?.createActivity ??
    jest.fn(
      async (
        id: string,
        type: string,
        description: string,
        metadata: Record<string, unknown>,
        userId: string
      ) =>
        new Activity(
          'act-1',
          id,
          type,
          description,
          metadata,
          new Date('2026-04-01T15:00:00.000Z'),
          userId,
          typeof metadata.createdByName === 'string'
            ? metadata.createdByName
            : undefined,
          typeof metadata.createdByRole === 'string'
            ? metadata.createdByRole
            : undefined
        )
    );

  const controller = new ClientController(
    { createActivity } as any,
    {} as any,
    { getClientById } as any
  );

  return { controller, getClientById, createActivity };
}

function request(options: {
  id?: string;
  body?: unknown;
  user?: Partial<AuthRequest['user']>;
  tenantId?: string;
}): AuthRequest {
  return {
    params: options.id === undefined ? {} : { id: options.id },
    body: options.body,
    user: options.user,
    tenant:
      options.tenantId === undefined
        ? undefined
        : {
            id: options.tenantId,
            slug: 'synthetic',
            name: 'Synthetic Org',
            role: 'admin',
            membershipId: 'membership-1',
            platformAdmin: false,
          },
  } as unknown as AuthRequest;
}

async function invoke(controller: ClientController, req: AuthRequest) {
  let status = 200;
  let body: unknown;
  const res = {
    status(code: number) {
      status = code;
      return res;
    },
    json(payload: unknown) {
      body = payload;
      return res;
    },
    headersSent: false,
  };
  await controller.createActivity(req, res as unknown as Response);
  return { status, body };
}

const admin = {
  id: 'admin-1',
  role: ROLE.ADMIN,
  firstname: 'Ada',
  lastname: 'Admin',
  email: 'ada.admin@example.com',
};

describe('create client activity characterization', () => {
  beforeEach(() => {
    process.env.SPLIT_DB_READ_MODE = 'primary';
    (sensitiveAccess.canAccessSensitive as jest.Mock).mockResolvedValue({
      canAccess: false,
      assignedClientIds: [],
    });
  });

  it('returns the activity DTO and trims the note fields', async () => {
    const { controller, createActivity, getClientById } = buildController();

    const result = await invoke(
      controller,
      request({
        id: clientId,
        user: admin,
        tenantId: otherTenantId,
        body: {
          activity_type: '  note  ',
          content: '  Visit note  ',
          metadata: { category: 'general', visibleToClient: true },
          visible_to_client: 'true',
        },
      })
    );

    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      success: true,
      data: {
        id: 'act-1',
        client_id: clientId,
        created_by: 'admin-1',
        created_by_name: 'Ada Admin',
        created_by_role: 'admin',
        activity_type: 'note',
        content: 'Visit note',
        created_at: '2026-04-01T15:00:00.000Z',
        visible_to_client: true,
        metadata: {
          category: 'general',
          visibleToClient: true,
          createdByName: 'Ada Admin',
          createdByRole: 'admin',
        },
      },
    });
    expect(getClientById).toHaveBeenCalledWith(clientId);
    expect(createActivity).toHaveBeenCalledWith(
      clientId,
      'note',
      'Visit note',
      {
        category: 'general',
        visibleToClient: true,
        createdByName: 'Ada Admin',
        createdByRole: 'admin',
      },
      'admin-1'
    );
    expect(sensitiveAccess.canAccessSensitive).not.toHaveBeenCalled();
  });

  it('still creates when the request tenant differs but the client lookup returns the row', async () => {
    const { controller, createActivity } = buildController({
      client: { id: clientId },
    });

    const result = await invoke(
      controller,
      request({
        id: clientId,
        user: admin,
        tenantId: requestTenantId,
        body: { activity_type: 'note', content: 'Visit note' },
      })
    );

    expect(result.status).toBe(200);
    expect(result.body).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          activity_type: 'note',
          content: 'Visit note',
          visible_to_client: false,
          metadata: expect.objectContaining({
            visibleToClient: false,
            createdByName: 'Ada Admin',
            createdByRole: 'admin',
          }),
        }),
      })
    );
    expect(createActivity).toHaveBeenCalled();
  });

  it('uses email then a staff label when the author has no name', async () => {
    const { controller, createActivity } = buildController();

    await invoke(
      controller,
      request({
        id: clientId,
        user: {
          id: 'admin-1',
          role: ROLE.ADMIN,
          email: 'ada.admin@example.com',
        },
        body: { activity_type: 'note', content: 'Visit note' },
      })
    );
    expect(createActivity).toHaveBeenCalledWith(
      clientId,
      'note',
      'Visit note',
      expect.objectContaining({ createdByName: 'ada.admin@example.com' }),
      'admin-1'
    );

    createActivity.mockClear();
    await invoke(
      controller,
      request({
        id: clientId,
        user: { id: 'admin-1', role: ROLE.ADMIN },
        body: { activity_type: 'note', content: 'Visit note' },
      })
    );
    expect(createActivity).toHaveBeenCalledWith(
      clientId,
      'note',
      'Visit note',
      expect.objectContaining({ createdByName: 'Staff member' }),
      'admin-1'
    );
  });

  it('drops metadata that is not a plain object', async () => {
    const { controller, createActivity } = buildController();

    await invoke(
      controller,
      request({
        id: clientId,
        user: admin,
        body: {
          activity_type: 'note',
          content: 'Visit note',
          metadata: ['not', 'an', 'object'],
        },
      })
    );

    expect(createActivity).toHaveBeenCalledWith(
      clientId,
      'note',
      'Visit note',
      {
        visibleToClient: false,
        createdByName: 'Ada Admin',
        createdByRole: 'admin',
      },
      'admin-1'
    );
  });

  it('returns 501 when split-db read mode is not primary', async () => {
    process.env.SPLIT_DB_READ_MODE = 'shadow';
    const { controller, getClientById, createActivity } = buildController();

    const result = await invoke(
      controller,
      request({
        id: clientId,
        user: admin,
        body: { activity_type: 'note', content: 'Visit note' },
      })
    );

    expect(result).toEqual({
      status: 501,
      body: {
        success: false,
        error: 'Shadow disabled',
        code: 'SHADOW_DISABLED',
      },
    });
    expect(getClientById).not.toHaveBeenCalled();
    expect(createActivity).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
  ])('returns 400 when the client id is %s', async (_label, id) => {
    const { controller, getClientById } = buildController();

    const result = await invoke(
      controller,
      request({
        id,
        user: admin,
        body: { activity_type: '', content: '' },
      })
    );

    expect(result).toEqual({
      status: 400,
      body: {
        success: false,
        error: 'Missing client ID',
        code: 'VALIDATION_ERROR',
      },
    });
    expect(getClientById).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', undefined],
    ['blank', '   '],
    ['not a string', 12],
  ])('returns 400 when activity_type is %s', async (_label, activityType) => {
    const { controller, getClientById, createActivity } = buildController();

    const result = await invoke(
      controller,
      request({
        id: clientId,
        user: { id: 'doula-1', role: ROLE.DOULA },
        body: { activity_type: activityType, content: '' },
      })
    );

    expect(result).toEqual({
      status: 400,
      body: {
        success: false,
        error:
          'Invalid request: activity_type is required and must be a non-empty string',
        code: 'VALIDATION_ERROR',
      },
    });
    expect(getClientById).not.toHaveBeenCalled();
    expect(createActivity).not.toHaveBeenCalled();
    expect(sensitiveAccess.canAccessSensitive).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', undefined],
    ['blank', ' '],
    ['not a string', { text: 'nope' }],
  ])('returns 400 when content is %s', async (_label, content) => {
    const { controller, getClientById } = buildController();

    const result = await invoke(
      controller,
      request({
        id: clientId,
        user: admin,
        body: { activity_type: 'note', content },
      })
    );

    expect(result).toEqual({
      status: 400,
      body: {
        success: false,
        error:
          'Invalid request: content is required and must be a non-empty string',
        code: 'VALIDATION_ERROR',
      },
    });
    expect(getClientById).not.toHaveBeenCalled();
  });

  it('returns 404 when the client lookup misses', async () => {
    const { controller, createActivity } = buildController({ client: null });

    const result = await invoke(
      controller,
      request({
        id: clientId,
        user: admin,
        tenantId: requestTenantId,
        body: { activity_type: 'note', content: 'Visit note' },
      })
    );

    expect(result).toEqual({
      status: 404,
      body: { success: false, error: 'Client not found', code: 'NOT_FOUND' },
    });
    expect(createActivity).not.toHaveBeenCalled();
  });

  it('returns 403 for an unassigned doula without a client lookup', async () => {
    const { controller, getClientById, createActivity } = buildController();

    const result = await invoke(
      controller,
      request({
        id: clientId,
        user: { id: 'doula-unassigned', role: ROLE.DOULA },
        body: { activity_type: 'note', content: 'Visit note' },
      })
    );

    expect(result).toEqual({
      status: 403,
      body: {
        success: false,
        error: 'Not authorized to access this client',
        code: 'FORBIDDEN',
      },
    });
    expect(getClientById).not.toHaveBeenCalled();
    expect(createActivity).not.toHaveBeenCalled();
  });

  it('returns 401 when a doula has no user id', async () => {
    const { controller, getClientById } = buildController();

    const result = await invoke(
      controller,
      request({
        id: clientId,
        user: { role: ROLE.DOULA } as AuthRequest['user'],
        body: { activity_type: 'note', content: 'Visit note' },
      })
    );

    expect(result).toEqual({
      status: 401,
      body: { success: false, error: 'Unauthorized', code: 'UNAUTHENTICATED' },
    });
    expect(getClientById).not.toHaveBeenCalled();
  });

  it.each([
    ['billing', ROLE.BILLING],
    ['client', ROLE.CLIENT],
    ['missing', undefined],
  ])('returns 403 for a %s role', async (_label, role) => {
    const { controller, getClientById, createActivity } = buildController();

    const result = await invoke(
      controller,
      request({
        id: clientId,
        user: { id: 'user-1', role } as AuthRequest['user'],
        body: { activity_type: 'note', content: 'Visit note' },
      })
    );

    expect(result).toEqual({
      status: 403,
      body: { success: false, error: 'Forbidden', code: 'FORBIDDEN' },
    });
    expect(getClientById).not.toHaveBeenCalled();
    expect(createActivity).not.toHaveBeenCalled();
  });

  it('allows an assigned doula to create the activity', async () => {
    (sensitiveAccess.canAccessSensitive as jest.Mock).mockResolvedValue({
      canAccess: true,
      assignedClientIds: [clientId],
    });
    const { controller, createActivity } = buildController();

    const result = await invoke(
      controller,
      request({
        id: clientId,
        user: {
          id: 'doula-1',
          role: ROLE.DOULA,
          firstname: 'Nia',
          lastname: 'Doula',
        },
        body: { activity_type: 'note', content: 'Visit note' },
      })
    );

    expect(result.status).toBe(200);
    expect(result.body).toEqual(expect.objectContaining({ success: true }));
    expect(createActivity).toHaveBeenCalledWith(
      clientId,
      'note',
      'Visit note',
      expect.objectContaining({
        createdByName: 'Nia Doula',
        createdByRole: 'doula',
      }),
      'doula-1'
    );
  });

  it('returns 503 when the activities table is missing', async () => {
    const createActivity = jest
      .fn()
      .mockRejectedValue(
        new Error('relation "client_activities" does not exist')
      );
    const { controller } = buildController({ createActivity });

    const result = await invoke(
      controller,
      request({
        id: clientId,
        user: admin,
        body: { activity_type: 'note', content: 'Visit note' },
      })
    );

    expect(result).toEqual({
      status: 503,
      body: {
        success: false,
        error: 'Activities feature not available — table pending migration',
        code: 'SERVICE_UNAVAILABLE',
      },
    });
  });

  it('returns a safe 500 when persistence fails for another reason', async () => {
    const createActivity = jest
      .fn()
      .mockRejectedValue(new Error('connection reset'));
    const { controller } = buildController({ createActivity });

    const result = await invoke(
      controller,
      request({
        id: clientId,
        user: admin,
        body: { activity_type: 'note', content: 'Visit note' },
      })
    );

    expect(result).toEqual({
      status: 500,
      body: { success: false, error: 'Internal Server Error' },
    });
  });

  it('maps a validation error from persistence to 400 without a code', async () => {
    const createActivity = jest
      .fn()
      .mockRejectedValue(new ValidationError('bad field'));
    const { controller } = buildController({ createActivity });

    const result = await invoke(
      controller,
      request({
        id: clientId,
        user: admin,
        body: { activity_type: 'note', content: 'Visit note' },
      })
    );

    expect(result).toEqual({
      status: 400,
      body: { success: false, error: 'bad field' },
    });
  });
});
