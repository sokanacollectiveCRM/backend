import express, { Router } from 'express';
import multer from 'multer';

import { ValidationError } from '../../../domains/errors';
import { requestFormService } from '../../../index';
import authMiddleware from '../../../middleware/authMiddleware';
import { AuthRequest } from '../../../types';
import { isPlatformSupportPrincipal } from '../../tenancy';
import {
  IntakeEditorActor,
  IntakeEditorError,
  clearIntakeDraftLogo,
  discardIntakeEditorDraft,
  getIntakeEditorState,
  getIntakeEditorVersion,
  listIntakeEditorVersions,
  listIntakeOrganizationsForSupport,
  prepareIntakeTestSubmission,
  publishIntakeEditorDraft,
  readLiveLogoBytes,
  restoreIntakeEditorVersion,
  saveIntakeEditorDraft,
  setIntakeDraftLogo,
  storeIntakeAnswerImage,
} from '../application/intakeFormEditor';
import { PUBLIC_INTAKE_SUCCESS_MESSAGE } from './publicSubmissionContract';

const intakeFormRoutes: Router = express.Router();
const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});
const answerImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

intakeFormRoutes.use(authMiddleware);

intakeFormRoutes.get('/organizations', async (req, res) => {
  try {
    const actor = await actorFrom(req as AuthRequest);
    if (!actor.platformSupport) {
      res.status(403).json({
        error: 'Only platform support can list organizations.',
      });
      return;
    }
    const tenants = await listIntakeOrganizationsForSupport();
    res.status(200).json({ tenants });
  } catch (error) {
    sendEditorError(res, error);
  }
});

intakeFormRoutes.get('/draft', async (req, res) => {
  try {
    const actor = await actorFrom(req as AuthRequest);
    if (actor.platformSupport && !actor.requestedTenantId) {
      const tenants = await listIntakeOrganizationsForSupport();
      res.status(200).json({
        platformSupport: true,
        needsTenant: true,
        tenants,
      });
      return;
    }
    const state = await getIntakeEditorState(actor);
    res.status(200).json(state);
  } catch (error) {
    sendEditorError(res, error);
  }
});

intakeFormRoutes.put('/draft', async (req, res) => {
  try {
    const actor = await actorFrom(req as AuthRequest);
    const state = await saveIntakeEditorDraft(actor, req.body);
    res.status(200).json(state);
  } catch (error) {
    sendEditorError(res, error);
  }
});

intakeFormRoutes.post('/draft/publish', async (req, res) => {
  try {
    const actor = await actorFrom(req as AuthRequest);
    const state = await publishIntakeEditorDraft(actor);
    res.status(200).json(state);
  } catch (error) {
    sendEditorError(res, error);
  }
});

intakeFormRoutes.post('/draft/discard', async (req, res) => {
  try {
    const actor = await actorFrom(req as AuthRequest);
    const state = await discardIntakeEditorDraft(actor, req.body?.confirm);
    res.status(200).json(state);
  } catch (error) {
    sendEditorError(res, error);
  }
});

intakeFormRoutes.post('/draft/logo', (req, res) => {
  logoUpload.single('logo')(req, res, async (uploadError) => {
    if (uploadError) {
      res.status(400).json({ error: 'The logo must be 2 MB or smaller.' });
      return;
    }
    try {
      const actor = await actorFrom(req as AuthRequest);
      const file = (req as AuthRequest).file;
      const state = await setIntakeDraftLogo(
        actor,
        file
          ? {
              buffer: file.buffer,
              mimetype: file.mimetype,
              size: file.size,
            }
          : undefined
      );
      res.status(200).json(state);
    } catch (error) {
      sendEditorError(res, error);
    }
  });
});

intakeFormRoutes.delete('/draft/logo', async (req, res) => {
  try {
    const actor = await actorFrom(req as AuthRequest);
    const state = await clearIntakeDraftLogo(actor);
    res.status(200).json(state);
  } catch (error) {
    sendEditorError(res, error);
  }
});

intakeFormRoutes.get('/versions', async (req, res) => {
  try {
    const actor = await actorFrom(req as AuthRequest);
    res.status(200).json(await listIntakeEditorVersions(actor));
  } catch (error) {
    sendEditorError(res, error);
  }
});

intakeFormRoutes.get('/versions/:version', async (req, res) => {
  try {
    const actor = await actorFrom(req as AuthRequest);
    const version = parseVersion(req.params.version);
    if (version == null) {
      res.status(400).json({ error: 'Version must be a positive number.' });
      return;
    }
    res.status(200).json(await getIntakeEditorVersion(actor, version));
  } catch (error) {
    sendEditorError(res, error);
  }
});

