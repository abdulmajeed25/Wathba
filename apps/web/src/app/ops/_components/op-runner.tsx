'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

import { formatSar, isNonZeroHalalas } from '../_lib/money';

/**
 * Shared focus trap for the ops modals (OpRunner + command palette).
 *
 * WCAG 2.4.3 (focus order) + 2.1.2 (no keyboard trap escape hatch): while
 * `active`, Tab/Shift-Tab cycle ONLY within `ref`; focus moves into the dialog
 * on open and RESTORES to the previously-focused element (the trigger) on
 * close. Esc handling stays with each caller. Listener is capture-phase so it
 * wins over inner handlers; RTL doesn't affect Tab semantics.
 */
export function useFocusTrap(active: boolean, ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    if (!active) return;
    const el = ref.current;
    if (!el) return;
    const restoreTo = document.activeElement as HTMLElement | null;

    const focusable = (): HTMLElement[] =>
      Array.from(
        el.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])',
        ),
      ).filter((n) => n.offsetParent !== null || n === document.activeElement);

    // Move focus in: first focusable child, else the container itself.
    (focusable()[0] ?? el).focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = focusable();
      if (items.length === 0) {
        e.preventDefault();
        el.focus();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const current = document.activeElement;
      if (e.shiftKey) {
        if (current === first || !el.contains(current)) {
          e.preventDefault();
          last.focus();
        }
      } else if (current === last || !el.contains(current)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      restoreTo?.focus?.();
    };
  }, [active, ref]);
}

/**
 * OPS Part 5 — THE governed-mutation control. Every destructive/money button
 * on every operator screen is an <OpRunner>. It enforces the platform's
 * contract in the UI so an operator can never fire blind:
 *
 *   trigger → dry-run (BFF) → preview (summary + before/after + counts +
 *   monetary deltas) → mandatory reason (SENSITIVE/MONEY) → typed confirm
 *   (MONEY: type نعم) → execute (BFF, x-idempotency-key) → done / error.
 *
 * Blockers (dry-run ok:false) surface each `reasonAr` and hard-disable
 * execute. A dead session (401) or a stale step-up (403 «إعادة توثيق») link
 * the operator to re-auth. `requiresReason`/`riskTier` may be passed as props
 * or discovered from the descriptor (GET /api/ops/read/operations/<key>).
 */

type RiskTier = 'CONTENT' | 'STANDARD' | 'SENSITIVE' | 'MONEY';

interface DryRunPreview {
  summaryAr: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  counts?: Record<string, number>;
  monetaryDeltasHalalas?: Record<string, string>;
}
interface DryRunOutcome {
  ok: boolean;
  blockers: Array<{ code: string; reasonAr: string }>;
  preview: DryRunPreview | null;
}

type Phase = 'idle' | 'loading' | 'preview' | 'executing' | 'done' | 'error';

export interface OpRunnerProps {
  opKey: string;
  input: unknown;
  triggerLabel: string;
  /** Pass to skip the descriptor fetch; otherwise discovered on open. */
  requiresReason?: boolean;
  riskTier?: RiskTier;
  /** Style the trigger as the destructive/primary action. */
  variant?: 'primary' | 'danger' | 'ghost';
  /** Disable the trigger (e.g. missing permission upstream). */
  disabled?: boolean;
  /** Fired after a successful execute with the API result. */
  onDone?: (result: unknown) => void;
  /** Open the flow immediately on mount (used by the command palette). */
  autoStart?: boolean;
  /** Notified whenever the dialog closes (for controlled unmounting). */
  onClose?: () => void;
}

