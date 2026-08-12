'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { OpRunner } from '../../_components/op-runner';
import { StatusBadge } from '../../_components/badge';

/**
 * OPS Part 5 (CONTENT) — «المحتوى التحريري» client island. Editorial cards +
 * homepage sections are read server-side (admin GET) and handed in; every
 * mutation is a governed CONTENT-tier operation through <OpRunner>. The
 * permanent cultural-exclusions guard refuses server-side and surfaces as an
 * OpRunner blocker.
 */

export interface EditorialCard {
  id: string;
  kind: string;
  slug: string | null;
  titleAr: string;
  bodyAr: string;
  bodyLongAr: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  linkLabelAr: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface HomepageSection {
  key: string;
  isActive: boolean;
  sortOrder: number;
}

export const CARD_KINDS = [
  'HERO_BANNER',
  'ANNOUNCEMENT',
  'SUCCESS_STORY',
  'CREATOR_INTERVIEW',
  'RESOURCE',
  'TIP',
  'TRUST_GUIDE',
] as const;

const KIND_AR: Record<string, string> = {
  HERO_BANNER: 'لافتة رئيسية',
  ANNOUNCEMENT: 'إعلان',
  SUCCESS_STORY: 'قصة نجاح',
  CREATOR_INTERVIEW: 'حوار صانع',
  RESOURCE: 'مورد',
  TIP: 'نصيحة',
  TRUST_GUIDE: 'دليل ثقة',
};

const INPUT =
  'rounded border border-[#30363d] bg-[#0d1117] px-3 py-1.5 text-sm outline-none focus:border-emerald-500';

export function EditorialManager({
  cards,
  sections,
  cardsAvailable,
}: {
  cards: EditorialCard[];
  sections: HomepageSection[];
  cardsAvailable: boolean;
}) {
  const router = useRouter();
  const refresh = () => router.refresh();

  return (
    <div className="space-y-8">
      <ComposeCardForm onDone={refresh} />

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-bold">البطاقات التحريرية</h2>
          <a href="/" target="_blank" rel="noreferrer" className="text-xs text-[#58a6ff] hover:underline">
            معاينة الرئيسية ↗
          </a>
        </div>
        {!cardsAvailable ? (
          <p className="rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            تعذّر قراءة قائمة البطاقات الآن — يمكنك إنشاء بطاقة جديدة أعلاه، لكن قائمة التعديل غير
            متاحة.
          </p>
        ) : cards.length === 0 ? (
          <p className="rounded border border-[#21262d] bg-[#0d1117] px-4 py-6 text-center text-sm text-[#8b949e]">
            لا بطاقات بعد — أنشئ الأولى من نموذج التأليف أعلاه.
          </p>
        ) : (
          <ul className="space-y-2">
            {cards.map((c) => (
              <CardRow key={c.id} card={c} onDone={refresh} />
            ))}
          </ul>
        )}
      </section>

      <SectionsPanel sections={sections} onDone={refresh} />
    </div>
  );
}

/* ── compose ─────────────────────────────────────────────────────────────── */
function ComposeCardForm({ onDone }: { onDone: () => void }) {
  const [kind, setKind] = useState<string>('TIP');
  const [titleAr, setTitleAr] = useState('');
  const [bodyAr, setBodyAr] = useState('');
  const [bodyLongAr, setBodyLongAr] = useState('');
  const [slug, setSlug] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabelAr, setLinkLabelAr] = useState('');
  const [sortOrder, setSortOrder] = useState('');
  const [isActive, setIsActive] = useState(true);

  const input = useMemo(() => {
    const out: Record<string, unknown> = {
      kind,
      titleAr: titleAr.trim(),
      bodyAr: bodyAr.trim(),
      isActive,
    };
    if (bodyLongAr.trim()) out.bodyLongAr = bodyLongAr.trim();
    if (slug.trim()) out.slug = slug.trim();
    if (imageUrl.trim()) out.imageUrl = imageUrl.trim();
    if (linkUrl.trim()) out.linkUrl = linkUrl.trim();
    if (linkLabelAr.trim()) out.linkLabelAr = linkLabelAr.trim();
    if (sortOrder.trim() !== '') out.sortOrder = Number(sortOrder);
    return out;
  }, [kind, titleAr, bodyAr, bodyLongAr, slug, imageUrl, linkUrl, linkLabelAr, sortOrder, isActive]);

