import { permanentRedirect } from 'next/navigation';

/**
 * Batch ACCOUNT §2.1 — this route is now /activity.
 *
 * It never rendered a profile. It rendered the signed-in reader's backings and
 * saved projects while carrying the label «الملف الشخصي», sitting one row
 * below «ملفي العام» which pointed at the real profile — two menu entries that
 * both read as "profile" and went to different places. The audit's verdict was
 * DISTINCT, so the page is kept and renamed rather than deleted.
 *
 * 308 (permanentRedirect) and not a rewrite: the old URL is in browser
 * histories and in at least one in-product link, and it should stop being a
 * second address for the same page rather than quietly keep working forever.
 */
export default function LegacyProfileRedirect(): never {
  permanentRedirect('/activity');
}
