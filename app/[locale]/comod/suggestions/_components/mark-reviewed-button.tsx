'use client';

// Story 6.5 — bouton co_mod « Marquer comme lue » (optimiste léger via transition).

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
import { markSuggestionReviewed } from '../actions';

export function MarkReviewedButton({ id }: { id: string }) {
  const t = useTranslations('suggestion.comod');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const res = await markSuggestionReviewed(id);
          if (res.ok) router.refresh();
        })
      }
      className="inline-flex min-h-touch w-fit items-center justify-center gap-2 rounded-[10px] bg-bg-soft px-4 text-sm font-semibold text-accent-600 hover:bg-neutral-300 disabled:opacity-50"
    >
      <Check className="size-4" aria-hidden />
      {t('markRead')}
    </button>
  );
}
