import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { LedgerView } from '@/components/ventures/ledger-view';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { getLocale } from '@/lib/i18n/server';
import { findVenture, getLedgerEntries } from '@/lib/ventures/fixtures';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const venture = findVenture(id);
  return { title: venture ? `Ledger · ${venture.name}` : id };
}

export default async function ProjectLedgerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = await getLocale();
  const dict = await getDictionary(locale, 'ventures');
  const venture = findVenture(id);
  if (!venture) notFound();
  const entries = getLedgerEntries(venture.id);
  return (
    <div className="mx-auto w-full max-w-[1080px] px-5 py-8">
      <LedgerView locale={locale} dict={dict} venture={venture} entries={entries} />
    </div>
  );
}
