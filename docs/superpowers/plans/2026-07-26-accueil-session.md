# Accueil conscient de la session — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** l'accueil reconnaît la session — « Entrer dans Darna » pour qui a déjà un accès, « Demander l'accès » + lien de connexion visible pour les autres.

**Architecture:** la seule décision (quelle destination → quel CTA) vit dans une fonction pure `homeCta`. La présentation est un composant sans logique. La page se contente de résoudre la session avec `resolveRedirect`, le helper déjà utilisé au login.

**Tech Stack:** Next 16 (RSC), Supabase, Tailwind 3.4, vitest + @testing-library/react, next-intl.

**Spec:** [`docs/superpowers/specs/2026-07-26-accueil-session-design.md`](../specs/2026-07-26-accueil-session-design.md)

## Global Constraints

- Branche : `feat/accueil-session`, partant de `main` — **indépendante** des PR #15/#16/#17 en cours.
- Portes de qualité par tâche : `pnpm typecheck`, `pnpm lint`, `pnpm test`. Un commit par tâche, `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Aucune migration, aucun changement de RLS, aucune nouvelle règle d'accès : `resolveRedirect` reste la seule source de vérité de routage.
- a11y (job CI bloquant) : cibles tactiles ≥ 44 px (`min-h-touch`), lien de connexion atteignable au clavier avec un focus visible.
- Pas de nouvelles clés dans `ar.json` : `home` n'y a que `title`/`subtitle`, le reste tombe en fallback FR.
- Le bouton d'installation est masqué en mode installé en **CSS pur** — pas de `matchMedia`, pas de `'use client'` sur l'accueil.

---

### Task 1 : `homeCta`, la seule décision

**Files:**

- Create: `lib/auth/home-cta.ts`
- Create: `lib/auth/home-cta.test.ts`

**Interfaces:**

- Consumes: rien (fonction pure).
- Produces:
  - `type HomeCta = { kind: 'apply' } | { kind: 'enter'; href: string } | { kind: 'pending'; href: string }`
  - `homeCta(destination: string | null, locale: string): HomeCta`

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `lib/auth/home-cta.test.ts` :

```ts
import { describe, expect, it } from 'vitest';
import { homeCta } from '@/lib/auth/home-cta';

describe('homeCta', () => {
  it('pas de session → demander l’accès', () => {
    expect(homeCta(null, 'fr')).toEqual({ kind: 'apply' });
  });

  it('résident → entrer', () => {
    expect(homeCta('/fr/community/', 'fr')).toEqual({ kind: 'enter', href: '/fr/community/' });
  });

  it('co_mod → entrer', () => {
    expect(homeCta('/fr/comod', 'fr')).toEqual({ kind: 'enter', href: '/fr/comod' });
  });

  it('demande en attente → voir ma demande', () => {
    expect(homeCta('/fr/admission/pending', 'fr')).toEqual({
      kind: 'pending',
      href: '/fr/admission/pending',
    });
  });

  it('demande refusée → voir ma demande', () => {
    expect(homeCta('/fr/admission/refused', 'fr')).toEqual({
      kind: 'pending',
      href: '/fr/admission/refused',
    });
  });

  it('connecté sans demande → demander l’accès (il doit postuler)', () => {
    expect(homeCta('/fr/admission', 'fr')).toEqual({ kind: 'apply' });
  });

  it('fonctionne en arabe', () => {
    expect(homeCta('/ar/community/', 'ar')).toEqual({ kind: 'enter', href: '/ar/community/' });
    expect(homeCta('/ar/admission', 'ar')).toEqual({ kind: 'apply' });
    expect(homeCta('/ar/admission/pending', 'ar')).toEqual({
      kind: 'pending',
      href: '/ar/admission/pending',
    });
  });

  it('destination inattendue → entrer plutôt que bloquer', () => {
    expect(homeCta('/fr/autre-chose', 'fr')).toEqual({ kind: 'enter', href: '/fr/autre-chose' });
  });
});
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run lib/auth/home-cta.test.ts`
Expected: FAIL — `Cannot find package '@/lib/auth/home-cta'`.

- [ ] **Step 3 : Implémenter**

Créer `lib/auth/home-cta.ts` :

```ts
// Traduit la destination calculée par `resolveRedirect` en intention d'UI pour
// l'accueil. C'est la SEULE décision du chantier : la page ne fait que résoudre
// la session, le composant ne fait que rendre.
//
// `resolveRedirect` renvoie exactement l'un de : `/{locale}/comod`,
// `/{locale}/community/`, `/{locale}/admission/pending`,
// `/{locale}/admission/refused`, `/{locale}/admission`.