intakeFormRoutes.post('/versions/:version/restore', async (req, res) => {
  try {
    const actor = await actorFrom(req as AuthRequest);
    const version = parseVersion(req.params.version);
    if (version == null) {
      res.status(400).json({ error: 'Version must be a positive number.' });
      return;
    }
    res.status(200).json(await restoreIntakeEditorVersion(actor, version));
  } catch (error) {
    sendEditorError(res, error);
  }
});

intakeFormRoutes.post('/answer-images', (req, res) => {
  answerImageUpload.single('image')(req, res, async (uploadError) => {
    if (uploadError) {
      res.status(400).json({ error: 'Each image must be 5 MB or smaller.' });
      return;
    }
    try {
      const actor = await actorFrom(req as AuthRequest);
      const tenant = await getIntakeEditorState(actor);
      const assetId = await storeIntakeAnswerImage({
        tenantId: tenant.tenant.id,
        file: (req as AuthRequest).file
          ? {
              buffer: (req as AuthRequest).file!.buffer,
              mimetype: (req as AuthRequest).file!.mimetype,
              size: (req as AuthRequest).file!.size,
            }
          : undefined,
        createdBy: actor.userId,
      });
      res.status(200).json({ assetId });
    } catch (error) {
      sendEditorError(res, error);
    }
  });
});

intakeFormRoutes.post('/test-submissions', async (req, res) => {
  try {
    const actor = await actorFrom(req as AuthRequest);
    const version =
      req.body?.version == null || req.body.version === ''
        ? undefined
        : Number(req.body.version);
    if (version != null && (!Number.isInteger(version) || version < 1)) {
      res.status(400).json({ error: 'Version must be a positive number.' });
      return;
    }
    const prepared = await prepareIntakeTestSubmission(actor, {
      answers: req.body?.answers ?? req.body,
      version,
    });
    await requestFormService.savePreparedLead(prepared.data, {
      tenantId: prepared.tenantId,
      intakeFormVersion: prepared.intakeFormVersion,
      customAnswers: prepared.customAnswers,
      isTest: true,
    });
    res
      .status(200)
      .json({ message: PUBLIC_INTAKE_SUCCESS_MESSAGE, is_test: true });
  } catch (error) {
    sendEditorError(res, error);
  }
});

intakeFormRoutes.get('/live-logo', async (req, res) => {
  try {
    const actor = await actorFrom(req as AuthRequest);
    const state = await getIntakeEditorState(actor);
    const logo = await readLiveLogoBytes(state.tenant.id);
    if (!logo) {
      res.status(204).end();
      return;
    }
    res.setHeader('Content-Type', logo.contentType);
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.status(200).send(logo.bytes);
  } catch (error) {
    sendEditorError(res, error);
  }
});

async function actorFrom(req: AuthRequest): Promise<IntakeEditorActor> {
  if (!req.user?.id) {
    throw new IntakeEditorError('Sign in to edit the intake form.', 401);
  }
  const platformSupport = await isPlatformSupportPrincipal({
    userId: String(req.user.id),
    email: req.user.email,
  });
  const queryTenant = req.query.tenantId;
  const requestedTenantId =
    typeof queryTenant === 'string' && queryTenant.trim()
      ? queryTenant.trim()
      : null;
  return {
    userId: String(req.user.id),
    email: req.user.email,
    sessionRole:
      req.tenant?.role ?? (req.user.role ? String(req.user.role) : null),
    sessionTenantId: req.tenant?.id ?? null,
    platformSupport,
    requestedTenantId,
  };
}

function parseVersion(value: string | undefined): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return null;
  return parsed;
}

function sendEditorError(res: express.Response, error: unknown): void {
  if (error instanceof IntakeEditorError) {
    if (error.status === 429) {
      const retryAfterSec = Number(error.extra?.retryAfterSec ?? 1);
      res.setHeader('Retry-After', String(retryAfterSec));
      res.status(429).json({
        error: error.message,
        code: 'RATE_LIMITED',
        retryAfterSec,
      });
      return;
    }
    res.status(error.status).json({ error: error.message });
    return;
  }
  if (error instanceof ValidationError) {
    res.status(400).json({ error: error.message });
    return;
  }
  console.error('Intake form editor error:', error);
  res.status(500).json({ error: 'Unable to update the intake form.' });
}

export default intakeFormRoutes;
