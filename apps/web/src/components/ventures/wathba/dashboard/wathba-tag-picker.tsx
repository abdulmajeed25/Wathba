'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Batch DISCOVERY-ENGINE — the creator's tag picker.
 *
 * A picker over a CURATED vocabulary, not a free-text field, and the whole
 * design follows from that: the creator is choosing, not writing, so the
 * control's job is to make the vocabulary findable rather than to accept
 * anything typed. Arabic is why — «تقنية», «تقنيه» and «تقنيّة» are one concept
 * and three strings, and a free-text field would split the facet three ways.
 *
 * Saves the WHOLE set on every change. The API has whole-set semantics, so
 * there is no add/remove protocol to keep in sync and a double-submit converges
 * instead of drifting.
 */

const MAX_TAGS = 10;

export interface PickerTag {
  slug: string;
  nameAr: string;
}

export function WathbaTagPicker({
  initial,
  onSave,
}: {
  initial: PickerTag[];
  /** Persists the whole set; returns the slugs the server actually applied. */
  onSave: (slugs: string[]) => Promise<string[]>;
}) {
  const [chosen, setChosen] = useState<PickerTag[]>(initial);
  const [q, setQ] = useState('');
  const [options, setOptions] = useState<PickerTag[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const box = useRef<HTMLDivElement>(null);

  // Debounced, like the header search — one request per pause, not per key.
  useEffect(() => {
    const t = setTimeout(() => {
      void fetch(`/api/tags/suggest?q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((j: { items?: PickerTag[] }) => setOptions(j.items ?? []))
        .catch(() => setOptions([]));
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  // A click outside closes the list. Without this the panel sits over the rest
  // of the settings form and the creator has to pick something to escape it.
  useEffect(() => {
    const away = (e: MouseEvent): void => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);

  const persist = async (next: PickerTag[]): Promise<void> => {
    const prev = chosen;
    setChosen(next); // optimistic — a control that waits on a round trip reads as broken
    setBusy(true);
    setMsg(null);
    try {
      const applied = await onSave(next.map((t) => t.slug));
      // The server drops slugs ops retired between page load and save. Reflect
      // what it actually stored rather than what we asked for, or the creator
      // walks away believing in a tag that is not there.
      if (applied.length !== next.length) {
        setChosen(next.filter((t) => applied.includes(t.slug)));
        setMsg({ kind: 'ok', text: 'حُفظت الوسوم — بعضها لم يعد متاحاً وأُسقط' });
      } else {
        setMsg({ kind: 'ok', text: 'حُفظت الوسوم' });
      }
    } catch (e) {
      setChosen(prev);
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'تعذّر الحفظ' });
    } finally {
      setBusy(false);
    }
  };

  const add = (t: PickerTag): void => {
    if (chosen.some((c) => c.slug === t.slug) || chosen.length >= MAX_TAGS) return;
    void persist([...chosen, t]);
    setQ('');
  };
  const remove = (slug: string): void => void persist(chosen.filter((c) => c.slug !== slug));

  const available = options.filter((o) => !chosen.some((c) => c.slug === o.slug));
  const full = chosen.length >= MAX_TAGS;

  return (
    <div ref={box} style={{ position: 'relative' }}>
      <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 12 }}>
        الوسوم تساعد الداعمين على إيجاد مشروعك عبر الفئات — «تراث سعودي» أو «صديق للبيئة» مثلاً.
        اختر حتى {MAX_TAGS} وسوم من القائمة.
      </p>

      {/* The chosen set. Each chip is removable; the group is labelled so a
          screen reader announces it as a list rather than as loose buttons. */}
      <div
        role="list"
        aria-label="وسوم المشروع"
        style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12, minHeight: 34 }}
      >
        {chosen.length === 0 && (
          <span style={{ fontSize: 13, color: 'var(--muted2)', alignSelf: 'center' }}>
            لا وسوم بعد
          </span>
        )}
        {chosen.map((t) => (
          <span
            key={t.slug}
            role="listitem"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              background: 'rgba(var(--accent-rgb),.10)',
              border: '1px solid rgba(var(--accent-rgb),.28)',
              color: 'var(--accent-ink)',
              padding: '6px 10px', borderRadius: 30, fontSize: 13, fontWeight: 600,
            }}
          >
            {t.nameAr}
            <button
              type="button"
              disabled={busy}
              onClick={() => remove(t.slug)}
              aria-label={`إزالة الوسم ${t.nameAr}`}
              style={{
                border: 0, background: 'none', cursor: busy ? 'default' : 'pointer',
                color: 'inherit', fontSize: 15, lineHeight: 1, padding: 0,
                // 24px target per WCAG 2.2 SC 2.5.8, without a 24px-looking chip.
                width: 24, height: 24, display: 'grid', placeItems: 'center',
              }}
            >
              ×
            </button>
          </span>
        ))}
      </div>

      <input
        type="text"
        value={q}
        disabled={busy || full}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={full ? `بلغت الحد الأقصى (${MAX_TAGS})` : 'ابحث عن وسم…'}
        aria-label="ابحث عن وسم"
        aria-expanded={open}
        role="combobox"
        aria-controls="wathba-tag-options"
        style={{
          width: '100%', maxWidth: 340, padding: '9px 12px', borderRadius: 10,
          border: '1px solid rgba(var(--ink-rgb),.16)', background: 'var(--card)',
          color: 'var(--text)', fontFamily: 'inherit', fontSize: 14,
        }}
      />

      {open && !full && available.length > 0 && (
        <ul
          id="wathba-tag-options"
          role="listbox"
          style={{
            position: 'absolute', zIndex: 30, marginTop: 6, maxWidth: 340, width: '100%',
            maxHeight: 260, overflowY: 'auto', listStyle: 'none', padding: 6,
            background: 'var(--card)', border: '1px solid rgba(var(--ink-rgb),.14)',
            borderRadius: 12, boxShadow: '0 18px 40px -20px rgba(0,0,0,.55)',
          }}
        >
          {available.map((t) => (
            <li key={t.slug} role="option" aria-selected={false}>
              <button
                type="button"
                onClick={() => add(t)}
                style={{
                  width: '100%', textAlign: 'start', border: 0, background: 'none',
                  cursor: 'pointer', padding: '9px 10px', borderRadius: 8,
                  color: 'var(--text)', fontFamily: 'inherit', fontSize: 13.5,
                }}
              >
                {t.nameAr}
              </button>
            </li>
          ))}
        </ul>
      )}

      {msg && (
        <p
          style={{
            marginTop: 10, fontSize: 13, fontWeight: 600,
            color: msg.kind === 'ok' ? 'var(--accent-ink)' : '#c0392b',
          }}
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}
