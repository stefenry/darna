'use client';

// Story 2.7 — formulaire d'édition de fiche (calqué sur create-artisan-form 2.4,
// SANS gate consentement). Encart d'avertissement re-consent si PII change sur une
// fiche published. Danger Zone inline (phrase typée RETIRER, pattern 1.9) pour le
// retrait. Deux `useActionState` distincts (édition / retrait).

import { useActionState, useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ArtisanEditData } from '../../data';
import { updateArtisan, retractArtisan } from '../actions';
import { UPDATE_ARTISAN_INITIAL, RETRACT_ARTISAN_INITIAL } from '../state';

type Tag = { key: string; label: string };

const INPUT_CLASS =
  'min-h-touch rounded-[14px] border border-neutral-300 bg-bg-card px-4 text-base text-neutral-900 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/30';
const PHONE_NORMALIZE = /[\s.\-()]+/g;

export function EditArtisanForm({
  locale,
  slug,
  tags,
  artisan,
}: {
  locale: string;
  slug: string;
  tags: Tag[];
  artisan: ArtisanEditData;
}) {
  const t = useTranslations('community.artisanEdit');
  const tErr = useTranslations('errors');
  const [state, formAction, isPending] = useActionState(updateArtisan, UPDATE_ARTISAN_INITIAL);

  const nameId = useId();
  const nameArId = useId();
  const phoneId = useId();
  const priceId = useId();
  const invoiceId = useId();

  const [nameVal, setNameVal] = useState(artisan.displayNameFr);
  const [phoneVal, setPhoneVal] = useState(artisan.phoneE164);
  const piiTouched =
    nameVal.trim() !== artisan.displayNameFr.trim() ||
    phoneVal.replace(PHONE_NORMALIZE, '') !== artisan.phoneE164.replace(PHONE_NORMALIZE, '');
  const showReconsentWarning = piiTouched && artisan.state === 'published';

  if (state.ok) {
    const msg = state.reconsent === 'none' ? t('savedNoReconsent') : t('savedReconsent');
    return (
      <div role="status" className="flex flex-col gap-3 rounded-[14px] bg-accent-50 p-5">
        <p className="text-base text-neutral-900">{msg}</p>
        {state.smsFailed && (
          <p role="alert" className="rounded-[10px] bg-bg-soft px-3 py-2 text-sm text-warning">
            {t('smsFailedWarning')}
          </p>
        )}
        <Link
          href={`/${locale}/community/artisan/${slug}`}
          className="inline-flex min-h-touch w-fit items-center justify-center rounded-[14px] bg-accent-500 px-5 text-sm font-semibold text-white hover:bg-accent-600"
        >
          {t('backToFiche')}
        </Link>
      </div>
    );
  }

  const error = 'error' in state ? state.error : null;
  const errorKey = error?.message_key?.replace(/^errors\./, '') ?? null;

  return (
    <div className="flex flex-col gap-8">
      <form action={formAction} noValidate className="flex flex-col gap-5" aria-busy={isPending}>
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="locale" value={locale} />

        {error && (
          <div role="alert" className="rounded-[14px] bg-bg-soft px-4 py-3 text-sm text-danger">
            {errorKey ? tErr(errorKey) : tErr('artisan.edit_submit_failed')}
          </div>
        )}

        {artisan.reconsentPending && (
          <p className="rounded-[14px] bg-bg-soft px-4 py-3 text-sm text-neutral-700">
            {t('reconsentInProgress')}
          </p>
        )}

        <label htmlFor={nameId} className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-neutral-900">{t('displayNameFr')}</span>
          <input
            id={nameId}
            name="display_name_fr"
            type="text"
            required
            maxLength={120}
            value={nameVal}
            onChange={(e) => setNameVal(e.target.value)}
            className={INPUT_CLASS}
          />
        </label>

        <label htmlFor={nameArId} className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-neutral-900">{t('displayNameAr')}</span>
          <input
            id={nameArId}
            name="display_name_ar"
            type="text"
            maxLength={120}
            dir="rtl"
            defaultValue={artisan.displayNameAr ?? ''}
            className={INPUT_CLASS}
          />
        </label>

        <label htmlFor={phoneId} className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-neutral-900">{t('phone')}</span>
          <input
            id={phoneId}
            name="phone"
            type="tel"
            inputMode="tel"
            required
            value={phoneVal}
            onChange={(e) => setPhoneVal(e.target.value)}
            className={INPUT_CLASS}
          />
        </label>

        {showReconsentWarning && (
          <p
            aria-live="polite"
            className="rounded-[14px] bg-warning/10 px-4 py-3 text-sm text-warning"
          >
            {t('reconsentWarning')}
          </p>
        )}

        <fieldset className="flex flex-col gap-2 text-sm">
          <legend className="font-medium text-neutral-900">{t('competences')}</legend>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <label
                key={tag.key}
                className="inline-flex min-h-touch cursor-pointer items-center gap-2 rounded-full bg-bg-soft px-3 text-sm text-neutral-700 has-[:checked]:bg-accent-500 has-[:checked]:text-white"
              >
                <input
                  type="checkbox"
                  name="tag_keys"
                  value={tag.key}
                  defaultChecked={artisan.tagKeys.includes(tag.key)}
                  className="sr-only"
                />
                {tag.label}
              </label>
            ))}
          </div>
        </fieldset>

        <label htmlFor={priceId} className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-neutral-900">{t('price')}</span>
          <select
            id={priceId}
            name="price_relative"
            defaultValue={artisan.priceRelative ?? ''}
            className={INPUT_CLASS}
          >
            <option value="">{t('priceNone')}</option>
            <option value="$">$</option>
            <option value="$$">$$</option>
            <option value="$$$">$$$</option>
            <option value="$$$$">$$$$</option>
          </select>
        </label>

        <label htmlFor={invoiceId} className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-neutral-900">{t('invoice')}</span>
          <select
            id={invoiceId}
            name="has_invoice"
            defaultValue={artisan.hasInvoice ?? ''}
            className={INPUT_CLASS}
          >
            <option value="">{t('invoiceNone')}</option>
            <option value="oui">{t('invoiceOui')}</option>
            <option value="non">{t('invoiceNon')}</option>
            <option value="sur_demande">{t('invoiceSurDemande')}</option>
          </select>
        </label>

        <button
          type="submit"
          disabled={isPending}
          className="inline-flex min-h-touch-lg items-center justify-center rounded-[14px] bg-accent-500 px-6 text-base font-semibold text-white shadow-sm transition-colors hover:bg-accent-600 disabled:bg-neutral-300 disabled:text-neutral-500"
        >
          {isPending ? t('saving') : t('save')}
        </button>
      </form>

      <RetractZone locale={locale} slug={slug} />
    </div>
  );
}