export type HomeCta =
  | { kind: 'apply' }
  | { kind: 'enter'; href: string }
  | { kind: 'pending'; href: string };

export function homeCta(destination: string | null, locale: string): HomeCta {
  // Pas de session → le geste attendu est la demande d'accès.
  if (!destination) return { kind: 'apply' };

  // Connecté mais sans demande enregistrée : `resolveRedirect` renvoie
  // `/{locale}/admission` tout court. Il doit postuler comme un nouveau.
  if (destination === `/${locale}/admission`) return { kind: 'apply' };

  // Demande déposée (en attente ou refusée) → on l'emmène à son statut.
  if (destination.startsWith(`/${locale}/admission/`)) {
    return { kind: 'pending', href: destination };
  }

  // Résident, co_mod, ou toute destination future : on laisse entrer plutôt que
  // de bloquer sur un cas non prévu.
  return { kind: 'enter', href: destination };
}
```

- [ ] **Step 4 : Lancer le test pour vérifier qu'il passe**

Run: `npx vitest run lib/auth/home-cta.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5 : Commit**

```bash
git add lib/auth/home-cta.ts lib/auth/home-cta.test.ts
git commit -m "feat(accueil): homeCta, destination resolveRedirect → intention d'UI"
```

---

### Task 2 : `HomeActions`, la présentation

**Files:**

- Create: `app/[locale]/(public)/_components/home-actions.tsx`
- Create: `tests/home/home-actions.test.tsx`
- Modify: `messages/fr.json` (namespace `home`)

**Interfaces:**

- Consumes: `HomeCta` (Task 1).
- Produces: `<HomeActions locale={string} cta={HomeCta} signedIn={boolean} />`.

- [ ] **Step 1 : Ajouter les clés i18n**

`messages/fr.json`, namespace `home`, après `"cta_admission"` :

```json
    "cta_enter": "Entrer dans Darna",
    "cta_pending": "Voir ma demande d'accès",
    "login_hint": "J'ai déjà un accès —",
    "login_cta": "Me connecter",
```

Rien à ajouter dans `ar.json` (fallback FR, cf. contraintes).

- [ ] **Step 2 : Écrire le test qui échoue**

Créer `tests/home/home-actions.test.tsx` :

```tsx
// Chantier accueil (2026-07-26) — les trois états du CTA principal et la
// visibilité du lien de connexion.

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import frMessages from '@/messages/fr.json';
import { HomeActions } from '@/app/[locale]/(public)/_components/home-actions';

function wrap(ui: ReactNode) {
  return render(
    <NextIntlClientProvider locale="fr" messages={frMessages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe('HomeActions', () => {
  it('anonyme : demander l’accès + lien de connexion visible', () => {
    wrap(<HomeActions locale="fr" cta={{ kind: 'apply' }} signedIn={false} />);
    expect(screen.getByRole('link', { name: "Demander l'accès" }).getAttribute('href')).toBe(
      '/fr/admission',
    );
    expect(screen.getByRole('link', { name: 'Me connecter' }).getAttribute('href')).toBe(
      '/fr/auth/login',
    );
  });

  it('résident : « Entrer dans Darna » vers sa destination, sans lien de connexion', () => {
    wrap(<HomeActions locale="fr" cta={{ kind: 'enter', href: '/fr/community/' }} signedIn />);
    expect(screen.getByRole('link', { name: 'Entrer dans Darna' }).getAttribute('href')).toBe(
      '/fr/community/',
    );
    expect(screen.queryByRole('link', { name: 'Me connecter' })).toBeNull();
    expect(screen.queryByRole('link', { name: "Demander l'accès" })).toBeNull();
  });

  it('demande en attente : « Voir ma demande d’accès »', () => {
    wrap(
      <HomeActions locale="fr" cta={{ kind: 'pending', href: '/fr/admission/pending' }} signedIn />,
    );
    expect(screen.getByRole('link', { name: "Voir ma demande d'accès" }).getAttribute('href')).toBe(
      '/fr/admission/pending',
    );
  });

  it('connecté sans demande : demander l’accès, mais pas de lien de connexion', () => {
    wrap(<HomeActions locale="fr" cta={{ kind: 'apply' }} signedIn />);
    expect(screen.getByRole('link', { name: "Demander l'accès" })).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Me connecter' })).toBeNull();
  });

  it('bouton d’installation masqué quand l’app tourne en mode installé', () => {
    wrap(<HomeActions locale="fr" cta={{ kind: 'apply' }} signedIn={false} />);
    const install = screen.getByRole('link', { name: "Installer l'app" });
    expect(install.className).toContain('display-mode:standalone');
  });

  it('cibles tactiles : tous les liens d’action ont min-h-touch', () => {
    wrap(<HomeActions locale="fr" cta={{ kind: 'apply' }} signedIn={false} />);
    for (const name of ["Demander l'accès", "Installer l'app"]) {
      expect(screen.getByRole('link', { name }).className).toContain('min-h-touch');
    }
  });
});
```

