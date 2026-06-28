import type { Metadata } from 'next';

import { WathbaNotifications } from '@/components/ventures/wathba/wathba-notifications';
import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';

export const metadata: Metadata = { title: 'الإشعارات · وثبة' };

export default function NotificationsPage() {
  return (
    <WathbaShell>
      <WathbaNotifications />
    </WathbaShell>
  );
}
