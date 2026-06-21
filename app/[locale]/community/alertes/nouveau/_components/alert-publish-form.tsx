'use client';

// Story 4.2 — publication d'alerte en ~1 tap. Étape 1 : grille de modèles (tap
// area ≥ 56×56, NFR36). Étape 2 : formulaire pré-rempli (corps éditable + durée
// 24/72/168h) avec un seul CTA « Publier ». « Autre » = saisie libre. Version AR
// optionnelle repliée (MVP FR-only, FR48).

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Bug, Dog, Droplet, Megaphone, Package, Search, Zap, type LucideIcon } from 'lucide-react';
import { ALERT_DURATIONS_HOURS } from '@/lib/content/ephemeral';
import { createAlert, type CreateAlertState } from '../actions';
import { CREATE_ALERT_INITIAL } from '../state';

export type TemplateOption = {
  key: string;
  icon: string;
  labelFr: string;
  labelAr: string | null;
  bodyFr: string | null;
  bodyAr: string | null;
  durationHours: number;
};

const ICONS: Record<string, LucideIcon> = {
  Droplet,
  Zap,
  Bug,
  Dog,
  Search,
  Package,
  Megaphone,
};

export function AlertPublishForm({
  templates,
  locale,
}: {
  templates: TemplateOption[];
  locale: string;
}) {
  const t = useTranslations('community.alertes');
  const tErr = useTranslations('errors.alert');
  const router = useRouter();
  const [selected, setSelected] = useState<TemplateOption | null>(null);
  const [state, formAction, isPending] = useActionState<CreateAlertState, FormData>(
    createAlert,
    CREATE_ALERT_INITIAL,
  );

  useEffect(() => {
    if (state.ok) router.push(`/${locale}/community/alertes`);
  }, [state, router, locale]);

  // ── Étape 1 : grille de modèles ─────────────────────────────────────────────
  if (!selected) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-neutral-700">{t('new.pickTemplate')}</p>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {templates.map((tpl) => {
            const Icon = ICONS[tpl.icon] ?? Megaphone;
            return (
              <li key={tpl.key}>
                <button
                  type="button"
                  onClick={() => setSelected(tpl)}
                  className="flex min-h-touch-lg w-full flex-col items-center justify-center gap-2 rounded-[14px] bg-white p-4 text-center shadow-xs hover:bg-bg-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
                >
                  <Icon className="size-6 text-accent-600" aria-hidden />
                  <span className="text-sm font-semibold text-neutral-900">{tpl.labelFr}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  // ── Étape 2 : formulaire pré-rempli ─────────────────────────────────────────
  const fieldError = !state.ok && 'error' in state ? state.error : null;
  const errMsg =
    fieldError && fieldError.code === 'validation'
      ? tErr(fieldError.message_key)
      : fieldError && fieldError.code === 'rate_limited'
        ? tErr('rate_limited')
        : fieldError && (fieldError.code === 'forbidden' || fieldError.code === 'submit_failed')
          ? tErr('submit_failed')
          : null;

  return (
    <form
      key={selected.key}
      action={formAction}
      noValidate
      aria-busy={isPending}
      className="flex flex-col gap-4 pb-28"
    >
      <input type="hidden" name="template_key" value={selected.key} />

      <button
        type="button"
        onClick={() => setSelected(null)}
        className="inline-flex min-h-touch w-fit items-center text-sm font-medium text-accent-600 hover:underline"
      >
        {t('new.changeTemplate')}
      </button>

      {errMsg && (
        <p
          role="alert"
          className="rounded-[14px] border border-danger/30 bg-bg-soft p-3 text-sm text-danger"
        >
          {errMsg}
        </p>
      )}

      <fieldset className="flex flex-col gap-4" disabled={isPending}>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-neutral-700">{t('new.titleLabel')}</span>
          <input
            name="title_fr"
            type="text"
            required
            maxLength={200}
            defaultValue={selected.labelFr}
            className="min-h-touch rounded-[10px] bg-bg-soft px-3 text-base text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-neutral-700">{t('new.bodyLabel')}</span>
          <textarea
            name="body_fr"
            required
            rows={4}
            maxLength={5000}
            defaultValue={selected.bodyFr ?? ''}
            placeholder={t('new.bodyPlaceholder')}
            className="rounded-[10px] bg-bg-soft px-3 py-2 text-base text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500"
          />
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-neutral-700">{t('new.durationLabel')}</legend>
          <div className="flex flex-wrap gap-2">
            {ALERT_DURATIONS_HOURS.map((h) => (
              <label
                key={h}
                className="inline-flex min-h-touch cursor-pointer items-center gap-2 rounded-[10px] bg-bg-soft px-4 text-sm font-medium text-neutral-800 has-[:checked]:bg-accent-100 has-[:checked]:text-accent-700 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent-500"
              >
                <input
                  type="radio"
                  name="duration_hours"
                  value={h}
                  defaultChecked={h === selected.durationHours}
                  className="size-4 accent-accent-500"
                />
                {t(`new.duration.${h}`)}
              </label>
            ))}
          </div>
        </fieldset>

        <details className="rounded-[10px] bg-bg-soft px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium text-neutral-600">
            {t('new.addArabic')}
          </summary>
          <div className="mt-3 flex flex-col gap-3" dir="rtl">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-neutral-700">{t('new.titleLabelAr')}</span>
              <input
                name="title_ar"
                type="text"
                maxLength={200}
                defaultValue={selected.labelAr ?? ''}
                className="min-h-touch rounded-[10px] bg-white px-3 text-base text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-neutral-700">{t('new.bodyLabelAr')}</span>
              <textarea
                name="body_ar"
                rows={4}
                maxLength={5000}
                defaultValue={selected.bodyAr ?? ''}
                className="rounded-[10px] bg-white px-3 py-2 text-base text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500"
              />
            </label>
          </div>
        </details>
      </fieldset>

      <div className="fixed inset-x-0 bottom-0 border-t border-neutral-200 bg-bg-page/95 p-4 backdrop-blur">
        <div className="mx-auto max-w-2xl">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex min-h-touch-lg w-full items-center justify-center rounded-[14px] bg-accent-500 px-6 text-base font-semibold text-white hover:bg-accent-600 disabled:opacity-50"
          >
            {isPending ? t('new.publishing') : t('new.publish')}
          </button>
        </div>
      </div>
    </form>
  );
}