- [ ] **Step 3 : Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run tests/home/home-actions.test.tsx`
Expected: FAIL — le module `home-actions` n'existe pas.

- [ ] **Step 4 : Implémenter**

Créer `app/[locale]/(public)/_components/home-actions.tsx` :

```tsx
// Actions de l'accueil — présentation seule, aucune logique de décision (elle vit
// dans lib/auth/home-cta.ts). Server Component : pas de 'use client', donc pas
// d'hydratation pour trois liens.

import { useTranslations } from 'next-intl';
import { Link } from '@/lib/i18n/navigation';
import type { HomeCta } from '@/lib/auth/home-cta';

const PRIMARY =
  'inline-flex min-h-touch items-center justify-center rounded-[14px] bg-accent-500 px-6 text-base font-medium text-white shadow-sm transition-colors hover:bg-accent-600';
const SECONDARY =
  'inline-flex min-h-touch items-center justify-center rounded-[14px] bg-bg-soft px-6 text-base font-medium text-neutral-700 transition-colors hover:bg-neutral-300';
// Masqué quand la PWA tourne en mode installé : à cet endroit le bouton est du
// bruit. CSS pur (Tailwind 3.4 arbitrary variant), aucun JS.
const HIDE_WHEN_INSTALLED = '[@media(display-mode:standalone)]:hidden';

export function HomeActions({
  locale,
  cta,
  signedIn,
}: {
  locale: string;
  cta: HomeCta;
  signedIn: boolean;
}) {
  const t = useTranslations('home');

  return (
    <div className="mt-10 flex flex-col items-center gap-4">
      <div className="flex w-full flex-col gap-4 sm:flex-row sm:justify-center">
        {cta.kind === 'apply' ? (
          <Link href="/admission" className={PRIMARY}>
            {t('cta_admission')}
          </Link>
        ) : (
          <a href={cta.href} className={PRIMARY}>
            {cta.kind === 'enter' ? t('cta_enter') : t('cta_pending')}
          </a>
        )}

        <Link href="/install" className={`${SECONDARY} ${HIDE_WHEN_INSTALLED}`}>
          {t('cta_install')}
        </Link>
      </div>

      {/* Le maillon manquant : hors session, la porte de connexion doit être
          visible depuis l'accueil, pas enterrée en bas de /admission. */}
      {!signedIn && (
        <p className="text-sm text-neutral-500">
          {t('login_hint')}{' '}
          <Link
            href="/auth/login"
            className="font-medium text-accent-500 underline-offset-4 hover:underline"
          >
            {t('login_cta')}
          </Link>
        </p>
      )}
    </div>
  );
}
```

Note : `cta.href` vient de `resolveRedirect` et contient **déjà** la locale, donc c'est
un `<a>` natif et non le `<Link>` localisé de `@/lib/i18n/navigation` (qui préfixerait
une seconde fois).

- [ ] **Step 5 : Lancer le test pour vérifier qu'il passe**

Run: `npx vitest run tests/home/home-actions.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 6 : Commit**

