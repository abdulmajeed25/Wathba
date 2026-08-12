import { requireAdmin } from '../_lib/guard';
import { EnterForm } from './enter-form';

/**
 * OPS Part 1 — «دخول إلى مركز العمليات». Entering ops is an explicit act:
 * even with a live public ADMIN session, the operator re-enters their
 * password (and TOTP once enrolled) to mint the SEPARATE 60-minute session.
 */
export default async function OpsEnterPage() {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-1 text-xl font-bold">دخول إلى مركز العمليات</h1>
      <p className="mb-6 text-sm text-[#8b949e]">
        هذه جلسة منفصلة عن جلستك العامة: تنتهي بعد 60 دقيقة من الخمول، وكل
        محاولة دخول فاشلة تُسجَّل.
      </p>
      <EnterForm />
    </div>
  );
}
