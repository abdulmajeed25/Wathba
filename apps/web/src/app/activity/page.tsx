import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { WathbaProfile } from '@/components/ventures/wathba/wathba-profile';
import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';
import { getMe, listMyBackings, listMySaved } from '@/lib/api/wathba';

export const metadata: Metadata = { title: 'النشاط · وثبة' };
export const dynamic = 'force-dynamic';

/**
 * Batch ACCOUNT / U5 — this IS the old /projects/me/profile, renamed.
 *
 * The audit's verdict was DISTINCT, not DUPLICATE: that route never rendered a
 * profile. It renders the signed-in reader's backings and saved projects — an
 * activity view carrying the label «الملف الشخصي», one row below «ملفي العام»
 * which pointed at the real profile. Its menu icon was already a clock.
 *
 * So it is renamed rather than deleted, and the old path 308s here.
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
