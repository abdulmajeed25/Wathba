import { emailTemplates } from './email-templates';

/**
 * Batch CONTENT Part 2 — the account-suspension email must offer the appeal
 * ONLY where an appeal actually exists.
 *
 * assertOwnership in appeals.service.ts refuses an ACCOUNT_BAN appeal from any
 * account whose suspendedKind is not BANNED. A temporary suspension is not a
 * ban, so an appeal button in that email would send the reader to a form that
 * rejects them by name — the platform documenting behaviour it does not have.
 * These two cases are one boolean apart in the template, which is exactly the
 * kind of difference a reviewer skims past.
 */
describe('emailTemplates.accountSuspended', () => {
  it('offers the formal appeal to a BANNED account', () => {
    const { html } = emailTemplates.accountSuspended({ banned: true, reasonAr: 'مخالفة جسيمة' });
    expect(html).toContain('{{APP_URL}}/appeal');
    expect(html).toContain('تقديم تظلّم');
    expect(html).toContain('مخالفة جسيمة');
  });

  it('does NOT offer the appeal to a temporarily suspended account', () => {
    const { html } = emailTemplates.accountSuspended({ banned: false, reasonAr: null });
    expect(html).not.toContain('{{APP_URL}}/appeal');
    expect(html).not.toContain('تقديم تظلّم');
    // It still has to give them a way out — support, not a dead end.
    expect(html).toContain('support@wathba.sa');
  });

  it('points both cases at the enforcement policy', () => {
    for (const banned of [true, false]) {
      const { html } = emailTemplates.accountSuspended({ banned, reasonAr: null });
      expect(html).toContain('{{APP_URL}}/rules/enforcement');
    }
  });
});
