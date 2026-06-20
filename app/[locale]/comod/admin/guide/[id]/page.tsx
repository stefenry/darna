// Story 3.5 — édition entrée Guide (co_mod). notFound si id absent/autre résidence.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/lib/i18n/routing';
import type { Locale } from '@/lib/i18n/config';
import { AdminEditorView } from '../../_components/admin-page-views';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ locale: string; id: string }> };

function assertLocale(locale: string): asserts locale is Locale {
  if (!(routing.locales as readonly string[]).includes(locale)) notFound();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  assertLocale(locale);
  const t = await getTranslations({ locale, namespace: 'comod.admin' });
  return { title: t('edit') };
}

export default async function Page({ params }: Props) {
  const { locale, id } = await params;
  assertLocale(locale);
  setRequestLocale(locale);
  return <AdminEditorView kind="guide" mode="edit" id={id} locale={locale} />;
}
