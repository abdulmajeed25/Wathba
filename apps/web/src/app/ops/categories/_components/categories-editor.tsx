'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { OpRunner } from '../../_components/op-runner';
import { StatusBadge } from '../../_components/badge';
import type { CatNode } from './cat-types';

/**
 * OPS Part 5 (CONTENT) — «الفئات» tree editor client island. The tree is
 * fetched server-side (OPS-GAPS Y1: GET /v1/ops/categories, which INCLUDES
 * hidden/inactive nodes) and handed in; every mutation is a governed
 * CONTENT-tier operation fired through <OpRunner> (dry-run → preview →
 * execute), never a raw write. The permanent cultural exclusions guard lives
 * server-side — its Arabic refusal surfaces as an OpRunner blocker, not a
 * client check. Inactive nodes carry a «غير مُفعَّلة» badge + a reactivate
 * button; excluded nodes are locked («مستثناة») and cannot be reactivated.
 */

export type { CatNode };

const INPUT =
  'rounded border border-[#30363d] bg-[#0d1117] px-3 py-1.5 text-sm outline-none focus:border-emerald-500';

export function CategoriesEditor({ tree }: { tree: CatNode[] }) {
  const router = useRouter();
  const refresh = () => router.refresh();

  return (
    <div className="space-y-6">
      <CreateCategoryForm topLevel={tree} onDone={refresh} />

      <div>
        <h2 className="mb-2 text-base font-bold">الشجرة الحالية</h2>
        <p className="mb-3 text-xs text-[#8b949e]">
          الأعداد هي المشاريع الحيّة (LIVE، غير المخفاة). الإخفاء بديل الحذف المعتمد — لا توجد عملية
          حذف للفئات عمداً حتى لا تُيتَّم المشاريع المرتبطة.
        </p>
        <ScopeList parentId={null} initial={tree} onDone={refresh} depth={0} />
      </div>
    </div>
  );
}

