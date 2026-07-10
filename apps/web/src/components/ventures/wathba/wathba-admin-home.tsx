'use client';

import { useCallback, useEffect, useState } from 'react';

import { useConfirm, useToast } from './wathba-feedback';
import { Icon } from './wathba-icons';
import type { ApiEditorialCard } from '@/lib/api/wathba';

/**
 * Batch HOME — «إدارة الرئيسية»: toggle/reorder homepage sections and CRUD
 * the editorial cards that feed them. Loads client-side from the /api/admin
 * BFF proxies (httpOnly cookie → bearer); every mutation is AuditLogged
 * server-side.
 */

interface SectionRow {
  key: string;
  isActive: boolean;
  sortOrder: number;
}

const SECTION_LABELS: Record<string, string> = {
  hero_banners: 'اللافتات الرئيسية (S1)',
  featured_recommended: 'مشروع مميز + موصى بها (S2)',
  announcements: 'إعلانان (S3)',
  collection_showcase: 'عرض حملة (S4)',
  brand_program: 'رسالة وثبة + البرنامج (S5)',
  home_stretch: 'على وشك الاكتمال (S6)',
  success_stories: 'قصص نجاح (S7)',
  creator_interviews: 'حوارات المبدعين (S8)',
  fresh_favorites: 'مفضلات جديدة (S9)',
  creators_corner: 'ركن المبدعين (S10)',
  funding_tips: 'نصائح التمويل (S11)',
  trust_duo: 'الثقة والأمان (S12)',
};

const KIND_LABELS: Record<string, string> = {
  HERO_BANNER: 'لافتة رئيسية',
  ANNOUNCEMENT: 'إعلان',
  SUCCESS_STORY: 'قصة نجاح',
  CREATOR_INTERVIEW: 'حوار مبدع',
  RESOURCE: 'مورد للمبدعين',
  TIP: 'نصيحة تمويل',
  TRUST_GUIDE: 'دليل ثقة',
};
const KINDS = Object.keys(KIND_LABELS);

interface CardForm {
  id?: string;
  kind: string;
  titleAr: string;
  bodyAr: string;
  bodyLongAr: string;
  slug: string;
  linkUrl: string;
  linkLabelAr: string;
  sortOrder: number;
}

const EMPTY_FORM: CardForm = {
  kind: 'ANNOUNCEMENT', titleAr: '', bodyAr: '', bodyLongAr: '', slug: '',
  linkUrl: '', linkLabelAr: '', sortOrder: 0,
};

