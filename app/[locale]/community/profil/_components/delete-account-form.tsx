'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { deleteAccount } from '../actions';
import { DELETE_CONFIRM_PHRASE } from '@/lib/validation/profile';

type Props = {
  locale: string;
};

// Danger Zone : le bouton destructive reste désactivé tant que la phrase tapée
// ≠ DELETE_CONFIRM_PHRASE ('SUPPRIMER', D2). Double-belt : la Server Action
// revalide via Zod côté serveur.
export function DeleteAccountForm({ locale }: Props) {
  const t = useTranslations('profil.delete');
  const tErr = useTranslations('errors.profil');
  const router = useRouter();
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const ready = confirm === DELETE_CONFIRM_PHRASE;

  function submit() {
    if (!ready) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteAccount({ confirm });
      if (res.ok) {
        router.push(`/${locale}/`);
      } else {
        const errKey = res.message_key.startsWith('errors.profil.')
          ? res.message_key.replace('errors.profil.', '')
          : 'forbidden';
        setError(tErr(errKey));
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor="confirm" className="flex flex-col gap-2 text-sm">
        <span className="text-neutral-700">
          {t('confirmLabel', { phrase: DELETE_CONFIRM_PHRASE })}
        </span>
        <input
          id="confirm"
          type="text"
          name="confirm"
          value={confirm}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder={t('confirmPlaceholder')}
          onChange={(e) => setConfirm(e.target.value)}
          className="min-h-touch rounded-[14px] border border-neutral-300 bg-bg-card px-4 text-base text-neutral-900 focus:border-danger focus:outline-none focus:ring-2 focus:ring-danger/30"
        />
      </label>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={!ready || isPending}
        className="inline-flex min-h-touch items-center justify-center rounded-[14px] bg-danger px-6 text-base font-semibold text-white transition-colors hover:bg-danger/90 disabled:bg-neutral-300 disabled:text-neutral-500"
      >
        {isPending ? t('submitting') : t('submitCta')}
      </button>
    </div>
  );
}
