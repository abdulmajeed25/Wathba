/**
 * OPS-GAPS Y2 — «الاتصالات» shared label maps. PLAIN module (no 'use client'):
 * imported by both the server page and the client islands, so it must NOT
 * export React or client-only helpers (the label maps only).
 *
 * The NotificationKind universe mirrors prisma `enum NotificationKind`.
 *
 * CLOSEOUT C2 — the `locked` flag is now only a FALLBACK. The comms read
 * endpoint returns the server's real LOCKED_NOTIFICATION_KINDS and the panel
 * prefers it, because these two hand-maintained lists had already drifted: this
 * map marked five kinds mandatory that the server was willing to silence. That
 * drift was resolved in the SAFE direction: the four money-safety kinds
 * (CAPTURE_GRACE, PLEDGE_CANCELLED, MILESTONE_APPROVED/REJECTED) are now locked
 * on the SERVER too, while the RFQ outcome notices — commercial courtesy, not
 * money safety — are genuinely silenceable. The server remains the truth.
 */

export interface KindMeta {
  labelAr: string;
  /** Transactional/money-critical → never silenceable (server-enforced). */
  locked: boolean;
}

export const NOTIFICATION_KINDS: Record<string, KindMeta> = {
  // Money / transactional / account — LOCKED (server refuses to silence these).
  PLEDGE_RECEIVED: { labelAr: 'استلام تعهّد', locked: true },
  PROJECT_FUNDED: { labelAr: 'اكتمال تمويل المشروع', locked: true },
  PROJECT_FAILED: { labelAr: 'إخفاق تمويل المشروع', locked: true },
  MILESTONE_APPROVED: { labelAr: 'اعتماد مرحلة', locked: true },
  MILESTONE_REJECTED: { labelAr: 'رفض مرحلة', locked: true },
  PAYOUT_SENT: { labelAr: 'إرسال دفعة صرف', locked: true },
  REFUND_COMPLETED: { labelAr: 'اكتمال استرداد', locked: true },
  PLEDGE_CANCELLED: { labelAr: 'إلغاء تعهّد', locked: true },
  CAPTURE_GRACE: { labelAr: 'مهلة سحب المبلغ', locked: true },
  ACCOUNT_SUSPENDED: { labelAr: 'تعليق حساب', locked: true },
  ACCOUNT_REACTIVATED: { labelAr: 'إعادة تفعيل حساب', locked: true },
  APPEAL_DECIDED: { labelAr: 'بتّ في تظلّم', locked: true },
  SUPPLIER_VERIFIED: { labelAr: 'توثيق مورّد', locked: true },
  RFQ_AWARDED: { labelAr: 'ترسية طلب عرض سعر', locked: false },
  RFQ_DECIDED: { labelAr: 'نتيجة طلب عرض سعر (لغير الفائزين)', locked: false },

  // Engagement / informational — silenceable.
  UPDATE_POSTED: { labelAr: 'نشر تحديث', locked: false },
  CREATOR_NEW_PROJECT: { labelAr: 'مشروع جديد من منشئ تتابعه', locked: false },
  RANK_UP: { labelAr: 'ترقية رتبة', locked: false },
  CONTEST_OPENED: { labelAr: 'فتح مسابقة', locked: false },
  CONTEST_ANNOUNCED: { labelAr: 'إعلان نتائج مسابقة', locked: false },
  FAQ_ANSWERED: { labelAr: 'الإجابة على سؤال', locked: false },
  COMMENT_REPLY: { labelAr: 'ردّ على تعليق', locked: false },
  PROJECT_REVIEWED: { labelAr: 'مراجعة مشروع', locked: false },
  APPEAL_RECEIVED: { labelAr: 'استلام تظلّم', locked: false },
};

export const NOTIFICATION_DISABLED_KINDS_KEY = 'notifications.disabledKinds';

export function kindLabel(kind: string): string {
  return NOTIFICATION_KINDS[kind]?.labelAr ?? kind;
}

export function isKindLocked(kind: string): boolean {
  return NOTIFICATION_KINDS[kind]?.locked ?? false;
}