const TRIGGER: Record<NonNullable<OpRunnerProps['variant']>, string> = {
  primary: 'rounded bg-[#238636] px-3 py-1.5 text-sm font-bold text-white hover:bg-[#2ea043]',
  danger: 'rounded border border-red-500/50 bg-red-500/10 px-3 py-1.5 text-sm text-red-300 hover:bg-red-500/20',
  ghost: 'rounded border border-[#30363d] px-3 py-1.5 text-sm hover:bg-[#21262d]',
};

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function OpRunner(props: OpRunnerProps) {
  const { opKey, input, triggerLabel, variant = 'primary', disabled = false, onDone } = props;

  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [dry, setDry] = useState<DryRunOutcome | null>(null);
  const [reason, setReason] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [reAuthHref, setReAuthHref] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ requiresReason: boolean; riskTier: RiskTier }>({
    requiresReason: props.requiresReason ?? false,
    riskTier: props.riskTier ?? 'STANDARD',
  });

  const idemRef = useRef<string>('');
  const dialogRef = useRef<HTMLDivElement>(null);

  const isMoney = meta.riskTier === 'MONEY';
  const needsReason = meta.requiresReason || meta.riskTier === 'SENSITIVE' || isMoney;
  const CONFIRM_PHRASE = 'نعم';

  const reset = useCallback(() => {
    setPhase('idle');
    setDry(null);
    setReason('');
    setConfirmText('');
    setError(null);
    setReAuthHref(null);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    reset();
    props.onClose?.();
  }, [reset, props]);

  const start = useCallback(async () => {
    setOpen(true);
    setPhase('loading');
    setError(null);
    setReAuthHref(null);
    idemRef.current = uuid();

    // Discover the descriptor when the caller didn't pin the tier/reason.
    if (props.requiresReason === undefined || props.riskTier === undefined) {
      try {
        const d = await fetch(`/api/ops/read/operations/${opKey}`);
        if (d.ok) {
          const desc = (await d.json()) as { requiresReason?: boolean; riskTier?: RiskTier };
          setMeta({
            requiresReason: props.requiresReason ?? desc.requiresReason ?? false,
            riskTier: props.riskTier ?? desc.riskTier ?? 'STANDARD',
          });
        }
      } catch {
        /* fall back to prop defaults */
      }
    }

    try {
      const r = await fetch(`/api/ops/operations/${opKey}/dry-run`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ input }),
      });
      const body = (await r.json().catch(() => ({}))) as Record<string, unknown>;
      if (r.status === 401) {
        setReAuthHref('/ops/enter');
        setError((body.message as string) ?? 'انتهت جلسة العمليات — أعد الدخول');
        setPhase('error');
        return;
      }
      if (!r.ok) {
        setError((body.message as string) ?? 'تعذّرت المعاينة');
        setPhase('error');
        return;
      }
      setDry(body as unknown as DryRunOutcome);
      setPhase('preview');
    } catch {
      setError('تعذّر الوصول إلى الخادم');
      setPhase('error');
    }
  }, [opKey, input, props.requiresReason, props.riskTier]);

  const execute = useCallback(async () => {
    setPhase('executing');
    setError(null);
    setReAuthHref(null);
    try {
      const r = await fetch(`/api/ops/operations/${opKey}/execute`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-idempotency-key': idemRef.current },
        body: JSON.stringify({ input, reason: needsReason ? reason : undefined }),
      });
      const body = (await r.json().catch(() => ({}))) as Record<string, unknown>;
      if (!r.ok) {
        const msg =
          (body.message as string) ??
          (body as { blockers?: Array<{ reasonAr: string }> }).blockers?.[0]?.reasonAr ??
          'فشل التنفيذ';
        const text = Array.isArray(msg) ? (msg as string[]).join('، ') : String(msg);
        // Step-up / dead session → offer re-auth.
        if (r.status === 401) setReAuthHref('/ops/enter');
        else if (r.status === 403 && /توثيق|step.?up/i.test(text)) setReAuthHref('/ops');
        setError(text);
        setPhase('error');
        return;
      }
      setPhase('done');
      onDone?.((body as { result?: unknown }).result ?? body);
    } catch {
      setError('تعذّر الوصول إلى الخادم');
      setPhase('error');
    }
  }, [opKey, input, reason, needsReason, onDone]);

  // Command-palette launch: open the flow the moment we mount.
  const startedRef = useRef(false);
  useEffect(() => {
    if (props.autoStart && !startedRef.current) {
      startedRef.current = true;
      void start();
    }
  }, [props.autoStart, start]);

  // Trap + restore focus while open (WCAG 2.4.3 / 2.1.2).
  useFocusTrap(open, dialogRef);

  // Esc-to-close (except mid-execute, when the flow must not be interrupted).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && phase !== 'executing') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, phase, close]);

  const blocked = dry?.ok === false;
  const reasonOk = !needsReason || reason.trim().length >= 10;
  const confirmOk = !isMoney || confirmText.trim() === CONFIRM_PHRASE;
  const canExecute = phase === 'preview' && !blocked && reasonOk && confirmOk;

  return (
    <>
      {props.autoStart ? null : (
        <button type="button" onClick={start} disabled={disabled} className={`${TRIGGER[variant]} disabled:opacity-50`}>
          {triggerLabel}
        </button>
      )}

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`تنفيذ العملية ${opKey}`}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && phase !== 'executing') close();
          }}
        >
          <div
            ref={dialogRef}
            tabIndex={-1}
            dir="rtl"
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg border border-[#30363d] bg-[#161b22] p-5 text-[#e6edf3] outline-none"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-base font-bold">{triggerLabel}</h2>
              <code dir="ltr" className="text-[11px] text-[#8b949e]">
                {opKey}
              </code>
            </div>

            {/* SR live region: announces the op outcome to assistive tech
                (the visual result banners below are not read on state change). */}
            <p role="status" aria-live="polite" className="sr-only">
              {phase === 'done'
                ? '✓ نُفِّذت العملية وسُجّلت في التدقيق'
                : phase === 'error'
                  ? `خطأ: ${error ?? 'فشل التنفيذ'}`
                  : ''}
            </p>

            {phase === 'loading' ? (
              <p className="py-6 text-center text-sm text-[#8b949e]">جارٍ المعاينة…</p>
            ) : null}

            {phase === 'error' ? (
              <div className="space-y-3">
                <p role="alert" className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
                  {error}
                </p>
                {reAuthHref ? (
                  <a
                    href={reAuthHref}
                    className="inline-block rounded border border-amber-500/50 bg-amber-500/10 px-3 py-1.5 text-sm text-amber-300 hover:bg-amber-500/20"
                  >
                    إعادة التوثيق →
                  </a>
                ) : null}
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={close} className="rounded border border-[#30363d] px-3 py-1.5 text-sm hover:bg-[#21262d]">
                    إغلاق
                  </button>
                  <button type="button" onClick={start} className="rounded bg-[#238636] px-3 py-1.5 text-sm font-bold text-white hover:bg-[#2ea043]">
                    إعادة المحاولة
                  </button>
                </div>
              </div>
            ) : null}

            {phase === 'done' ? (
              <div className="space-y-4">
                <p className="rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-300">
                  ✓ نُفِّذت العملية وسُجّلت في التدقيق.
                </p>
                <div className="flex justify-end">
                  <button type="button" onClick={close} className="rounded bg-[#238636] px-4 py-1.5 text-sm font-bold text-white hover:bg-[#2ea043]">
                    تم
                  </button>
                </div>
              </div>
            ) : null}

            {phase === 'preview' || phase === 'executing' ? (
              <div className="space-y-4">
                {dry?.preview ? (
                  <p className="rounded border border-[#30363d] bg-[#0d1117] px-3 py-2.5 text-sm">{dry.preview.summaryAr}</p>
                ) : null}

                {blocked ? (
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-red-300">لا يمكن التنفيذ — الشروط التالية غير محقّقة:</p>
                    <ul className="space-y-1">
                      {dry!.blockers.map((b) => (
                        <li key={b.code} className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                          {b.reasonAr}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {dry?.preview?.counts && Object.keys(dry.preview.counts).length ? (
                  <dl className="grid grid-cols-2 gap-2 text-xs">
                    {Object.entries(dry.preview.counts).map(([k, v]) => (
                      <div key={k} className="rounded border border-[#30363d] bg-[#0d1117] px-3 py-2">
                        <dt className="text-[#8b949e]" dir="ltr">
                          {k}
                        </dt>
                        <dd className="mt-0.5 text-base font-bold tabular-nums">{v.toLocaleString('ar-SA-u-nu-latn')}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}

                {dry?.preview?.monetaryDeltasHalalas &&
                Object.keys(dry.preview.monetaryDeltasHalalas).length ? (
                  <dl className="space-y-1">
                    {Object.entries(dry.preview.monetaryDeltasHalalas).map(([k, v]) => (
                      <div
                        key={k}
                        className={`flex items-center justify-between rounded border px-3 py-2 text-sm ${
                          isNonZeroHalalas(v)
                            ? 'border-red-500/40 bg-red-500/10 text-red-200'
                            : 'border-[#30363d] bg-[#0d1117] text-[#8b949e]'
                        }`}
                      >
                        <dt dir="ltr">{k}</dt>
                        <dd className="font-bold tabular-nums">{formatSar(v)}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}

                {(dry?.preview?.before || dry?.preview?.after) && !blocked ? (
                  <details className="rounded border border-[#30363d] bg-[#0d1117] text-xs">
                    <summary className="cursor-pointer select-none px-3 py-2 text-[#8b949e]">قبل / بعد</summary>
                    <div className="grid gap-2 border-t border-[#30363d] p-3 sm:grid-cols-2" dir="ltr">
                      <pre className="overflow-x-auto whitespace-pre-wrap break-all text-[#8b949e]">
                        {JSON.stringify(dry?.preview?.before ?? null, null, 2)}
                      </pre>
                      <pre className="overflow-x-auto whitespace-pre-wrap break-all text-emerald-300/80">
                        {JSON.stringify(dry?.preview?.after ?? null, null, 2)}
                      </pre>
                    </div>
                  </details>
                ) : null}

                {!blocked && needsReason ? (
                  <label className="block">
                    <span className="mb-1 block text-xs text-[#8b949e]">
                      السبب (10 أحرف على الأقل — يُسجَّل في التدقيق)
                    </span>
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      minLength={10}
                      rows={2}
                      required
                      className="w-full rounded border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm outline-none focus:border-emerald-500"
                    />
                  </label>
                ) : null}

                {!blocked && isMoney ? (
                  <label className="block">
                    <span className="mb-1 block text-xs text-amber-300">
                      عملية مالية — اكتب «{CONFIRM_PHRASE}» للتأكيد
                    </span>
                    <input
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      className="w-full rounded border border-amber-500/40 bg-[#0d1117] px-3 py-2 text-sm outline-none focus:border-amber-500"
                    />
                  </label>
                ) : null}

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={close}
                    disabled={phase === 'executing'}
                    className="rounded border border-[#30363d] px-3 py-1.5 text-sm hover:bg-[#21262d] disabled:opacity-50"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={execute}
                    disabled={phase === 'executing' || !canExecute}
                    className={`rounded px-4 py-1.5 text-sm font-bold text-white disabled:opacity-50 ${
                      isMoney ? 'bg-red-600 hover:bg-red-500' : 'bg-[#238636] hover:bg-[#2ea043]'
                    }`}
                  >
                    {phase === 'executing' ? 'جارٍ التنفيذ…' : isMoney ? 'تنفيذ العملية المالية' : 'تنفيذ'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
