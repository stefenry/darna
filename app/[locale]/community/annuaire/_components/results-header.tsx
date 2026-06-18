// Story 2.2 (AC2/AC3) — compteur de résultats + indicateur « plus de N » quand
// le pool dépasse PAGE_SIZE. Le compteur vit dans le Suspense résultats : il
// n'est rendu qu'au moment où les données arrivent (review F26 : évite
// l'annonce aria-live à chaque keystroke ; l'annonce se fait au settle).

import { useTranslations } from 'next-intl';

type Props = {
  count: number;
  hasMore: boolean;
};

export function ResultsHeader({ count, hasMore }: Props) {
  const t = useTranslations('community.annuaire');
  return (
    <p role="status" aria-live="polite" className="text-sm text-neutral-500">
      {t('resultsCount', { count })}
      {hasMore && <span className="ms-1">· {t('resultsMore')}</span>}
    </p>
  );
}
