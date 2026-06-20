'use client';

// Story 2.8 — formulaire de réponse / rectification. POST natif vers le webhook
// (pas `useActionState` — pattern 2.5 PRG, évite le cluster jsdom). 2 sections
// exclusives (toggle), seule la section active rend ses champs → seuls ses inputs
// sont soumis ; le bouton submit porte `name="kind"`.

import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';

type RecentRating = { id: string; createdAt: string; summary: string };

const FIELD_TARGETS = [
  'display_name_fr',
  'display_name_ar',
  'phone_e164',
  'competences',
  'price_relative',
  'has_invoice',
] as const;

const INPUT_CLASS =
  'min-h-touch rounded-[14px] border border-neutral-300 bg-bg-card px-4 text-base text-neutral-900 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/30';
const TEXTAREA_CLASS =
  'rounded-[14px] border border-neutral-300 bg-bg-card px-4 py-3 text-base text-neutral-900 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/30';

function formatDate(s: string, locale: string): string {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(locale, { day: '2-digit', month: 'short' });
}

export function RespondForm({
  token,
  locale,
  recentRatings,
}: {
  token: string;
  locale: string;
  recentRatings: RecentRating[];
}) {
  const t = useTranslations('artisanRespond');
  const [tab, setTab] = useState<'response' | 'rectification'>('response');
  const [targetKind, setTargetKind] = useState<'listing' | 'rating'>('listing');
  const [respLen, setRespLen] = useState(0);
  const [justifLen, setJustifLen] = useState(0);
  const respId = useId();
  const justifId = useId();

  const tabClass = (active: boolean) =>
    `min-h-touch rounded-[14px] px-4 text-sm font-medium ${active ? 'bg-accent-500 text-white' : 'bg-bg-soft text-neutral-700'}`;

  return (
    <div className="flex flex-col gap-5">
      <div role="tablist" className="flex gap-2">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'response'}
          onClick={() => setTab('response')}
          className={tabClass(tab === 'response')}
        >
          {t('tabResponse')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'rectification'}
          onClick={() => setTab('rectification')}
          className={tabClass(tab === 'rectification')}
        >
          {t('tabRectification')}
        </button>
      </div>

      <form action="/api/webhook/artisan-respond" method="post" className="flex flex-col gap-4">
        <input type="hidden" name="token" value={token} />

        {tab === 'response' ? (
          <>
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-neutral-900">{t('targetKindLabel')}</span>
              <select
                name="target_kind"
                value={targetKind}
                onChange={(e) => setTargetKind(e.target.value as 'listing' | 'rating')}
                className={INPUT_CLASS}
              >
                <option value="listing">{t('targetKindListing')}</option>
                {recentRatings.length > 0 && (
                  <option value="rating">{t('targetKindRating')}</option>
                )}
              </select>
            </label>

            {targetKind === 'rating' && recentRatings.length > 0 && (
              <label className="flex flex-col gap-2 text-sm">
                <span className="font-medium text-neutral-900">{t('recentRatings')}</span>
                <select name="target_id" className={INPUT_CLASS}>
                  {recentRatings.map((r) => (
                    <option key={r.id} value={r.id}>
                      {formatDate(r.createdAt, locale)} — {r.summary}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label htmlFor={respId} className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-neutral-900">{t('responseTextLabel')}</span>
              <textarea
                id={respId}
                name="response_text"
                required
                maxLength={500}
                rows={5}
                placeholder={t('responseTextPlaceholder')}
                onChange={(e) => setRespLen(e.target.value.length)}
                aria-describedby={`${respId}-count`}
                className={TEXTAREA_CLASS}
              />
              <span
                id={`${respId}-count`}
                className="text-end text-xs tabular-nums text-neutral-500"
              >
                {t('charCount', { count: String(respLen) })}
              </span>
            </label>

            <button
              type="submit"
              name="kind"
              value="response"
              className="inline-flex min-h-touch-lg items-center justify-center rounded-[14px] bg-accent-500 px-6 text-base font-semibold text-white shadow-sm hover:bg-accent-600"
            >
              {t('submitResponse')}
            </button>
          </>
        ) : (
          <>
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-neutral-900">{t('fieldTargetLabel')}</span>
              <select name="field_target" required className={INPUT_CLASS}>
                {FIELD_TARGETS.map((f) => (
                  <option key={f} value={f}>
                    {t(`fields.${f}`)}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-neutral-900">{t('requestedValueLabel')}</span>
              <input
                name="requested_value"
                type="text"
                required
                maxLength={200}
                className={INPUT_CLASS}
              />
            </label>

            <label htmlFor={justifId} className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-neutral-900">{t('justificationLabel')}</span>
              <textarea
                id={justifId}
                name="justification_text"
                required
                maxLength={500}
                rows={4}
                onChange={(e) => setJustifLen(e.target.value.length)}
                aria-describedby={`${justifId}-count`}
                className={TEXTAREA_CLASS}
              />
              <span
                id={`${justifId}-count`}
                className="text-end text-xs tabular-nums text-neutral-500"
              >
                {t('charCount', { count: String(justifLen) })}
              </span>
            </label>

            <button
              type="submit"
              name="kind"
              value="rectification"
              className="inline-flex min-h-touch-lg items-center justify-center rounded-[14px] bg-accent-500 px-6 text-base font-semibold text-white shadow-sm hover:bg-accent-600"
            >
              {t('submitRectification')}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
