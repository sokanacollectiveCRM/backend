import { NodemailerService } from '../../../services/emailService';
import { CONTACT_EMAIL } from '../domain/catalog';
import { displayFirstName } from '../domain/names';
import { postponementReasonLabel } from '../domain/postponement';
import type { PostponementReason } from '../domain/postponement';
import { formatLongNewYorkDate } from '../domain/time';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export class NotificationEmail {
  constructor(private readonly mail = new NodemailerService()) {}

  async sendContractSignBy(input: {
    to: string;
    clientName: string;
    contractTitle: string;
    signingUrl: string;
    expiresAt: Date;
    cancelBy: Date;
  }): Promise<void> {
    const first = displayFirstName(input.clientName);
    const cancel = formatLongNewYorkDate(input.cancelBy);
    const text = [
      `Hello ${first},`,
      '',
      `Please review and sign ${input.contractTitle}:`,
      input.signingUrl,
      '',
      `Please sign by ${cancel}. If the contract is not signed by that date, it will be canceled.`,
      '',
      `This secure link expires at ${input.expiresAt.toISOString()}.`,
      `Questions: ${CONTACT_EMAIL}`,
    ].join('\n');
    await this.mail.sendEmail(
      input.to,
      `Please review and sign: ${input.contractTitle}`,
      text,
      `<p>Hello ${escapeHtml(first)},</p><p>Please review and sign <strong>${escapeHtml(input.contractTitle)}</strong>.</p><p><a href="${escapeHtml(input.signingUrl)}">Review and sign contract</a></p><p>Please sign by ${escapeHtml(cancel)}. If the contract is not signed by that date, it will be canceled.</p><p>Questions: ${CONTACT_EMAIL}</p>`
    );
  }

  async sendSigningSoftReminder(input: {
    to: string;
    clientFirstName: string;
    signingUrl: string;
    cancelBy: Date;
  }): Promise<void> {
    const first = displayFirstName(input.clientFirstName);
    const cancel = formatLongNewYorkDate(input.cancelBy);
    const text = `Hello ${first},\n\nAny questions? Your doula is held for you until ${cancel}.\n\nYou can sign here:\n${input.signingUrl}\n\nQuestions: ${CONTACT_EMAIL}`;
    await this.mail.sendEmail(
      input.to,
      'Any questions about your contract?',
      text,
      `<p>Hello ${escapeHtml(first)},</p><p>Any questions? Your doula is held for you until ${escapeHtml(cancel)}.</p><p><a href="${escapeHtml(input.signingUrl)}">Sign your contract</a></p><p>Questions: ${CONTACT_EMAIL}</p>`
    );
  }

  async sendDoulaUnsignedNudge(input: {
    to: string;
    clientFirstName: string;
  }): Promise<void> {
    const first = displayFirstName(input.clientFirstName);
    const text = `${first} hasn't signed yet, feel free to check in.\n\n${CONTACT_EMAIL}`;
    await this.mail.sendEmail(
      input.to,
      `${first} hasn't signed yet`,
      text,
      `<p>${escapeHtml(first)} hasn't signed yet, feel free to check in.</p>`
    );
  }

  async sendContractCanceled(input: {
    to: string;
    clientFirstName: string;
  }): Promise<void> {
    const first = displayFirstName(input.clientFirstName);
    const text = `Hello ${first},\n\nYour contract was canceled. Please reach out to ${CONTACT_EMAIL} if you would like to continue.`;
    await this.mail.sendEmail(
      input.to,
      'Your contract was canceled',
      text,
      `<p>Hello ${escapeHtml(first)},</p><p>Your contract was canceled. Please reach out to ${CONTACT_EMAIL} if you would like to continue.</p>`
    );
  }

  async sendPostponementToDoula(input: {
    to: string;
    clientFirstName: string;
    reason: PostponementReason;
    restartOn: string;
  }): Promise<void> {
    const first = displayFirstName(input.clientFirstName);
    const reason = postponementReasonLabel(input.reason);
    const text = `${first}'s services are postponed until ${input.restartOn} (${reason}). The day-7 contract cancel is paused.\n\n${CONTACT_EMAIL}`;
    await this.mail.sendEmail(
      input.to,
      `Services postponed for ${first}`,
      text,
      `<p>${escapeHtml(first)}'s services are postponed until ${escapeHtml(input.restartOn)} (${escapeHtml(reason)}). The day-7 contract cancel is paused.</p>`
    );
  }

  async sendBirthOutcomeReminder(input: {
    to: string;
    clientFirstName: string;
  }): Promise<void> {
    const first = displayFirstName(input.clientFirstName);
    const text = `Please record birth outcomes for ${first}. Payout cannot be submitted until that is done.\n\n${CONTACT_EMAIL}`;
    await this.mail.sendEmail(
      input.to,
      `Birth outcomes needed for ${first}`,
      text,
      `<p>Please record birth outcomes for ${escapeHtml(first)}. Payout cannot be submitted until that is done.</p><p>${CONTACT_EMAIL}</p>`
    );
  }

  async sendOverdueNote(input: {
    to: string;
    clientFirstName: string;
    crmUrl: string | null;
  }): Promise<void> {
    const first = displayFirstName(input.clientFirstName);
    const link = input.crmUrl ? `\n\n${input.crmUrl}` : '';
    const text = `A note has not been added for ${first} in 7 days.${link}\n\n${CONTACT_EMAIL}`;
    await this.mail.sendEmail(
      input.to,
      `Note overdue for ${first}`,
      text,
      `<p>A note has not been added for ${escapeHtml(first)} in 7 days.</p>${input.crmUrl ? `<p><a href="${escapeHtml(input.crmUrl)}">Open the client</a></p>` : ''}<p>${CONTACT_EMAIL}</p>`
    );
  }

  async sendAdminNoteToDoula(input: {
    to: string;
    clientFirstName: string;
    crmUrl: string | null;
  }): Promise<void> {
    const first = displayFirstName(input.clientFirstName);
    const text = `An admin added a note for ${first}. Open the client in Sokana360.${input.crmUrl ? `\n${input.crmUrl}` : ''}\n\n${CONTACT_EMAIL}`;
    await this.mail.sendEmail(
      input.to,
      `New note for ${first}`,
      text,
      `<p>An admin added a note for ${escapeHtml(first)}. Open the client in Sokana360.</p>`
    );
  }

  async sendRuleSample(input: { to: string; ruleId: string }): Promise<void> {
    const text = `This is a Sokana360 notification sample for ${input.ruleId}. No client details are included.\n\n${CONTACT_EMAIL}`;
    await this.mail.sendEmail(
      input.to,
      `Notification sample: ${input.ruleId}`,
      text,
      `<p>This is a Sokana360 notification sample for ${escapeHtml(input.ruleId)}. No client details are included.</p><p>${CONTACT_EMAIL}</p>`
    );
  }
}
