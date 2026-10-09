import { NextFunction, Request, Response, Router } from 'express';
import { ZodError } from 'zod';

import authMiddleware from '../../../middleware/authMiddleware';
import authorizeRoles from '../../../middleware/authorizeRoles';
import { ApiErrorCode } from '../../../security/errorCodes';
import { MessagingController } from './messagingController';
import { requireReminderCronOidc, requireReminderTestTools } from './oidcCronAuth';

const wrap =
  (fn: (req: Request, res: Response, next: NextFunction) => unknown) =>
  (req: Request, res: Response, next: NextFunction): void => {
    void Promise.resolve(fn(req, res, next)).catch(next);
  };

function handleError(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: 'Validation error',
      code: ApiErrorCode.VALIDATION_ERROR,
      details: error.flatten(),
    });
    return;
  }
  const candidate = error as { statusCode?: number; message?: string };
  const status =
    typeof candidate.statusCode === 'number' ? candidate.statusCode : 500;
  res.status(status).json({
    success: false,
    error: status >= 500 ? 'Internal server error' : candidate.message,
    code: status === 404 ? ApiErrorCode.NOT_FOUND : ApiErrorCode.INTERNAL_ERROR,
  });
}

export function createAdminMessagingRoutes(
  controller: MessagingController
): Router {
  const router = Router();
  router.use(authMiddleware);
  router.use((req, res, next) => authorizeRoles(req, res, next, ['admin']));

  router.get('/messaging/policies', wrap(controller.listPolicies));
  router.get('/messaging/policies/:id', wrap(controller.getPolicy));
  router.patch('/messaging/policies/:id', wrap(controller.patchPolicy));
  router.put('/messaging/policies/:id/steps', wrap(controller.replaceSteps));

  router.get('/messaging/templates', wrap(controller.listTemplates));
  router.get('/messaging/templates/:id', wrap(controller.getTemplate));
  router.patch('/messaging/templates/:id', wrap(controller.patchTemplate));
  router.post('/messaging/templates/:id/preview', wrap(controller.previewTemplate));
  router.post('/messaging/templates/:id/test-send', wrap(controller.testSendTemplate));

  router.get('/messaging/runs', wrap(controller.listRuns));
  router.get('/messaging/send-log', wrap(controller.listSendLog));
  router.get('/messaging/settings', wrap(controller.getSettings));
  router.patch('/messaging/settings', wrap(controller.patchSettings));
  router.get('/messaging/alerts', wrap(controller.listAlerts));
  router.post('/messaging/alerts/:id/ack', wrap(controller.ackAlert));

  router.post(
    '/messaging/runs/:id/advance',
    requireReminderTestTools,
    wrap(controller.advanceRun)
  );
  router.post(
    '/messaging/tick-now',
    requireReminderTestTools,
    wrap(controller.tickNow)
  );

  router.post(
    '/contracts/:id/reminders/stop',
    wrap(controller.stopContractReminders)
  );
  router.post(
    '/contracts/:id/reminders/resume',
    wrap(controller.resumeContractReminders)
  );

  router.get('/clients/:id/postponements', wrap(controller.listPostponements));
  router.post('/clients/:id/postponements', wrap(controller.createPostponement));
  router.post('/postponements/:id/approve', wrap(controller.approvePostponement));
  router.post('/postponements/:id/lift', wrap(controller.liftPostponement));
  router.post('/postponements/:id/extend', wrap(controller.extendPostponement));
  router.post('/postponements/:id/cancel', wrap(controller.cancelPostponement));

  router.use(handleError);
  return router;
}

export function createDoulaPostponementRoutes(
  controller: MessagingController
): Router {
  const router = Router();
  router.use(authMiddleware);
  router.use((req, res, next) => authorizeRoles(req, res, next, ['doula']));
  router.post(
    '/clients/:id/postponement-requests',
    wrap(controller.requestPostponement)
  );
  router.use(handleError);
  return router;
}

export function createReminderTickRoutes(
  controller: MessagingController
): Router {
  const router = Router();
  router.post('/tick', wrap(requireReminderCronOidc), wrap(controller.tick));
  router.use(handleError);
  return router;
}
