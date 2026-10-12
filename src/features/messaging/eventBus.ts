import { logger } from '../../common/utils/logger';
import { MessagingEvent } from './domain/types';

type Handler = (event: MessagingEvent) => Promise<unknown>;

let handler: Handler | null = null;

export function setMessagingEventHandler(next: Handler | null): void {
  handler = next;
}

export function fireMessagingEvent(event: MessagingEvent): void {
  if (!handler) return;
  void handler(event).catch((error) => {
    logger.warn(
      {
        service: 'messaging',
        operation: 'event',
        eventType: event.type,
        errorClass: error instanceof Error ? error.name : 'Error',
      },
      'Messaging event handler failed'
    );
  });
}
