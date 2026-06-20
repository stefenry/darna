// Story 3.4 (AC2/AC5) — section Pack dépliable. `<details>` natif (clavier +
// Escape gratuits, NFR37) ; titre = `section_key` (text libre) ; entrées rendues
// via le renderer Markdown partagé (3.2) — les deep-links Guide markdown
// `[texte](/community/guide/<slug>)` sont résolus par le renderer.

import { useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import { MarkdownRender } from '@/components/content/markdown-render';
import type { PackSection as PackSectionData } from '../data';

export function PackSection({
  section,
  defaultOpen = false,
}: {
  section: PackSectionData;
  defaultOpen?: boolean;
}) {
  const t = useTranslations('community.guide');
  return (
    <details
      open={defaultOpen}
      className="group rounded-[14px] bg-white shadow-xs [&_summary::-webkit-details-marker]:hidden"
    >
      <summary className="flex min-h-touch cursor-pointer list-none items-center justify-between gap-3 rounded-[14px] px-4 py-3 font-semibold text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500">
        <span>{section.sectionKey}</span>
        <ChevronDown
          className="size-5 shrink-0 text-neutral-400 motion-safe:transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="flex flex-col gap-4 px-4 pb-4">
        {section.entries.map((entry, i) => (
          <div key={i} className="flex flex-col gap-1">
            <h3 className="text-base font-semibold text-neutral-900">{entry.title}</h3>
            {entry.untranslated && (
              <span className="w-fit rounded-sm bg-bg-soft px-2 py-0.5 text-xs font-medium text-neutral-500">
                {t('notTranslatedBadge')}
              </span>
            )}
            <MarkdownRender source={entry.body} />
          </div>
        ))}
      </div>
    </details>
  );
}
