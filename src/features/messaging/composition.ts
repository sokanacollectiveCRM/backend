import { logger } from '../../common/utils/logger';
import { contractNotifications } from '../../config/env';
import { nativeContracts } from '../../config/env';
import { NodemailerService } from '../../services/emailService';
import { InvitationService } from '../contracts/application/invitationService';
import { contractRepository } from '../contracts/infrastructure/contractRepository';
import { invitationRepository } from '../contracts/infrastructure/invitationRepository';
import { PostponementService } from './application/postponementService';
import {
  ContractVoider,
  ReminderEngine,
  SigningLinkIssuer,
} from './application/reminderEngine';
import { isSigned, isUnsignedPending } from './application/stopConditions';
import { setMessagingEventHandler } from './eventBus';
import { MessagingController } from './http/messagingController';
import {
  createAdminMessagingRoutes,
  createDoulaPostponementRoutes,
  createReminderTickRoutes,
} from './http/messagingRoutes';
import { PostgresMessagingStore } from './infrastructure/postgresMessagingStore';

const store = new PostgresMessagingStore();
const email = new NodemailerService();

const voids: ContractVoider = {
  async voidIfUnsigned(contractId, reason) {
    const contract = await contractRepository.findById(contractId);
    if (!contract) return 'not_found';
    if (isSigned(contract.status)) return 'skipped_signed';
    if (!isUnsignedPending(contract.status)) return 'invalid_status';
    try {
      await contractRepository.voidContract(contractId, '', reason);
      return 'voided';
    } catch (error) {
      logger.warn(
        {
          service: 'messaging',
          operation: 'void_contract',
          errorClass: error instanceof Error ? error.name : 'Error',
        },
        'Auto-void skipped'
      );
      return 'invalid_status';
    }
  },
};

const invitationService = new InvitationService(
  invitationRepository,
  contractRepository,
  nativeContracts.invitationTtlHours * 60 * 60 * 1000
);

const signingLinks: SigningLinkIssuer = {
  async issue(contractId, clientId) {
    try {
      const issued = await invitationService.issue(contractId, clientId, true);
      return `${nativeContracts.signingBaseUrl}#invitation=${encodeURIComponent(issued.token)}`;
    } catch {
      return `${nativeContracts.signingBaseUrl}`;
    }
  },
};

export const reminderEngine = new ReminderEngine(
  store,
  email,
  voids,
  signingLinks,
  { now: () => new Date() },
  contractNotifications.frontendUrl
);

export const postponementService = new PostponementService(
  store,
  reminderEngine
);

export const messagingController = new MessagingController(
  store,
  reminderEngine,
  postponementService,
  email
);

export const adminMessagingRoutes =
  createAdminMessagingRoutes(messagingController);
export const doulaPostponementRoutes =
  createDoulaPostponementRoutes(messagingController);
export const reminderTickRoutes = createReminderTickRoutes(messagingController);

export function initMessagingFeature(): void {
  setMessagingEventHandler((event) => reminderEngine.handleEvent(event));
}

export async function renderContractSentInitial(input: {
  contractId: string;
  clientId: string;
  signingUrl: string;
  sentAt: Date;
}): Promise<{
  subject: string;
  text: string;
  html: string;
  cancelDate: string;
} | null> {
  try {
    return await reminderEngine.renderContractSentInitial(input);
  } catch (error) {
    logger.warn(
      {
        service: 'messaging',
        operation: 'render_contract_sent',
        errorClass: error instanceof Error ? error.name : 'Error',
      },
      'Could not render contract_sent_initial; using fallback copy'
    );
    return null;
  }
}
