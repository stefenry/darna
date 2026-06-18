// Story 2.3 (AC1) — en-tête fiche : retour + overflow (share=Epic 6.2, inactif au
// MVP), nom H1, prix, tags compétence, badge facture, téléphone visible.

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowLeft, MoreHorizontal, Phone } from 'lucide-react';
import { Chip } from '@/app/[locale]/community/annuaire/_components/chip';
import type { Database } from '@/lib/supabase/types.generated';
import type { ArtisanDetail } from '../data';

type HasInvoice = Database['public']['Enums']['artisan_has_invoice'];

const MA_MOBILE = /^\+212(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/;

function formatPhone(e164: string): string {
  const ma = e164.match(MA_MOBILE);
  if (ma) return `+212 ${ma[1]} ${ma[2]} ${ma[3]} ${ma[4]} ${ma[5]}`;
  return e164;
}

export function ArtisanHeader({ locale, artisan }: { locale: string; artisan: ArtisanDetail }) {
  const t = useTranslations('community.artisan');

  return (
    <header className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Link
          href={`/${locale}/community/annuaire`}
          aria-label={t('back')}
          className="inline-flex min-h-touch min-w-touch items-center justify-center rounded-[14px] text-neutral-700 hover:bg-bg-soft"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        {/* Menu partage/overflow = Epic 6.2 — présent mais inactif au MVP. */}
        <button
          type="button"
          disabled
          aria-disabled="true"
          aria-label={t('more')}
          className="inline-flex min-h-touch min-w-touch items-center justify-center rounded-[14px] text-neutral-300"
        >
          <MoreHorizontal className="size-5" aria-hidden />
        </button>
      </div>

      <div className="flex items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 break-words">
          {artisan.displayName}
        </h1>
        {artisan.priceRelative && (
          <span className="shrink-0 rounded-sm bg-bg-soft px-2 py-1 text-sm font-medium text-neutral-700">
            {artisan.priceRelative}
          </span>
        )}
      </div>

      {artisan.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {artisan.tags.map((tag) => (
            <Chip key={tag.key}>{tag.label}</Chip>
          ))}
        </div>
      )}

      <InvoiceBadge hasInvoice={artisan.hasInvoice} />

      <p className="flex items-center gap-2 text-base text-neutral-700">
        <Phone className="size-4 text-neutral-400" aria-hidden />
        <span aria-label={t('phoneAriaLabel')} className="tabular-nums tracking-wide">
          {formatPhone(artisan.phoneE164)}
        </span>
      </p>
    </header>
  );
}

function InvoiceBadge({ hasInvoice }: { hasInvoice: HasInvoice | null }) {
  const t = useTranslations('community.artisan');
  if (hasInvoice === 'oui') {
    return (
      <span className="inline-flex w-fit items-center gap-1 text-sm font-medium text-success">
        <span aria-hidden>✓</span> {t('invoice')}
      </span>
    );
  }
  if (hasInvoice === 'sur_demande') {
    return <span className="text-sm font-medium text-neutral-500">{t('invoiceOnRequest')}</span>;
  }
  return null;
}
