# ADR 0001 — Garder Tailwind CSS 3.4 (variance vs `architecture.md` qui prescrit Tailwind 4)

- **Statut** : accepté
- **Date** : 2026-05-23 (implémenté), formalisé 2026-05-24
- **Décideur** : Stephane
- **Stories impactées** : 1.1

## Contexte

L'architecture (`architecture.md#Versions-vérifiées-recherche-web-mai-2026`) prescrit **Tailwind CSS 4** pour le MVP. Le starter officiel `with-supabase` pour Next.js 16.2 (`npx create-next-app@latest --example with-supabase`) livre cependant **Tailwind CSS 3.4** (+ `tailwindcss-animate`, `postcss`, `autoprefixer`, `class-variance-authority`, `tailwind-merge`, `lucide-react`, `next-themes`, et 7 composants shadcn/Radix UI dans `components/ui/`).

Migrer le starter vers Tailwind 4 dès J1 impliquerait :

- réécrire `postcss.config.mjs` (Tailwind 4 utilise `@tailwindcss/postcss`)
- migrer `tailwind.config.ts` → tokens CSS-first `@theme` dans `app/globals.css`
- valider la compat de `tailwindcss-animate` + des 7 composants shadcn livrés
- perdre l'alignement avec le vendor officiel (re-validation à chaque MAJ starter)

## Décision

**Garder Tailwind 3.4** tel que livré par le starter officiel `with-supabase`. Le starter officiel est traité comme la **référence vendor** : on ne dévie pas de ses choix sans incident concret qui motive la migration.

## Conséquences

**Acceptées** :

- Logical properties Tailwind (`me-*`, `ps-*`, `start-*`, `end-*`) supportées nativement en 3.4 → AR22 reste applicable.
- Tokens `colors`, `borderRadius`, `minHeight/minWidth: { touch: '48px' }` configurés via `tailwind.config.ts` au lieu de CSS-first.
- Le plugin `eslint-plugin-tailwindcss` (qui visait 3.x) est buggé sur pnpm strict avec Tailwind 3.4 (impossible de résoudre `tailwindcss` depuis le plugin) → la règle custom `no-restricted-syntax` (regex AR22) reste l'unique enforcement, le plugin a été retiré (cf. Story 1.1 Review Findings).

**À revisiter si** :

- Tailwind 4 stabilise un mode compat 3.x sans surcoût.
- Une feature de Tailwind 4 (CSS-first tokens, container queries améliorées) devient nécessaire.
- Le starter `with-supabase` est mis à jour vers Tailwind 4.

## Alternatives écartées

- **Migrer immédiatement vers Tailwind 4** : coût migration non justifié pour MVP, dette potentielle si le starter évolue différemment.
