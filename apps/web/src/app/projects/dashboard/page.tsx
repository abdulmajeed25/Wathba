import type { Metadata } from 'next';
import { WathbaDashboard } from '@/components/ventures/wathba/wathba-dashboard';
import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';
import { listMyProjects } from '@/lib/api/wathba';
import { requireUser } from '@/lib/auth/guard';

export const metadata: Metadata = { title: 'مشاريعي وطلباتي · وثبة' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  await requireUser();
  const myProjects = await listMyProjects();
  return <WathbaShell><WathbaDashboard myProjects={myProjects} /></WathbaShell>;
}
