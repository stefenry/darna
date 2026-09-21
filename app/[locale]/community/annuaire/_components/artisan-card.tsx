// Story 2.2 (AC1/AC7) — carte artisan (Server Component, aucune interactivité).
// La carte entière est un lien vers la fiche (overlay absolu) ; le mini-bouton
// `tel:` est un lien SÉPARÉ au-dessus (z-10) — pas de lien imbriqué (HTML invalide).
//
// Refonte 2026-09 — « le maximum d'informations sur le minimum de place » :
// 2 rangées. (1) nom + ligne meta en texte (métier · prix · avis · facture) et
// bouton d'appel ; (2) les 4 axes de notation en bandeau, une seule teinte.
// La hauteur de l'en-tête est plancherée par la cible tactile du bouton d'appel.

import { useTranslations } from 'next-intl';
import { Check, Phone } from 'lucide-react';
import { RatingGauge } from './rating-gauge';
import { RATING_AXES, type AxisScore } from '@/lib/artisans/rating';
import { bestAxes } from '@/lib/artisans/best-axis';
import type { Database } from '@/lib/supabase/types.generated';

type PriceRelative = Database['public']['Enums']['artisan_price_relative'];
type HasInvoice = Database['public']['Enums']['artisan_has_invoice'];

export type ArtisanCardData = {
  slug: string;
  displayName: string;
  priceRelative: PriceRelative | null;
  hasInvoice: HasInvoice | null;
  phoneE164: string;
  primaryTagKey: string | null;
  primaryTagLabel: string | null;
  axes: AxisScore[];
};

export function ArtisanCard({ locale, artisan }: { locale: string; artisan: ArtisanCardData }) {
  const t = useTranslations('community.annuaire.card');
  const byAxis = new Map(artisan.axes.map((a) => [a.axis, a]));
  const best = bestAxes(artisan.axes);
  // Pas de total de votants dans l'agrégat : l'axe le plus noté en donne la
  // borne basse (un voisin note rarement un seul axe).
  const reviews = Math.max(0, ...artisan.axes.map((a) => a.count));
  // Review F25 : un seul lien englobant la carte (le bouton call sort visuellement
  // mais reste DOM-séparé sans overlap d'`aria-label` sur l'article).
  const cardHref = `/${locale}/community/artisan/${artisan.slug}`;

  return (
    <article className="relative flex flex-col gap-1.5 rounded bg-bg-card py-2 pe-3 ps-4 shadow-xs">
      {/* Lien carte entière (overlay) — focusable, étiqueté. */}
      <a
        href={cardHref}
        className="absolute inset-0 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
      >
        <span className="sr-only">{t('open', { name: artisan.displayName })}</span>
      </a>

      <header className="flex items-center justify-between gap-3">
        {/* min-w-0 + truncate : un nom long ne doit jamais pousser le bouton
            d'appel hors de la carte. */}
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="truncate text-base font-semibold leading-tight tracking-tight text-neutral-900">
            {artisan.displayName}
          </h3>
          <div className="flex items-center gap-1.5 overflow-hidden whitespace-nowrap text-[13px] text-neutral-500">
            {artisan.primaryTagLabel && <span>{artisan.primaryTagLabel}</span>}
            {artisan.priceRelative && (
              <>
                <Dot />
                <span
                  className="font-semibold text-neutral-900"
                  aria-label={t('price', { price: artisan.priceRelative })}
                >
                  {artisan.priceRelative}
                </span>
              </>
            )}
            {reviews > 0 && (
              <>
                <Dot />
                <span>{t('reviews', { count: reviews })}</span>
              </>
            )}
            <InvoiceBadge hasInvoice={artisan.hasInvoice} />
          </div>
        </div>
        {/* Mini-appel : lien distinct au-dessus de l'overlay (z-10). */}
        <a
          href={`tel:${artisan.phoneE164}`}
          aria-label={t('call', { name: artisan.displayName })}
          className="relative z-10 inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-500 text-on-accent motion-safe:transition-colors hover:bg-accent-600"
        >
          <Phone className="size-[18px]" aria-hidden />
        </a>
      </header>

      {/* Les 4 axes, ordre canonique : on compare les artisans colonne par colonne. */}
      <div className="flex gap-3 pe-1">
        {RATING_AXES.map((axis) => {
          const s = byAxis.get(axis) ?? { axis, average: null, count: 0 };
          return (
            <RatingGauge
              key={axis}
              axis={axis}
              average={s.average}
              count={s.count}
              highlight={best.has(axis)}
            />
          );
        })}
      </div>
    </article>
  );
}

function Dot() {
  return <span aria-hidden>·</span>;
}

function InvoiceBadge({ hasInvoice }: { hasInvoice: HasInvoice | null }) {
  const t = useTranslations('community.annuaire.card');
  if (hasInvoice === 'oui') {
    return (
      <>
        <Dot />
        <span className="inline-flex items-center gap-0.5">
          <Check className="size-3.5" aria-hidden />
          {t('invoice')}
        </span>
      </>
    );
  }
  if (hasInvoice === 'sur_demande') {
    return (
      <>
        <Dot />
        <span>{t('invoiceOnRequest')}</span>
      </>
    );
  }
  return null;
}
