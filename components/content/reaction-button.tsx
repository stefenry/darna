'use client';

// Story 6.4 (FR43b) — bouton 👍 1-tap avec compteur agrégé. Optimistic UI
// (incrément immédiat, réconcilié au retour serveur), toggle (2e tap retire).
// Compte 0 → juste « 👍 » sans chiffre. Tap ≥ 48×48. Aucun 👎 (par construction).

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { ThumbsUp } from 'lucide-react';
import { toggleReaction } from '@/app/actions/toggle-reaction';
import type { ReactionTarget } from '@/lib/reactions/config';

type Props = {
  targetType: ReactionTarget;
  targetId: string;
  initialCount: number;
  initialReacted: boolean;
};

export function ReactionButton({ targetType, targetId, initialCount, initialReacted }: Props) {
  const t = useTranslations('reactions');
  const [count, setCount] = useState(initialCount);
  const [reacted, setReacted] = useState(initialReacted);
  const [isPending, startTransition] = useTransition();

  function onClick() {
    const prevReacted = reacted;
    const prevCount = count;
    const nextReacted = !prevReacted;
    // Optimistic.
    setReacted(nextReacted);
    setCount(prevCount + (nextReacted ? 1 : -1));

    startTransition(async () => {
      const res = await toggleReaction(targetType, targetId);
      if (res.ok) {
        setReacted(res.reacted);
        setCount(res.count);
      } else {
        // Échec → revert.
        setReacted(prevReacted);
        setCount(prevCount);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending}
      aria-pressed={reacted}
      aria-label={t('like')}
      className={`inline-flex min-h-touch min-w-touch items-center justify-center gap-1.5 rounded-[10px] px-3 text-sm font-semibold transition-colors disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 ${
        reacted
          ? 'bg-accent-100 text-accent-700'
          : 'bg-bg-soft text-neutral-700 hover:bg-neutral-300'
      }`}
    >
      <ThumbsUp className="size-4 shrink-0" aria-hidden />
      {count > 0 && <span aria-hidden>{count}</span>}
    </button>
  );
}
