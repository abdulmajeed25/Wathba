import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';
import { BackerChangeResponses } from '@/components/ventures/wathba/backer-change-responses';
import { notFound } from 'next/navigation';
export const metadata = { title: 'تغييرات تعهدي · وثبة' };
export default async function PledgeChangesPage({ params }: { params: Promise<{ pledgeId: string }> }) {
  const { pledgeId } = await params;
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(pledgeId)) notFound();
  return <WathbaShell><BackerChangeResponses pledgeId={pledgeId} /></WathbaShell>;
}
