'use client';

// Story 3.5 (Task 5 / AC1) — liste d'admin générique (paramétrée `kind`). Cartes :
// libellé, sélecteur (thème/catégorie/section), ordre, badge « retiré » si
// soft-deleted ; boutons Éditer (→ [id]) et Retirer (RetireConfirm). CTA
// « + Nouvelle entrée » → nouveau.

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { RetireConfirm } from './retire-confirm';
import type { DurableKind } from '@/lib/content/admin-config';
import type { AdminListItem } from '../_data/durable';

export function AdminList({
  kind,
  items,
  locale,
}: {
  kind: DurableKind;
  items: AdminListItem[];
  locale: string;
}) {
  const t = useTranslations('comod.admin');
  const tThemes = useTranslations('community.guide.themes');
  const tCats = useTranslations('community.numerosUtiles.categories');
  const route = kind === 'guide' ? 'guide' : kind === 'numeros' ? 'numeros-utiles' : 'pack-accueil';

  const selectorLabel = (raw: string): string => {
    if (kind === 'guide') return tThemes(raw as never);
    if (kind === 'numeros') return tCats(raw as never);
    return raw; // pack section_key = text libre
  };

  return (
    <div className="flex flex-col gap-4">
      <Link
        href={`/${locale}/comod/admin/${route}/nouveau`}
        className="inline-flex min-h-touch w-fit items-center gap-2 rounded-[14px] bg-accent-500 px-5 text-sm font-semibold text-white hover:bg-accent-600"
      >
        <Plus className="size-4" aria-hidden />
        {t('newEntry')}
      </Link>

      {items.length === 0 ? (
        <p className="rounded-[14px] bg-bg-soft px-4 py-6 text-center text-base text-neutral-600">
          {t('empty')}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id} className="flex flex-col gap-2 rounded-[14px] bg-white p-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-col gap-0.5">
                  <span className="font-semibold text-neutral-900">
                    {item.title}
                    {item.retired && (
                      <span className="ms-2 rounded-sm bg-bg-soft px-2 py-0.5 text-xs font-medium text-neutral-500">
                        {t('retiredBadge')}
                      </span>
                    )}
                  </span>
                  <span className="text-sm text-neutral-500">
                    {selectorLabel(item.selector)} · #{item.order}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {/* Éditer une entrée retirée n'a aucun effet public (deleted_at
                      inchangé) → on masque l'action tant qu'elle est retirée. */}
                  {!item.retired && (
                    <Link
                      href={`/${locale}/comod/admin/${route}/${item.id}`}
                      className="inline-flex min-h-touch items-center justify-center rounded-[10px] px-3 text-sm font-medium text-accent-600 hover:bg-bg-soft"
                    >
                      {t('edit')}
                    </Link>
                  )}
                  {!item.retired && <RetireConfirm kind={kind} id={item.id} />}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
