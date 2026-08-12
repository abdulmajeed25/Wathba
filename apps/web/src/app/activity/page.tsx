import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { WathbaProfile } from '@/components/ventures/wathba/wathba-profile';
import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';
import { getMe, listMyBackings, listMySaved } from '@/lib/api/wathba';

export const metadata: Metadata = { title: 'النشاط · وثبة' };
export const dynamic = 'force-dynamic';

/**
 * Batch ACCOUNT §2.1 — this IS the old /projects/me/profile, renamed.
 *
 * The audit's verdict was DISTINCT, not DUPLICATE: that route never rendered a
 * profile. It renders the signed-in reader's backings and saved projects — an
 * activity view wearing the label «الملف الشخصي» beside a second row that also
 * said profile and went somewhere else. Its menu icon was already a clock.
 *
 * So it is renamed rather than deleted (the batch's own contingency), and
 * /projects/me/profile now redirects here permanently.
 */
export default async function ActivityPage() {
  const me = await getMe();
  if (!me) redirect('/sign-in?next=%2Factivity');
  const [backings, saved] = await Promise.all([listMyBackings(), listMySaved()]);
  return (
    <WathbaShell>
      <WathbaProfile backings={backings} saved={saved} me={me} />
    </WathbaShell>
  );
}
