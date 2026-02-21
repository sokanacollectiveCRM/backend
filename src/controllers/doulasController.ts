import { Request, Response } from 'express';
import {
  DoulasService,
  DoulaAssignmentsQuery,
  DoulaListQuery,
  UpdateDoulaAssignmentInput,
} from '../services/doulasService';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const DEFAULT_OFFSET = 0;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function parseLimit(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(n), MAX_LIMIT);
}

function parseOffset(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_OFFSET;
  return Math.floor(n);
}

function parseIncludeCounts(raw: unknown): boolean {
  if (raw === undefined) return true;
  if (typeof raw !== 'string') return true;
  return raw.toLowerCase() !== 'false';
}

function optionalString(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return trimmed ? trimmed : undefined;
}

function validateNullableString(value: unknown, fieldName: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return `${fieldName} must be a string or null`;
  return null;
}

function validateDate(value: string | undefined, fieldName: string): string | null {
  if (!value) return null;
  if (!DATE_REGEX.test(value)) {
    return `${fieldName} must be YYYY-MM-DD`;
  }
  return null;
}

function validateUuid(value: string | undefined, fieldName: string): string | null {
  if (!value) return null;
  if (!UUID_REGEX.test(value)) {
    return `${fieldName} must be a valid UUID`;
  }
  return null;
}

export class DoulasController {
  constructor(private readonly doulasService: DoulasService) {}

  async listDoulas(req: Request, res: Response): Promise<void> {
    try {
      const query: DoulaListQuery = {
        q: optionalString(req.query.q),
        includeCounts: parseIncludeCounts(req.query.includeCounts),
        limit: parseLimit(req.query.limit),
        offset: parseOffset(req.query.offset),
      };

      const result = await this.doulasService.listDoulas(query);
      res.status(200).json({
        data: result.data,
        meta: {
          limit: query.limit,
          offset: query.offset,
          count: result.count,
        },
      });
    } catch {
      res.status(500).json({ error: 'Failed to fetch doulas' });
    }
  }

  async listDoulaAssignments(req: Request, res: Response): Promise<void> {
    const doulaId = optionalString(req.query.doulaId);
    const dateFrom = optionalString(req.query.dateFrom);
    const dateTo = optionalString(req.query.dateTo);
    const sortRaw = optionalString(req.query.sort);
    const sort = sortRaw === 'assigned_at_desc' ? 'assigned_at_desc' : 'updated_at_desc';

    const uuidError = validateUuid(doulaId, 'doulaId');
    if (uuidError) {
      res.status(400).json({ error: uuidError });
      return;
    }
    const dateFromError = validateDate(dateFrom, 'dateFrom');
    if (dateFromError) {
      res.status(400).json({ error: dateFromError });
      return;
    }
    const dateToError = validateDate(dateTo, 'dateTo');
    if (dateToError) {
      res.status(400).json({ error: dateToError });
      return;
    }

    try {
      const query: DoulaAssignmentsQuery = {
        q: optionalString(req.query.q),
        doulaId,
        hospital: optionalString(req.query.hospital),
        dateFrom,
        dateTo,
        sort,
        limit: parseLimit(req.query.limit),
        offset: parseOffset(req.query.offset),
      };

      const result = await this.doulasService.listDoulaAssignments(query);
      res.status(200).json({
        data: result.data,
        meta: {
          limit: query.limit,
          offset: query.offset,
          count: result.count,
        },
      });
    } catch {
      res.status(500).json({ error: 'Failed to fetch doula assignments' });
    }
  }

