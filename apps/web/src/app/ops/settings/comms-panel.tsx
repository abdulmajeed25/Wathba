'use client';

import { useCallback, useEffect, useState } from 'react';

import { Badge, StatusBadge } from '../_components/badge';
import { OpRunner } from '../_components/op-runner';
import {
  NOTIFICATION_DISABLED_KINDS_KEY,
  NOTIFICATION_KINDS,
} from './comms-labels';

/**
 * OPS-GAPS Y2 — «الاتصالات» interactive surface. Two panels:
 *
 *  1. Email templates — a selectable list (labelAr / key / critical / مُعدَّل)
 *     feeding an editor. The detail (default sample + current override) is
 *     fetched lazily via the generic read BFF when a row is picked. Saving is
 *     `comms.template.set`, «إرجاع للأصل» is `comms.template.reset` (only when
 *     an override exists), «إرسال تجريبي» is `comms.template.test-send` — all
 *     governed <OpRunner> flows. A live preview renders `effectiveBodyPreview`.
 *
 *  2. Notification kinds — an enable/disable toggle per NotificationKind backed
 *     by the `notifications.disabledKinds` settings key (edited via the shared
 *     `settings.update` op). Locked (transactional) kinds show an «إلزامي»
 *     badge and no toggle; the backend refine is the true guard.
 *
 * If the backend contract isn't live the parent degrades to an amber note and
 * never mounts this panel with fabricated rows.
 */

export interface TemplateListItem {
  key: string;
  labelAr: string;
  critical: boolean;
  variablesAr: string[];
  hasOverride: boolean;
  effectiveSubject: string;
  effectiveBodyPreview: string;
}

interface TemplateDetail {
  key: string;
  labelAr: string;
  critical: boolean;
  variablesAr: string[];
  hasOverride: boolean;
  effectiveSubject: string;
  effectiveBodyPreview: string;
  /** Default sample the platform ships with. */
  sampleSubject: string;
  sampleBody: string;
  /** Current DB override (null when none). */
  subjectAr: string | null;
  bodyAr: string | null;
}

const INPUT =
  'w-full rounded border border-[#30363d] bg-[#0d1117] px-3 py-1.5 text-sm outline-none focus:border-emerald-500';

/** Defensive normaliser — the detail endpoint's exact shape may nest the
 *  override under `override:{subjectAr,bodyAr}` or hoist it to the top level. */
function normaliseDetail(raw: unknown, fallback: TemplateListItem): TemplateDetail {
  const o = (raw ?? {}) as Record<string, unknown>;
  const ov = (o.override ?? null) as Record<string, unknown> | null;
  const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
  return {
    key: str(o.key) ?? fallback.key,
    labelAr: str(o.labelAr) ?? fallback.labelAr,
    critical: typeof o.critical === 'boolean' ? o.critical : fallback.critical,
    variablesAr: Array.isArray(o.variablesAr)
      ? (o.variablesAr as unknown[]).map(String)
      : fallback.variablesAr,
    hasOverride: typeof o.hasOverride === 'boolean' ? o.hasOverride : fallback.hasOverride,
    effectiveSubject: str(o.effectiveSubject) ?? fallback.effectiveSubject,
    effectiveBodyPreview: str(o.effectiveBodyPreview) ?? fallback.effectiveBodyPreview,
    sampleSubject: str(o.sampleSubject) ?? str(o.defaultSubject) ?? fallback.effectiveSubject,
    sampleBody: str(o.sampleBody) ?? str(o.defaultBody) ?? '',
    subjectAr: str(ov?.subjectAr) ?? str(o.subjectAr),
    bodyAr: str(ov?.bodyAr) ?? str(o.bodyAr),
  };
}

