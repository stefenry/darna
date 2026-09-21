// Story 2.3 (AC1) — en-tête fiche : retour + overflow (share=Epic 6.2, inactif au
// MVP), nom H1, prix, tags compétence, badge facture, téléphone visible.
//
// Refonte 2026-09 — condensé : retour, nom et menu sur UNE ligne ; tags + prix en
// pastilles de 24 px ; facture et auteur de la fiche sur une ligne ; téléphone et
// WhatsApp sur une rangée.

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Check, MessageCircle, MoreHorizontal, Phone } from 'lucide-react';
import { waMeUrl } from '@/lib/artisans/whatsapp';
import type { Database } from '@/lib/supabase/types.generated';
import type { ArtisanDetail } from '../data';

type HasInvoice = Database['public']['Enums']['artisan_has_invoice'];

const MA_MOBILE = /^\+212(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/;

function formatPhone(e164: string): string {
  const ma = e164.match(MA_MOBILE);
  if (ma) return `+212 ${ma[1]} ${ma[2]} ${ma[3]} ${ma[4]} ${ma[5]}`;
  return e164;
}

const TAG =
  'inline-flex min-h-6 items-center rounded-full bg-bg-soft px-2.5 text-xs font-semibold text-neutral-900';

export function ArtisanHeader({ locale, artisan }: { locale: string; artisan: ArtisanDetail }) {
  const t = useTranslations('community.artisan');
  const whatsappHref = waMeUrl(artisan.phoneE164);
  const createdBy = artisan.createdByLabel.authorName
    ? t('createdByNamed', { name: artisan.createdByLabel.authorName })
    : artisan.createdByLabel.pseudonymSuffix
      ? t('createdByPseudonym', { suffix: artisan.createdByLabel.pseudonymSuffix })
      : t('createdByDeleted');

  return (
    <header className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Link
          href={`/${locale}/community/annuaire`}
          aria-label={t('back')}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-neutral-200 text-neutral-900 hover:bg-bg-soft"
        >
          <ArrowLeft className="size-5 rtl:rotate-180" aria-hidden />
        </Link>
        {/* Deux lignes max : un nom long se replie plutôt que de disparaître. */}
        <h1 className="line-clamp-2 min-w-0 flex-1 break-words text-xl font-semibold leading-tight tracking-tight text-neutral-900">
          {artisan.displayName}
        </h1>
        {/* Menu partage/overflow = Epic 6.2 — présent mais inactif au MVP. */}
        <button
          type="button"
          disabled
          aria-disabled="true"
          aria-label={t('more')}
          className="inline-flex size-11 shrink-0 items-center justify-center text-neutral-300"
        >
          <MoreHorizontal className="size-5" aria-hidden />
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {(artisan.tags.length > 0 || artisan.priceRelative) && (
          <div className="flex flex-wrap gap-1.5">
            {artisan.tags.map((tag) => (
              <span key={tag.key} className={TAG}>
                {tag.label}
              </span>
            ))}
            {artisan.priceRelative && <span className={TAG}>{artisan.priceRelative}</span>}
          </div>
        )}

        {/* Facture + qui a ajouté la fiche (nom ou pseudonyme selon la préférence
            du voisin), sur une seule ligne. */}
        <p className="flex flex-wrap items-center gap-x-1.5 text-[13px] text-neutral-500">
          <InvoiceBadge hasInvoice={artisan.hasInvoice} />
          <span>{createdBy}</span>
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 rounded border border-neutral-200 bg-bg-card py-1 pe-1 ps-3.5">
        <p className="flex min-w-0 items-center gap-2.5 text-[15px] font-semibold text-neutral-900">
          <Phone className="size-[18px] shrink-0 text-neutral-500" aria-hidden />
          <span aria-label={t('phoneAriaLabel')} className="truncate tabular-nums tracking-wide">
            {formatPhone(artisan.phoneE164)}
          </span>
        </p>
        {/* Lien sortant simple, sans script tiers (promesse « sans tracker »).
            Absent si le numéro n'est pas un E.164 exploitable — mieux qu'un lien
            qui ouvrirait WhatsApp sur un mauvais numéro. */}
        {whatsappHref && (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t('whatsappAriaLabel', { name: artisan.displayName })}
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-sm bg-bg-soft px-3.5 text-[13px] font-semibold text-neutral-900 motion-safe:transition-colors hover:bg-neutral-200"
          >
            <MessageCircle className="size-4" aria-hidden />
            {t('whatsapp')}
          </a>
        )}
      </div>
    </header>
  );
}

function InvoiceBadge({ hasInvoice }: { hasInvoice: HasInvoice | null }) {
  const t = useTranslations('community.artisan');
  if (hasInvoice === 'oui') {
    return (
      <>
        <span className="inline-flex items-center gap-0.5 font-semibold text-neutral-900">
          <Check className="size-3.5" aria-hidden /> {t('invoice')}
        </span>
        <span aria-hidden>·</span>
      </>
    );
  }
  if (hasInvoice === 'sur_demande') {
    return (
      <>
        <span>{t('invoiceOnRequest')}</span>
        <span aria-hidden>·</span>
      </>
    );
  }
  return null;
}