  async listClientDoulaAssignments(req: Request, res: Response): Promise<void> {
    const clientId = optionalString(req.params.clientId);
    const clientIdError = validateUuid(clientId, 'clientId');
    if (clientIdError || !clientId) {
      res.status(400).json({ error: clientIdError ?? 'clientId is required' });
      return;
    }

    try {
      const query: DoulaAssignmentsQuery = {
        q: undefined,
        doulaId: undefined,
        hospital: undefined,
        dateFrom: undefined,
        dateTo: undefined,
        sort: 'updated_at_desc',
        limit: parseLimit(req.query.limit),
        offset: parseOffset(req.query.offset),
        clientId,
      };

      const result = await this.doulasService.listDoulaAssignments(query);
      res.status(200).json({
        data: result.data,
        meta: {
          limit: query.limit,
          offset: query.offset,
          count: result.count,
        },
      });
    } catch {
      res.status(500).json({ error: 'Failed to fetch client doula assignments' });
    }
  }

  async getDoulaAssignment(req: Request, res: Response): Promise<void> {
    const clientId = optionalString(req.params.clientId);
    const doulaId = optionalString(req.params.doulaId);

    const clientIdError = validateUuid(clientId, 'clientId');
    if (clientIdError || !clientId) {
      res.status(400).json({ error: clientIdError ?? 'clientId is required' });
      return;
    }

    const doulaIdError = validateUuid(doulaId, 'doulaId');
    if (doulaIdError || !doulaId) {
      res.status(400).json({ error: doulaIdError ?? 'doulaId is required' });
      return;
    }

    try {
      const data = await this.doulasService.getDoulaAssignment(clientId, doulaId);
      if (!data) {
        res.status(404).json({ error: 'Assignment not found' });
        return;
      }
      res.status(200).json({ data });
    } catch {
      res.status(500).json({ error: 'Failed to fetch doula assignment' });
    }
  }

  async updateDoulaAssignment(req: Request, res: Response): Promise<void> {
    const clientId = optionalString(req.params.clientId);
    const doulaId = optionalString(req.params.doulaId);

    const clientIdError = validateUuid(clientId, 'clientId');
    if (clientIdError || !clientId) {
      res.status(400).json({ error: clientIdError ?? 'clientId is required' });
      return;
    }

    const doulaIdError = validateUuid(doulaId, 'doulaId');
    if (doulaIdError || !doulaId) {
      res.status(400).json({ error: doulaIdError ?? 'doulaId is required' });
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const hospitalTypeError = validateNullableString(body.hospital, 'hospital');
    if (hospitalTypeError) {
      res.status(400).json({ error: hospitalTypeError });
      return;
    }
    const notesTypeError = validateNullableString(body.notes, 'notes');
    if (notesTypeError) {
      res.status(400).json({ error: notesTypeError });
      return;
    }
    const sourceTimestampTypeError = validateNullableString(body.sourceTimestamp, 'sourceTimestamp');
    if (sourceTimestampTypeError) {
      res.status(400).json({ error: sourceTimestampTypeError });
      return;
    }

    const assignedAtRaw = body.assignedAt;
    if (assignedAtRaw !== undefined && assignedAtRaw !== null && typeof assignedAtRaw !== 'string') {
      res.status(400).json({ error: 'assignedAt must be an ISO date-time string or null' });
      return;
    }
    if (typeof assignedAtRaw === 'string') {
      const parsed = new Date(assignedAtRaw);
      if (Number.isNaN(parsed.getTime())) {
        res.status(400).json({ error: 'assignedAt must be a valid ISO date-time string' });
        return;
      }
    }

    const payload: UpdateDoulaAssignmentInput = {
      hospital: body.hospital === undefined ? undefined : (body.hospital as string | null),
      notes: body.notes === undefined ? undefined : (body.notes as string | null),
      assignedAt: body.assignedAt === undefined ? undefined : (body.assignedAt as string | null),
      sourceTimestamp:
        body.sourceTimestamp === undefined ? undefined : (body.sourceTimestamp as string | null),
    };

    try {
      const data = await this.doulasService.updateDoulaAssignment(clientId, doulaId, payload);
      if (!data) {
        res.status(404).json({ error: 'Assignment not found' });
        return;
      }
      res.status(200).json({ data });
    } catch {
      res.status(500).json({ error: 'Failed to update doula assignment' });
    }
  }
}

