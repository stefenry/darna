import { getTranslations } from 'next-intl/server';

// Story 1.9 — Déclencheurs UI de la déconnexion. Réutilise TEL QUEL la route
// existante app/auth/signout/route.ts (FR10 livré story 1.6) : POST same-origin
// (check CSRF natif), ?scope=local|global, expire les cookies sb-* et redirige
// vers /[locale]/. Aucune modification de la route. Server Component : 2 forms
// POST, zéro JS requis.
export async function SignoutButtons() {
  const t = await getTranslations('auth.common');

  return (
    <div className="flex flex-col gap-2">
      <form method="post" action="/auth/signout?scope=local">
        <button
          type="submit"
          className="inline-flex min-h-touch w-full items-center justify-center rounded-[14px] bg-bg-soft px-6 text-base font-medium text-neutral-700 transition-colors hover:bg-neutral-200"
        >
          {t('signOutLocal')}
        </button>
      </form>
      <form method="post" action="/auth/signout?scope=global">
        <button
          type="submit"
          className="inline-flex min-h-touch w-full items-center justify-center rounded-[14px] bg-bg-soft px-6 text-base font-medium text-neutral-700 transition-colors hover:bg-neutral-200"
        >
          {t('signOutGlobal')}
        </button>
      </form>
    </div>
  );
}
