import { Response } from 'express';
import { ValidationError } from '../domains/errors';
import { AuthRequest } from '../types';
import { ApiResponse } from '../utils/responseBuilder';
import { verificationInvoiceService } from '../services/verificationInvoiceService';

export async function sendVerificationInvoice(req: AuthRequest, res: Response): Promise<void> {
  try {
    const clientId = req.params.clientId;
    if (!clientId) {
      res.status(400).json(ApiResponse.error('Missing clientId', 'VALIDATION_ERROR'));
      return;
    }

    const result = await verificationInvoiceService.sendVerificationInvoice(
      clientId,
      req.user?.id || 'staff'
    );
    res.json(ApiResponse.success(result));
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json(ApiResponse.error(error.message, 'VALIDATION_ERROR'));
      return;
    }
    const message = error instanceof Error ? error.message : 'Failed to send verification invoice';
    const status = message.includes('not found') ? 404 : 500;
    res.status(status).json(ApiResponse.error(message, 'VERIFICATION_INVOICE_FAILED'));
  }
}
