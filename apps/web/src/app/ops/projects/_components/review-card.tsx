'use client';

import { useState } from 'react';

import { OpRunner } from '../../_components/op-runner';
import { formatSar } from '../../_lib/money';
import type { ProjectRow } from './status';

/**
 * OPS Phase 2 — a single review-queue card. The reviewer eyeballs a static
 * checklist, picks a canned Arabic feedback template (or writes their own),
 * then decides via governed OpRunners. Reject/request-changes carry the
 * structured feedback as the op's `feedbackAr` input (the OpRunner's own
 * reason is the audit note). Approve needs no feedback.
 *
 * Reviewer ASSIGNMENT is out of scope — no endpoint mints/claims a queue
 * item, so cards are shared; the note in the page header says so.
 */

const CHECKLIST: string[] = [
  'المحتوى يلتزم سياسة النشر (لا خطاب كراهية/تضليل/محظورات)',
  'المشروع يناسب الفئة المصنَّف تحتها',
  'خارج قوائم الاستثناء (لا سلاح/مقامرة/محرّمات/ادعاءات طبية)',
  'المكافآت منطقية وقابلة للتسليم ومتناسبة مع الأسعار',
  'هدف التمويل واقعي ومبرَّر بخطة الإنتاج',
  'الوسائط والملكية الفكرية سليمة (لا انتهاك حقوق طرف ثالث)',
];

const TEMPLATES: Array<{ labelAr: string; textAr: string }> = [
  { labelAr: '— اختر قالب ملاحظات —', textAr: '' },
  {
    labelAr: 'الفئة غير مناسبة',
    textAr: 'المشروع مصنَّف تحت فئة غير مناسبة لطبيعته. يُرجى إعادة تصنيفه ضمن الفئة الأنسب ثم إعادة التقديم.',
  },
  {
    labelAr: 'المكافآت غير واضحة',
    textAr: 'وصف المكافآت غير كافٍ لتقييم قابلية التسليم. يُرجى تفصيل كل مكافأة (المحتوى والكمية والجدول الزمني) وإعادة التقديم.',
  },
  {
    labelAr: 'هدف التمويل غير مبرَّر',
    textAr: 'هدف التمويل يحتاج إلى تبرير أوضح عبر خطة إنتاج/ميزانية تفصيلية. يُرجى إضافتها وإعادة التقديم.',
  },
  {
    labelAr: 'الوسائط/الملكية الفكرية',
    textAr: 'توجد وسائط قد تنتهك حقوق طرف ثالث أو تفتقر إلى إثبات الملكية. يُرجى استبدالها بوسائط أصلية موثّقة وإعادة التقديم.',
  },
  {
    labelAr: 'مخالفة سياسة المحتوى',
    textAr: 'المحتوى يخالف سياسة النشر. يُرجى مراجعة إرشادات المحتوى وتعديل المشروع بما يتوافق معها ثم إعادة التقديم.',
  },
];

function ageLabel(createdAt: string): { text: string; overdue: boolean } {
  const ms = Date.now() - new Date(createdAt).getTime();
  const hours = Math.floor(ms / 3_600_000);
  const overdue = hours >= 48;
  if (hours < 1) return { text: 'أقل من ساعة', overdue };
  if (hours < 24) return { text: `${hours.toLocaleString('ar-SA')} ساعة`, overdue };
  const days = Math.floor(hours / 24);
  return { text: `${days.toLocaleString('ar-SA')} يوم`, overdue };
}

export function ReviewCard({ project }: { project: ProjectRow }) {
  const [feedback, setFeedback] = useState('');
  const feedbackOk = feedback.trim().length >= 1;
  const age = ageLabel(project.createdAt);

  return (
    <div className="space-y-4 rounded-lg border border-[#30363d] bg-[#161b22] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold">{project.titleAr}</h2>
          <p className="mt-1 text-xs text-[#8b949e]">
            {project.categoryNameAr ?? 'بلا فئة'} · الهدف {formatSar(project.goalHalalas)} ·{' '}
            {project.createdBy ? (
              <span dir="ltr" className="font-mono">
                @{project.createdBy}
              </span>
            ) : (
              'مبدع غير معروف'
            )}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className={`rounded border px-2 py-0.5 text-[11px] ${
              age.overdue
                ? 'border-red-500/40 bg-red-500/10 text-red-300'
                : 'border-amber-500/40 bg-amber-500/10 text-amber-300'
            }`}
          >
            في الطابور منذ {age.text}
            {age.overdue ? ' — تجاوز SLA' : ''}
          </span>
          <a
            href={`/projects/${project.id}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-[#58a6ff] hover:underline"
          >
            معاينة الصفحة العامة ↗
          </a>
          <a
            href={`/ops/projects/${project.id}`}
            className="text-xs text-[#58a6ff] hover:underline"
          >
            مساحة العمل الكاملة ←
          </a>
        </div>
      </div>

      <fieldset className="rounded border border-[#30363d] bg-[#0d1117] p-3">
        <legend className="px-1 text-xs text-[#8b949e]">قائمة الفحص (تحقّق يدوي)</legend>
        <ul className="space-y-1.5">
          {CHECKLIST.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                id={`chk-${project.id}-${i}`}
                className="mt-0.5 h-4 w-4 accent-emerald-600"
              />
              <label htmlFor={`chk-${project.id}-${i}`}>{item}</label>
            </li>
          ))}
        </ul>
      </fieldset>

      <div className="space-y-2">
        <label className="block text-xs text-[#8b949e]">
          ملاحظات منظَّمة للمبدع (تُرسل مع الرفض/طلب التعديل)
        </label>
        <select
          aria-label="قالب ملاحظات جاهز"
          onChange={(e) => {
            if (e.target.value) setFeedback(e.target.value);
          }}
          defaultValue=""
          className="w-full rounded border border-[#30363d] bg-[#0d1117] px-3 py-1.5 text-sm"
        >
          {TEMPLATES.map((t, i) => (
            <option key={i} value={t.textAr}>
              {t.labelAr}
            </option>
          ))}
        </select>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          rows={3}
          placeholder="اكتب الملاحظات أو اختر قالباً أعلاه…"
          className="w-full rounded border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm outline-none focus:border-emerald-500"
        />
      </div>

      <div className="flex flex-wrap gap-2 border-t border-[#21262d] pt-3">
        <OpRunner
          opKey="projects.review.approve"
          input={{ projectId: project.id }}
          triggerLabel="اعتماد"
          variant="primary"
          requiresReason={false}
          riskTier="STANDARD"
        />
        <OpRunner
          opKey="projects.review.reject"
          input={{ projectId: project.id, feedbackAr: feedback.trim() || undefined }}
          triggerLabel="رفض"
          variant="danger"
          disabled={!feedbackOk}
          requiresReason
          riskTier="STANDARD"
        />
        <OpRunner
          opKey="projects.review.reject"
          input={{ projectId: project.id, feedbackAr: feedback.trim() || undefined }}
          triggerLabel="طلب تعديلات (يعيده للمسودة)"
          variant="ghost"
          disabled={!feedbackOk}
          requiresReason
          riskTier="STANDARD"
        />
      </div>
      {!feedbackOk ? (
        <p className="text-xs text-[#484f58]">
          الرفض وطلب التعديل يتطلّبان ملاحظات مكتوبة — الاعتماد لا يتطلّبها.
        </p>
      ) : null}
    </div>
  );
}
