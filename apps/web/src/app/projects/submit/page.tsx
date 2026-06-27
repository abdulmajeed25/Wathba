import type { Metadata } from 'next';

import { SubmissionWizard } from '@/components/ventures/submission-wizard';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { getLocale } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const dict = await getDictionary(locale, 'ventures');
  return { title: dict.meta.submit };
}

export default async function ProjectsSubmitPage() {
  const locale = await getLocale();
  const dict = await getDictionary(locale, 'ventures');
  return (
    <div className="mx-auto w-full max-w-[960px] px-5 py-8">
      <SubmissionWizard locale={locale} dict={dict} />
    </div>
  );
}
