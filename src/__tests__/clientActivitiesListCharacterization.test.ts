/**
 * Characterization of ClientController.getClientActivities
 * (GET /clients/:id/activities and the /client, /api/clients, /api/client aliases).
 *
 * Pins today's status codes, cache headers, and list body. Synthetic ids only.
 */
import { Response } from 'express';

import { ClientController } from '../controllers/clientController';
import { ValidationError } from '../domains/errors';
import { Activity } from '../entities/Activity';
import { AuthRequest, ROLE } from '../types';
import * as sensitiveAccess from '../utils/sensitiveAccess';

jest.mock('../utils/sensitiveAccess');

const clientId = '123e4567-e89b-12d3-a456-426614174010';
const otherClientId = '123e4567-e89b-12d3-a456-426614174011';
const authUserId = '123e4567-e89b-12d3-a456-426614174012';
const requestTenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const createdAt = new Date('2026-04-01T15:00:00.000Z');

function note(
  id: string,
  content: string,
  metadata: Record<string, unknown>
): Activity {
  return new Activity(
    id,
    clientId,
    'note',
    content,
    metadata,
    createdAt,
    'admin-1',
    'Ada Admin',
    'admin'
  );
}

const hidden = note('act-hidden', 'Staff only', {});
const visible = note('act-visible', 'Visible note', { visibleToClient: true });

function buildController(options?: {
  client?: Record<string, unknown> | null;
  activities?: Activity[];
  getClientActivities?: jest.Mock;
  ownClientId?: string | null;
}) {
  const getClientById = jest.fn().mockImplementation(async (id: string) => {
    if (options && 'client' in options) {
      return options.client && id === String(options.client.id)
        ? options.client
        : null;
    }
    return id === clientId ? { id } : null;
  });
  const getClientActivities =
    options?.getClientActivities ??
    jest.fn(async () => options?.activities ?? [hidden, visible]);
  const getClientIdByAuthUserId = jest
    .fn()
    .mockResolvedValue(
      options && 'ownClientId' in options ? options.ownClientId : clientId
    );

  const controller = new ClientController(
    { getClientActivities, createActivity: jest.fn() } as any,
    {} as any,
    { getClientById } as any
  );
  (controller as any).cloudSqlAssignmentService = { getClientIdByAuthUserId };

  return {
    controller,
    getClientById,
    getClientActivities,
    getClientIdByAuthUserId,
  };
}

