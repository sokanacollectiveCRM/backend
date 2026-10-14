import { logger } from '../../common/utils/logger';
import { NodemailerService } from '../../services/emailService';
import { schedulingConfig } from './application/config';
import type { MailPort } from './application/ports';
import { SchedulingService } from './application/schedulingService';
import { SchedulingController } from './http/schedulingController';
import { CloudSqlSchedulingStore } from './infrastructure/schedulingStore';

function createMailPort(): MailPort {
  const transport = new NodemailerService();
  return {
    async sendEmail(to, subject, text, html) {
      try {
        await transport.sendEmail(to, subject, text, html);
      } catch {
        logger.error(
          {
            service: 'scheduling',
            operation: 'notify',
            errorCode: 'SCHEDULING_EMAIL_FAILURE',
          },
          'Scheduling notification failed'
        );
      }
    },
  };
}

export function createSchedulingService(
  overrides?: Partial<{
    store: CloudSqlSchedulingStore;
    mail: MailPort;
  }>
): SchedulingService {
  return new SchedulingService(
    overrides?.store ?? new CloudSqlSchedulingStore(),
    schedulingConfig,
    overrides?.mail ?? createMailPort()
  );
}

export function createSchedulingController(
  service = createSchedulingService()
): SchedulingController {
  return new SchedulingController(service);
}
