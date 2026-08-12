import { permanentRedirect } from 'next/navigation';

/**
 * Batch ACCOUNT / U5 — this route is now /activity.
 *
 * It never rendered a profile. It rendered the reader's backings and saved
 * projects while wearing the label «الملف الشخصي», one row below «ملفي العام»
 * which went to the real profile — two menu entries that both read as "profile"
 * and led to different places. The audit verdict was DISTINCT, so the page is
 * kept and renamed rather than deleted.
 *
 * 308 and not a rewrite: the old URL is in browser histories and in at least
 * one in-product link, and it should stop being a second address for the same
 * page rather than quietly keep working forever.
 */
export default function LegacyProfileRedirect(): never {
  permanentRedirect('/activity');
}
