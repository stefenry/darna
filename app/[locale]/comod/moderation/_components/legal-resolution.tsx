'use client';

// Story 5.5 — résolution out-of-band d'une escalade juridique (report en
// closed_kept_pending_legal). Le co_mod enregistre la suite donnée par le contact
// juridique : « Avis : conserver » (approved) ou « Avis : retirer » (removed) +
// note libre. Divulgation inline, useTransition.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type LegalDecision } from '@/lib/validation/moderation';
import { resolveLegalEscalation } from '../actions';

export function LegalResolution({ reportId, locale }: { reportId: string; locale: string }) {
  const t = useTranslations('comod.moderation');
  const tErr = useTranslations('errors.moderation');
  const router = useRouter();
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = (decision: LegalDecision) => {
    setError(null);
    startTransition(async () => {
      const res = await resolveLegalEscalation({
        report_id: reportId,
        decision,
        note: note.trim() ? note : null,
      });
      if (res.ok) {
        router.push(`/${locale}/comod/moderation`);
        router.refresh();
      } else {
        setError(tErr(res.code));
      }
    });
  };

  return (
    <section className="flex flex-col gap-3 rounded-[14px] border border-neutral-200 bg-bg-soft p-4">
      <p className="text-sm font-semibold text-neutral-800">{t('legal.pendingTitle')}</p>
      <p className="text-sm text-neutral-600">{t('legal.pendingHint')}</p>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700">{t('legal.noteLabel')}</span>
        <textarea
          value={note}
          maxLength={2000}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className="rounded-[10px] border border-neutral-200 bg-white px-3 py-2 text-sm"
          placeholder={t('legal.notePlaceholder')}
        />
      </label>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => submit('approved')}
          disabled={isPending}
          className="inline-flex min-h-touch items-center justify-center rounded-[14px] bg-bg-card px-4 text-sm font-semibold text-accent-600 hover:bg-neutral-200 disabled:opacity-50"
        >
          {t('legal.approve')}
        </button>
        <button
          type="button"
          onClick={() => submit('removed')}
          disabled={isPending}
          className="inline-flex min-h-touch items-center justify-center rounded-[14px] bg-danger px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {t('legal.remove')}
        </button>
      </div>
    </section>
  );
}
