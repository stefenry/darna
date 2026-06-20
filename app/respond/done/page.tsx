// Story 2.8 — page de statut post-action de réponse artisan. L'URL ne contient
// PAS le raw token (mitigation 2.5/D1). Calque /consent/done.

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';
import type { Locale } from '@/lib/i18n/config';

export const dynamic = 'force-dynamic';

const zLang = z.enum(['fr', 'ar']).catch('fr');
const zStatus = z
  .enum(['published', 'rectification_pending', 'expired', 'used', 'invalid'])
  .catch('used');

type Props = {
  searchParams: Promise<{ lang?: string | string[]; status?: string | string[] }>;
};

function pick<T>(v: T | T[] | undefined): T | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function localeFrom(lang: string | string[] | undefined): Locale {
  return zLang.parse(pick(lang) ?? 'fr');
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { lang } = await searchParams;
  const t = await getTranslations({ locale: localeFrom(lang), namespace: 'artisanRespond' });
  return { title: t('doneTitle'), robots: { index: false } };
}

const TITLE_KEY = {
  published: 'donePublishedTitle',
  rectification_pending: 'doneRectificationPendingTitle',
  expired: 'expiredTitle',
  used: 'usedTitle',
  invalid: 'invalidTitle',
} as const;
const BODY_KEY = {
  published: 'donePublishedBody',
  rectification_pending: 'doneRectificationPendingBody',
  expired: 'expiredBody',
  used: 'usedBody',
  invalid: 'invalidBody',
} as const;

export default async function RespondDonePage({ searchParams }: Props) {
  const { lang, status: rawStatus } = await searchParams;
  const locale = localeFrom(lang);
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const status = zStatus.parse(pick(rawStatus) ?? 'used');
  const t = await getTranslations({ locale, namespace: 'artisanRespond' });

  return (
    <main dir={dir} className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
        {t(TITLE_KEY[status])}
      </h1>
      <p className="text-base text-neutral-700">{t(BODY_KEY[status])}</p>
    </main>
  );
}
