import type { Metadata } from 'next';

import { WathbaNotifications } from '@/components/ventures/wathba/wathba-notifications';
import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';
import { listMyNotifications } from '@/lib/api/wathba';

export const metadata: Metadata = { title: 'الإشعارات · وثبة' };

// No ISR — every load is fresh because new notifications arrive constantly.
export const dynamic = 'force-dynamic';

export default async function NotificationsPage(): Promise<React.ReactElement> {
  // Middleware bounces anon callers to /sign-in, so by the time we get here
  // there's a cookie. listMyNotifications() picks it up from the request.
  const page = await listMyNotifications({ take: 50 });
  return (
    <WathbaShell>
      <WathbaNotifications
        items={page?.items ?? []}
        unreadCount={page?.unreadCount ?? 0}
      />
    </WathbaShell>
  );
}
