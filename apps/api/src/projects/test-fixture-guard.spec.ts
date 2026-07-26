/**
 * Batch POLISH Unit 6 — the fixture-title predicate.
 *
 * The real predicate lives in a Postgres trigger (migration 0058) so no query
 * can forget it. This spec pins the RULE the trigger implements, in one place,
 * with the titles that actually appeared on the public site and the real Arabic
 * titles that must never be caught.
 *
 * Both halves are required on purpose. «مشروع الاختبار» is a legitimate name for
 * a real project, and a real campaign may well have a number in its title;
 * neither alone is evidence. A fixture token AND a 10-digit-or-longer run — a
 * Date.now() timestamp — together are, because no human types that into a title.
 */

const TOKEN = /(E2E|إي٢إي|PAY|SMOKE|TEST|SEED|FIXTURE)/;
const TIMESTAMP = /[0-9]{10,}/;

/** Mirror of wathba_project_mark_test_fixture() in migration 0058. */
function isTestFixture(titleAr: string): boolean {
  return TOKEN.test(titleAr) && TIMESTAMP.test(titleAr);
}

describe('POLISH U6 — test-fixture title predicate', () => {
  // Titles taken verbatim from the polluted public listing.
  it.each([
    'مشروع E2E 1784976525442',
    'مشروع إي٢إي 1784982599652',
    'حملة PAY 1785073243239',
    'SMOKE 1785073243239',
    'SEED PROJECT 1784976525442',
  ])('flags the fixture %s', (title) => {
    expect(isTestFixture(title)).toBe(true);
  });

  // Real seeded demo projects, and the traps the predicate must not fall into.
  it.each([
    'سِرب — درون التصوير الذكي',
    'خط — عائلة خطوط عربية حديثة',
    'سدو — لعبة لوحية تراثية',
    'رحيق — رواية سعودية مصوّرة',
    // A token with no timestamp: a genuine project may be about testing.
    'مشروع الاختبار الطبي',
    'TEST DRIVE — سيارة كهربائية',
    // A timestamp-length number with no token: e.g. a phone or licence number.
    'مشروع 1234567890123 للطاقة',
    // PAY as part of a longer Arabic/Latin word, still no timestamp.
    'PAYMENTS — بوابة دفع سعودية',
  ])('leaves the real title %s alone', (title) => {
    expect(isTestFixture(title)).toBe(false);
  });

  it('needs BOTH halves — neither is sufficient alone', () => {
    expect(isTestFixture('E2E مشروع')).toBe(false);
    expect(isTestFixture('مشروع 1784976525442')).toBe(false);
    expect(isTestFixture('E2E مشروع 1784976525442')).toBe(true);
  });
});
