'use client';

import { useEffect, useRef, useState } from 'react';

import { Icon } from './wathba-icons';

/**
 * STAKES/I1 — per-network share: X / WhatsApp / Telegram / copy-link.
 * Small popover anchored to the trigger; native navigator.share stays the
 * first option on devices that support it. Esc/outside-click close; the
 * copy action confirms inline (no toast dependency).
 */

function shareTargets(url: string, title: string) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  return [
    { key: 'x', label: 'X', href: `https://x.com/intent/post?url=${u}&text=${t}` },
    { key: 'whatsapp', label: 'واتساب', href: `https://wa.me/?text=${t}%20${u}` },
    { key: 'telegram', label: 'تيليغرام', href: `https://t.me/share/url?url=${u}&text=${t}` },
  ];
}

export function ShareButton({
  title,
  url,
  style,
}: {
  title: string;
  /** Absolute or path URL to share; defaults to the current location. */
  url?: string;
  style?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const resolvedUrl = () =>
    url && /^https?:/.test(url)
      ? url
      : typeof window !== 'undefined'
        ? url
          ? new URL(url, window.location.origin).toString()
          : window.location.href
        : (url ?? '');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(resolvedUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard denied — the per-network links still work */
    }
  };

  return (
    <div ref={rootRef} style={{ position: 'relative', flex: 1, display: 'flex' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          flex: 1, cursor: 'pointer',
          background: 'transparent',
          border: '1px solid rgba(var(--ink-rgb),.16)',
          color: 'var(--text)', fontWeight: 600, fontSize: 13,
          padding: '10px', borderRadius: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 6, fontFamily: 'inherit',
          ...style,
        }}
      >
        <Icon name="share" size={16} /> شارك
      </button>
      {open && (
        <div role="menu" aria-label="مشاركة" style={panel}>
          {shareTargets(resolvedUrl(), title).map((tgt) => (
            <a
              key={tgt.key}
              role="menuitem"
              href={tgt.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              style={row}
            >
              <Icon name="send" size={15} color="var(--accent)" /> {tgt.label}
            </a>
          ))}
          <button type="button" role="menuitem" onClick={() => void copy()} style={{ ...row, width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>
            <Icon name={copied ? 'check_circle' : 'bookmark'} size={15} color="var(--accent)" />
            {copied ? 'تم النسخ ✓' : 'نسخ الرابط'}
          </button>
        </div>
      )}
    </div>
  );
}

const panel: React.CSSProperties = {
  position: 'absolute', bottom: 'calc(100% + 8px)', insetInlineStart: 0, minWidth: 170, zIndex: 60,
  background: 'var(--card)', border: '1px solid rgba(var(--ink-rgb),.1)', borderRadius: 13,
  boxShadow: '0 24px 48px -20px rgba(0,0,0,.45)', padding: 6,
};
const row: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 9, padding: '9px 10px', borderRadius: 9,
  textDecoration: 'none', color: 'var(--text-soft)', fontSize: 13.5, fontWeight: 600, textAlign: 'start',
};