/* ── create ─────────────────────────────────────────────────────────────── */
function CreateCategoryForm({ topLevel, onDone }: { topLevel: CatNode[]; onDone: () => void }) {
  const [slug, setSlug] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [parentId, setParentId] = useState('');
  const [sortOrder, setSortOrder] = useState('');

  const input = useMemo(() => {
    const out: Record<string, unknown> = { slug: slug.trim(), nameAr: nameAr.trim() };
    if (nameEn.trim()) out.nameEn = nameEn.trim();
    if (parentId) out.parentId = parentId;
    if (sortOrder.trim() !== '') out.sortOrder = Number(sortOrder);
    return out;
  }, [slug, nameAr, nameEn, parentId, sortOrder]);

  const ready = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug.trim()) && nameAr.trim().length >= 2;

  return (
    <form
      className="grid gap-3 rounded-lg border border-[#21262d] bg-[#161b22] p-4 sm:grid-cols-2"
      onSubmit={(e) => e.preventDefault()}
    >
      <h2 className="text-base font-bold sm:col-span-2">إنشاء فئة</h2>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-[#8b949e]">المُعرّف (slug — إنجليزي بشرطات)</span>
        <input value={slug} onChange={(e) => setSlug(e.target.value)} dir="ltr" placeholder="e.g. clean-energy" className={INPUT} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-[#8b949e]">الاسم بالعربية</span>
        <input value={nameAr} onChange={(e) => setNameAr(e.target.value)} placeholder="الطاقة النظيفة" className={INPUT} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-[#8b949e]">الاسم بالإنجليزية (اختياري)</span>
        <input value={nameEn} onChange={(e) => setNameEn(e.target.value)} dir="ltr" placeholder="Clean Energy" className={INPUT} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-[#8b949e]">الفئة الأم (فارغ = فئة رئيسية)</span>
        <select value={parentId} onChange={(e) => setParentId(e.target.value)} className={INPUT}>
          <option value="">— فئة رئيسية —</option>
          {topLevel
            .filter((n) => n.isActive)
            .map((n) => (
              <option key={n.id} value={n.id}>
                {n.nameAr}
              </option>
            ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-[#8b949e]">الترتيب (اختياري)</span>
        <input value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} type="number" min={0} className={INPUT} />
      </label>
      <div className="flex items-end sm:col-span-2">
        <OpRunner
          opKey="content.categories.create"
          input={input}
          triggerLabel="إنشاء الفئة"
          riskTier="CONTENT"
          requiresReason={false}
          disabled={!ready}
          onDone={() => {
            setSlug('');
            setNameAr('');
            setNameEn('');
            setParentId('');
            setSortOrder('');
            onDone();
          }}
        />
      </div>
    </form>
  );
}

/* ── a single sortable scope (top-level, or one parent's children) ───────── */
function ScopeList({
  parentId,
  initial,
  onDone,
  depth,
}: {
  parentId: string | null;
  initial: CatNode[];
  onDone: () => void;
  depth: number;
}) {
  const [order, setOrder] = useState<CatNode[]>(initial);

  const dirty = order.map((n) => n.id).join() !== initial.map((n) => n.id).join();

  function move(i: number, dir: -1 | 1) {
    setOrder((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const a = prev[i];
      const b = prev[j];
      if (!a || !b) return prev;
      const next = [...prev];
      next[i] = b;
      next[j] = a;
      return next;
    });
  }

  if (order.length === 0) {
    return <p className="py-3 text-xs text-[#484f58]">لا فئات في هذا المستوى بعد.</p>;
  }

  return (
    <div className={depth > 0 ? 'mr-6 border-r border-[#21262d] pr-3' : ''}>
      <ul className="space-y-2">
        {order.map((n, i) => (
          <li key={n.id} className="rounded-lg border border-[#21262d] bg-[#0d1117]">
            <NodeRow node={n} i={i} count={order.length} onMove={move} onDone={onDone} />
            {n.children.length > 0 ? (
              <div className="border-t border-[#21262d] p-3">
                <ScopeList parentId={n.id} initial={n.children} onDone={onDone} depth={depth + 1} />
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {dirty ? (
        <div className="mt-2">
          <OpRunner
            opKey="content.categories.reorder"
            input={{ parentId, orderedIds: order.map((n) => n.id) }}
            triggerLabel="حفظ ترتيب هذا المستوى"
            riskTier="CONTENT"
            requiresReason={false}
            variant="ghost"
            onDone={onDone}
          />
        </div>
      ) : null}
    </div>
  );
}

function NodeRow({
  node,
  i,
  count,
  onMove,
  onDone,
}: {
  node: CatNode;
  i: number;
  count: number;
  onMove: (i: number, dir: -1 | 1) => void;
  onDone: () => void;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-3 p-3">
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => onMove(i, -1)}
          disabled={i === 0}
          aria-label={`رفع ${node.nameAr}`}
          className="rounded border border-[#30363d] px-1.5 text-xs leading-4 hover:bg-[#21262d] disabled:opacity-30"
        >
          ▲
        </button>
        <button
          type="button"
          onClick={() => onMove(i, 1)}
          disabled={i === count - 1}
          aria-label={`خفض ${node.nameAr}`}
          className="rounded border border-[#30363d] px-1.5 text-xs leading-4 hover:bg-[#21262d] disabled:opacity-30"
        >
          ▼
        </button>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`font-medium ${node.isActive ? '' : 'text-[#8b949e]'}`}>{node.nameAr}</span>
          <code dir="ltr" className="text-[11px] text-[#8b949e]">
            {node.slug}
          </code>
          <StatusBadge intent="info">{node.projectCount.toLocaleString('ar-SA')} مشروع</StatusBadge>
          {!node.isActive ? <StatusBadge intent="warn">غير مُفعَّلة</StatusBadge> : null}
          {node.excluded ? <StatusBadge intent="danger">🔒 مستثناة</StatusBadge> : null}
        </div>
        {editing ? <RenameForm node={node} onDone={() => { setEditing(false); onDone(); }} /> : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="rounded border border-[#30363d] px-2 py-1 text-xs hover:bg-[#21262d]"
        >
          {editing ? 'إلغاء التعديل' : 'تعديل'}
        </button>
        {node.isActive ? (
          <OpRunner
            opKey="content.categories.set-active"
            input={{ categoryId: node.id, isActive: false }}
            triggerLabel="إخفاء"
            riskTier="CONTENT"
            requiresReason={false}
            variant="danger"
            onDone={onDone}
          />
        ) : node.excluded ? (
          <span
            title="فئة مستثناة دائماً — لا يمكن تفعيلها"
            className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-xs text-red-300"
          >
            🔒 لا يمكن تفعيلها
          </span>
        ) : (
          <OpRunner
            opKey="content.categories.set-active"
            input={{ categoryId: node.id, isActive: true }}
            triggerLabel="إعادة التفعيل"
            riskTier="CONTENT"
            requiresReason={false}
            variant="primary"
            onDone={onDone}
          />
        )}
        <Link
          href={`/ops/audit?q=${encodeURIComponent(node.slug)}`}
          className="text-xs text-[#58a6ff] hover:underline"
        >
          سجلّها
        </Link>
      </div>
    </div>
  );
}

function RenameForm({ node, onDone }: { node: CatNode; onDone: () => void }) {
  const [slug, setSlug] = useState(node.slug);
  const [nameAr, setNameAr] = useState(node.nameAr);
  const [nameEn, setNameEn] = useState(node.nameEn);

  const input = useMemo(() => {
    const out: Record<string, unknown> = { categoryId: node.id };
    if (slug.trim() !== node.slug) out.slug = slug.trim();
    if (nameAr.trim() !== node.nameAr) out.nameAr = nameAr.trim();
    if (nameEn.trim() !== node.nameEn) out.nameEn = nameEn.trim();
    return out;
  }, [slug, nameAr, nameEn, node]);

  const changed = Object.keys(input).length > 1;

  return (
    <div className="mt-3 grid gap-2 rounded border border-[#21262d] bg-[#161b22] p-3 sm:grid-cols-3">
      <input value={slug} onChange={(e) => setSlug(e.target.value)} dir="ltr" aria-label="المُعرّف" className={INPUT} />
      <input value={nameAr} onChange={(e) => setNameAr(e.target.value)} aria-label="الاسم بالعربية" className={INPUT} />
      <input value={nameEn} onChange={(e) => setNameEn(e.target.value)} dir="ltr" aria-label="الاسم بالإنجليزية" className={INPUT} />
      <div className="sm:col-span-3">
        <OpRunner
          opKey="content.categories.update"
          input={input}
          triggerLabel="حفظ التعديل"
          riskTier="CONTENT"
          requiresReason={false}
          disabled={!changed}
          onDone={onDone}
        />
      </div>
    </div>
  );
}
