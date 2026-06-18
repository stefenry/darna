'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { validateAdmission } from '../actions';
import { DecisionForm } from './decision-form';

type QueueItem = {
  id: string;
  villa: number;
  tranche: string | null;
  first_name: string;
  created_at: string;
  email_verified_at: string | null;
};

type Props = {
  locale: string;
  items: QueueItem[];
};

export function AdmissionQueue({ locale, items }: Props) {
  const t = useTranslations('comod.admission');

  if (items.length === 0) {
    return (
      <p className="rounded-[14px] bg-bg-soft px-4 py-6 text-center text-base text-neutral-700">
        {t('emptyState')}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <QueueRow key={item.id} locale={locale} item={item} />
      ))}
    </ul>
  );
}

function QueueRow({ locale, item }: { locale: string; item: QueueItem }) {
  const t = useTranslations('comod.admission');
  const tErr = useTranslations('errors.comod');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onResolved() {
    router.refresh();
  }

  function validate() {
    setError(null);
    startTransition(async () => {
      const res = await validateAdmission({ admission_request_id: item.id });
      if (res.ok) {
        router.refresh();
      } else {
        const errKey = res.message_key.startsWith('errors.comod.')
          ? res.message_key.replace('errors.comod.', '')
          : 'decision_failed';
        setError(tErr(errKey));
      }
    });
  }

  const requestedAt = new Date(item.created_at).toLocaleDateString(locale, {
    day: '2-digit',
    month: 'short',
  });

  return (
    <li className="flex flex-col gap-3 rounded-[14px] bg-bg-card p-4 shadow-xs">
      <div className="flex flex-col gap-1">
        <p className="text-base font-medium text-neutral-900">
          {t('columnVilla')} {item.villa}
          {item.tranche ? ` · ${item.tranche}` : ''} · {item.first_name}
        </p>
        <p className="text-sm text-neutral-500">
          {t('requestedAt')} {requestedAt}
          {!item.email_verified_at && (
            <span className="text-warning"> · {t('emailUnverifiedBadge')}</span>
          )}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={validate}
          disabled={isPending}
          className="inline-flex min-h-touch items-center justify-center rounded-[14px] bg-accent-500 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-600 disabled:bg-neutral-300 disabled:text-neutral-500"
        >
          {isPending ? t('submitting') : t('validateCta')}
        </button>
        <DecisionForm admissionRequestId={item.id} onResolved={onResolved} />
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </li>
  );
}
