// Story 2.5 — page publique de consentement artisan (HORS `[locale]` : le lien
// SMS est sans préfixe). Aucune authentification, aucune session. Toggle FR/AR
// via `?lang=`. Le form POSTe vers /api/webhook/sms-consent (PRG).

import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/lib/i18n/config';
import { resolveConsentToken } from '@/lib/consent/lookup';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ lang?: string }>;
};

function localeFrom(lang: string | undefined): Locale {
  return lang === 'ar' ? 'ar' : 'fr';
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { lang } = await searchParams;
  const t = await getTranslations({ locale: localeFrom(lang), namespace: 'consent' });
  return { title: t('title'), robots: { index: false } };
}

export default async function ConsentPage({ params, searchParams }: Props) {
  const { token } = await params;
  const { lang } = await searchParams;
  const locale = localeFrom(lang);
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const t = await getTranslations({ locale, namespace: 'consent' });
  const otherLang = locale === 'ar' ? 'fr' : 'ar';

  const result = await resolveConsentToken(token, locale);

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
        <section className="flex flex-col gap-5">
          <header className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">{t('title')}</h1>
            <p className="text-base text-neutral-700">{t('intro', { name: result.displayName })}</p>
          </header>

          {result.tags.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-neutral-900">{t('competences')}</p>
              <div className="flex flex-wrap gap-2">
                {result.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-bg-soft px-3 py-1 text-xs font-medium text-neutral-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          <p className="text-sm text-neutral-500">{t('privacy')}</p>

          <form action="/api/webhook/sms-consent" method="post" className="flex flex-col gap-3">
            <input type="hidden" name="token" value={token} />
            <button
              type="submit"
              name="decision"
              value="accept"
              className="flex min-h-touch-lg items-center justify-center rounded-[14px] bg-accent-500 px-6 text-base font-semibold text-white shadow-sm hover:bg-accent-600"
            >
              {t('accept')}
            </button>
            <button
              type="submit"
              name="decision"
              value="refuse"
              className="flex min-h-touch items-center justify-center rounded-[14px] bg-bg-soft px-6 text-base font-medium text-neutral-700 hover:bg-neutral-300"
            >
              {t('refuse')}
            </button>
          </form>
        </section>
      )}

      {result.status === 'expired' && <Notice title={t('expiredTitle')} body={t('expiredBody')} />}
      {result.status === 'invalid' && <Notice title={t('invalidTitle')} body={t('invalidBody')} />}
      {result.status === 'used' &&
        (result.state === 'published' ? (
          <Notice
            title={t('usedAcceptedTitle')}
            body={t('usedAcceptedBody')}
            link={{ href: `/${locale}/community/artisan/${result.slug}`, label: t('viewFiche') }}
          />
        ) : (
          <Notice title={t('usedRefusedTitle')} body={t('usedRefusedBody')} />
        ))}
    </main>
  );
}

function Notice({
  title,
  body,
  link,
}: {
  title: string;
  body: string;
  link?: { href: string; label: string };
}) {
  return (
    <section className="flex flex-col gap-3">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">{title}</h1>
      <p className="text-base text-neutral-700">{body}</p>
      {link && (
        <Link
          href={link.href}
          className="inline-flex min-h-touch w-fit items-center justify-center rounded-[14px] bg-accent-500 px-5 text-sm font-semibold text-white hover:bg-accent-600"
        >
          {link.label}
        </Link>
      )}
    </section>
  );
}
