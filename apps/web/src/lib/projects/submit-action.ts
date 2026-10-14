'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? process.env.API_BASE_URL ?? 'http://localhost:4000';
export interface SubmissionResult { draftId?: string; error?: string; saved?: boolean }

/** A failed review submission keeps the saved draft and never creates a second project. */
export async function submitProjectAction(previous: SubmissionResult, formData: FormData): Promise<SubmissionResult> {
  const token = (await cookies()).get('wathba_session')?.value;
  if (!token) return { ...previous, error: 'انتهت جلستك. سجّل الدخول في تبويب آخر ثم أعد المحاولة.' };
  const get = (key: string) => String(formData.get(key) ?? '').trim();
  let draftId = previous.draftId || get('draftId') || undefined;
  if (draftId && !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(draftId)) return { error: 'رابط المسودة غير صالح.' };
  const saving = get('intent') === 'save';
  if (!saving && get('rulesAck') !== 'on') return { draftId, error: 'اقرأ القواعد وأكّد موافقتك قبل الإرسال.' };
  const body = {
    titleAr: get('titleAr'), shortDescAr: get('shortDescAr'),
    categoryId: get('categoryId') || undefined, region: get('region') || undefined,
    storyAr: get('storyAr'), fundingGoalHalalas: Math.round(Number(get('fundingGoalSar')) * 100),
    releaseThresholdPct: Number(get('releaseThresholdPct')), durationDays: Number(get('durationDays')),
    productSpecAr: get('productSpecAr') || undefined,
    expectedDeliveryDate: get('expectedDeliveryDate') || undefined,
  };
  const headers = { 'content-type': 'application/json', Authorization: `Bearer ${token}` };
  try {
    const response = await fetch(`${API_BASE}/v1/projects${draftId ? `/${draftId}` : ''}`, {
      method: draftId ? 'PATCH' : 'POST', headers, body: JSON.stringify(body), cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { draftId, error: message(data.message, 'تعذّر حفظ الطلب. راجع الحقول ثم أعد المحاولة.') };
    draftId = data.id;
    if (!draftId) return { error: 'لم يصل تأكيد الحفظ. افتح مشاريعي للتحقق قبل إعادة الإرسال.' };
    if (saving) return { draftId, saved: true };
    const submitted = await fetch(`${API_BASE}/v1/projects/${draftId}/submit`, { method: 'POST', headers, cache: 'no-store' });
    if (!submitted.ok) {
      const failure = await submitted.json().catch(() => ({}));
      return { draftId, error: message(failure.message, 'حُفظت المسودة، لكن تعذّر إرسالها للمراجعة. يمكنك إعادة المحاولة.') };
    }
  } catch {
    return { draftId, error: 'تعذّر الاتصال. بيانات النموذج باقية؛ أعد المحاولة بعد عودة الاتصال.' };
  }
  redirect(`/projects/dashboard/requests/${draftId}`);
}

function message(value: unknown, fallback: string): string {
  if (typeof value === 'string') {
    if (value.includes('KYC required')) return 'حُفظت المسودة. أكمل توثيق هويتك عبر نفاذ قبل إرسال الطلب للمراجعة.';
    return value;
  }
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) return value.join(' · ');
  return fallback;
}