function TemplateEditor({
  item,
  operatorEmail,
}: {
  item: TemplateListItem;
  operatorEmail: string;
}) {
  const [detail, setDetail] = useState<TemplateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subjectAr, setSubjectAr] = useState('');
  const [bodyAr, setBodyAr] = useState('');
  const [to, setTo] = useState(operatorEmail);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/ops/read/comms/templates/${item.key}`);
      if (r.status === 404) {
        setError('building');
        setLoading(false);
        return;
      }
      if (!r.ok) {
        setError('تعذّر تحميل القالب.');
        setLoading(false);
        return;
      }
      const d = normaliseDetail(await r.json(), item);
      setDetail(d);
      // Seed with the current override when present, else the shipped sample.
      setSubjectAr(d.subjectAr ?? d.sampleSubject ?? d.effectiveSubject);
      setBodyAr(d.bodyAr ?? d.sampleBody ?? '');
    } catch {
      setError('تعذّر الوصول إلى الخادم.');
    }
    setLoading(false);
  }, [item]);

  useEffect(() => {
    void load();
  }, [load]);

  const previewHtml = detail?.effectiveBodyPreview ?? item.effectiveBodyPreview;
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to);
  const dirty = subjectAr.trim().length > 0 && bodyAr.trim().length > 0;

  if (loading) {
    return <p className="py-8 text-center text-sm text-[#8b949e]">جارٍ تحميل القالب…</p>;
  }
  if (error === 'building') {
    return (
      <p className="rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
        قيد الإنشاء — لم يُنشر تفصيل هذا القالب بعد.
      </p>
    );
  }
  if (error) {
    return (
      <div className="space-y-3">
        <p className="rounded border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded border border-[#30363d] px-3 py-1.5 text-sm hover:bg-[#21262d]"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-bold">{item.labelAr}</h3>
        <code dir="ltr" className="text-[11px] text-[#8b949e]">
          {item.key}
        </code>
        {item.critical ? <StatusBadge intent="danger">حرِج</StatusBadge> : null}
        {(detail?.hasOverride ?? item.hasOverride) ? (
          <StatusBadge intent="info">مُعدَّل</StatusBadge>
        ) : (
          <StatusBadge intent="muted">افتراضي</StatusBadge>
        )}
      </div>

      <label className="block">
        <span className="mb-1 block text-xs text-[#8b949e]">عنوان الرسالة (subjectAr)</span>
        <input
          value={subjectAr}
          onChange={(e) => setSubjectAr(e.target.value)}
          className={INPUT}
          dir="rtl"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs text-[#8b949e]">نص الرسالة (bodyAr)</span>
        <textarea
          value={bodyAr}
          onChange={(e) => setBodyAr(e.target.value)}
          rows={8}
          className={`${INPUT} font-mono leading-relaxed`}
          dir="rtl"
        />
      </label>

      {detail?.variablesAr?.length ? (
        <div className="space-y-1.5">
          <span className="block text-xs text-[#8b949e]">المتغيّرات المتاحة:</span>
          <div className="flex flex-wrap gap-1.5">
            {detail.variablesAr.map((v) => (
              <Badge key={v} className="border-[#30363d] bg-[#0d1117] text-[#8b949e]">
                <code dir="ltr">{v}</code>
              </Badge>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <OpRunner
          opKey="comms.template.set"
          input={{ key: item.key, subjectAr, bodyAr }}
          triggerLabel="حفظ"
          riskTier="SENSITIVE"
          requiresReason
          variant="primary"
          disabled={!dirty}
          onDone={() => window.location.reload()}
        />
        {(detail?.hasOverride ?? item.hasOverride) ? (
          <OpRunner
            opKey="comms.template.reset"
            input={{ key: item.key }}
            triggerLabel="إرجاع للأصل"
            riskTier="SENSITIVE"
            requiresReason
            variant="danger"
            onDone={() => window.location.reload()}
          />
        ) : null}
      </div>

      {/* Live preview — renders the server-computed effective HTML. This is
          operator-authored, admin-only content behind ops auth + step-up, so
          dangerouslySetInnerHTML in this isolated bordered box is acceptable
          (trusted-admin content, never end-user input). */}
      <div className="space-y-1.5">
        <span className="block text-xs text-[#8b949e]">معاينة (القالب الفعّال):</span>
        <div
          dir="rtl"
          className="max-h-64 overflow-auto rounded-lg border border-[#30363d] bg-white p-4 text-sm text-black"
          dangerouslySetInnerHTML={{ __html: previewHtml ?? '' }}
        />
      </div>

      {/* Test-send. Tier/reason discovered from the descriptor so the flow
          matches whatever the backend declares for this op. */}
      <div className="space-y-1.5 rounded-lg border border-[#21262d] bg-[#0d1117] p-3">
        <span className="block text-xs text-[#8b949e]">إرسال نسخة تجريبية إلى:</span>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            type="email"
            dir="ltr"
            className={`${INPUT} max-w-xs`}
          />
          <OpRunner
            opKey="comms.template.test-send"
            input={{ key: item.key, to }}
            triggerLabel="إرسال تجريبي"
            variant="ghost"
            disabled={!emailOk}
          />
        </div>
      </div>
    </div>
  );
}

function TemplatesPanel({
  templates,
  operatorEmail,
}: {
  templates: TemplateListItem[];
  operatorEmail: string;
}) {
  const [selected, setSelected] = useState<string | null>(templates[0]?.key ?? null);
  const active = templates.find((t) => t.key === selected) ?? null;

  if (templates.length === 0) {
    return (
      <p className="rounded border border-[#30363d] bg-[#161b22] px-4 py-3 text-sm text-[#8b949e]">
        لا قوالب لعرضها.
      </p>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_1fr]">
      <ul className="space-y-1.5">
        {templates.map((t) => {
          const isActive = t.key === selected;
          return (
            <li key={t.key}>
              <button
                type="button"
                onClick={() => setSelected(t.key)}
                aria-current={isActive ? 'true' : undefined}
                className={`w-full rounded-lg border px-3 py-2 text-right transition ${
                  isActive
                    ? 'border-emerald-500/50 bg-emerald-500/10'
                    : 'border-[#21262d] bg-[#161b22] hover:border-[#30363d]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{t.labelAr}</span>
                  <span className="flex items-center gap-1">
                    {t.critical ? <StatusBadge intent="danger">حرِج</StatusBadge> : null}
                    {t.hasOverride ? <StatusBadge intent="info">مُعدَّل</StatusBadge> : null}
                  </span>
                </div>
                <code dir="ltr" className="mt-0.5 block text-[11px] text-[#8b949e]">
                  {t.key}
                </code>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="rounded-lg border border-[#21262d] bg-[#161b22] p-4">
        {active ? (
          <TemplateEditor key={active.key} item={active} operatorEmail={operatorEmail} />
        ) : (
          <p className="text-sm text-[#8b949e]">اختر قالباً من القائمة.</p>
        )}
      </div>
    </div>
  );
}

