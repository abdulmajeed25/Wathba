'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { OpRunner } from '../../_components/op-runner';
import { StatusBadge } from '../../_components/badge';

/**
 * OPS Part 5 (CONTENT) — «المجموعات وحملات وثبة» client island. Collections are
 * read server-side (admin GET, with project counts + ids) and handed in; every
 * mutation is a governed CONTENT-tier operation through <OpRunner>.
 */

export interface Collection {
  id: string;
  slug: string;
  nameAr: string;
  descriptionAr: string;
  isActive: boolean;
  showInMenu: boolean;
  sortOrder: number;
  _count?: { projects: number };
}

const INPUT =
  'rounded border border-[#30363d] bg-[#0d1117] px-3 py-1.5 text-sm outline-none focus:border-emerald-500';

export function CollectionsManager({ collections }: { collections: Collection[] }) {
  const router = useRouter();
  const refresh = () => router.refresh();

  return (
    <div className="space-y-8">
      <CreateCollectionForm onDone={refresh} />

      <section>
        <h2 className="mb-2 text-base font-bold">الحملات الحالية</h2>
        {collections.length === 0 ? (
          <p className="rounded border border-[#21262d] bg-[#0d1117] px-4 py-6 text-center text-sm text-[#8b949e]">
            لا حملات بعد — أنشئ الأولى أعلاه.
          </p>
        ) : (
          <ul className="space-y-2">
            {collections.map((c) => (
              <CollectionRow key={c.id} collection={c} onDone={refresh} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ── create ─────────────────────────────────────────────────────────────── */
function CreateCollectionForm({ onDone }: { onDone: () => void }) {
  const [slug, setSlug] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [descriptionAr, setDescriptionAr] = useState('');
  const [sortOrder, setSortOrder] = useState('');

  const input = useMemo(() => {
    const out: Record<string, unknown> = {
      slug: slug.trim(),
      nameAr: nameAr.trim(),
      descriptionAr: descriptionAr.trim(),
    };
    if (sortOrder.trim() !== '') out.sortOrder = Number(sortOrder);
    return out;
  }, [slug, nameAr, descriptionAr, sortOrder]);

  const ready =
    /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug.trim()) &&
    slug.trim().length >= 3 &&
    nameAr.trim().length >= 2 &&
    descriptionAr.trim().length >= 4;

  return (
    <form
      className="grid gap-3 rounded-lg border border-[#21262d] bg-[#161b22] p-4 sm:grid-cols-2"
      onSubmit={(e) => e.preventDefault()}
    >
      <h2 className="text-base font-bold sm:col-span-2">إنشاء حملة وثبة</h2>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-[#8b949e]">المُعرّف (slug — 3 أحرف على الأقل)</span>
        <input value={slug} onChange={(e) => setSlug(e.target.value)} dir="ltr" placeholder="ramadan-2026" className={INPUT} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-[#8b949e]">الاسم بالعربية</span>
        <input value={nameAr} onChange={(e) => setNameAr(e.target.value)} placeholder="حملة رمضان" className={INPUT} />
      </label>
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="text-xs text-[#8b949e]">الوصف (4 أحرف على الأقل)</span>
        <textarea value={descriptionAr} onChange={(e) => setDescriptionAr(e.target.value)} rows={2} className={INPUT} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-[#8b949e]">الترتيب (اختياري)</span>
        <input value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} type="number" min={0} className={INPUT} />
      </label>
      <p className="self-end text-xs text-[#8b949e]">تُنشأ غير مفعّلة حتى تُفعَّل صراحةً.</p>
      <div className="sm:col-span-2">
        <OpRunner
          opKey="content.collections.create"
          input={input}
          triggerLabel="إنشاء الحملة"
          riskTier="CONTENT"
          requiresReason={false}
          disabled={!ready}
          onDone={() => {
            setSlug('');
            setNameAr('');
            setDescriptionAr('');
            setSortOrder('');
            onDone();
          }}
        />
      </div>
    </form>
  );
}

/* ── row ────────────────────────────────────────────────────────────────── */
function CollectionRow({ collection: c, onDone }: { collection: Collection; onDone: () => void }) {
  const [editing, setEditing] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [nameAr, setNameAr] = useState(c.nameAr);
  const [descriptionAr, setDescriptionAr] = useState(c.descriptionAr);
  const [projectId, setProjectId] = useState('');

  const editInput = useMemo(() => {
    const out: Record<string, unknown> = { id: c.id };
    if (nameAr.trim() !== c.nameAr) out.nameAr = nameAr.trim();
    if (descriptionAr.trim() !== c.descriptionAr) out.descriptionAr = descriptionAr.trim();
    return out;
  }, [nameAr, descriptionAr, c]);
  const changed = Object.keys(editInput).length > 1;

  const projectOk = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId.trim());

  return (
    <li className="rounded-lg border border-[#21262d] bg-[#0d1117] p-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{c.nameAr}</span>
            <code dir="ltr" className="text-[11px] text-[#8b949e]">
              {c.slug}
            </code>
            {c.isActive ? <StatusBadge intent="ok">مفعّلة</StatusBadge> : <StatusBadge intent="muted">غير مفعّلة</StatusBadge>}
            {c.showInMenu ? <StatusBadge intent="info">في القائمة</StatusBadge> : null}
            <StatusBadge intent="muted">
              {(c._count?.projects ?? 0).toLocaleString('ar-SA-u-nu-latn')} مشروع مُسند
            </StatusBadge>
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-[#8b949e]">{c.descriptionAr}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setEditing((v) => !v)} className="rounded border border-[#30363d] px-2 py-1 text-xs hover:bg-[#21262d]">
            {editing ? 'إلغاء' : 'تعديل'}
          </button>
          <button type="button" onClick={() => setAssigning((v) => !v)} className="rounded border border-[#30363d] px-2 py-1 text-xs hover:bg-[#21262d]">
            إسناد مشروع
          </button>
          <OpRunner
            opKey="content.collections.update"
            input={{ id: c.id, isActive: !c.isActive }}
            triggerLabel={c.isActive ? 'إلغاء التفعيل' : 'تفعيل'}
            riskTier="CONTENT"
            requiresReason={false}
            variant="ghost"
            onDone={onDone}
          />
          <OpRunner
            opKey="content.collections.update"
            input={{ id: c.id, showInMenu: !c.showInMenu }}
            triggerLabel={c.showInMenu ? 'إخفاء من القائمة' : 'إظهار في القائمة'}
            riskTier="CONTENT"
            requiresReason={false}
            variant="ghost"
            onDone={onDone}
          />
          <OpRunner
            opKey="content.collections.delete"
            input={{ id: c.id }}
            triggerLabel="حذف"
            riskTier="CONTENT"
            requiresReason={false}
            variant="danger"
            onDone={onDone}
          />
          <Link href={`/ops/audit?entity=Collection&entityId=${encodeURIComponent(c.id)}`} className="text-xs text-[#58a6ff] hover:underline">
            سجلّها
          </Link>
        </div>
      </div>

      {editing ? (
        <div className="mt-3 grid gap-2 rounded border border-[#21262d] bg-[#161b22] p-3">
          <input value={nameAr} onChange={(e) => setNameAr(e.target.value)} aria-label="الاسم" className={INPUT} />
          <textarea value={descriptionAr} onChange={(e) => setDescriptionAr(e.target.value)} rows={2} aria-label="الوصف" className={INPUT} />
          <div>
            <OpRunner
              opKey="content.collections.update"
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

      {assigning ? (
        <div className="mt-3 grid gap-2 rounded border border-[#21262d] bg-[#161b22] p-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-[#8b949e]">مُعرّف المشروع (UUID)</span>
            <input value={projectId} onChange={(e) => setProjectId(e.target.value)} dir="ltr" placeholder="00000000-0000-0000-0000-000000000000" className={INPUT} />
          </label>
          <div className="flex gap-2">
            <OpRunner
              opKey="content.collections.assign"
              input={{ collectionId: c.id, projectId: projectId.trim() }}
              triggerLabel="إسناد"
              riskTier="CONTENT"
              requiresReason={false}
              disabled={!projectOk}
              onDone={() => {
                setProjectId('');
                onDone();
              }}
            />
            <OpRunner
              opKey="content.collections.unassign"
              input={{ collectionId: c.id, projectId: projectId.trim() }}
              triggerLabel="فك الإسناد"
              riskTier="CONTENT"
              requiresReason={false}
              variant="ghost"
              disabled={!projectOk}
              onDone={() => {
                setProjectId('');
                onDone();
              }}
            />
          </div>
        </div>
      ) : null}
    </li>
  );
}
