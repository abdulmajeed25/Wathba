'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { Icon } from './wathba-icons';

/**
 * STAKES/S-13 (G6 + G7) — the unified feedback layer:
 *  - useToast(): success/error snackbars (RTL, aria-live, auto-dismiss) so
 *    mutations stop inventing ad-hoc inline strings.
 *  - useConfirm(): a promise-based, styled RTL confirm dialog replacing the
 *    browser-native window.confirm (which renders LTR + off-design).
 * One provider (mounted in WathbaShell) serves both.
 */

interface Toast {
  id: number;
  kind: 'success' | 'error';
  text: string;
}

interface ConfirmRequest {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  resolve: (ok: boolean) => void;
}

interface FeedbackApi {
  toast: (kind: Toast['kind'], text: string) => void;
  confirm: (opts: Omit<ConfirmRequest, 'resolve'>) => Promise<boolean>;
}

const FeedbackContext = createContext<FeedbackApi | null>(null);

export function useToast(): FeedbackApi['toast'] {
  const ctx = useContext(FeedbackContext);
  // Degrade silently when a component renders outside the shell (tests).
  return ctx?.toast ?? (() => {});
}

export function useConfirm(): FeedbackApi['confirm'] {
  const ctx = useContext(FeedbackContext);
  // Fallback keeps behavior sane outside the provider.
  return (
    ctx?.confirm ??
    (async (opts) => (typeof window !== 'undefined' ? window.confirm(opts.title) : false))
  );
}

export function WathbaFeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pending, setPending] = useState<ConfirmRequest | null>(null);
  const idRef = useRef(0);
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);

  const toast = useCallback((kind: Toast['kind'], text: string) => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const confirm = useCallback(
    (opts: Omit<ConfirmRequest, 'resolve'>) =>
      new Promise<boolean>((resolve) => setPending({ ...opts, resolve })),
    [],
  );

  const settle = useCallback(
    (ok: boolean) => {
      pending?.resolve(ok);
      setPending(null);
    },
    [pending],
  );

  // Dialog keyboard contract: initial focus on confirm, Esc cancels.
  useEffect(() => {
    if (!pending) return;
    confirmBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') settle(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [pending, settle]);

  return (
    <FeedbackContext.Provider value={{ toast, confirm }}>
      {children}

      {/* toasts — bottom start (RTL: bottom-right visually) */}
      <div
        dir="rtl"
        aria-live="polite"
        style={{ position: 'fixed', bottom: 18, insetInlineStart: 18, zIndex: 200, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 'min(92vw, 380px)' }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 13,
              background: 'var(--card)', color: 'var(--text)',
              border: `1px solid ${t.kind === 'success' ? 'rgba(var(--accent-rgb),.4)' : 'rgba(220,38,38,.4)'}`,
              boxShadow: '0 18px 40px -16px rgba(0,0,0,.4)', fontSize: 13.5, fontWeight: 600,
              animation: 'wathba-fadeUp .25s ease both',
            }}
          >
            <Icon
              name={t.kind === 'success' ? 'check_circle' : 'error'}
              size={18}
              color={t.kind === 'success' ? 'var(--accent-ink)' : '#dc2626'}
            />
            {t.text}
          </div>
        ))}
      </div>

      {/* confirm dialog */}
      {pending && (
        <div
          dir="rtl"
          style={{ position: 'fixed', inset: 0, zIndex: 210, background: 'rgba(6,18,16,.55)', display: 'grid', placeItems: 'center', padding: 20 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) settle(false);
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label={pending.title}
            style={{
              background: 'var(--card)', borderRadius: 18, padding: '22px 24px', maxWidth: 400, width: '100%',
              border: '1px solid rgba(var(--ink-rgb),.1)', boxShadow: '0 40px 80px -30px rgba(0,0,0,.55)',
            }}
          >
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>{pending.title}</h2>
            {pending.body && (
              <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 4 }}>{pending.body}</p>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-start', marginTop: 18 }}>
              <button
                ref={confirmBtnRef}
                type="button"
                onClick={() => settle(true)}
                style={{
                  cursor: 'pointer', border: 'none', fontFamily: 'inherit', fontWeight: 700, fontSize: 14,
                  padding: '11px 20px', borderRadius: 12,
                  background: pending.danger ? '#dc2626' : 'var(--grad)',
                  color: pending.danger ? '#fff' : 'var(--on-accent)',
                }}
              >
                {pending.confirmLabel ?? 'تأكيد'}
              </button>
              <button
                type="button"
                onClick={() => settle(false)}
                style={{
                  cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 14,
                  padding: '11px 20px', borderRadius: 12, background: 'transparent',
                  border: '1px solid rgba(var(--ink-rgb),.16)', color: 'var(--text)',
                }}
              >
                {pending.cancelLabel ?? 'إلغاء'}
              </button>
            </div>
          </div>
        </div>
      )}
    </FeedbackContext.Provider>
  );
}