function RetractZone({ locale, slug }: { locale: string; slug: string }) {
  const t = useTranslations('community.artisanEdit');
  const tErr = useTranslations('errors');
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(retractArtisan, RETRACT_ARTISAN_INITIAL);
  const [confirm, setConfirm] = useState('');

  useEffect(() => {
    if (state.ok) router.replace(`/${locale}/community/annuaire`);
  }, [state, router, locale]);

  const error = 'error' in state ? state.error : null;
  const errorKey = error?.message_key?.replace(/^errors\./, '') ?? null;

  return (
    <section
      id="retrait"
      className="flex flex-col gap-3 rounded-[14px] border border-danger/30 bg-danger/5 p-4"
    >
      <h2 className="text-base font-semibold text-danger">{t('dangerZoneTitle')}</h2>
      <p className="text-sm text-neutral-700">{t('dangerZoneDescription')}</p>
      <form action={formAction} className="flex flex-col gap-3" aria-busy={isPending}>
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="locale" value={locale} />
        {error && (
          <p role="alert" className="text-sm text-danger">
            {errorKey ? tErr(errorKey) : tErr('artisan.edit_submit_failed')}
          </p>
        )}
        <label className="flex flex-col gap-2 text-sm">
          <span className="text-neutral-700">{t('confirmPhraseLabel')}</span>
          <input
            name="confirm"
            type="text"
            autoComplete="off"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={INPUT_CLASS}
          />
        </label>
        <button
          type="submit"
          disabled={isPending || confirm !== t('confirmPhrase')}
          className="inline-flex min-h-touch-lg items-center justify-center rounded-[14px] bg-danger px-6 text-base font-semibold text-white shadow-sm transition-colors hover:opacity-90 disabled:bg-neutral-300 disabled:text-neutral-500"
        >
          {isPending ? t('retracting') : t('retract')}
        </button>
      </form>
    </section>
  );
}
