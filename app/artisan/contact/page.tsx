// Story 2.8 — page publique « contacter Darna en tant qu'artisan » (HORS
// `[locale]`, calque /consent/[token]). Demande un magic-link de droit de réponse
// par téléphone. Aucune session. Toggle FR/AR via `?lang=`. robots:noindex.

import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';
import type { Locale } from '@/lib/i18n/config';
import { ContactForm } from './_components/contact-form';

export const dynamic = 'force-dynamic';

const zLang = z.enum(['fr', 'ar']).catch('fr');

type Props = { searchParams: Promise<{ lang?: string | string[] }> };

function localeFrom(lang: string | string[] | undefined): Locale {
  const candidate = Array.isArray(lang) ? lang[0] : lang;
  return zLang.parse(candidate ?? 'fr');
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { lang } = await searchParams;
  const t = await getTranslations({ locale: localeFrom(lang), namespace: 'artisanContact' });
  return { title: t('pageTitle'), robots: { index: false } };
}

export default async function ArtisanContactPage({ searchParams }: Props) {
  const { lang } = await searchParams;
  const locale = localeFrom(lang);
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const otherLang = locale === 'ar' ? 'fr' : 'ar';
  const t = await getTranslations({ locale, namespace: 'artisanContact' });

  return (
    <main dir={dir} className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-10">
      <div className="flex justify-end">
        <Link
          href={`?lang=${otherLang}`}
          className="text-sm font-medium text-accent-600 underline-offset-4 hover:underline"
        >
          {t('langToggle')}
        </Link>
      </div>
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">{t('pageTitle')}</h1>
        <p className="text-base text-neutral-700">{t('intro')}</p>
      </header>
      <ContactForm />
    </main>
  );
}
