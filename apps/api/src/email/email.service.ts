import { Injectable, Logger, Optional } from '@nestjs/common';
import {
  emailTemplates,
  renderOverride,
  type EmailContent,
  type EmailTemplateName,
} from './email-templates';
import { PrismaService } from '../prisma/prisma.service';

/**
 * STAKES/S-3 (F1) — transactional email sender.
 *
 * Env-flagged: with EMAIL_ENABLED=true + a provider key it POSTs to the
 * provider; otherwise (dev/CI, the default) it STUBS — logs the recipient +
 * subject and records the send so it can be asserted in tests. Like
 * AuditService, `deliver()` never throws: a mail failure must not fail the
 * money action that triggered it.
 *
 * OPS-GAPS Y2 — DB template overrides. Every typed helper now routes through a
 * KEYED path (`deliverKeyed`): if an EmailTemplateOverride row exists for the
 * key, its Arabic subject/body replaces the code default (wrapped in the shared
 * layout via renderOverride); otherwise the code default is sent BYTE-FOR-BYTE.
 * Overrides are cached for 60s (invalidated by the governed comms ops). The
 * PrismaService injection is @Optional so `new EmailService()` (unit tests, the
 * dev seam) stays override-free — with no client there is no override, so the
 * behaviour is identical to before this change.
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

  /** 60s override cache: key → the operator's stored Arabic copy. */
  private static readonly OVERRIDE_TTL_MS = 60_000;
  private overrideCache: Map<string, { subjectAr: string; bodyAr: string }> | null = null;
  private overrideCacheAt = 0;

  constructor(@Optional() private readonly prisma?: PrismaService) {}

  /** Last N stubbed sends — test/observability hook (bounded, in-memory).
   *  html included: the dev-mailbox seam (STAKES/S-12) lets e2e suites read
   *  verification links out of the stubbed outbox. Stub mode only. */
  readonly sent: Array<{ to: string; subject: string; html: string }> = [];

  /** Drop the cached overrides — the governed comms ops call this in
   *  afterCommit so an edit is visible immediately, not up to 60s later. */
  invalidateTemplateCache(): void {
    this.overrideCache = null;
    this.overrideCacheAt = 0;
  }

  /** All override rows, memoised for 60s. A load failure (or no Prisma client)
   *  yields an empty map — mail then falls back to the code default, never
   *  fails: the same fail-safe posture as deliver(). */
  private async loadOverrides(): Promise<Map<string, { subjectAr: string; bodyAr: string }>> {
    const now = Date.now();
    if (this.overrideCache && now - this.overrideCacheAt < EmailService.OVERRIDE_TTL_MS) {
      return this.overrideCache;
    }
    const map = new Map<string, { subjectAr: string; bodyAr: string }>();
    if (this.prisma) {
      try {
        const rows = await this.prisma.emailTemplateOverride.findMany({
          select: { key: true, subjectAr: true, bodyAr: true },
        });
        for (const r of rows) map.set(r.key, { subjectAr: r.subjectAr, bodyAr: r.bodyAr });
      } catch (e) {
        this.logger.warn(`template override load failed: ${String(e)}`);
      }
    }
    this.overrideCache = map;
    this.overrideCacheAt = now;
    return map;
  }

  /** The effective content for a key: the DB override (if any) rendered into
   *  the shared layout, else the code default UNCHANGED. */
  private async applyOverride(key: string, def: EmailContent): Promise<EmailContent> {
    const override = (await this.loadOverrides()).get(key);
    return override ? renderOverride(override.subjectAr, override.bodyAr) : def;
  }

  /** deliver() through the override plumbing — the single path every typed
   *  helper takes. No override row ⇒ identical to `deliver(to, def)`. */
  private async deliverKeyed(
    key: EmailTemplateName,
    to: string,
    def: EmailContent,
  ): Promise<{ sent: boolean; stubbed: boolean }> {
    return this.deliver(to, await this.applyOverride(key, def));
  }

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

  // ---- typed helpers (build template + keyed deliver via override plumbing) --
  verification(to: string, link: string) { return this.deliverKeyed('verification', to, emailTemplates.verification(link)); }
  passwordReset(to: string, link: string) { return this.deliverKeyed('passwordReset', to, emailTemplates.passwordReset(link)); }
  welcome(to: string, name: string) { return this.deliverKeyed('welcome', to, emailTemplates.welcome(name)); }
  accountActivated(to: string, name: string) { return this.deliverKeyed('accountActivated', to, emailTemplates.accountActivated(name)); }
  duplicateSignup(to: string) { return this.deliverKeyed('duplicateSignup', to, emailTemplates.duplicateSignup()); }
  passwordChanged(to: string) { return this.deliverKeyed('passwordChanged', to, emailTemplates.passwordChanged()); }
  emailChanged(to: string, newEmailMasked: string) { return this.deliverKeyed('emailChanged', to, emailTemplates.emailChanged(newEmailMasked)); }
  creatorNewProject(to: string, d: { creatorName: string; projectTitle: string; link: string }) {
    return this.deliverKeyed('creatorNewProject', to, emailTemplates.creatorNewProject(d));
  }
  emailChangeVerify(to: string, link: string) {
    return this.deliverKeyed('emailChangeVerify', to, emailTemplates.emailChangeVerify(link));
  }
  captureGrace(to: string, d: { projectTitle: string; amountHalalas: number; bnpl: boolean; link: string }) {
    return this.deliverKeyed('captureGrace', to, emailTemplates.captureGrace(d));
  }
  captureFailed(to: string, d: { projectTitle: string; amountHalalas: number }) {
    return this.deliverKeyed('captureFailed', to, emailTemplates.captureFailed(d));
  }
  newDeviceSignin(to: string) {
    return this.deliverKeyed('newDeviceSignin', to, emailTemplates.newDeviceSignin());
  }
  milestoneReleased(to: string, d: { projectTitle: string; milestoneTitle: string; amountHalalas: number }) {
    return this.deliverKeyed('milestoneReleased', to, emailTemplates.milestoneReleased(d));
  }
  // Money-adjacent (pledgeReceipt/projectFunded/projectFailed/refundCompleted/
  // payoutSent) — same keyed pass-through; with no override row the delivered
  // subject/html are byte-identical to before (asserted in the spec).
  pledgeReceipt(to: string, d: { projectTitle: string; amountHalalas: number; tierTitle?: string | null }) {
    return this.deliverKeyed('pledgeReceipt', to, emailTemplates.pledgeReceipt(d));
  }
  projectFunded(to: string, d: { projectTitle: string; amountHalalas: number }) {
    return this.deliverKeyed('projectFunded', to, emailTemplates.projectFunded(d));
  }
  projectFailed(to: string, d: { projectTitle: string; amountHalalas: number }) {
    return this.deliverKeyed('projectFailed', to, emailTemplates.projectFailed(d));
  }
  refundCompleted(to: string, d: { projectTitle: string; amountHalalas: number }) {
    return this.deliverKeyed('refundCompleted', to, emailTemplates.refundCompleted(d));
  }
  payoutSent(to: string, d: { projectTitle: string; amountHalalas: number }) {
    return this.deliverKeyed('payoutSent', to, emailTemplates.payoutSent(d));
  }
  projectReviewed(to: string, d: { projectTitle: string; approved: boolean; feedback?: string | null }) {
    return this.deliverKeyed('projectReviewed', to, emailTemplates.projectReviewed(d));
  }
  // Batch OPS (registry completion) — account lifecycle + support desk.
  accountSuspended(to: string, d: { banned: boolean; reasonAr?: string | null }) {
    return this.deliverKeyed('accountSuspended', to, emailTemplates.accountSuspended(d));
  }
  accountReactivated(to: string, name: string) {
    return this.deliverKeyed('accountReactivated', to, emailTemplates.accountReactivated(name));
  }
  supportReply(to: string, d: { name: string; topic: string; replyAr: string }) {
    return this.deliverKeyed('supportReply', to, emailTemplates.supportReply(d));
  }
  // OPS-GAPS R2 — RFQ award.
  rfqAwarded(to: string, d: { projectTitle: string }) {
    return this.deliverKeyed('rfqAwarded', to, emailTemplates.rfqAwarded(d));
  }
  // OPS-GAPS R1 — appeals lifecycle.
  appealReceived(to: string, d: { kindAr: string }) {
    return this.deliverKeyed('appealReceived', to, emailTemplates.appealReceived(d));
  }
  appealDecided(to: string, d: { kindAr: string; outcomeAr: string; reasonAr: string }) {
    return this.deliverKeyed('appealDecided', to, emailTemplates.appealDecided(d));
  }
}
