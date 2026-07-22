// Gestion des compétences artisan (spec 2026-07-23-comod-tags-admin-design.md).
// Lecture session (tags lisibles par tous les authentifiés) ; le compteur
// d'usage est scopé résidence via la RLS d'artisan_tags.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/lib/i18n/routing';
import type { Locale } from '@/lib/i18n/config';
import { createClient } from '@/lib/supabase/server';
import { TagsAdmin } from './_components/tags-admin';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ locale: string }> };

function assertLocale(locale: string): asserts locale is Locale {
  if (!(routing.locales as readonly string[]).includes(locale)) notFound();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  assertLocale(locale);
  const t = await getTranslations({ locale, namespace: 'comod.admin.competences' });
  return { title: t('pageTitle') };
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  assertLocale(locale);
  setRequestLocale(locale);
  const t = await getTranslations('comod.admin.competences');

  const supabase = await createClient();
  const { data } = await supabase
    .from('tags')
    .select('key, label_fr, label_ar, artisan_tags(count)')
    .order('label_fr');

  const tags = (data ?? []).map((row) => ({
    key: row.key,
    labelFr: row.label_fr,
    labelAr: row.label_ar,
    usageCount: row.artisan_tags?.[0]?.count ?? 0,
  }));

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-[28px] font-semibold tracking-tight text-neutral-900">{t('title')}</h1>
        <p className="text-base text-neutral-700">{t('intro')}</p>
      </header>
      <TagsAdmin tags={tags} />
    </section>
  );
}
