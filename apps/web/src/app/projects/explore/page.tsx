import type { Metadata } from 'next';

import { VenturesExploreView } from '@/components/ventures/explore-view';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { getLocale } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const dict = await getDictionary(locale, 'ventures');
  return { title: dict.meta.explore };
}

export default async function ProjectsExplorePage() {
  const locale = await getLocale();
  const dict = await getDictionary(locale, 'ventures');
  return (
    <div className="mx-auto w-full max-w-[1080px] px-5 py-8">
      <VenturesExploreView locale={locale} dict={dict} />
    </div>
  );
}
