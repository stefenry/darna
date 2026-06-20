// Story 2.8 — page publique de réponse artisan (HORS `[locale]`, calque
// /consent/[token]). Token-based, aucune session. Toggle FR/AR. Rate-limit GET
// (fail-open). robots:noindex. force-dynamic.

import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';
import type { Locale } from '@/lib/i18n/config';
import { resolveResponseToken } from '@/lib/consent/lookup-response';
import { checkLimit } from '@/lib/rate-limit';
import { RespondForm } from './_components/respond-form';

export const dynamic = 'force-dynamic';

const zLang = z.enum(['fr', 'ar']).catch('fr');

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ lang?: string | string[] }>;
};

function localeFrom(lang: string | string[] | undefined): Locale {
  const candidate = Array.isArray(lang) ? lang[0] : lang;
  return zLang.parse(candidate ?? 'fr');
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { lang } = await searchParams;
  const t = await getTranslations({ locale: localeFrom(lang), namespace: 'artisanRespond' });
  return { title: t('pageTitle'), robots: { index: false } };
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <section className="flex flex-col gap-3">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">{title}</h1>
      <p className="text-base text-neutral-700">{body}</p>
    </section>
  );
}

export default async function RespondPage({ params, searchParams }: Props) {
  const { token } = await params;
  const { lang } = await searchParams;
  const locale = localeFrom(lang);
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const otherLang = locale === 'ar' ? 'fr' : 'ar';
  const t = await getTranslations({ locale, namespace: 'artisanRespond' });

  // Rate-limit léger sur le GET (fail-open via checkLimit — pattern 2.5/P18).
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  await checkLimit(`respond-get:${ip}`, 30, 600);

  const result = await resolveResponseToken(token, locale);

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

      {result.status === 'valid' && (
        <>
          <header className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
              {t('ficheTitle', { name: result.displayName })}
            </h1>
            <p className="text-sm text-neutral-500">
              {t('phoneMasked', { phone: result.phoneMasked })}
            </p>
            {result.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {result.tags.map((tag, idx) => (
                  <span
                    key={`${tag}-${idx}`}
                    className="rounded-full bg-bg-soft px-3 py-1 text-xs font-medium text-neutral-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </header>
          <RespondForm token={token} locale={locale} recentRatings={result.recentRatings} />
        </>
      )}

      {result.status === 'expired' && <Notice title={t('expiredTitle')} body={t('expiredBody')} />}
      {result.status === 'invalid' && <Notice title={t('invalidTitle')} body={t('invalidBody')} />}
      {result.status === 'used' && <Notice title={t('usedTitle')} body={t('usedBody')} />}
    </main>
  );
}
