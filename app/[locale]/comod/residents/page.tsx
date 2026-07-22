// Liste des résidents par villa pour le co_mod (geste « qui habite où » +
// promotion in-app). Roster : `admission_requests` (state=accepted) — complet
// (chaque résident validé y est) et robuste au bug profiles. villa/tranche
// viennent du profil COURANT (`profiles`, éditable par le résident) avec
// fallback admission (cf. roster.ts). Croisé avec `users` (co_mod RLS) pour
// exclure les comptes supprimés et marquer les co_mod. PAS d'e-mail/contact
// (décision produit).
//
// Lecture via le client SESSION (RLS co_mod : admission_requests_co_mod_select
// + users_co_mod_select_residence + profiles_co_mod_select_residence). Garde
// 403 héritée de comod/layout.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/lib/i18n/routing';
import type { Locale } from '@/lib/i18n/config';
import { createClient } from '@/lib/supabase/server';
import { buildVillaRoster } from './roster';
import { PromoteButton } from './_components/promote-button';
import { RemoveButton } from './_components/remove-button';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ locale: string }> };

function assertLocale(locale: string): asserts locale is Locale {
  if (!(routing.locales as readonly string[]).includes(locale)) notFound();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  assertLocale(locale);
  const t = await getTranslations({ locale, namespace: 'comod.residents' });
  return { title: t('title') };
}

export default async function ComodResidentsPage({ params }: Props) {
  const { locale } = await params;
  assertLocale(locale);
  setRequestLocale(locale);
  const t = await getTranslations('comod.residents');

  const supabase = await createClient();
  const [{ data: admissions }, { data: users }, { data: profiles }] = await Promise.all([
    supabase
      .from('admission_requests')
      .select('user_id, villa, tranche, first_name, created_at')
      .eq('state', 'accepted')
      .order('created_at', { ascending: false }),
    supabase.from('users').select('id, role, deleted_at'),
    supabase.from('profiles').select('user_id, villa, tranche'),
  ]);

  const byVilla = buildVillaRoster({
    admissions: admissions ?? [],
    users: users ?? [],
    profiles: profiles ?? [],
    locale,
  });
  const villas = [...byVilla.keys()];

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-[28px] font-semibold tracking-tight text-neutral-900">{t('title')}</h1>
        <p className="text-base text-neutral-700">{t('intro')}</p>
        <p className="text-sm text-neutral-500">{t('reloginNote')}</p>
      </header>

      {villas.length === 0 ? (
        <p className="text-base text-neutral-500">{t('empty')}</p>
      ) : (
        <ul className="flex flex-col gap-5">
          {villas.map((villa) => {
            const residents = byVilla.get(villa)!;
            return (
              <li key={villa} className="flex flex-col gap-2">
                <div className="flex items-baseline gap-2">
                  <h2 className="text-lg font-semibold text-neutral-900">
                    {t('villaLabel', { n: villa })}
                  </h2>
                  <span className="text-sm text-neutral-500">
                    {t('villaCount', { count: residents.length })}
                  </span>
                </div>
                <ul className="flex flex-col divide-y divide-neutral-200 rounded-[14px] bg-white shadow-xs">
                  {residents.map((r) => (
                    <li key={r.userId} className="flex flex-col gap-2 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate font-medium text-neutral-900">
                            {r.firstName}
                          </span>
                          {r.tranche && (
                            <span className="text-sm text-neutral-500">
                              {t('trancheLabel', { t: r.tranche })}
                            </span>
                          )}
                        </div>
                        {r.isComod ? (
                          <span className="inline-flex shrink-0 items-center rounded-full bg-accent-500 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                            {t('comodBadge')}
                          </span>
                        ) : (
                          <PromoteButton userId={r.userId} name={r.firstName} />
                        )}
                      </div>
                      {/* Retrait : résidents uniquement (co_mod = script-only, spec 2026-07-21). */}
                      {!r.isComod && (
                        <div className="flex justify-end">
                          <RemoveButton userId={r.userId} name={r.firstName} />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
