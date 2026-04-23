import { Response } from 'express';
import { CloudSqlDoulaAssignmentService } from '../services/cloudSqlDoulaAssignmentService';
import { PaymentMethodServiceError, customerPaymentMethodService } from '../services/payments/customerPaymentMethodService';
import type { AuthRequest } from '../types';

interface SavePaymentMethodBody {
  client_id: string;
  intuit_token: string;
  request_id: string;
}

async function resolveAuthorizedClientId(req: AuthRequest, clientId: string): Promise<string> {
  if (!req.user) {
    throw new PaymentMethodServiceError('unauthorized', 401, 'Unauthorized');
  }

  if (req.user.role === 'admin') {
    return clientId;
  }

  const assignmentService = new CloudSqlDoulaAssignmentService();

  if (req.user.role === 'client') {
    const ownClientId = await assignmentService.getClientIdByAuthUserId(req.user.id);
    if (!ownClientId) {
      throw new PaymentMethodServiceError('client_not_found', 404, 'Client not found');
    }
    if (ownClientId !== clientId) {
      throw new PaymentMethodServiceError('forbidden', 403, 'Not authorized for this client');
    }
    return ownClientId;
  }

  if (req.user.role === 'doula') {
    const allowed = await assignmentService.assignmentExists(clientId, req.user.id);
    if (!allowed) {
      throw new PaymentMethodServiceError('forbidden', 403, 'Not authorized for this client');
    }
    return clientId;
  }

  throw new PaymentMethodServiceError('forbidden', 403, 'Not authorized for this client');
}

function respondWithError(res: Response, error: unknown): void {
  if (error instanceof PaymentMethodServiceError) {
    res.status(error.statusCode).json({
      success: false,
      error: error.message,
      code: error.code,
    });
    return;
  }

  const message = error instanceof Error ? error.message : 'Internal server error';
  res.status(500).json({
    success: false,
    error: message,
    code: 'internal_server_error',
  });
}

export class PaymentMethodController {
  async savePaymentMethod(req: AuthRequest, res: Response): Promise<void> {
    try {
      const body = req.body as SavePaymentMethodBody;
      const authorizedClientId = await resolveAuthorizedClientId(req, body.client_id);

      const data = await customerPaymentMethodService.savePaymentMethod({
        client_id: authorizedClientId,
        intuit_token: body.intuit_token,
        request_id: body.request_id,
      });

      res.status(200).json({ success: true, data });
    } catch (error) {
      respondWithError(res, error);
    }
  }

  async getPaymentMethod(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { clientId } = req.params;
      const authorizedClientId = await resolveAuthorizedClientId(req, clientId);
      const data = await customerPaymentMethodService.getPaymentMethod(authorizedClientId);

      if (!data) {
        res.status(404).json({
          success: false,
          error: 'Payment method not found',
          code: 'payment_method_not_found',
        });
        return;
      }

      res.status(200).json({ success: true, data });
    } catch (error) {
      respondWithError(res, error);
    }
  }
}

export const paymentMethodController = new PaymentMethodController();
