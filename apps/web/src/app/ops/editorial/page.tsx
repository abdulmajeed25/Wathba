import Link from 'next/link';

import { API_BASE, requireAdmin, requireOpsSession } from '../_lib/guard';
import {
  EditorialManager,
  type EditorialCard,
  type HomepageSection,
} from './_components/editorial-manager';

/**
 * OPS Part 5 (CONTENT) — «المحتوى التحريري»: editorial cards + homepage
 * sections.
 *
 * CLOSEOUT C3 — reads now come from the OPS read layer
 * (`/v1/ops/editorial/cards`, `/v1/ops/editorial/sections`, ops token +
 * `content.editorial`) instead of the legacy `/v1/admin/*` JWT seams. Those
 * seams were the split-brain the OPS-360 census flagged: two authorisation
 * paths into the same data, only one of which is the ops token the rest of the
 * console uses. They still list EVERYTHING incl. inactive rows with their ids.
 * Every mutation was already a governed CONTENT-tier operation
 * (content.editorial.*, content.homepage-section.*) fired through <OpRunner>.
 */
export default async function OpsEditorialPage() {
  await requireAdmin();
  const { opsToken } = await requireOpsSession();

  const auth = { headers: { 'x-ops-token': opsToken }, cache: 'no-store' as const };

  let cards: EditorialCard[] = [];
  let cardsAvailable = false;
  let sections: HomepageSection[] = [];
  let refused = false;

  try {
    const [cardsRes, sectionsRes] = await Promise.all([
      fetch(`${API_BASE}/v1/ops/editorial/cards`, auth),
      fetch(`${API_BASE}/v1/ops/editorial/sections`, auth),
    ]);
    if (cardsRes.status === 403 || sectionsRes.status === 403) refused = true;
    if (cardsRes.ok) {
      cards = ((await cardsRes.json()) as { items: EditorialCard[] }).items;
      cardsAvailable = true;
    }
    if (sectionsRes.ok) {
      sections = ((await sectionsRes.json()) as { items: HomepageSection[] }).items;
    }
  } catch {
    /* API unreachable — the compose surface still works below */
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">المحتوى التحريري</h1>
          <p className="mt-1 text-sm text-[#8b949e]">
            بطاقات الرئيسية وأقسامها — قصص، حوارات، أدلة ثقة. كل تغيير عملية محكومة ومسجَّلة في
            التدقيق.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/ops/audit?q=content.editorial" className="text-sm text-[#58a6ff] hover:underline">
            سجل التغييرات
          </Link>
          <Link href="/ops" className="text-sm text-[#58a6ff] hover:underline">
            ← العودة للمركز
          </Link>
        </div>
      </div>

      {refused ? (
        <p className="rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          تفتقد صلاحية قراءة المحتوى التحريري — تحتاج دور ADMIN. يمكنك تأليف بطاقة جديدة أدناه.
        </p>
      ) : null}

      <EditorialManager cards={cards} sections={sections} cardsAvailable={cardsAvailable} />
    </div>
  );
}
