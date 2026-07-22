'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { addTag, renameTag } from '../../_actions/tags';

// Formulaire d'ajout + liste avec édition inline des libellés. La clé (slug)
// est générée en SQL et immuable — seule l'édition des libellés est proposée.

type TagRow = { key: string; labelFr: string; labelAr: string | null; usageCount: number };

const INPUT_CLASS =
  'min-h-touch rounded-[10px] bg-card px-3 text-sm shadow-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500';

export function TagsAdmin({ tags }: Readonly<{ tags: TagRow[] }>) {
  const t = useTranslations('comod.admin.competences');
  const router = useRouter();
  const [labelFr, setLabelFr] = useState('');
  const [labelAr, setLabelAr] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const [isPending, startTransition] = useTransition();

  const addValid = labelFr.trim().length >= 2 && labelFr.trim().length <= 40;

  function submitAdd() {
    if (!addValid) return;
    setAddError(null);
    setAdded(false);
    startTransition(async () => {
      const res = await addTag(labelFr, labelAr);
      if (res.ok) {
        setLabelFr('');
        setLabelAr('');
        setAdded(true);
        router.refresh();
      } else {
        setAddError(t(`error.${res.code}`));
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        className="flex flex-col gap-3 rounded-[14px] bg-white p-4 shadow-xs"
        onSubmit={(e) => {
          e.preventDefault();
          submitAdd();
        }}
      >
        <h2 className="text-lg font-semibold text-neutral-900">{t('addTitle')}</h2>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500">{t('labelFrLabel')}</span>
          <input
            type="text"
            value={labelFr}
            onChange={(e) => setLabelFr(e.target.value)}
            maxLength={40}
            placeholder={t('labelFrPlaceholder')}
            className={INPUT_CLASS}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500">{t('labelArLabel')}</span>
          <input
            type="text"
            value={labelAr}
            onChange={(e) => setLabelAr(e.target.value)}
            maxLength={40}
            dir="rtl"
            className={INPUT_CLASS}
          />
        </label>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isPending || !addValid}
            className="inline-flex min-h-touch items-center justify-center rounded-[14px] bg-accent-500 px-6 text-base font-semibold text-white transition-colors hover:bg-accent-600 disabled:bg-neutral-300 disabled:text-neutral-500"
          >
            {isPending ? t('adding') : t('addCta')}
          </button>
          {added && <span className="text-sm text-accent-600">{t('added')}</span>}
        </div>
        {addError && (
          <span role="alert" className="text-xs text-danger">
            {addError}
          </span>
        )}
      </form>

      <ul className="flex flex-col divide-y divide-neutral-200 rounded-[14px] bg-white shadow-xs">
        {tags.map((tag) => (
          <TagListItem key={tag.key} tag={tag} />
        ))}
      </ul>
    </div>
  );
}

function TagListItem({ tag }: Readonly<{ tag: TagRow }>) {
  const t = useTranslations('comod.admin.competences');
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [labelFr, setLabelFr] = useState(tag.labelFr);
  const [labelAr, setLabelAr] = useState(tag.labelAr ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const valid = labelFr.trim().length >= 2 && labelFr.trim().length <= 40;

  function submitRename() {
    if (!valid) return;
    setError(null);
    startTransition(async () => {
      const res = await renameTag(tag.key, labelFr, labelAr);
      if (res.ok) {
        setEditing(false);
        router.refresh();
      } else {
        setError(t(`error.${res.code}`));
      }
    });
  }

  if (!editing) {
    return (
      <li className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium text-neutral-900">{tag.labelFr}</span>
          <span className="text-xs text-neutral-500">
            {t('usageCount', { count: tag.usageCount })}
            {tag.labelAr ? ` · ${tag.labelAr}` : ''}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="shrink-0 rounded-[10px] border border-accent-500 px-3 py-1.5 text-sm font-medium text-accent-600 hover:bg-bg-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
        >
          {t('editCta')}
        </button>
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={labelFr}
          onChange={(e) => setLabelFr(e.target.value)}
          maxLength={40}
          aria-label={t('labelFrLabel')}
          className={`${INPUT_CLASS} flex-1`}
        />
        <input
          type="text"
          value={labelAr}
          onChange={(e) => setLabelAr(e.target.value)}
          maxLength={40}
          dir="rtl"
          aria-label={t('labelArLabel')}
          className={`${INPUT_CLASS} flex-1`}
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={submitRename}
          disabled={isPending || !valid}
          className="rounded-[10px] bg-accent-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-accent-600 disabled:opacity-60"
        >
          {t('saveCta')}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setLabelFr(tag.labelFr);
            setLabelAr(tag.labelAr ?? '');
            setError(null);
          }}
          disabled={isPending}
          className="rounded-[10px] px-2 py-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900"
        >
          {t('cancel')}
        </button>
      </div>
      {error && (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      )}
    </li>
  );
}
