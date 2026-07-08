import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { WathbaPublicProfile } from '@/components/ventures/wathba/wathba-public-profile';
import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';
import { getMe, getPublicProfile } from '@/lib/api/wathba';

/**
 * STAKES/C1 — the public user profile: /u/[handle] (UUID fallback for
 * handle-less legacy rows). Public + anonymous; the follow button and the
 * "edit my profile" affordance light up from the viewer's session.
 */

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const profile = await getPublicProfile(handle);
  if (!profile) return { title: 'الملف غير موجود · وثبة' };
  const title = `${profile.name} (@${profile.handle ?? 'مستخدم'}) · وثبة`;
  const description =
    profile.bioAr ??
    `ملف ${profile.name} على وثبة — ${profile.stats.createdCount} مشاريع أنشأها و${profile.stats.backedCount} مشاريع دعمها.`;
  return { title, description, openGraph: { title, description, type: 'profile' } };
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const [profile, me] = await Promise.all([getPublicProfile(handle), getMe()]);
  if (!profile) notFound();

  return (
    <WathbaShell>
      <WathbaPublicProfile
        profile={profile}
        isAuthenticated={Boolean(me)}
        isSelf={me?.id === profile.id}
      />
    </WathbaShell>
  );
}