function KindsPanel({ disabledKinds }: { disabledKinds: string[] }) {
  const disabled = new Set(disabledKinds);
  const kinds = Object.entries(NOTIFICATION_KINDS);

  return (
    <div className="space-y-2">
      <p className="text-xs text-[#8b949e]">
        تعطيل نوع إشعار يُوقف إرساله للمستخدمين. الأنواع المعاملاتية إلزامية ولا يمكن تعطيلها
        (يرفضها الخادم).
      </p>
      <ul className="divide-y divide-[#21262d] rounded-lg border border-[#21262d] bg-[#161b22]">
        {kinds.map(([kind, meta]) => {
          const isDisabled = disabled.has(kind);
          // Toggling builds the next disabledKinds array; the shared
          // settings.update op persists it (backend refine rejects locked kinds).
          const nextValue = isDisabled
            ? disabledKinds.filter((k) => k !== kind)
            : [...disabledKinds, kind];
          return (
            <li
              key={kind}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
            >
              <div className="min-w-0">
                <span className="text-sm">{meta.labelAr}</span>
                <code dir="ltr" className="mt-0.5 block text-[11px] text-[#8b949e]">
                  {kind}
                </code>
              </div>
              {meta.locked ? (
                <StatusBadge intent="warn">إلزامي</StatusBadge>
              ) : (
                <div className="flex items-center gap-2">
                  {isDisabled ? (
                    <StatusBadge intent="muted">مُعطَّل</StatusBadge>
                  ) : (
                    <StatusBadge intent="ok">مُفعَّل</StatusBadge>
                  )}
                  <OpRunner
                    opKey="settings.update"
                    input={{ key: NOTIFICATION_DISABLED_KINDS_KEY, value: nextValue }}
                    triggerLabel={isDisabled ? 'تفعيل' : 'تعطيل'}
                    riskTier="SENSITIVE"
                    requiresReason
                    variant="ghost"
                    onDone={() => window.location.reload()}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function CommsPanel({
  templates,
  disabledKinds,
  operatorEmail,
}: {
  templates: TemplateListItem[];
  disabledKinds: string[];
  operatorEmail: string;
}) {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-base font-bold">قوالب البريد الإلكتروني</h2>
        <TemplatesPanel templates={templates} operatorEmail={operatorEmail} />
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-bold">أنواع الإشعارات</h2>
        <KindsPanel disabledKinds={disabledKinds} />
      </section>
    </div>
  );
}
