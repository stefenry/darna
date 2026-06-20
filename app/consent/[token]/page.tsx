// Story 2.5 — page publique de consentement artisan (HORS `[locale]` : le lien
// SMS est sans préfixe). Aucune authentification, aucune session. Toggle FR/AR
// via `?lang=`. Le form POSTe vers /api/webhook/sms-consent (PRG).
//
// Hardening review 2026-06-19 :
//   P9  mention pseudo/nommé du contributeur (AC1 littéral).
//   P15 `?lang=` validation enum stricte (z.enum + catch fr).
//   P18 rate-limit IP sur GET (anti-bruteforce GET-side, fail-open).
//   P22 lien "Consulter ma fiche" retiré (artisan sans compte → /admission via proxy).

import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';
import type { Locale } from '@/lib/i18n/config';
import { resolveConsentToken } from '@/lib/consent/lookup';
import { checkLimit } from '@/lib/rate-limit';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ lang?: string | string[] }>;
};

const zLang = z.enum(['fr', 'ar']).catch('fr');

function localeFrom(lang: string | string[] | undefined): Locale {
  const candidate = Array.isArray(lang) ? lang[0] : lang;
  return zLang.parse(candidate ?? 'fr');
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

  // P18 — rate-limit léger sur le GET (fail-open via checkLimit).
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  await checkLimit(`consent-get:${ip}`, 30, 600);

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
          {/* P14 (review 2.7) — différencier 1er consent vs re-consent. */}
          <header className="flex flex-col gap-2">
            {result.reconsent ? (
              <>
                <span className="inline-flex w-fit items-center rounded-full bg-accent-500 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                  {t('reconsentBadge')}
                </span>
                <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
                  {t('reconsentTitle')}
                </h1>
                <p className="text-base text-neutral-700">
                  {t('reconsentLead', { name: result.displayName })}
                </p>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
                  {t('title')}
                </h1>
                <p className="text-base text-neutral-700">
                  {t('intro', { name: result.displayName })}
                </p>
              </>
            )}
            <p className="text-sm text-neutral-500">
              {result.contributorIdentityMode === 'identified'
                ? t('visibilityNoteNamed')
                : t('visibilityNotePseudo')}
            </p>
          </header>

          {result.reconsent && (
            <div className="flex flex-col gap-1 rounded-[14px] bg-bg-soft px-4 py-3 text-sm text-neutral-700">
              <p className="font-medium text-neutral-900">{t('reconsentIntro')}</p>
              {result.reconsent.name && (
                <p>
                  {t('reconsentNameChange', {
                    from: result.reconsent.name.from,
                    to: result.reconsent.name.to,
                  })}
                </p>
              )}
              {result.reconsent.phoneChanged && <p>{t('reconsentPhoneChange')}</p>}
            </div>
          )}

          {result.tags.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-neutral-900">{t('competences')}</p>
              <div className="flex flex-wrap gap-2">
                {result.tags.map((tag, idx) => (
                  <span
                    key={`${tag}-${idx}`}
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
          <Notice title={t('usedAcceptedTitle')} body={t('usedAcceptedBody')} />
        ) : (
          <Notice title={t('usedRefusedTitle')} body={t('usedRefusedBody')} />
        ))}
    </main>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <section className="flex flex-col gap-3">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">{title}</h1>
      <p className="text-base text-neutral-700">{body}</p>
    </section>
  );
}
