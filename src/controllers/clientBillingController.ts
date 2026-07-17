import { Response } from 'express';

import {
  InstallmentInvoiceError,
  installmentInvoiceService,
} from '../services/installmentInvoiceService';
import { AuthRequest } from '../types';
import { ApiResponse } from '../utils/responseBuilder';

export async function getClientPaymentSchedule(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const result = await installmentInvoiceService.list(req.params.clientId);
    res.json(ApiResponse.success(result));
  } catch (error) {
    if (error instanceof InstallmentInvoiceError) {
      res
        .status(error.statusCode)
        .json(ApiResponse.error(error.message, error.code));
      return;
    }
    res
      .status(500)
      .json(
        ApiResponse.error(
          error instanceof Error
            ? error.message
            : 'Failed to load payment schedule',
          'PAYMENT_SCHEDULE_FAILED'
        )
      );
  }
}

export async function generateInstallmentInvoice(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const result = await installmentInvoiceService.generate(
      req.params.clientId,
      req.params.installmentId,
      req.user?.id || 'staff'
    );
    res.json(ApiResponse.success(result));
  } catch (error) {
    if (error instanceof InstallmentInvoiceError) {
      res
        .status(error.statusCode)
        .json(ApiResponse.error(error.message, error.code));
      return;
    }
    res
      .status(500)
      .json(
        ApiResponse.error(
          error instanceof Error
            ? error.message
            : 'Failed to generate installment invoice',
          'INSTALLMENT_INVOICE_FAILED'
        )
      );
  }
}
