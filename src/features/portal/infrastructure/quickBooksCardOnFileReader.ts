import { customerPaymentMethodService } from '../../../services/payments/customerPaymentMethodService';
import { CardOnFileReader, CardOnFileRecord } from '../application/ports';

export class QuickBooksCardOnFileReader implements CardOnFileReader {
  async read(clientId: string): Promise<CardOnFileRecord> {
    const status =
      await customerPaymentMethodService.getCardOnFileStatus(clientId);
    return {
      onFile: status.on_file,
      paymentMethodReference: status.payment_method_reference,
    };
  }
}
