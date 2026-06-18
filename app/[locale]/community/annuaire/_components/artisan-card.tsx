// Story 2.2 (AC1/AC7) — carte artisan (Server Component, aucune interactivité).
// Borderless v2 : fond blanc, shadow-xs, rounded-[14px], zéro border. La carte
// entière est un lien vers la fiche (overlay absolu) ; le mini-bouton `tel:` est
// un lien SÉPARÉ au-dessus (z-10) — pas de lien imbriqué (HTML invalide).
// Ordre des champs : header (nom + prix) → tag → 2 jauges top → footer (facture
// + appel).

import { useTranslations } from 'next-intl';
import { Phone } from 'lucide-react';
import { RatingGauge } from './rating-gauge';
import { Chip } from './chip';
import { topAxes, type AxisScore } from '@/lib/artisans/rating';
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
  // Review D4 : pour un artisan sans aucun vote, `topAxes` retombe sur les 2
  // axes du métier (mapping `tag → axes`) au lieu des 2 axes canoniques par
  // défaut — la carte reste honnête plutôt que mensongère.
  const top = topAxes(artisan.axes, 2, artisan.primaryTagKey);
  // Review F25 : un seul lien englobant la carte (le bouton call sort visuellement
  // mais reste DOM-séparé sans overlap d'`aria-label` sur l'article).
  const cardHref = `/${locale}/community/artisan/${artisan.slug}`;

  return (
    <article className="relative flex flex-col gap-3 rounded-[14px] bg-bg-card p-4 shadow-xs motion-safe:transition-shadow hover:shadow-sm sm:p-5">
      {/* Lien carte entière (overlay) — focusable, étiqueté. */}
      <a
        href={cardHref}
        className="absolute inset-0 rounded-[14px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
      >
        <span className="sr-only">{t('open', { name: artisan.displayName })}</span>
      </a>

      <header className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-medium tracking-tight text-neutral-900">
          {artisan.displayName}
        </h3>
        {artisan.priceRelative && (
          <span
            className="shrink-0 rounded-sm bg-bg-soft px-2 py-0.5 text-xs font-medium text-neutral-700"
            aria-label={t('price', { price: artisan.priceRelative })}
          >
            {artisan.priceRelative}
          </span>
        )}
      </header>

      {artisan.primaryTagLabel && (
        <div>
          <Chip>{artisan.primaryTagLabel}</Chip>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {top.map((s) => (
          <RatingGauge
            key={s.axis}
            axis={s.axis}
            average={s.average}
            count={s.count}
            variant="compact"
          />
        ))}
      </div>

      <footer className="flex items-center justify-between gap-2">
        <InvoiceBadge hasInvoice={artisan.hasInvoice} />
        {/* Mini-appel : lien distinct au-dessus de l'overlay (z-10). */}
        <a
          href={`tel:${artisan.phoneE164}`}
          aria-label={t('call', { name: artisan.displayName })}
          className="relative z-10 inline-flex min-h-touch min-w-touch items-center justify-center rounded-[14px] bg-accent-500 text-white shadow-sm motion-safe:transition-colors hover:bg-accent-600"
        >
          <Phone className="size-4" aria-hidden />
        </a>
      </footer>
    </article>
  );
}

function InvoiceBadge({ hasInvoice }: { hasInvoice: HasInvoice | null }) {
  const t = useTranslations('community.annuaire.card');
  if (hasInvoice === 'oui') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
        <span aria-hidden>✓</span> {t('invoice')}
      </span>
    );
  }
  if (hasInvoice === 'sur_demande') {
    return <span className="text-xs font-medium text-neutral-500">{t('invoiceOnRequest')}</span>;
  }
  return <span />;
}
