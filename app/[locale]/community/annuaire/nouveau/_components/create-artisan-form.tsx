'use client';

// Story 2.4 — formulaire de création d'artisan. `useActionState` → createArtisan.
// Gate CNDP (case requise désactive le submit). Sur succès : panneau de
// confirmation inline (l'artisan recevra un SMS). Sur phone_duplicate : lien
// vers la fiche existante.

import { useActionState, useId, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Checkbox } from '@/components/ui/checkbox';
import { createArtisan } from '../actions';
import { CREATE_ARTISAN_INITIAL } from '../state';

type Tag = { key: string; label: string };

const INPUT_CLASS =
  'min-h-touch rounded-[14px] border border-neutral-300 bg-bg-card px-4 text-base text-neutral-900 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/30';

export function CreateArtisanForm({ locale, tags }: { locale: string; tags: Tag[] }) {
  const t = useTranslations('community.artisanCreate');
  // Espace large `errors.*` (couvre `errors.artisan.*` ET `errors.rate_limit`,
  // `errors.forbidden` etc.) — review 2026-06-18.
  const tErr = useTranslations('errors');
  const [state, formAction, isPending] = useActionState(createArtisan, CREATE_ARTISAN_INITIAL);
  const [consent, setConsent] = useState(false);

  const nameId = useId();
  const nameArId = useId();
  const phoneId = useId();
  const priceId = useId();
  const invoiceId = useId();
  const commentId = useId();

  if (state.ok) {
    return (
      <div role="status" className="flex flex-col gap-3 rounded-[14px] bg-accent-50 p-5">
        <p className="text-base text-neutral-900">{t('success', { name: state.display_name })}</p>
        {state.smsFailed && (
          <p role="alert" className="rounded-[10px] bg-bg-soft px-3 py-2 text-sm text-warning">
            {t('smsFailedWarning')}
          </p>
        )}
        <Link
          href={`/${locale}/community/annuaire`}
          className="inline-flex min-h-touch w-fit items-center justify-center rounded-[14px] bg-accent-500 px-5 text-sm font-semibold text-white hover:bg-accent-600"
        >
          {t('back')}
        </Link>
      </div>
    );
  }

  const error = 'error' in state ? state.error : null;
  // Le message_key est complet (`errors.artisan.xxx` OU `errors.rate_limit`) ;
  // on le passe tel quel en strippant le préfixe `errors.` (namespace tErr).
  const errorKey = error?.message_key?.replace(/^errors\./, '') ?? null;
  const duplicateSlug = error?.code === 'phone_duplicate' ? error.existing_slug : null;

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5" aria-busy={isPending}>
      {error && (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-[14px] bg-bg-soft px-4 py-3 text-sm text-danger"
        >
          <span>{errorKey ? tErr(errorKey) : tErr('artisan.submit_failed')}</span>
          {duplicateSlug && (
            <Link
              href={`/${locale}/community/artisan/${duplicateSlug}`}
              className="w-fit font-medium text-accent-600 underline-offset-4 hover:underline"
            >
              {t('duplicateView')}
            </Link>
          )}
        </div>
      )}

      <label htmlFor={nameId} className="flex flex-col gap-2 text-sm">
        <span className="font-medium text-neutral-900">{t('displayNameFr')}</span>
        <input
          id={nameId}
          name="display_name_fr"
          type="text"
          required
          maxLength={120}
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
          placeholder={t('phonePlaceholder')}
          className={INPUT_CLASS}
        />
      </label>

      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="font-medium text-neutral-900">{t('competences')}</legend>
        <p className="text-neutral-500">{t('competencesHint')}</p>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <label
              key={tag.key}
              className="inline-flex min-h-touch cursor-pointer items-center gap-2 rounded-full bg-bg-soft px-3 text-sm text-neutral-700 has-[:checked]:bg-accent-500 has-[:checked]:text-white"
            >
              <input type="checkbox" name="tag_keys" value={tag.key} className="sr-only" />
              {tag.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label htmlFor={priceId} className="flex flex-col gap-2 text-sm">
        <span className="font-medium text-neutral-900">{t('price')}</span>
        <select id={priceId} name="price_relative" defaultValue="" className={INPUT_CLASS}>
          <option value="">{t('priceNone')}</option>
          <option value="$">$</option>
          <option value="$$">$$</option>
          <option value="$$$">$$$</option>
          <option value="$$$$">$$$$</option>
        </select>
      </label>

      <label htmlFor={invoiceId} className="flex flex-col gap-2 text-sm">
        <span className="font-medium text-neutral-900">{t('invoice')}</span>
        <select id={invoiceId} name="has_invoice" defaultValue="" className={INPUT_CLASS}>
          <option value="">{t('invoiceNone')}</option>
          <option value="oui">{t('invoiceOui')}</option>
          <option value="non">{t('invoiceNon')}</option>
          <option value="sur_demande">{t('invoiceSurDemande')}</option>
        </select>
      </label>

      <label htmlFor={commentId} className="flex flex-col gap-2 text-sm">
        <span className="font-medium text-neutral-900">{t('comment')}</span>
        <textarea
          id={commentId}
          name="comment"
          maxLength={500}
          rows={3}
          placeholder={t('commentPlaceholder')}
          className="rounded-[14px] border border-neutral-300 bg-bg-card px-4 py-3 text-base text-neutral-900 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/30"
        />
      </label>

      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="font-medium text-neutral-900">{t('visibility')}</legend>
        <div className="flex gap-4">
          <label className="inline-flex items-center gap-2">
            <input type="radio" name="visibility" value="pseudonym" defaultChecked />
            {t('visibilityPseudonym')}
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="radio" name="visibility" value="named" />
            {t('visibilityNamed')}
          </label>
        </div>
      </fieldset>

      <div className="flex items-start gap-3">
        <Checkbox
          id="consent_confirmed"
          name="consent_confirmed"
          value="on"
          checked={consent}
          onCheckedChange={(v) => setConsent(v === true)}
        />
        <label htmlFor="consent_confirmed" className="text-sm text-neutral-700">
          {t('consentLabel')}
        </label>
      </div>

      <button
        type="submit"
        disabled={isPending || !consent}
        className="inline-flex min-h-touch-lg items-center justify-center rounded-[14px] bg-accent-500 px-6 text-base font-semibold text-white shadow-sm transition-colors hover:bg-accent-600 disabled:bg-neutral-300 disabled:text-neutral-500"
      >
        {isPending ? t('submitting') : t('submit')}
      </button>
    </form>
  );
}
