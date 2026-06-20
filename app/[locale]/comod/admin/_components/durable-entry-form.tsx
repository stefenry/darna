'use client';

// Story 3.5 (Task 6 / AC2/AC3/AC7) — éditeur bilingue générique (création + édition)
// des 3 entités. Guide/Pack : 2 textareas Markdown FR/AR côte à côte + preview live
// (MarkdownRender). Numéros : champs téléphone. Validation client (≥ FR rempli →
// CTA disabled) miroir du serveur. Avertissement « Non traduit » non bloquant (AC3).
// a11y : fieldset/legend, labels liés (useId), erreurs role="alert", RTL logical.

import { useActionState, useEffect, useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { MarkdownRender } from '@/components/content/markdown-render';
import {
  GUIDE_THEME_CHOICES,
  USEFUL_NUMBER_CATEGORY_CHOICES,
  type DurableKind,
} from '@/lib/content/admin-config';
import {
  saveDurableEntry,
  DURABLE_INITIAL,
  type DurableActionState,
} from '../_actions/durable-content';
import type { DurableEntryValues } from '../_data/durable';

type Props = {
  kind: DurableKind;
  // `mode` reste dans l'API pour le wrapper appelant (admin-page-views) mais le
  // form se branche sur `existing` directement (create = null, edit = values).
  mode: 'create' | 'edit';
  id?: string;
  existing?: DurableEntryValues | null;
  locale: string;
};

function str(v: string | number | null | undefined): string {
  return v == null ? '' : String(v);
}

export function DurableEntryForm({ kind, id, existing, locale }: Props) {
  const t = useTranslations('comod.admin');
  const tThemes = useTranslations('community.guide.themes');
  const tCats = useTranslations('community.numerosUtiles.categories');
  const tErr = useTranslations('errors.comod');
  const router = useRouter();

  const action = saveDurableEntry.bind(null, { kind, id });
  const [state, formAction, isPending] = useActionState<DurableActionState, FormData>(
    action,
    DURABLE_INITIAL,
  );

  const isMarkdown = kind !== 'numeros';
  const e = existing ?? {};

  // Champs FR pilotés (gating CTA + preview live).
  const [titleFr, setTitleFr] = useState(str(isMarkdown ? e.title_fr : e.label_fr));
  const [bodyFr, setBodyFr] = useState(str(e.body_fr_markdown));
  const [bodyAr, setBodyAr] = useState(str(e.body_ar_markdown));
  const [phone, setPhone] = useState(str(e.phone_e164));

  const frFilled = isMarkdown
    ? titleFr.trim().length > 0 && bodyFr.trim().length > 0
    : titleFr.trim().length > 0 && phone.trim().length > 0;

  // Flag « une soumission a réussi » : on push vers la liste après succès réel
  // (l'état initial vaut aussi `ok:true` → ne pas naviguer sans soumission). Si
  // avertissement untranslated, on laisse l'encart visible (pas de redirect auto).
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => {
    if (submitted && state.ok) {
      const warn = (state as { warning?: string }).warning;
      if (!warn) router.push(`/${locale}/comod/admin/${routeOf(kind)}`);
    }
  }, [submitted, state, router, locale, kind]);

  const fieldErr = !state.ok ? state : null;
  const ids = {
    selector: useId(),
    titleFr: useId(),
    titleAr: useId(),
    bodyFr: useId(),
    bodyAr: useId(),
    phone: useId(),
    notesFr: useId(),
    notesAr: useId(),
    order: useId(),
    slug: useId(),
  };

  return (
    <form
      action={(fd) => {
        setSubmitted(true);
        formAction(fd);
      }}
      noValidate
      aria-busy={isPending}
      className="flex flex-col gap-5 pb-28"
    >
      {fieldErr && (
        <p role="alert" className="rounded-[10px] bg-bg-soft px-3 py-2 text-sm text-danger">
          {tErr(fieldErr.message_key.replace('errors.comod.', '') as never)}
        </p>
      )}
      {state.ok && (state as { warning?: string }).warning === 'untranslated' && (
        <p role="status" className="rounded-[10px] bg-bg-soft px-3 py-2 text-sm text-warning">
          {t('untranslatedWarning')}
        </p>
      )}

      {/* Sélecteur thème / catégorie / section */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.selector} className="text-sm font-medium text-neutral-700">
          {kind === 'guide'
            ? t('guide.themeLabel')
            : kind === 'numeros'
              ? t('numeros.categoryLabel')
              : t('pack.sectionLabel')}
        </label>
        {kind === 'guide' && (
          <select
            id={ids.selector}
            name="theme_key"
            defaultValue={str(e.theme_key) || GUIDE_THEME_CHOICES[0]}
            className={selectClass}
          >
            {GUIDE_THEME_CHOICES.map((k) => (
              <option key={k} value={k}>
                {tThemes(k)}
              </option>
            ))}
          </select>
        )}
        {kind === 'numeros' && (
          <select
            id={ids.selector}
            name="category_key"
            defaultValue={str(e.category_key) || USEFUL_NUMBER_CATEGORY_CHOICES[0]}
            className={selectClass}
          >
            {USEFUL_NUMBER_CATEGORY_CHOICES.map((k) => (
              <option key={k} value={k}>
                {tCats(k)}
              </option>
            ))}
          </select>
        )}
        {kind === 'pack' && (
          <input
            id={ids.selector}
            name="section_key"
            defaultValue={str(e.section_key)}
            className={inputClass}
          />
        )}
      </div>

      {/* Titre / label FR + AR */}
      <fieldset className="flex flex-col gap-3 border-0 p-0">
        <legend className="mb-1 text-sm font-medium text-neutral-700">
          {isMarkdown ? t('frEditor') : t('numeros.phoneLabel')}
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.titleFr} className="text-xs text-neutral-500">
              FR *
            </label>
            <input
              id={ids.titleFr}
              name={isMarkdown ? 'title_fr' : 'label_fr'}
              value={titleFr}
              onChange={(ev) => setTitleFr(ev.target.value)}
              required
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.titleAr} className="text-xs text-neutral-500">
              AR
            </label>
            <input
              id={ids.titleAr}
              name={isMarkdown ? 'title_ar' : 'label_ar'}
              defaultValue={str(isMarkdown ? e.title_ar : e.label_ar)}
              dir="rtl"
              className={inputClass}
            />
          </div>
        </div>
      </fieldset>

      {/* Numéros : téléphone + notes */}
      {kind === 'numeros' && (
        <>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.phone} className="text-sm font-medium text-neutral-700">
              {t('numeros.phoneLabel')} *
            </label>
            <input
              id={ids.phone}
              name="phone_e164"
              inputMode="tel"
              value={phone}
              onChange={(ev) => setPhone(ev.target.value)}
              placeholder="+212600000000"
              dir="ltr"
              className={inputClass}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={ids.notesFr} className="text-xs text-neutral-500">
                {t('numeros.notesLabel')} FR
              </label>
              <input
                id={ids.notesFr}
                name="notes_fr"
                defaultValue={str(e.notes_fr)}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={ids.notesAr} className="text-xs text-neutral-500">
                {t('numeros.notesLabel')} AR
              </label>
              <input
                id={ids.notesAr}
                name="notes_ar"
                defaultValue={str(e.notes_ar)}
                dir="rtl"
                className={inputClass}
              />
            </div>
          </div>
        </>
      )}

      {/* Markdown FR/AR côte à côte + preview live */}
      {isMarkdown && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.bodyFr} className="text-sm font-medium text-neutral-700">
              {t('frEditor')} (Markdown) *
            </label>
            <textarea
              id={ids.bodyFr}
              name="body_fr_markdown"
              value={bodyFr}
              onChange={(ev) => setBodyFr(ev.target.value)}
              rows={10}
              required
              className={textareaClass}
            />
            <div className="rounded-[10px] border border-neutral-200 p-3">
              <p className="mb-1 text-xs text-neutral-400">{t('preview')}</p>
              <MarkdownRender source={bodyFr} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.bodyAr} className="text-sm font-medium text-neutral-700">
              {t('arEditor')} (Markdown)
            </label>
            <textarea
              id={ids.bodyAr}
              name="body_ar_markdown"
              value={bodyAr}
              onChange={(ev) => setBodyAr(ev.target.value)}
              rows={10}
              dir="rtl"
              className={textareaClass}
            />
            <div className="rounded-[10px] border border-neutral-200 p-3" dir="rtl">
              <p className="mb-1 text-xs text-neutral-400">{t('preview')}</p>
              <MarkdownRender source={bodyAr} />
            </div>
          </div>
        </div>
      )}

      {/* Slug (Guide) + ordre */}
      <div className="grid gap-3 sm:grid-cols-2">
        {kind === 'guide' && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.slug} className="text-sm font-medium text-neutral-700">
              slug
            </label>
            <input
              id={ids.slug}
              name="slug"
              defaultValue={str(e.slug)}
              dir="ltr"
              className={inputClass}
            />
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.order} className="text-sm font-medium text-neutral-700">
            {t('orderLabel')}
          </label>
          <input
            id={ids.order}
            name={
              kind === 'guide'
                ? 'order_in_theme'
                : kind === 'numeros'
                  ? 'order_in_category'
                  : 'order_in_section'
            }
            type="number"
            min={0}
            defaultValue={str(e.order_in_theme ?? e.order_in_category ?? e.order_in_section ?? 0)}
            className={inputClass}
          />
        </div>
      </div>

      {/* CTA sticky */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-neutral-200 bg-white/95 p-4 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => router.push(`/${locale}/comod/admin/${routeOf(kind)}`)}
            className="inline-flex min-h-touch items-center justify-center rounded-[14px] px-4 text-sm font-medium text-neutral-600 hover:bg-bg-soft"
          >
            {t('cancel')}
          </button>
          <button
            type="submit"
            disabled={!frFilled || isPending}
            className="inline-flex min-h-touch items-center justify-center rounded-[14px] bg-accent-500 px-6 text-sm font-semibold text-white hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? t('saving') : t('save')}
          </button>
        </div>
      </div>
    </form>
  );
}

function routeOf(kind: DurableKind): string {
  return kind === 'guide' ? 'guide' : kind === 'numeros' ? 'numeros-utiles' : 'pack-accueil';
}

const inputClass =
  'min-h-touch w-full rounded-[14px] bg-bg-soft px-4 text-base text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500';
const selectClass = inputClass;
const textareaClass =
  'w-full rounded-[14px] bg-bg-soft px-4 py-3 font-mono text-sm text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500';