export function WathbaAdminHome(): React.ReactElement {
  const toast = useToast();
  const confirm = useConfirm();
  const [sections, setSections] = useState<SectionRow[] | null>(null);
  const [cards, setCards] = useState<ApiEditorialCard[] | null>(null);
  const [form, setForm] = useState<CardForm | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [s, c] = await Promise.all([
      fetch('/api/admin/homepage-sections').then((r) => (r.ok ? r.json() : null)),
      fetch('/api/admin/editorial-cards').then((r) => (r.ok ? r.json() : null)),
    ]);
    setSections((s?.items as SectionRow[]) ?? []);
    setCards((c?.items as ApiEditorialCard[]) ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const patchSection = async (key: string, data: Partial<SectionRow>) => {
    const r = await fetch(`/api/admin/homepage-sections/${key}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!r.ok) {
      toast('error', 'تعذّر تحديث القسم');
      return false;
    }
    return true;
  };

  const toggleSection = async (s: SectionRow) => {
    if (await patchSection(s.key, { isActive: !s.isActive })) {
      setSections((prev) =>
        prev ? prev.map((x) => (x.key === s.key ? { ...x, isActive: !s.isActive } : x)) : prev,
      );
      toast('success', s.isActive ? 'أُخفي القسم من الرئيسية' : 'أُظهر القسم في الرئيسية');
    }
  };

  const moveSection = async (idx: number, dir: -1 | 1) => {
    if (!sections) return;
    const other = idx + dir;
    if (other < 0 || other >= sections.length) return;
    const a = sections[idx]!;
    const b = sections[other]!;
    // Swap sortOrders server-side, then mirror locally.
    const ok =
      (await patchSection(a.key, { sortOrder: b.sortOrder })) &&
      (await patchSection(b.key, { sortOrder: a.sortOrder }));
    if (ok) {
      setSections((prev) => {
        if (!prev) return prev;
        const next = [...prev];
        next[idx] = { ...b, sortOrder: a.sortOrder };
        next[other] = { ...a, sortOrder: b.sortOrder };
        return next;
      });
    }
  };

  const toggleCard = async (c: ApiEditorialCard) => {
    const r = await fetch(`/api/admin/editorial-cards/${c.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ isActive: !c.isActive }),
    });
    if (r.ok) {
      setCards((prev) =>
        prev ? prev.map((x) => (x.id === c.id ? { ...x, isActive: !c.isActive } : x)) : prev,
      );
    } else toast('error', 'تعذّر تحديث البطاقة');
  };

  const deleteCard = async (c: ApiEditorialCard) => {
    const ok = await confirm({
      title: 'حذف البطاقة',
      body: `سيُحذف «${c.titleAr}» نهائياً من الرئيسية.`,
      confirmLabel: 'احذف',
      danger: true,
    });
    if (!ok) return;
    const r = await fetch(`/api/admin/editorial-cards/${c.id}`, { method: 'DELETE' });
    if (r.ok) {
      setCards((prev) => (prev ? prev.filter((x) => x.id !== c.id) : prev));
      toast('success', 'حُذفت البطاقة');
    } else toast('error', 'تعذّر حذف البطاقة');
  };

  const submitForm = async () => {
    if (!form) return;
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        kind: form.kind,
        titleAr: form.titleAr.trim(),
        bodyAr: form.bodyAr.trim(),
        sortOrder: form.sortOrder,
      };
      if (form.bodyLongAr.trim()) payload.bodyLongAr = form.bodyLongAr.trim();
      if (form.slug.trim()) payload.slug = form.slug.trim();
      if (form.linkUrl.trim()) payload.linkUrl = form.linkUrl.trim();
      if (form.linkLabelAr.trim()) payload.linkLabelAr = form.linkLabelAr.trim();
      const r = await fetch(
        form.id ? `/api/admin/editorial-cards/${form.id}` : '/api/admin/editorial-cards',
        {
          method: form.id ? 'PATCH' : 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      if (!r.ok) {
        const err = (await r.json().catch(() => null)) as { message?: string | string[] } | null;
        const msg = Array.isArray(err?.message) ? err.message[0] : err?.message;
        toast('error', msg ?? 'تعذّر حفظ البطاقة');
        return;
      }
      toast('success', form.id ? 'حُدّثت البطاقة' : 'أُنشئت البطاقة');
      setForm(null);
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (sections === null || cards === null) {
    return <p style={{ color: 'var(--muted)', fontSize: 14 }}>يُحمَّل…</p>;
  }

  return (
    <div data-testid="admin-home-panel" style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* ── sections ─────────────────────────────────────────── */}
      <section>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>أقسام الرئيسية</h2>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
          فعّل أو أخفِ أو أعد ترتيب الأقسام — تظهر في الرئيسية بهذا الترتيب، والقسم الفارغ يُخفى تلقائياً.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sections.map((s, i) => (
            <div key={s.key} data-testid={`section-row-${s.key}`} style={rowStyle}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span style={{ fontWeight: 700, fontSize: 13.5 }}>{SECTION_LABELS[s.key] ?? s.key}</span>
                <span style={{ fontSize: 11.5, color: 'var(--muted2)', direction: 'ltr', textAlign: 'end' }}>{s.key}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button type="button" aria-label="أعلى" onClick={() => void moveSection(i, -1)} disabled={i === 0} style={miniBtn}>
                  <Icon name="expand_less" size={16} color="var(--text)" />
                </button>
                <button type="button" aria-label="أسفل" onClick={() => void moveSection(i, 1)} disabled={i === sections.length - 1} style={miniBtn}>
                  <Icon name="expand_more" size={16} color="var(--text)" />
                </button>
                <button
                  type="button"
                  role="switch"
                  aria-checked={s.isActive}
                  aria-label={`تفعيل ${SECTION_LABELS[s.key] ?? s.key}`}
                  data-testid={`section-toggle-${s.key}`}
                  onClick={() => void toggleSection(s)}
                  style={{
                    ...miniBtn, width: 'auto', padding: '7px 14px', fontWeight: 700, fontSize: 12,
                    background: s.isActive ? 'rgba(var(--accent-rgb),.14)' : 'rgba(var(--ink-rgb),.06)',
                    color: s.isActive ? 'var(--accent-ink)' : 'var(--muted)',
                  }}
                >
                  {s.isActive ? 'ظاهر' : 'مخفي'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── cards ────────────────────────────────────────────── */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>البطاقات التحريرية</h2>
          <button
            type="button"
            data-testid="new-card"
            onClick={() => setForm({ ...EMPTY_FORM })}
            style={{
              background: 'var(--grad)', color: 'var(--on-accent)', border: 'none', cursor: 'pointer',
              fontWeight: 700, fontSize: 12.5, padding: '9px 18px', borderRadius: 10,
            }}
          >
            + بطاقة جديدة
          </button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
          اللافتات والإعلانات والقصص والنصائح التي تغذّي الأقسام أعلاه.
        </p>

        {form && (
          <div style={{ ...rowStyle, flexDirection: 'column', alignItems: 'stretch', gap: 10, marginBottom: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={lbl}>
                النوع
                <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} style={inp}>
                  {KINDS.map((k) => (
                    <option key={k} value={k}>{KIND_LABELS[k]}</option>
                  ))}
                </select>
              </label>
              <label style={lbl}>
                الترتيب
                <input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })}
                  style={inp}
                />
              </label>
            </div>
            <label style={lbl}>
              العنوان
              <input value={form.titleAr} onChange={(e) => setForm({ ...form, titleAr: e.target.value })} style={inp} data-testid="card-title" />
            </label>
            <label style={lbl}>
              النص المختصر
              <textarea value={form.bodyAr} onChange={(e) => setForm({ ...form, bodyAr: e.target.value })} rows={3} style={inp} />
            </label>
            <label style={lbl}>
              المقال الكامل (اختياري — يفعّل صفحة /stories)
              <textarea value={form.bodyLongAr} onChange={(e) => setForm({ ...form, bodyLongAr: e.target.value })} rows={5} style={inp} />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <label style={lbl}>
                المُعرّف (slug)
                <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} style={{ ...inp, direction: 'ltr' }} />
              </label>
              <label style={lbl}>
                رابط الزر
                <input value={form.linkUrl} onChange={(e) => setForm({ ...form, linkUrl: e.target.value })} style={{ ...inp, direction: 'ltr' }} />
              </label>
              <label style={lbl}>
                نص الزر
                <input value={form.linkLabelAr} onChange={(e) => setForm({ ...form, linkLabelAr: e.target.value })} style={inp} />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setForm(null)} style={{ ...miniBtn, width: 'auto', padding: '9px 18px', fontSize: 12.5 }}>
                إلغاء
              </button>
              <button
                type="button"
                data-testid="save-card"
                onClick={() => void submitForm()}
                disabled={busy || form.titleAr.trim().length < 3 || form.bodyAr.trim().length < 10}
                style={{
                  background: 'var(--grad)', color: 'var(--on-accent)', border: 'none', cursor: 'pointer',
                  fontWeight: 700, fontSize: 12.5, padding: '9px 20px', borderRadius: 10,
                  opacity: busy ? 0.6 : 1,
                }}
              >
                {form.id ? 'حفظ التعديلات' : 'إنشاء'}
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {cards.map((c) => (
            <div key={c.id} style={rowStyle}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--accent-ink)', background: 'rgba(var(--accent-rgb),.1)', padding: '2px 8px', borderRadius: 999 }}>
                    {KIND_LABELS[c.kind] ?? c.kind}
                  </span>
                  {!c.isActive && (
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', background: 'rgba(var(--ink-rgb),.06)', padding: '2px 8px', borderRadius: 999 }}>
                      مخفية
                    </span>
                  )}
                </div>
                <span style={{ fontWeight: 700, fontSize: 13.5, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.titleAr}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() =>
                    setForm({
                      id: c.id, kind: c.kind, titleAr: c.titleAr, bodyAr: c.bodyAr,
                      bodyLongAr: c.bodyLongAr ?? '', slug: c.slug ?? '', linkUrl: c.linkUrl ?? '',
                      linkLabelAr: c.linkLabelAr ?? '', sortOrder: c.sortOrder,
                    })
                  }
                  style={{ ...miniBtn, width: 'auto', padding: '7px 14px', fontSize: 12, fontWeight: 700 }}
                >
                  تعديل
                </button>
                <button
                  type="button"
                  role="switch"
                  aria-checked={c.isActive}
                  aria-label={`تفعيل ${c.titleAr}`}
                  onClick={() => void toggleCard(c)}
                  style={{
                    ...miniBtn, width: 'auto', padding: '7px 14px', fontSize: 12, fontWeight: 700,
                    background: c.isActive ? 'rgba(var(--accent-rgb),.14)' : 'rgba(var(--ink-rgb),.06)',
                    color: c.isActive ? 'var(--accent-ink)' : 'var(--muted)',
                  }}
                >
                  {c.isActive ? 'ظاهرة' : 'مخفية'}
                </button>
                <button type="button" aria-label={`حذف ${c.titleAr}`} onClick={() => void deleteCard(c)} style={miniBtn}>
                  <Icon name="delete" size={16} color="var(--err)" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

const rowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
  background: 'var(--card)', border: '1px solid rgba(var(--ink-rgb),.08)',
  borderRadius: 14, padding: '12px 16px',
};
const miniBtn: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 9, border: '1px solid rgba(var(--ink-rgb),.12)',
  background: 'var(--card)', cursor: 'pointer', display: 'inline-grid', placeItems: 'center',
};
const lbl: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 700, color: 'var(--text-soft)',
};
const inp: React.CSSProperties = {
  border: '1px solid rgba(var(--ink-rgb),.14)', borderRadius: 10, padding: '9px 12px',
  fontSize: 13.5, fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--text)',
};
