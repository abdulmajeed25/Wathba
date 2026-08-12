import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { WathbaProfile } from '@/components/ventures/wathba/wathba-profile';
import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';
import { getMe, listMyBackings, listMySaved } from '@/lib/api/wathba';

export const metadata: Metadata = { title: 'المشاريع المحفوظة · وثبة' };
export const dynamic = 'force-dynamic';

/**
 * Batch ACCOUNT — saved projects get a ROUTE.
 *
 * They previously existed only as `?only=saved` on the discover surface, so
 * "my bookmarks" was a filter state of a search page: not linkable as a place,
 * and impossible to land on from a menu without inheriting whatever other
 * filters the reader had left applied.
 */
export default async function SavedPage() {
  const me = await getMe();
  if (!me) redirect('/sign-in?next=%2Fsaved');
  const [backings, saved] = await Promise.all([listMyBackings(), listMySaved()]);
  return (
    <WathbaShell>
      <WathbaProfile backings={backings} saved={saved} me={me} initialTab="saved" />
    </WathbaShell>
  );
}
