import type { Metadata } from 'next';

import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';
import { WathbaSpotlight } from '@/components/ventures/wathba/wathba-spotlight';
import { getSpotlightPayload } from '@/lib/api/wathba';

/**
 * Batch POLISH Unit 1/2 — «تحت الأضواء».
 *
 * Server-rendered so the curated content is in the first paint (and crawlable);
 * the payload is ISR-cached for 60s and tagged `wathba-home`, so an Ops Center
 * staff-pick toggle shows up here immediately.
 */

export const metadata: Metadata = {
  title: 'تحت الأضواء | وثبة',
  description:
    'أضخم المشاريع وأنجحها، مختارات فريق وثبة، وأكثر الأعمال إبداعاً على منصة وثبة — مشاريع سعودية يقودها أصحابها.',
  alternates: { canonical: '/spotlight' },
  openGraph: {
    title: 'تحت الأضواء | وثبة',
    description: 'أضخم المشاريع وأنجحها، ومختارات فريق وثبة، وأكثر الأعمال إبداعاً.',
    url: '/spotlight',
    type: 'website',
    locale: 'ar_SA',
  },
};

export default async function SpotlightPage() {
  const data = await getSpotlightPayload();
  return (
    <WathbaShell>
      <WathbaSpotlight data={data} />
    </WathbaShell>
  );
}