function request(options: {
  id?: string;
  user?: Partial<AuthRequest['user']>;
  tenantId?: string;
}): AuthRequest {
  return {
    params: options.id === undefined ? {} : { id: options.id },
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

const noStore = [
  ['Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate'],
  ['Pragma', 'no-cache'],
  ['Expires', '0'],
];

async function invoke(controller: ClientController, req: AuthRequest) {
  let status = 200;
  let body: unknown;
  const sets: [string, string][] = [];
  const res = {
    set(name: string, value: string) {
      sets.push([name, value]);
      return res;
    },
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
  await controller.getClientActivities(req, res as unknown as Response);
  return { status, body, sets };
}

const admin = {
  id: 'admin-1',
  role: ROLE.ADMIN,
  firstname: 'Ada',
  lastname: 'Admin',
};

describe('list client activities characterization', () => {
  beforeEach(() => {
    process.env.SPLIT_DB_READ_MODE = 'primary';
    (sensitiveAccess.canAccessSensitive as jest.Mock).mockResolvedValue({
      canAccess: false,
      assignedClientIds: [],
    });
  });

  it('returns every note for an admin, with no-store headers', async () => {
    const { controller, getClientById, getClientActivities } =
      buildController();

    const result = await invoke(
      controller,
      request({ id: clientId, user: admin, tenantId: requestTenantId })
    );

    expect(result.status).toBe(200);
    expect(result.sets).toEqual(noStore);
    expect(result.body).toEqual({
      success: true,
      data: [
        {
          id: 'act-hidden',
          client_id: clientId,
          created_by: 'admin-1',
          created_by_name: 'Ada Admin',
          created_by_role: 'admin',
          activity_type: 'note',
          content: 'Staff only',
          created_at: '2026-04-01T15:00:00.000Z',
          visible_to_client: false,
        },
        {
          id: 'act-visible',
          client_id: clientId,
          created_by: 'admin-1',
          created_by_name: 'Ada Admin',
          created_by_role: 'admin',
          activity_type: 'note',
          content: 'Visible note',
          created_at: '2026-04-01T15:00:00.000Z',
          visible_to_client: true,
          metadata: { visibleToClient: true },
        },
      ],
      meta: { count: 2 },
    });
    expect(getClientById).toHaveBeenCalledWith(clientId);
    expect(getClientActivities).toHaveBeenCalledWith(clientId);
  });

  it('still lists when the request tenant differs but the client lookup returns the row', async () => {
    const { controller, getClientActivities } = buildController({
      client: { id: clientId },
    });

    const result = await invoke(
      controller,
      request({
        id: clientId,
        user: admin,
        tenantId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      })
    );

    expect(result.status).toBe(200);
    expect(result.body).toEqual(
      expect.objectContaining({ success: true, meta: { count: 2 } })
    );
    expect(getClientActivities).toHaveBeenCalledWith(clientId);
  });

  it('returns only client-visible notes when the viewer is the client', async () => {
    const { controller, getClientById, getClientActivities } =
      buildController();

    const result = await invoke(
      controller,
      request({
        id: clientId,
        user: { id: authUserId, role: ROLE.CLIENT },
      })
    );

    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      success: true,
      data: [
        expect.objectContaining({
          id: 'act-visible',
          content: 'Visible note',
          visible_to_client: true,
        }),
      ],
      meta: { count: 1 },
    });
    expect(getClientById).toHaveBeenCalledWith(clientId);
    expect(getClientActivities).toHaveBeenCalledWith(clientId);
  });

  it('loads the client record when the path id is the auth user id', async () => {
    const {
      controller,
      getClientById,
      getClientActivities,
      getClientIdByAuthUserId,
    } = buildController({ ownClientId: clientId });

    await invoke(
      controller,
      request({
        id: authUserId,
        user: { id: authUserId, role: ROLE.CLIENT },
      })
    );

    expect(getClientIdByAuthUserId).toHaveBeenCalledWith(authUserId);
    expect(getClientById).toHaveBeenCalledWith(clientId);
    expect(getClientActivities).toHaveBeenCalledWith(clientId);
  });

  it('returns 403 when a client asks for someone else', async () => {
    const { controller, getClientById, getClientActivities } = buildController({
      ownClientId: clientId,
    });

    const result = await invoke(
      controller,
      request({
        id: otherClientId,
        user: { id: authUserId, role: ROLE.CLIENT },
      })
    );

    expect(result).toEqual(
      expect.objectContaining({
        status: 403,
        body: {
          success: false,
          error: 'Forbidden: cannot access another client profile',
          code: 'FORBIDDEN',
        },
      })
    );
    expect(result.sets).toEqual(noStore);
    expect(getClientById).not.toHaveBeenCalled();
    expect(getClientActivities).not.toHaveBeenCalled();
  });

  it('returns 404 when the signed-in client has no profile', async () => {
    const { controller, getClientById } = buildController({
      ownClientId: null,
    });

    const result = await invoke(
      controller,
      request({
        id: clientId,
        user: { id: authUserId, role: ROLE.CLIENT },
      })
    );

    expect(result.body).toEqual({
      success: false,
      error: 'Client profile not found',
      code: 'NOT_FOUND',
    });
    expect(result.status).toBe(404);
    expect(getClientById).not.toHaveBeenCalled();
  });

  it('returns 501 when split-db read mode is not primary', async () => {
    process.env.SPLIT_DB_READ_MODE = 'shadow';
    const { controller, getClientById, getClientActivities } =
      buildController();

    const result = await invoke(
      controller,
      request({ id: clientId, user: admin })
    );

    expect(result.status).toBe(501);
    expect(result.body).toEqual({
      success: false,
      error: 'Shadow disabled',
      code: 'SHADOW_DISABLED',
    });
    expect(result.sets).toEqual(noStore);
    expect(getClientById).not.toHaveBeenCalled();
    expect(getClientActivities).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
  ])('returns 400 when the client id is %s', async (_label, id) => {
    const { controller, getClientById, getClientIdByAuthUserId } =
      buildController();

    const result = await invoke(
      controller,
      request({ id, user: { id: authUserId, role: ROLE.CLIENT } })
    );

    expect(result.body).toEqual({
      success: false,
      error: 'Missing client ID',
      code: 'VALIDATION_ERROR',
    });
    expect(result.status).toBe(400);
    expect(getClientById).not.toHaveBeenCalled();
    expect(getClientIdByAuthUserId).not.toHaveBeenCalled();
  });

  it('returns 404 when the client lookup misses', async () => {
    const { controller, getClientActivities } = buildController({
      client: null,
    });

    const result = await invoke(
      controller,
      request({ id: clientId, user: admin, tenantId: requestTenantId })
    );

    expect(result.body).toEqual({
      success: false,
      error: 'Client not found',
      code: 'NOT_FOUND',
    });
    expect(result.status).toBe(404);
    expect(getClientActivities).not.toHaveBeenCalled();
  });

  it('returns 404 for an unassigned doula without a client lookup', async () => {
    const { controller, getClientById, getClientActivities } =
      buildController();

    const result = await invoke(
      controller,
      request({
        id: clientId,
        user: { id: 'doula-unassigned', role: ROLE.DOULA },
      })
    );

    expect(result.body).toEqual({
      success: false,
      error: 'Client not found',
      code: 'NOT_FOUND',
    });
    expect(result.status).toBe(404);
    expect(getClientById).not.toHaveBeenCalled();
    expect(getClientActivities).not.toHaveBeenCalled();
  });

  it('returns 401 when a doula has no user id', async () => {
    const { controller, getClientById } = buildController();

    const result = await invoke(
      controller,
      request({
        id: clientId,
        user: { role: ROLE.DOULA } as AuthRequest['user'],
      })
    );

    expect(result.body).toEqual({
      success: false,
      error: 'Unauthorized',
      code: 'UNAUTHENTICATED',
    });
    expect(result.status).toBe(401);
    expect(getClientById).not.toHaveBeenCalled();
  });

  it('allows an assigned doula to see staff-only notes', async () => {
    (sensitiveAccess.canAccessSensitive as jest.Mock).mockResolvedValue({
      canAccess: true,
      assignedClientIds: [clientId],
    });
    const { controller, getClientActivities } = buildController();

    const result = await invoke(
      controller,
      request({
        id: clientId,
        user: { id: 'doula-1', role: ROLE.DOULA },
      })
    );

    expect(result.status).toBe(200);
    expect(result.body).toEqual(
      expect.objectContaining({ success: true, meta: { count: 2 } })
    );
    expect(getClientActivities).toHaveBeenCalledWith(clientId);
  });

  it.each([
    ['billing', ROLE.BILLING],
    ['missing', undefined],
  ])('returns 403 for a %s role', async (_label, role) => {
    const { controller, getClientById, getClientActivities } =
      buildController();

    const result = await invoke(
      controller,
      request({
        id: clientId,
        user: { id: 'user-1', role } as AuthRequest['user'],
      })
    );

    expect(result.body).toEqual({
      success: false,
      error: 'Forbidden',
      code: 'FORBIDDEN',
    });
    expect(result.status).toBe(403);
    expect(getClientById).not.toHaveBeenCalled();
    expect(getClientActivities).not.toHaveBeenCalled();
  });

  it('returns an empty 200 list when the activities table is missing', async () => {
    const errorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const getClientActivities = jest
      .fn()
      .mockRejectedValue(
        new Error('relation "client_activities" does not exist')
      );
    const { controller } = buildController({ getClientActivities });

    const result = await invoke(
      controller,
      request({ id: clientId, user: admin })
    );

    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      success: true,
      data: [],
      meta: { count: 0 },
    });
    expect(errorSpy).toHaveBeenCalledWith(
      'Error: Failed to fetch activities (table may be missing). Returning empty list.'
    );
    errorSpy.mockRestore();
  });

  it('returns a safe 500 when the list fails for another reason', async () => {
    const getClientActivities = jest
      .fn()
      .mockRejectedValue(new Error('connection reset'));
    const { controller } = buildController({ getClientActivities });

    const result = await invoke(
      controller,
      request({ id: clientId, user: admin })
    );

    expect(result.status).toBe(500);
    expect(result.body).toEqual({
      success: false,
      error: 'Internal Server Error',
    });
  });

  it('maps a validation error from the list to 400 without a code', async () => {
    const getClientActivities = jest
      .fn()
      .mockRejectedValue(new ValidationError('bad field'));
    const { controller } = buildController({ getClientActivities });

    const result = await invoke(
      controller,
      request({ id: clientId, user: admin })
    );

    expect(result.status).toBe(400);
    expect(result.body).toEqual({ success: false, error: 'bad field' });
  });
});
