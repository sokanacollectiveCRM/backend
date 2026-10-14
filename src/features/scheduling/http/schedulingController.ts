import { Response } from 'express';

import type { AuthRequest } from '../../../types';
import type { SchedulingActorRole } from '../domain/bookingRules';
import type { SchedulingService } from '../application/schedulingService';
import { sendSchedulingError } from './mapError';

function actorFrom(req: AuthRequest) {
  return {
    id: String(req.user?.id || ''),
    role: String(req.user?.role || '').toLowerCase() as SchedulingActorRole,
    email: req.user?.email ?? null,
  };
}

export class SchedulingController {
  constructor(private readonly service: SchedulingService) {}

  async listClientSlots(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await this.service.listClientSlots({
        actor: actorFrom(req),
        doulaId: String(req.params.doulaId || ''),
        from: req.query.from,
        to: req.query.to,
        durationMinutes: req.query.durationMinutes,
      });
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      sendSchedulingError(res, error);
    }
  }

  async createClientBooking(req: AuthRequest, res: Response): Promise<void> {
    try {
      const booking = await this.service.createClientBooking({
        actor: actorFrom(req),
        doulaId: req.body?.doulaId ?? req.body?.doula_id,
        startAt: req.body?.startAt ?? req.body?.start_at,
        endAt: req.body?.endAt ?? req.body?.end_at,
        notes: req.body?.notes ?? req.body?.note,
        clientId: req.body?.clientId ?? req.body?.client_id,
      });
      res.status(201).json({ success: true, booking });
    } catch (error) {
      sendSchedulingError(res, error);
    }
  }

  async listClientBookings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const bookings = await this.service.listClientBookings(actorFrom(req));
      res.status(200).json({ success: true, bookings });
    } catch (error) {
      sendSchedulingError(res, error);
    }
  }

  async listDoulaBookings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const bookings = await this.service.listDoulaBookings({
        actor: actorFrom(req),
        from: req.query.from,
        to: req.query.to,
      });
      res.status(200).json({ success: true, bookings });
    } catch (error) {
      sendSchedulingError(res, error);
    }
  }

  async listAdminBookings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const bookings = await this.service.listAdminBookings({
        actor: actorFrom(req),
        doulaId: req.query.doulaId ?? req.query.doula_id,
        clientId: req.query.clientId ?? req.query.client_id,
        status: req.query.status,
        from: req.query.from,
        to: req.query.to,
      });
      res.status(200).json({ success: true, bookings });
    } catch (error) {
      sendSchedulingError(res, error);
    }
  }

  async updateBooking(req: AuthRequest, res: Response): Promise<void> {
    try {
      const booking = await this.service.updateBookingStatus({
        actor: actorFrom(req),
        bookingId: String(req.params.id || ''),
        status: req.body?.status,
      });
      res.status(200).json({ success: true, booking });
    } catch (error) {
      sendSchedulingError(res, error);
    }
  }

  async listAdminAvailability(req: AuthRequest, res: Response): Promise<void> {
    try {
      const records = await this.service.listAdminAvailability({
        actor: actorFrom(req),
        doulaId: String(req.params.doulaId || ''),
      });
      res.status(200).json({ success: true, records });
    } catch (error) {
      sendSchedulingError(res, error);
    }
  }
}