  const ready = titleAr.trim().length >= 3 && bodyAr.trim().length >= 10;

  return (
    <form
      className="grid gap-3 rounded-lg border border-[#21262d] bg-[#161b22] p-4 sm:grid-cols-2"
      onSubmit={(e) => e.preventDefault()}
    >
      <h2 className="text-base font-bold sm:col-span-2">تأليف بطاقة جديدة</h2>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-[#8b949e]">النوع</span>
        <select value={kind} onChange={(e) => setKind(e.target.value)} className={INPUT}>
          {CARD_KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_AR[k]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-[#8b949e]">المُعرّف (slug — اختياري، للقصص)</span>
        <input value={slug} onChange={(e) => setSlug(e.target.value)} dir="ltr" className={INPUT} />
      </label>
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="text-xs text-[#8b949e]">العنوان بالعربية (3 أحرف على الأقل)</span>
        <input value={titleAr} onChange={(e) => setTitleAr(e.target.value)} className={INPUT} />
      </label>
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="text-xs text-[#8b949e]">النص المختصر (10 أحرف على الأقل)</span>
        <textarea value={bodyAr} onChange={(e) => setBodyAr(e.target.value)} rows={2} className={INPUT} />
      </label>
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="text-xs text-[#8b949e]">النص الطويل (اختياري — صفحة القصة)</span>
        <textarea value={bodyLongAr} onChange={(e) => setBodyLongAr(e.target.value)} rows={3} className={INPUT} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-[#8b949e]">رابط الصورة (اختياري)</span>
        <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} dir="ltr" className={INPUT} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-[#8b949e]">رابط الوجهة (اختياري)</span>
        <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} dir="ltr" className={INPUT} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-[#8b949e]">نص الرابط (اختياري)</span>
        <input value={linkLabelAr} onChange={(e) => setLinkLabelAr(e.target.value)} className={INPUT} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-[#8b949e]">الترتيب (اختياري)</span>
        <input value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} type="number" min={0} className={INPUT} />
      </label>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 accent-emerald-600" />
        منشورة فور الإنشاء
      </label>
      <div className="sm:col-span-2">
        <OpRunner
          opKey="content.editorial.card.create"
          input={input}
          triggerLabel="إنشاء البطاقة"
          riskTier="CONTENT"
          requiresReason={false}
          disabled={!ready}
          onDone={() => {
            setTitleAr('');
            setBodyAr('');
            setBodyLongAr('');
            setSlug('');
            setImageUrl('');
            setLinkUrl('');
            setLinkLabelAr('');
            setSortOrder('');
            onDone();
          }}
        />
      </div>
    </form>
  );
}

/* ── card row (edit / toggle / delete) ───────────────────────────────────── */
function CardRow({ card, onDone }: { card: EditorialCard; onDone: () => void }) {
  const [editing, setEditing] = useState(false);
  const [titleAr, setTitleAr] = useState(card.titleAr);
  const [bodyAr, setBodyAr] = useState(card.bodyAr);
  const [imageUrl, setImageUrl] = useState(card.imageUrl ?? '');
  const [linkUrl, setLinkUrl] = useState(card.linkUrl ?? '');

  const editInput = useMemo(() => {
    const out: Record<string, unknown> = { id: card.id };
    if (titleAr.trim() !== card.titleAr) out.titleAr = titleAr.trim();
    if (bodyAr.trim() !== card.bodyAr) out.bodyAr = bodyAr.trim();
    if (imageUrl.trim() !== (card.imageUrl ?? '')) out.imageUrl = imageUrl.trim();
    if (linkUrl.trim() !== (card.linkUrl ?? '')) out.linkUrl = linkUrl.trim();
    return out;
  }, [titleAr, bodyAr, imageUrl, linkUrl, card]);

  const changed = Object.keys(editInput).length > 1;

  return (
    <li className="rounded-lg border border-[#21262d] bg-[#0d1117] p-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{card.titleAr}</span>
            <StatusBadge intent="muted">{KIND_AR[card.kind] ?? card.kind}</StatusBadge>
            {card.isActive ? (
              <StatusBadge intent="ok">منشورة</StatusBadge>
            ) : (
              <StatusBadge intent="warn">مخفاة</StatusBadge>
            )}
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-[#8b949e]">{card.bodyAr}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {card.slug ? (
            <a
              href={`/stories/${card.slug}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-[#58a6ff] hover:underline"
            >
              معاينة ↗
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="rounded border border-[#30363d] px-2 py-1 text-xs hover:bg-[#21262d]"
          >
            {editing ? 'إلغاء' : 'تعديل'}
          </button>
          <OpRunner
            opKey="content.editorial.card.update"
            input={{ id: card.id, isActive: !card.isActive }}
            triggerLabel={card.isActive ? 'إخفاء' : 'نشر'}
            riskTier="CONTENT"
            requiresReason={false}
            variant="ghost"
            onDone={onDone}
          />
          <OpRunner
            opKey="content.editorial.card.delete"
            input={{ id: card.id }}
            triggerLabel="حذف"
            riskTier="CONTENT"
            requiresReason={false}
            variant="danger"
            onDone={onDone}
          />
        </div>
      </div>

      {editing ? (
        <div className="mt-3 grid gap-2 rounded border border-[#21262d] bg-[#161b22] p-3">
          <input value={titleAr} onChange={(e) => setTitleAr(e.target.value)} aria-label="العنوان" className={INPUT} />
          <textarea value={bodyAr} onChange={(e) => setBodyAr(e.target.value)} rows={2} aria-label="النص" className={INPUT} />
          <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} dir="ltr" aria-label="رابط الصورة" placeholder="رابط الصورة" className={INPUT} />
          <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} dir="ltr" aria-label="رابط الوجهة" placeholder="رابط الوجهة" className={INPUT} />
          <div>
            <OpRunner
              opKey="content.editorial.card.update"
              input={editInput}
              triggerLabel="حفظ التعديل"
              riskTier="CONTENT"
              requiresReason={false}
              disabled={!changed}
              onDone={() => {
                setEditing(false);
                onDone();
              }}
            />
          </div>
        </div>
      ) : null}
    </li>
  );
}

/* ── homepage sections ───────────────────────────────────────────────────── */
function SectionsPanel({ sections, onDone }: { sections: HomepageSection[]; onDone: () => void }) {
  return (
    <section>
      <h2 className="mb-2 text-base font-bold">أقسام الرئيسية</h2>
      {sections.length === 0 ? (
        <p className="rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          تعذّرت قراءة أقسام الرئيسية الآن.
        </p>
      ) : (
        <ul className="space-y-2">
          {sections.map((s) => (
            <SectionRow key={s.key} section={s} onDone={onDone} />
          ))}
        </ul>
      )}
    </section>
  );
}

function SectionRow({ section, onDone }: { section: HomepageSection; onDone: () => void }) {
  const [sortOrder, setSortOrder] = useState(String(section.sortOrder));
  const orderChanged = sortOrder.trim() !== '' && Number(sortOrder) !== section.sortOrder;

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-lg border border-[#21262d] bg-[#0d1117] p-3">
      <code dir="ltr" className="flex-1 text-sm text-[#e6edf3]">
        {section.key}
      </code>
      {section.isActive ? (
        <StatusBadge intent="ok">ظاهر</StatusBadge>
      ) : (
        <StatusBadge intent="muted">مخفي</StatusBadge>
      )}
      <label className="flex items-center gap-2 text-xs text-[#8b949e]">
        الترتيب
        <input
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          type="number"
          min={0}
          className={`w-20 ${INPUT}`}
        />
      </label>
      <OpRunner
        opKey="content.homepage-section.update"
        input={{ key: section.key, sortOrder: Number(sortOrder) }}
        triggerLabel="حفظ الترتيب"
        riskTier="CONTENT"
        requiresReason={false}
        variant="ghost"
        disabled={!orderChanged}
        onDone={onDone}
      />
      <OpRunner
        opKey="content.homepage-section.update"
        input={{ key: section.key, isActive: !section.isActive }}
        triggerLabel={section.isActive ? 'إخفاء' : 'إظهار'}
        riskTier="CONTENT"
        requiresReason={false}
        variant="ghost"
        onDone={onDone}
      />
    </li>
  );
}
