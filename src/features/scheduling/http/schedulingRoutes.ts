import express, { Router } from 'express';

import authMiddleware from '../../../middleware/authMiddleware';
import authorizeRoles from '../../../middleware/authorizeRoles';
import type { AuthRequest } from '../../../types';
import { createSchedulingController } from '../composition';
import type { SchedulingController } from './schedulingController';

export function buildSchedulingRouter(
  controller: SchedulingController
): Router {
  const schedulingRoutes: Router = express.Router();

  schedulingRoutes.get(
    '/client/doulas/:doulaId/slots',
    authMiddleware,
    (req, res, next) => authorizeRoles(req, res, next, ['client']),
    (req, res) => controller.listClientSlots(req as AuthRequest, res)
  );

  schedulingRoutes.post(
    '/client/bookings',
    authMiddleware,
    (req, res, next) => authorizeRoles(req, res, next, ['client', 'admin']),
    (req, res) => controller.createClientBooking(req as AuthRequest, res)
  );

  schedulingRoutes.get(
    '/client/bookings',
    authMiddleware,
    (req, res, next) => authorizeRoles(req, res, next, ['client']),
    (req, res) => controller.listClientBookings(req as AuthRequest, res)
  );

  schedulingRoutes.get(
    '/doula/bookings',
    authMiddleware,
    (req, res, next) => authorizeRoles(req, res, next, ['doula']),
    (req, res) => controller.listDoulaBookings(req as AuthRequest, res)
  );

  schedulingRoutes.get(
    '/admin/bookings',
    authMiddleware,
    (req, res, next) => authorizeRoles(req, res, next, ['admin']),
    (req, res) => controller.listAdminBookings(req as AuthRequest, res)
  );

  schedulingRoutes.patch(
    '/bookings/:id',
    authMiddleware,
    (req, res, next) =>
      authorizeRoles(req, res, next, ['admin', 'doula', 'client']),
    (req, res) => controller.updateBooking(req as AuthRequest, res)
  );

  schedulingRoutes.get(
    '/admin/doulas/:doulaId/availability',
    authMiddleware,
    (req, res, next) => authorizeRoles(req, res, next, ['admin']),
    (req, res) => controller.listAdminAvailability(req as AuthRequest, res)
  );

  return schedulingRoutes;
}

const schedulingRoutes = buildSchedulingRouter(createSchedulingController());
export default schedulingRoutes;
