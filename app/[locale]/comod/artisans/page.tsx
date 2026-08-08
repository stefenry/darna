// Feedback bêta 2026-07-23 — file « Artisans à valider » pour le co_mod. Avec
// l'envoi SMS coupé (SMS_PROVIDER=disabled), toute fiche créée reste en
// pending_consent jusqu'à publication par un co_mod — mais l'annuaire ne liste
// que les fiches publiées : sans cette page, les fiches en attente étaient
// introuvables (URL directe uniquement). Chaque entrée renvoie vers la fiche,
// qui porte déjà le bouton « Publier sans consentement » (ComodPublishButton).
//
// Lecture via le client SESSION (RLS artisans_co_mod_select_residence : tous
// états, résidence du co_mod, hors soft-delete). Garde 403 héritée de
// comod/layout.
import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { assertLocale } from '@/lib/i18n/assert-locale';
import { createClient } from '@/lib/supabase/server';
import { Chip } from '@/app/[locale]/community/annuaire/_components/chip';

type EmbeddedTag = { key: string; label_fr: string; label_ar: string | null };

/** Même sémantique que la fiche : AR si traduit, repli FR sinon. */
function tagLabel(locale: string, tag: EmbeddedTag): string {
  return locale === 'ar' && tag.label_ar ? tag.label_ar : tag.label_fr;
}

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  assertLocale(locale);
  return {
    title: (await getTranslations({ locale, namespace: 'comod.artisansQueue' }))('title'),
  };
}

export default async function ComodArtisansQueuePage({ params }: Props) {
  const { locale } = await params;
  assertLocale(locale);
  setRequestLocale(locale);
  const t = await getTranslations('comod.artisansQueue');

  const supabase = await createClient();
  // Feedback bêta 2026-08-08 — compétences ET recommandation sont nécessaires
  // pour décider : sans elles, valider revient à publier une fiche dont on
  // ignore le métier et le motif. Les compétences sont lisibles depuis la policy
  // artisan_tags_co_mod_select_residence (20260808140000) — avant elle, la
  // jointure renvoyait un tableau vide. La recommandation, elle, n'était pas
  // persistée du tout (20260808160000) : les fiches d'avant n'en ont pas.
  const { data: artisans } = await supabase
    .from('artisans')
    .select(
      'id, slug, display_name_fr, phone_e164, created_at, recommendation_text, artisan_tags ( tags ( key, label_fr, label_ar ) )',
    )
    .eq('state', 'pending_consent')
    .order('created_at', { ascending: true });

  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-[28px] font-semibold tracking-tight text-neutral-900">{t('title')}</h1>
        <p className="text-base text-neutral-700">{t('intro')}</p>
      </header>

      {!artisans || artisans.length === 0 ? (
        <p className="rounded-[14px] bg-bg-soft px-4 py-6 text-center text-base text-neutral-700">
          {t('empty')}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {artisans.map((artisan) => (
            <li key={artisan.id}>
              <Link
                href={`/${locale}/community/artisan/${artisan.slug}`}
                className="flex flex-col gap-1 rounded-[14px] bg-bg-card p-4 shadow-xs hover:bg-bg-soft"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-base font-semibold text-neutral-900">
                    {artisan.display_name_fr}
                  </span>
                  <span className="text-xs text-neutral-500">
                    {t('submittedOn', { date: dateFormat.format(new Date(artisan.created_at)) })}
                  </span>
                </div>
                <span className="text-sm text-neutral-700" dir="ltr">
                  {artisan.phone_e164}
                </span>

                {(() => {
                  const tags = (artisan.artisan_tags ?? [])
                    .map((at) => at.tags)
                    .filter((tag): tag is EmbeddedTag => !!tag)
                    .map((tag) => ({ key: tag.key, label: tagLabel(locale, tag) }))
                    .sort((a, b) => a.label.localeCompare(b.label, locale));

                  // Une fiche SANS compétence est un signal de validation à part
                  // entière : on le dit, au lieu de n'afficher rien du tout —
                  // c'est précisément l'ambiguïté qui a motivé ce correctif.
                  return tags.length > 0 ? (
                    <span className="mt-1 flex flex-wrap gap-2">
                      {tags.map((tag) => (
                        <Chip key={tag.key}>{tag.label}</Chip>
                      ))}
                    </span>
                  ) : (
                    <span className="mt-1 text-sm italic text-neutral-500">
                      {t('noCompetences')}
                    </span>
                  );
                })()}

                {artisan.recommendation_text?.trim() && (
                  <span className="mt-1 block rounded-[14px] bg-bg-soft px-3 py-2 text-sm italic text-neutral-700">
                    “{artisan.recommendation_text.trim()}”
                  </span>
                )}

                <span className="mt-1 text-sm font-medium text-accent-600">{t('openCta')}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
