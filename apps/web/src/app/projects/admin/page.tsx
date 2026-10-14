import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/guard';

export const metadata: Metadata = { title: 'الإدارة · وثبة' };
export const dynamic = 'force-dynamic';

/** Keep saved links working while all operators use the governed Ops Center. */
export default async function AdminPage(): Promise<never> {
  await requireRole('ADMIN');
  redirect('/ops');
}
