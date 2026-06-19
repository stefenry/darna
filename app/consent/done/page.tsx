// Story 2.5 review P10 — page de statut post-action de consentement.
// L'URL ne contient PAS le raw token (mitigation D1 review : pas de fuite via
// Location header / Sentry / Vercel logs).

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';
import type { Locale } from '@/lib/i18n/config';

export const dynamic = 'force-dynamic';

const zLang = z.enum(['fr', 'ar']).catch('fr');
const zStatus = z.enum(['accepted', 'refused', 'expired', 'used']).catch('used');

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
  const t = await getTranslations({ locale: localeFrom(lang), namespace: 'consent' });
  return { title: t('doneTitle'), robots: { index: false } };
}

export default async function ConsentDonePage({ searchParams }: Props) {
  const { lang, status: rawStatus } = await searchParams;
  const locale = localeFrom(lang);
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const status = zStatus.parse(pick(rawStatus) ?? 'used');
  const t = await getTranslations({ locale, namespace: 'consent' });

  const titleKey =
    status === 'accepted'
      ? 'doneAcceptedTitle'
      : status === 'refused'
        ? 'doneRefusedTitle'
        : status === 'expired'
          ? 'expiredTitle'
          : 'usedAcceptedTitle';
  const bodyKey =
    status === 'accepted'
      ? 'doneAcceptedBody'
      : status === 'refused'
        ? 'doneRefusedBody'
        : status === 'expired'
          ? 'expiredBody'
          : 'usedAcceptedBody';

  return (
    <main dir={dir} className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">{t(titleKey)}</h1>
      <p className="text-base text-neutral-700">{t(bodyKey)}</p>
    </main>
  );
}
