import { notFound } from 'next/navigation';

import { adaptApiProjectDetail, adaptApiVenture, wathbaProjects } from '@/components/ventures/wathba/wathba-data';
import { WathbaCampaignHeader } from '@/components/ventures/wathba/wathba-campaign-header';
import { WathbaCampaignTabBar } from '@/components/ventures/wathba/wathba-campaign-tabbar';
import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';
import { getProjectDetail, listVentures } from '@/lib/api/wathba';

/**
 * TABS — the persistent campaign shell (Kickstarter pattern): the header
 * (cover/video, title, creator card, funding progress + 80%-gate bar, days
 * left, backers, ادعم المشروع, ذكّرني, share) and the TAB BAR render here
 * ONCE; tab navigations only swap the content area below (this layout does
 * not re-render between child routes).
 *
 * Shared header data is fetched here; child routes fetch only their own
 * slice. The same-URL fetches dedupe within a request and share the ISR
 * data cache across routes.
 */
export default async function CampaignLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const { id } = await params;
  const [live, detail] = await Promise.all([
    listVentures(),
    // CC-14 — surfaces the PAUSED banner.
    getProjectDetail(id).catch(() => null),
  ]);
  const apiRow = live?.find((v) => v.slug.toLowerCase() === id.toLowerCase());
  // POLISH — fall back to the API DETAIL, not to a demo fixture. adaptApiVenture
  // can only match a project that exists in the hardcoded demo table, so for
  // every real project it returned null and resolveCampaign silently rendered
  // wathbaProjects[0]. The detail payload is already fetched above; use it.
  const liveProject =
    (apiRow ? adaptApiVenture(apiRow) : null) ?? (detail ? adaptApiProjectDetail(detail) : null);

  /**
   * HOME-REVIEW O3 — a campaign id that resolves to NOTHING is a 404, not a
   * page.
   *
   * This route answered 200 for any string at all, rendering an empty campaign
   * shell titled «مشروع {id} · وثبة» — a soft-404. It surfaced while deleting
   * the orphan routes: with /projects/explore and /projects/compare removed,
   * [id] caught them and served «مشروع explore» at 200, so the files were gone
   * and the URLs were not. Deleting a route that a dynamic segment silently
   * re-serves is not deleting it.
   *
   * The fixture table is part of the test, deliberately: the demo ids (p1…p8)
   * still resolve exactly as before, so this narrows the route to "no API row,
   * no API detail, AND no fixture" — the case where there is genuinely nothing
   * to show — instead of quietly retiring the demo data along with it.
   */
  const known =
    Boolean(apiRow) || Boolean(detail) || wathbaProjects.some((p) => p.id === id);
  if (!known) notFound();

  const paused = detail?.status === 'PAUSED';

  return (
    <WathbaShell>
      {paused && (
        <div
          dir="rtl"
          style={{
            maxWidth: 1120, margin: '0 auto 4px', padding: '10px 18px', borderRadius: 12,
            background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.4)',
            color: '#a96400', fontSize: 13.5, fontWeight: 700, textAlign: 'center',
          }}
        >
          ⏸ هذه الحملة موقوفة مؤقتاً — الدعم الجديد متوقف حالياً.
        </div>
      )}
      <WathbaCampaignHeader id={id} project={liveProject ?? undefined} />
      <WathbaCampaignTabBar id={id} project={liveProject ?? undefined} />
      <div style={{ maxWidth: 1320, margin: '0 auto', padding: '36px 26px 80px' }}>
        {children}
      </div>
    </WathbaShell>
  );
}
