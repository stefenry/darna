'use client';

// Refonte 2026-09 — barre d'onglets fixe en bas de la zone communautaire. Les
// libellés arrivent déjà traduits du layout serveur ; ce composant ne porte que
// l'état actif. Masquée sur la fiche artisan, où le CTA « Appeler » occupe le bas
// de l'écran.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, Home, ShieldCheck, User, Users, type LucideIcon } from 'lucide-react';

const ICONS = {
  home: Home,
  annuaire: Users,
  alertes: Bell,
  profil: User,
  comod: ShieldCheck,
} satisfies Record<string, LucideIcon>;

export type BottomNavItem = {
  key: keyof typeof ICONS;
  href: string;
  label: string;
  // `exact` : l'accueil n'est actif que sur sa propre URL, pas sur tout /community.
  exact?: boolean;
};

export function BottomNav({ items, label }: { items: BottomNavItem[]; label: string }) {
  const pathname = usePathname();
  if (pathname.includes('/community/artisan/')) return null;

  return (
    <nav
      aria-label={label}
      className="fixed inset-x-0 bottom-0 z-20 border-t border-neutral-200 bg-bg-card pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-2xl px-3">
        {items.map(({ key, href, label: itemLabel, exact }) => {
          const Icon = ICONS[key];
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <li key={key} className="min-w-0 flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-touch-lg flex-col items-center gap-1 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-500 ${
                  active ? 'text-neutral-900' : 'text-neutral-500'
                }`}
              >
                <span
                  aria-hidden
                  className={`h-[3px] w-6 rounded-full ${active ? 'bg-neutral-900' : 'bg-transparent'}`}
                />
                <Icon className="size-[22px]" strokeWidth={1.7} aria-hidden />
                <span className="max-w-full truncate">{itemLabel}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
