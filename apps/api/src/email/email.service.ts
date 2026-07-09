import { Injectable, Logger } from '@nestjs/common';
import { emailTemplates, type EmailContent } from './email-templates';

/**
 * STAKES/S-3 (F1) — transactional email sender.
 *
 * Env-flagged: with EMAIL_ENABLED=true + a provider key it POSTs to the
 * provider; otherwise (dev/CI, the default) it STUBS — logs the recipient +
 * subject and records the send so it can be asserted in tests. Like
 * AuditService, `deliver()` never throws: a mail failure must not fail the
 * money action that triggered it.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly enabled = process.env.EMAIL_ENABLED === 'true';
  private readonly providerKey = process.env.EMAIL_PROVIDER_KEY ?? '';
  private readonly providerUrl = process.env.EMAIL_PROVIDER_URL ?? '';
  private readonly fromName = process.env.EMAIL_FROM_NAME ?? 'وثبة';
  private readonly fromAddr = process.env.EMAIL_FROM ?? 'no-reply@wathba.sa';
  private readonly appUrl = process.env.APP_PUBLIC_URL ?? 'https://wathba.sa';

  /** Last N stubbed sends — test/observability hook (bounded, in-memory).
   *  html included: the dev-mailbox seam (STAKES/S-12) lets e2e suites read
   *  verification links out of the stubbed outbox. Stub mode only. */
  readonly sent: Array<{ to: string; subject: string; html: string }> = [];

  private hydrate(html: string): string {
    return html
      .replaceAll('{{APP_URL}}', this.appUrl)
      .replaceAll('{{PREFS_URL}}', `${this.appUrl}/projects/settings`);
  }

  async deliver(to: string, content: EmailContent): Promise<{ sent: boolean; stubbed: boolean }> {
    const html = this.hydrate(content.html);
    if (!this.enabled || !this.providerKey || !this.providerUrl) {
      this.logger.log(`[EMAIL stub] → ${to} · "${content.subject}"`);
      this.sent.push({ to, subject: content.subject, html });
      if (this.sent.length > 100) this.sent.shift();
      return { sent: false, stubbed: true };
    }
    try {
      const res = await fetch(this.providerUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.providerKey}` },
        body: JSON.stringify({ from: `${this.fromName} <${this.fromAddr}>`, to, subject: content.subject, html }),
      });
      if (!res.ok) {
        this.logger.error(`email send failed (${res.status}) → ${to} "${content.subject}"`);
        return { sent: false, stubbed: false };
      }
      return { sent: true, stubbed: false };
    } catch (e) {
      this.logger.error(`email send threw → ${to} "${content.subject}"`, e as Error);
      return { sent: false, stubbed: false };
    }
  }

  // ---- typed helpers (build template + deliver) ----------------------------
  verification(to: string, link: string) { return this.deliver(to, emailTemplates.verification(link)); }
  passwordReset(to: string, link: string) { return this.deliver(to, emailTemplates.passwordReset(link)); }
  welcome(to: string, name: string) { return this.deliver(to, emailTemplates.welcome(name)); }
  accountActivated(to: string, name: string) { return this.deliver(to, emailTemplates.accountActivated(name)); }
  duplicateSignup(to: string) { return this.deliver(to, emailTemplates.duplicateSignup()); }
  passwordChanged(to: string) { return this.deliver(to, emailTemplates.passwordChanged()); }
  emailChanged(to: string, newEmailMasked: string) { return this.deliver(to, emailTemplates.emailChanged(newEmailMasked)); }
  creatorNewProject(to: string, d: { creatorName: string; projectTitle: string; link: string }) {
    return this.deliver(to, emailTemplates.creatorNewProject(d));
  }
  emailChangeVerify(to: string, link: string) {
    return this.deliver(to, emailTemplates.emailChangeVerify(link));
  }
  captureGrace(to: string, d: { projectTitle: string; amountHalalas: number; bnpl: boolean; link: string }) {
    return this.deliver(to, emailTemplates.captureGrace(d));
  }
  captureFailed(to: string, d: { projectTitle: string; amountHalalas: number }) {
    return this.deliver(to, emailTemplates.captureFailed(d));
  }
  newDeviceSignin(to: string) {
    return this.deliver(to, emailTemplates.newDeviceSignin());
  }
  milestoneReleased(to: string, d: { projectTitle: string; milestoneTitle: string; amountHalalas: number }) {
    return this.deliver(to, emailTemplates.milestoneReleased(d));
  }
  pledgeReceipt(to: string, d: { projectTitle: string; amountHalalas: number; tierTitle?: string | null }) {
    return this.deliver(to, emailTemplates.pledgeReceipt(d));
  }
  projectFunded(to: string, d: { projectTitle: string; amountHalalas: number }) {
    return this.deliver(to, emailTemplates.projectFunded(d));
  }
  projectFailed(to: string, d: { projectTitle: string; amountHalalas: number }) {
    return this.deliver(to, emailTemplates.projectFailed(d));
  }
  refundCompleted(to: string, d: { projectTitle: string; amountHalalas: number }) {
    return this.deliver(to, emailTemplates.refundCompleted(d));
  }
  payoutSent(to: string, d: { projectTitle: string; amountHalalas: number }) {
    return this.deliver(to, emailTemplates.payoutSent(d));
  }
  projectReviewed(to: string, d: { projectTitle: string; approved: boolean; feedback?: string | null }) {
    return this.deliver(to, emailTemplates.projectReviewed(d));
  }
}
