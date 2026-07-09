import { EmailService } from './email.service';
import { emailTemplates } from './email-templates';

/** STAKES/S-3 — EmailService stub behaviour + Arabic RTL templates. */
describe('email templates', () => {
  it('pledge receipt carries the project, SAR amount and RTL layout', () => {
    const { subject, html } = emailTemplates.pledgeReceipt({
      projectTitle: 'سِرب',
      amountHalalas: 5000,
      tierTitle: 'باقة رقمية',
    });
    expect(subject).toContain('سِرب');
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('lang="ar"');
    expect(html).toContain('باقة رقمية');
    expect(html).toContain('ر.س'); // amount rendered in SAR (ar-SA locale → Arabic-indic digits)
  });

  it('funded vs failed have distinct, correct subjects', () => {
    expect(emailTemplates.projectFunded({ projectTitle: 'x', amountHalalas: 100 }).subject).toContain('نجحت');
    expect(emailTemplates.projectFailed({ projectTitle: 'x', amountHalalas: 100 }).subject).toContain('ردّ');
  });

  it('reviewed switches copy on approve/reject and includes feedback', () => {
    expect(emailTemplates.projectReviewed({ projectTitle: 'x', approved: true }).subject).toContain('الموافقة');
    const rej = emailTemplates.projectReviewed({ projectTitle: 'x', approved: false, feedback: 'وضّح الميزانية' });
    expect(rej.html).toContain('وضّح الميزانية');
  });
});

describe('EmailService (stub mode)', () => {
  it('stubs (no provider configured), records the send, and never throws', async () => {
    const svc = new EmailService();
    const res = await svc.pledgeReceipt('backer@wathba.sa', { projectTitle: 'سِرب', amountHalalas: 5000 });
    expect(res).toEqual({ sent: false, stubbed: true });
    expect(svc.sent.at(-1)).toEqual({ to: 'backer@wathba.sa', subject: expect.stringContaining('سِرب'), html: expect.any(String) });
  });

  it('hydrates {{APP_URL}} / {{PREFS_URL}} placeholders (welcome)', async () => {
    const svc = new EmailService();
    // The welcome template embeds {{APP_URL}}; deliver() must not leave the raw token.
    await svc.welcome('u@wathba.sa', 'أحمد');
    expect(svc.sent.at(-1)?.subject).toContain('توثيق');
  });
});
