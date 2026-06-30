import { redirect } from 'next/navigation';

import { DashboardCreatorProfileEditor } from '@/components/ventures/wathba/dashboard/wathba-dashboard-creator-profile-editor';
import { getCreatorProfile, getMe } from '@/lib/api/wathba';

/**
 * "ملفي كمبدع" — the dashboard section where the creator edits their public
 * profile. The profile is global (one per User, not per Project), so this
 * page hangs off the per-project dashboard for nav cohesion while operating
 * on the user-scoped resource.
 *
 * Ownership is already enforced by the parent layout (`layout.tsx`) which
 * verifies `me.id === project.createdBy`. We still re-read `me` here to know
 * which creator profile to fetch and PATCH against.
 *
 * If the user has no creator profile yet (the backend is being built in
 * parallel), the editor renders with an empty draft and surfaces the API-
 * not-ready banner on save attempts.
 */
export default async function CreatorProfilePage(): Promise<React.ReactElement> {
  const me = await getMe();
  if (!me) redirect('/sign-in');

  const profile = await getCreatorProfile(me.id);
  return <DashboardCreatorProfileEditor userId={me.id} initialProfile={profile} />;
}
