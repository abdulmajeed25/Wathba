import type { Metadata } from 'next';

import { WathbaSettings } from '@/components/ventures/wathba/wathba-settings';
import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';
import { getMe } from '@/lib/api/wathba';

export const metadata: Metadata = { title: 'الإعدادات · وثبة' };

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const [me, sp] = await Promise.all([getMe(), searchParams]);
  return (
    <WathbaShell>
      <WathbaSettings me={me} okFlag={sp.ok ?? null} errFlag={sp.err ?? null} />
    </WathbaShell>
  );
}
