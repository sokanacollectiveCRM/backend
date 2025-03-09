import { RequestFormRepository } from '../repositories/RequestFormRepository';
import { NodemailerService } from './EmailService';

export class RequestApprovalService {
  private emailService: NodemailerService;
  private requestRepository: RequestFormRepository;

  constructor() {
    this.emailService = new NodemailerService();
    this.requestRepository = new RequestFormRepository();
  }

  async approveRequest(requestId: number, signupBaseUrl: string): Promise<void> {
    const request = await this.requestRepository.getRequestById(requestId);
    if (!request) {
      throw new Error('Request not found');
    }

    await this.requestRepository.updateRequestStatus(requestId, 'approved');

    const token = crypto.randomUUID();
    const signupUrl = `${signupBaseUrl}?token=${token}&email=${request.email}`;

    // 4. Send approval email
    await this.emailService.sendClientApprovalEmail(
      request.email,
      `${request.first_name} ${request.last_name}`,
      signupUrl
    );
  }
}