```bash
git add "app/[locale]/(public)/_components/home-actions.tsx" tests/home/home-actions.test.tsx messages/fr.json
git commit -m "feat(accueil): composant HomeActions (3 états + lien de connexion visible)"
```

---

### Task 3 : Câbler la page

**Files:**

- Modify: `app/[locale]/(public)/page.tsx`

**Interfaces:**

- Consumes: `homeCta` (Task 1), `HomeActions` (Task 2), `resolveRedirect` de `@/lib/auth/redirect-by-state`, `createClient` de `@/lib/supabase/server`.
- Produces: rien de nouveau.

- [ ] **Step 1 : Remplacer le corps de la page**

```tsx
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { resolveRedirect } from '@/lib/auth/redirect-by-state';
import { homeCta } from '@/lib/auth/home-cta';
import type { routing } from '@/lib/i18n/routing';
import { HomeActions } from './_components/home-actions';

type Locale = (typeof routing.locales)[number];

type Props = {
  params: Promise<{ locale: string }>;
};

// L'accueil est le `start_url` de la PWA : il doit reconnaître la session à chaque
// lancement, donc rendu dynamique (le proxy résout déjà la session sur cette route).
export const dynamic = 'force-dynamic';

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');

  // Session : on ne garde que ce qu'il faut pour choisir le bon CTA. Aucune
  // redirection — décision produit : la page de présentation reste montrable même
  // connecté.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const destination = user
    ? await resolveRedirect({ supabase, user, locale: locale as Locale, nextParam: null })
    : null;
  const cta = homeCta(destination, locale);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 sm:px-6">
      <div className="w-full max-w-2xl text-center">
        <h1 className="text-[28px] font-semibold tracking-tight text-neutral-900">{t('title')}</h1>
        <p className="mt-3 text-lg text-neutral-500">{t('subtitle')}</p>
        <p className="mt-4 text-base text-neutral-400">{t('description')}</p>

        <HomeActions locale={locale} cta={cta} signedIn={Boolean(user)} />
      </div>
    </main>
  );
}
```

- [ ] **Step 2 : Portes de qualité**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: tout vert.

- [ ] **Step 3 : Commit**

```bash
git add "app/[locale]/(public)/page.tsx"
git commit -m "feat(accueil): l'accueil reconnaît la session (Entrer dans Darna)"
```

---

### Task 4 : Vérification bout en bout et PR

**Files:** aucun (vérification).

- [ ] **Step 1 : Vérifier les deux états sur la stack locale**

Technique validée sur les chantiers 1 et 2 : OTP admin → `verifyOtp` → cookie
`sb-127-auth-token` forgé → `fetch` de `/fr` avec et sans cookie.

Attendu, **déconnecté** : « Demander l'accès », lien « Me connecter » présent, bouton
d'installation présent.
Attendu, **connecté en résident** : « Entrer dans Darna » vers `/fr/community/`, aucun
lien « Me connecter », aucun « Demander l'accès ».
Attendu, **connecté en co_mod** : « Entrer dans Darna » vers `/fr/comod`.
Aucune erreur dans les logs du serveur de dev.

- [ ] **Step 2 : Ouvrir la PR**

```bash
git push -u origin feat/accueil-session
gh pr create --base main --head feat/accueil-session
```

Corps : le double problème (pas de porte de connexion + accueil aveugle à la session),
la décision de ne pas rediriger, les trois états, ce qui est testé, et la conséquence
hors-ligne (CTA possiblement décalé, rien de sensible).

Ne pas merger.

---

## Notes de plan

- **Indépendance** : rien de commun avec #15/#16/#17, la branche part de `main` et peut être mergée dans n'importe quel ordre.
- **Pourquoi une fonction pure séparée** : la logique « quelle destination → quel bouton » est la seule chose qui peut se tromper silencieusement. L'isoler la rend testable sans base ni React, et laisse la page et le composant triviaux.
