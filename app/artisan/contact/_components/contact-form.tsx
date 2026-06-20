'use client';

// Story 2.8 — formulaire de demande de magic-link droit de réponse. `useActionState`
// → requestArtisanContactLink. AR38 : la réponse est toujours générique ; aucune
// erreur explicite (Zod silencieux). Bouton « Renvoyer » désactivé 60s post-submit.

import { useActionState, useEffect, useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { requestArtisanContactLink, CONTACT_LINK_INITIAL } from '../actions';

const INPUT_CLASS =
  'min-h-touch rounded-[14px] border border-neutral-300 bg-bg-card px-4 text-base text-neutral-900 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/30';

export function ContactForm() {
  const t = useTranslations('artisanContact');
  const [state, formAction, isPending] = useActionState(
    requestArtisanContactLink,
    CONTACT_LINK_INITIAL,
  );
  const phoneId = useId();
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (state.ok) setCooldown(60);
  }, [state]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5" aria-busy={isPending}>
      {state.ok && (
        <p
          role="alert"
          aria-live="polite"
          className="rounded-[14px] bg-accent-50 px-4 py-3 text-sm text-neutral-800"
        >
          {t('successGeneric')}
        </p>
      )}

      <label htmlFor={phoneId} className="flex flex-col gap-2 text-sm">
        <span className="font-medium text-neutral-900">{t('phoneLabel')}</span>
        <input
          id={phoneId}
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          placeholder={t('phoneHelper')}
          className={INPUT_CLASS}
        />
      </label>

      <button
        type="submit"
        disabled={isPending || cooldown > 0}
        className="inline-flex min-h-touch-lg items-center justify-center rounded-[14px] bg-accent-500 px-6 text-base font-semibold text-white shadow-sm transition-colors hover:bg-accent-600 disabled:bg-neutral-300 disabled:text-neutral-500"
      >
        {cooldown > 0 ? `${t('submit')} (${cooldown}s)` : t('submit')}
      </button>
    </form>
  );
}
