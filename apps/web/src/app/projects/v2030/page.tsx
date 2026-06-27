import type { Metadata } from 'next';

import { V2030View } from '@/components/ventures/v2030-view';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { getLocale } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const dict = await getDictionary(locale, 'ventures');
  return { title: dict.meta.v2030 };
}

export default async function ProjectsV2030Page() {
  const locale = await getLocale();
  const dict = await getDictionary(locale, 'ventures');
  return (
    <div className="mx-auto w-full max-w-[1080px] px-5 py-8">
      <V2030View locale={locale} dict={dict} />
    </div>
  );
}
