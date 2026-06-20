// Story 3.2 (AC1/AC7) — section thème dépliable. `<details>` natif (clavier +
// Escape gratuits, NFR37) ; `<summary>` = libellé i18n du thème + compteur ;
// liste de liens deep-link vers `/guide/[slug]` (+ badge « Non traduit » FR48).

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import type { GuideThemeGroup } from '../data';

export function GuideThemeSection({
  locale,
  group,
  defaultOpen = false,
}: {
  locale: string;
  group: GuideThemeGroup;
  defaultOpen?: boolean;
}) {
  const t = useTranslations('community.guide');
  return (
    <details
      open={defaultOpen}
      className="group rounded-[14px] bg-white shadow-xs [&_summary::-webkit-details-marker]:hidden"
    >
      <summary className="flex min-h-touch cursor-pointer list-none items-center justify-between gap-3 rounded-[14px] px-4 py-3 font-semibold text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500">
        <span>{t(`themes.${group.themeKey}`)}</span>
        <span className="flex items-center gap-2">
          <span className="text-sm font-normal text-neutral-500">
            {t('count', { n: group.entries.length })}
          </span>
          <ChevronDown
            className="size-5 text-neutral-400 motion-safe:transition-transform group-open:rotate-180"
            aria-hidden
          />
        </span>
      </summary>
      <ul className="flex flex-col gap-0.5 px-2 pb-2">
        {group.entries.map((entry) => (
          <li key={entry.slug}>
            <Link
              href={`/${locale}/community/guide/${entry.slug}`}
              className="flex min-h-touch items-center justify-between gap-2 rounded-[10px] px-2 py-2 text-base text-neutral-800 hover:bg-bg-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
            >
              <span>{entry.title}</span>
              {entry.untranslated && (
                <span className="shrink-0 rounded-sm bg-bg-soft px-2 py-0.5 text-xs font-medium text-neutral-500">
                  {t('notTranslatedBadge')}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}
