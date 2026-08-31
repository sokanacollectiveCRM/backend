import { Request, Response, Router } from 'express';

import { logger } from '../common/utils/logger';
import { toSafeProviderError } from '../common/utils/safeLogging';
import { signNowCallback } from '../controllers/signNowWebhookController';
import authMiddleware from '../middleware/authMiddleware';
import authorizeRoles from '../middleware/authorizeRoles';
import { requireSignNowWebhookAuth } from '../security/webhookAuth';
import { signNowService } from '../services/signNowService';

const router = Router();

router.use((_req, res, next) => {
  res.setHeader('Deprecation', 'true');
  res.setHeader('Link', '</api/contracts/drafts>; rel="successor-version"');
  next();
});

interface SignNowRequest extends Request {
  body: {
    documentId?: string;
    client?: {
      email: string;
      name: string;
    };
    partner?: {
      email: string;
      name: string;
    };
    subject?: string;
    message?: string;
    sequential?: boolean;
  };
}

const requireAdmin = (req: any, res: any, next: any) =>
  authorizeRoles(req, res, next, ['admin']);

// Provider webhook — no CRM session; HMAC via SIGNNOW_WEBHOOK_SECRET (PR 5).
router.post('/callback', requireSignNowWebhookAuth, signNowCallback);

// Security bug fix (PR 4): SignNow tooling / invitations require admin session.
router.use(authMiddleware);
router.use(requireAdmin);

// Test authentication
router.post(
  '/test-auth',
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const result = await signNowService.testAuthentication();
      res.json(result);
    } catch (error) {
      logger.error(
        toSafeProviderError('signnow', 'test_auth', error),
        'Test auth failed'
      );
      res.status(500).json({
        success: false,
        error: 'Authentication test failed',
      });
    }
  }
);

// Test template access
router.post(
  '/test-template',
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const templateId = 'f1d8f4d8b2c849f88644b7276b4b466ec6df8620';
      const result = await signNowService.testTemplate(templateId);
      res.json(result);
    } catch (error) {
      logger.error(
        toSafeProviderError('signnow', 'test_template', error),
        'Test template failed'
      );
      res.status(500).json({
        success: false,
        error: 'Template test failed',
      });
    }
  }
);

// List available templates
router.post(
  '/list-templates',
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const result = await signNowService.listTemplates();
      res.json(result);
    } catch (error) {
      logger.error(
        toSafeProviderError('signnow', 'list_templates', error),
        'List templates failed'
      );
      res.status(500).json({
        success: false,
        error: 'List templates failed',
      });
    }
  }
);

// Get template field details
router.post(
  '/template-fields',
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const templateId = 'f1d8f4d8b2c849f88644b7276b4b466ec6df8620';
      const result = await signNowService.getTemplateFields(templateId);
      res.json(result);
    } catch (error) {
      logger.error(
        toSafeProviderError('signnow', 'template_fields', error),
        'Get template fields failed'
      );
      res.status(500).json({
        success: false,
        error: 'Get template fields failed',
      });
    }
  }
);

// Get Postpartum template field details
router.post(
  '/postpartum-template-fields',
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const templateId = '3cc4323f75af4986b9a142513185d2b13d300759';
      const result = await signNowService.getTemplateFields(templateId);
      res.json(result);
    } catch (error) {
      logger.error(
        toSafeProviderError('signnow', 'postpartum_template_fields', error),
        'Get Postpartum template fields failed'
      );
      res.status(500).json({
        success: false,
        error: 'Get Postpartum template fields failed',
      });
    }
  }
);

// Debug: Clone and inspect fields
router.post(
  '/debug-clone-fields',
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const templateId = 'f1d8f4d8b2c849f88644b7276b4b466ec6df8620';

      const cloneResult = await signNowService.createPrefilledDocFromTemplate(
        templateId,
        'Debug Field Test Document',
        []
      );

      const fieldsInfo = await signNowService.inspectDocumentFields(
        cloneResult.documentId
      );

      res.json({
        success: true,
        documentId: cloneResult.documentId,
        fields: fieldsInfo.fields,
      });
    } catch (error) {
      logger.error(
        toSafeProviderError('signnow', 'debug_clone_fields', error),
        'Debug clone fields failed'
      );
      res.status(500).json({
        success: false,
        error: 'Debug clone fields failed',
      });
    }
  }
);

// Send client+partner invitation
router.post(
  '/send-client-partner',
  async (req: SignNowRequest, res: Response): Promise<void> => {
    try {
      const { documentId, client, partner, subject, message, sequential } =
        req.body;

      if (!client || !client.email || !client.name) {
        res.status(400).json({
          success: false,
          error: 'client {name,email} are required',
        });
        return;
      }

      const result = await signNowService.createInvitationClientPartner(
        documentId,
        client,
        partner,
        { subject, message, sequential }
      );

      res.json(result);
    } catch (error: any) {
      logger.error(
        toSafeProviderError('signnow', 'send_client_partner', error),
        'SignNow invite failed'
      );

      if (error?.response?.data?.errors) {
        const dailyLimitError = error.response.data.errors.find(
          (e: any) => e.code === 65639
        );
        if (dailyLimitError) {
          res.status(429).json({
            success: false,
            error: 'Daily invite limit exceeded. Please try again tomorrow.',
          });
          return;
        }
      }

      res.status(500).json({
        success: false,
        error: 'Failed to send contract',
      });
    }
  }
);

export default router;
