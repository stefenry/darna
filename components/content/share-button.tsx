'use client';

// Story 6.2 (FR37) — bouton « Partager » 1-tap, montable sur toute fiche. Utilise
// le partage natif (`navigator.share` → WhatsApp natif sur mobile) ; à défaut,
// copie le lien canonique dans le presse-papier + toast « Lien copié ». AUCUNE
// modale (règle Aïcha NFR40). Tap target ≥ 48×48. Compteur best-effort au succès.

import { useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Share2 } from 'lucide-react';
import { recordShare } from '@/app/actions/record-share';
import type { ShareKind } from '@/lib/share/entities';

type Props = {
  kind: ShareKind;
  id: string;
  /** URL canonique absolue (locale-less, déjà construite côté serveur). */
  url: string;
  title: string;
  /** Courte description partagée (texte natif), optionnelle. */
  text?: string;
  variant?: 'button' | 'inline';
};

export function ShareButton({ kind, id, url, title, text, variant = 'button' }: Props) {
  const t = useTranslations('share.button');
  const [copied, setCopied] = useState(false);
  const [, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function flagCopied() {
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2500);
  }

  async function onShare() {
    let didShare = false;
    let viaClipboard = false;
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title, text, url });
        didShare = true;
      } else {
        await navigator.clipboard.writeText(url);
        didShare = true;
        viaClipboard = true;
      }
    } catch (err) {
      // L'utilisateur a annulé la feuille de partage native → ne pas compter.
      if (err instanceof Error && err.name === 'AbortError') return;
      // Échec du partage natif → repli presse-papier.
      try {
        await navigator.clipboard.writeText(url);
        didShare = true;
        viaClipboard = true;
      } catch {
        return;
      }
    }
    if (viaClipboard) flagCopied();
    if (didShare) startTransition(() => void recordShare(kind, id));
  }

  const className =
    variant === 'button'
      ? 'inline-flex min-h-touch min-w-touch items-center justify-center gap-2 rounded-[14px] bg-bg-soft px-5 text-sm font-semibold text-accent-600 hover:bg-neutral-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500'
      : 'inline-flex min-h-touch min-w-touch items-center justify-center gap-2 rounded-[10px] px-3 text-sm font-medium text-accent-600 hover:bg-bg-soft';

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={onShare} className={className}>
        <Share2 className="size-4 shrink-0" aria-hidden />
        {t('share')}
      </button>
      <span aria-live="polite" className="text-sm text-accent-600">
        {copied ? t('copied') : ''}
      </span>
    </div>
  );
}
