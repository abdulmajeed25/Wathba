'use client';

import { useRef } from 'react';
import { useRouter } from 'next/navigation';
import { OpRunner } from '../_components/op-runner';

function summarize(result: unknown): { message: string; intent: 'ok' | 'warn' } {
  const r = result as { outcome?: string; queued?: boolean } | null;
  if (r?.queued) return { intent: 'warn', message: 'أُرسل طلب التحقق للمراجعة؛ لم يُنفذ بعد.' };
  if (r?.outcome === 'confirmed') return { intent: 'ok', message: 'أكد المزود رد المبلغ كاملًا، وحُفظت النتيجة المالية.' };
  if (r?.outcome === 'partial') return { intent: 'warn', message: 'أفاد المزود برد جزء فقط؛ بقيت المحاولة للمراجعة ولم يُعتمد الرد الكامل.' };
  if (r?.outcome === 'pending') return { intent: 'warn', message: 'لم يؤكد المزود الاسترداد بعد؛ بقي المبلغ محجوزًا ولم يُرسل طلب استرداد جديد.' };
  return { intent: 'warn', message: 'لم تصل نتيجة تحقق واضحة؛ راجع سجل العملية قبل اتخاذ إجراء آخر.' };
}

function summarizeVoid(result: unknown): { message: string; intent: 'ok' | 'warn' } {
  const r = result as { outcome?: string; queued?: boolean } | null;
  if (r?.queued) return { intent: 'warn', message: 'أُرسل طلب التحقق للمراجعة؛ لم يُنفذ بعد.' };
  if (r?.outcome === 'confirmed') return { intent: 'ok', message: 'أكد المزود فك الحجز. حُفظت النتيجة دون تغيير رصيد الحملة أو المخزون.' };
  return { intent: 'warn', message: 'لم يتأكد فك الحجز؛ بقي التعهد غير محتسب وللمراجعة، ولم يُرسل طلب فك جديد.' };
}

function summarizeHeld(result: unknown): { message: string; intent: 'ok' | 'warn' } {
  const r = result as { outcome?: string; action?: string; queued?: boolean } | null;
  if (r?.queued) return { intent: 'warn', message: 'أُرسل طلب التحقق للمراجعة؛ لم يُنفذ بعد.' };
  if (r?.outcome === 'uncharged') return { intent: 'warn', message: 'أكد المزود عدم التحصيل وانتهاء محاولة الدفع. يمكن تحديث البطاقة داخل المهلة؛ انتهاء المهلة يخضع للمراجعة قبل تحرير المكافأة.' };
  if (r?.outcome === 'confirmed') return { intent: 'ok', message: ['CAPTURE', 'AUTHORIZE'].includes(r.action ?? '')
    ? 'أكد المزود تحصيل المبلغ كاملًا، وحُفظ الرصيد والسجل المالي.'
    : 'أكد المزود فك الحجز، وحُدّث تمويل الحملة والمخزون.' };
  return { intent: 'warn', message: r?.action === 'REAUTHORIZE'
    ? 'ظهور الحجز لدى المزود لا يثبت تجديد مدته. بقيت المحاولة للمراجعة دون طلب مالي جديد.'
    : 'لم تتأكد نتيجة العملية؛ بقيت المحاولة قيد التحقق، ولم يُرسل طلب مالي جديد.' };
}

function summarizeReplacement(result: unknown): { message: string; intent: 'ok' | 'warn' } {
  const r = result as { ok?: boolean; queued?: boolean } | null;
  if (r?.queued) return { intent: 'warn', message: 'أُرسل طلب استكمال التحصيل للمراجعة؛ لم يُنفذ بعد.' };
  if (r?.ok) return { intent: 'ok', message: 'تأكد تحصيل البطاقة الجديدة وحُفظ الرصيد والسجل المالي.' };
  return { intent: 'warn', message: 'لم يتأكد التحصيل؛ تحقّق من نتيجة المحاولة قبل أي طلب آخر.' };
}

function summarizeAuthorization(result: unknown): { message: string; intent: 'ok' | 'warn' } {
  const r = result as { outcome?: string; queued?: boolean } | null;
  if (r?.queued) return { intent: 'warn', message: 'أُرسل طلب قراءة الحجز للمراجعة؛ لم يُنفذ بعد.' };
  if (r?.outcome === 'confirmed') return { intent: 'ok', message: 'تأكد الحجز واحتُسب الدعم وفق الشروط الأصلية والمخزون المتاح.' };
  if (r?.outcome === 'uncharged') return { intent: 'warn', message: 'ثبت أن المحاولة لم تحصّل مبلغًا؛ لم تزد عدادات الحملة أو المخزون.' };
  return { intent: 'warn', message: r?.outcome === 'challenge' ? 'يلزم الداعم إكمال تحقق البنك من حسابه؛ لم يُحتسب الدعم بعد.' : 'تحتاج شروط الحجز إلى مراجعة. لم يُحتسب دعم جديد ولم يُرسل طلب مالي آخر.' };
}

function summarizeRelease(result: unknown): { message: string; intent: 'ok' | 'warn' } {
  const r = result as { ok?: boolean; queued?: boolean } | null;
  if (r?.queued) return { intent: 'warn', message: 'أُرسل طلب فك الحجز للمراجعة؛ لم يُنفذ بعد.' };
  if (r?.ok) return { intent: 'ok', message: 'تأكد فك الحجز غير المحتسب. لم ينقص رصيد الحملة أو مخزونها.' };
  return { intent: 'warn', message: 'لم يتأكد فك الحجز؛ تحقّق من نتيجة المحاولة المحفوظة قبل أي إجراء آخر.' };
}

const actions = {
  refund: { key: 'money.refund.reconcile', label: 'التحقق من الاسترداد', summarize },
  void: { key: 'money.void.reconcile', label: 'التحقق من فك الحجز', summarize: summarizeVoid },
  held: { key: 'money.hold.reconcile', label: 'التحقق من العملية المالية', summarize: summarizeHeld },
  replacement: { key: 'money.replacement.capture', label: 'استكمال تحصيل البطاقة الجديدة', summarize: summarizeReplacement },
  authorization: { key: 'money.authorization.reconcile', label: 'التحقق من الحجز الأول', summarize: summarizeAuthorization },
  release: { key: 'money.authorization.release', label: 'فك الحجز غير المحتسب', summarize: summarizeRelease },
};

export function RefundVerificationAction({ pledgeId, kind = 'refund' }: { pledgeId: string; kind?: keyof typeof actions }) {
  const router = useRouter();
  const completed = useRef(false);
  const action = actions[kind];
  return <OpRunner opKey={action.key} input={{ pledgeId }}
    triggerLabel={action.label} riskTier="MONEY" requiresReason variant="ghost"
    summarizeResult={action.summarize} onDone={() => { completed.current = true; }}
    onClose={() => { if (completed.current || kind === 'replacement' || kind === 'release') { completed.current = false; router.refresh(); } }} />;
}
