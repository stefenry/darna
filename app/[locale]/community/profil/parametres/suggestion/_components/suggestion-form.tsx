'use client';

// Story 6.5 — formulaire de suggestion (texte libre ≤1000). Un seul champ + CTA.
// Accusé de réception on-screen au succès (FR43c). Pas de vote, pas de débat.

import { useActionState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { SUGGESTION_MAXLEN } from '@/lib/validation/suggestion';
import { submitSuggestion, type SubmitSuggestionState } from '../actions';
import { SUGGESTION_INITIAL } from '../state';

export function SuggestionForm() {
  const t = useTranslations('suggestion');
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState<SubmitSuggestionState, FormData>(
    submitSuggestion,
    SUGGESTION_INITIAL,
  );

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  const errorKey = !state.ok && 'code' in state ? state.code : null;

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3" aria-busy={isPending}>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-neutral-700">{t('label')}</span>
        <textarea
          name="body"
          required
          rows={5}
          maxLength={SUGGESTION_MAXLEN}
          placeholder={t('placeholder')}
          className="rounded-[10px] bg-bg-soft px-3 py-2 text-base text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500"
        />
      </label>

      <div aria-live="polite" className="min-h-5 text-sm">
        {state.ok && <span className="font-medium text-accent-600">{t('ack')}</span>}
        {errorKey && (
          <span role="alert" className="text-danger">
            {t(`error.${errorKey}`)}
          </span>
        )}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex min-h-touch-lg w-fit items-center justify-center rounded-[14px] bg-accent-500 px-6 text-base font-semibold text-white hover:bg-accent-600 disabled:opacity-50"
      >
        {isPending ? t('submitting') : t('submit')}
      </button>
    </form>
  );
}
