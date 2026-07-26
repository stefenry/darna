# Annuaire compact, créateur affiché, WhatsApp — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** rendre la liste de l'annuaire plus compacte, afficher le voisin créateur sur la fiche artisan, et permettre de contacter l'artisan sur WhatsApp depuis la fiche.

**Architecture:** trois évolutions de la même surface. La carte passe de 4 à 3 rangées en remontant le bouton d'appel à côté du nom. Le créateur est résolu **côté serveur** par `resolveNeighbourLabels` (scope `artisans`) et seul son libellé traverse vers le client. Le lien WhatsApp est un `wa.me` construit depuis le `phone_e164` déjà en base, sans script tiers.

**Tech Stack:** Next 16 (App Router, RSC), Tailwind, vitest + @testing-library/react, next-intl.

**Spec:** [`docs/superpowers/specs/2026-07-26-annuaire-fiche-artisan-design.md`](../specs/2026-07-26-annuaire-fiche-artisan-design.md)

## Global Constraints

- Branche : `feat/annuaire-fiche-artisan`, **empilée sur `feat/suggestions-identite`** (PR #16) dont elle consomme `resolveNeighbourLabels` / `authorLabelFromIdentityMode`. PR ciblée sur cette branche ; GitHub la rebasera sur `main` au merge de #16.
- Portes de qualité à chaque tâche : `pnpm typecheck`, `pnpm lint`, `pnpm test` — les trois vertes avant commit. Un commit par tâche, `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- **Aucune migration, aucun changement de RLS** dans ce chantier.
- a11y (job CI bloquant) : cibles tactiles ≥ 44 px (`min-h-touch` / `min-w-touch`), chaque lien garde un `aria-label` explicite.
- La carte reste **un seul lien englobant** (overlay absolu) + des liens d'action DOM-séparés au-dessus (`z-10`) : jamais de lien imbriqué (HTML invalide).
- `created_by` ne quitte JAMAIS le serveur : seul le libellé résolu est sérialisé (FR16).
- Défaut sûr : profil manquant, `display_name` vide ou auteur purgé → pseudonyme ou « Voisin supprimé », jamais un nom par accident.
- Filets de régression à laisser **verts sans les affaiblir** : `tests/annuaire/annuaire-components.test.tsx` (carte) et `tests/artisan/artisan-fiche.test.tsx` (fiche).

---

### Task 1 : Carte annuaire compacte

**Files:**

- Modify: `app/[locale]/community/annuaire/_components/artisan-card.tsx`
- Modify: `tests/annuaire/annuaire-components.test.tsx`

**Interfaces:**

- Consumes: `ArtisanCardData` (inchangé).
- Produces: aucune nouvelle interface — changement de disposition uniquement.

- [ ] **Step 1 : Écrire les tests de structure qui échouent**

Ajouter dans le `describe('ArtisanCard')` de `tests/annuaire/annuaire-components.test.tsx` :

```tsx
it('bouton d’appel dans l’en-tête, à côté du nom', () => {
  wrap(<ArtisanCard locale="fr" artisan={ARTISAN} />);
  const call = screen.getByRole('link', { name: 'Appeler Hassan Plombier' });
  const header = call.closest('header');
  expect(header).not.toBeNull();
  // Le nom et le bouton partagent la même rangée.
  expect(within(header as HTMLElement).getByText('Hassan Plombier')).toBeDefined();
});

it('carte compacte : 3 rangées, plus de pied de carte', () => {
  const { container } = wrap(<ArtisanCard locale="fr" artisan={ARTISAN} />);
  const article = container.querySelector('article') as HTMLElement;
  // overlay + header + meta + jauges — le <footer> a disparu.
  expect(article.querySelector('footer')).toBeNull();
  expect(article.querySelectorAll(':scope > *').length).toBe(4);
});

it('prix et badge facture sur la même ligne meta que le métier', () => {
  wrap(<ArtisanCard locale="fr" artisan={ARTISAN} />);
  const meta = screen.getByText('Plomberie').closest('div') as HTMLElement;
  expect(within(meta).getByText('$$')).toBeDefined();
  expect(within(meta).getByText('Facture émise')).toBeDefined();
});
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run tests/annuaire/annuaire-components.test.tsx`
Expected: FAIL sur les 3 nouveaux cas (le bouton d'appel est dans un `<footer>`, l'article a 5 enfants directs, le prix est dans le `<header>`).

- [ ] **Step 3 : Implémenter la nouvelle disposition**

Dans `artisan-card.tsx`, remplacer le commentaire d'en-tête de fichier, le `<header>`, le bloc chip et le `<footer>` par :

```tsx
// Story 2.2 (AC1/AC7) — carte artisan (Server Component, aucune interactivité).
// Borderless v2 : fond blanc, shadow-xs, rounded-[14px], zéro border. La carte
// entière est un lien vers la fiche (overlay absolu) ; le mini-bouton `tel:` est
// un lien SÉPARÉ au-dessus (z-10) — pas de lien imbriqué (HTML invalide).
//
// Disposition compacte (2026-07-26) : 3 rangées au lieu de 4 — le bouton d'appel
// remonte à côté du nom et le pied de carte disparaît, sa ligne meta (métier,
// prix, facture) étant fusionnée sur une seule rangée.
```

```tsx
      <header className="flex items-start justify-between gap-3">
        {/* min-w-0 + truncate : un nom long ne doit jamais pousser le bouton
            d'appel hors de la carte. */}
        <h3 className="min-w-0 truncate text-lg font-medium tracking-tight text-neutral-900">
          {artisan.displayName}
        </h3>
        {/* Mini-appel : lien distinct au-dessus de l'overlay (z-10). */}
        <a
          href={`tel:${artisan.phoneE164}`}
          aria-label={t('call', { name: artisan.displayName })}
          className="relative z-10 inline-flex min-h-touch min-w-touch shrink-0 items-center justify-center rounded-[14px] bg-accent-500 text-white shadow-sm motion-safe:transition-colors hover:bg-accent-600"
        >
          <Phone className="size-4" aria-hidden />
        </a>
      </header>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {artisan.primaryTagLabel && <Chip>{artisan.primaryTagLabel}</Chip>}
        {artisan.priceRelative && (
          <span
            className="rounded-sm bg-bg-soft px-2 py-0.5 text-xs font-medium text-neutral-700"
            aria-label={t('price', { price: artisan.priceRelative })}
          >
            {artisan.priceRelative}
          </span>
        )}
        <InvoiceBadge hasInvoice={artisan.hasInvoice} />
      </div>
```

et supprimer entièrement l'ancien `<footer>`. `InvoiceBadge` renvoie déjà `<span />` quand `hasInvoice` vaut `non` : rien à changer côté composant.

- [ ] **Step 4 : Lancer les tests pour vérifier qu'ils passent**

Run: `npx vitest run tests/annuaire/annuaire-components.test.tsx`
Expected: PASS — les 3 nouveaux cas **et** les 4 cas existants (nom/prix/tag/facture, 2 jauges, liens séparés, facture sur demande) sans modification de ces derniers.

- [ ] **Step 5 : Commit**

```bash
git add "app/[locale]/community/annuaire/_components/artisan-card.tsx" tests/annuaire/annuaire-components.test.tsx
git commit -m "feat(annuaire): carte compacte, bouton d'appel à côté du nom"
```

---

### Task 2 : Helper `waMeUrl`

**Files:**

- Create: `lib/artisans/whatsapp.ts`
- Create: `lib/artisans/whatsapp.test.ts`

**Interfaces:**

- Consumes: rien.
- Produces: `waMeUrl(phoneE164: string | null | undefined): string | null`.

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `lib/artisans/whatsapp.test.ts` :

```ts
import { describe, expect, it } from 'vitest';
import { waMeUrl } from '@/lib/artisans/whatsapp';

describe('waMeUrl', () => {
  it('numéro marocain E.164 → lien wa.me sans le +', () => {
    expect(waMeUrl('+212600000001')).toBe('https://wa.me/212600000001');
  });

  it('tolère les espaces de saisie', () => {
    expect(waMeUrl('+212 600 000 001')).toBe('https://wa.me/212600000001');
  });

  it('numéro non E.164 (sans +) → null, on n’invente pas d’indicatif', () => {
    expect(waMeUrl('0600000001')).toBeNull();
  });

  it('caractères non numériques → null', () => {
    expect(waMeUrl('+212ABC000001')).toBeNull();
  });

  it('chaîne vide, null, undefined → null', () => {
    expect(waMeUrl('')).toBeNull();
    expect(waMeUrl(null)).toBeNull();
    expect(waMeUrl(undefined)).toBeNull();
  });

  it('longueur invraisemblable → null (garde-fou anti-lien cassé)', () => {
    expect(waMeUrl('+21')).toBeNull();
    expect(waMeUrl(`+${'9'.repeat(20)}`)).toBeNull();
  });
});
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run lib/artisans/whatsapp.test.ts`
Expected: FAIL — `Cannot find package '@/lib/artisans/whatsapp'`.

- [ ] **Step 3 : Implémenter**

Créer `lib/artisans/whatsapp.ts` :

```ts
// Lien de conversation WhatsApp depuis un numéro E.164 (`phone_e164`).
//
// `wa.me` attend le numéro international SANS le `+` ni séparateur. On refuse
// tout ce qui n'est pas un E.164 plausible plutôt que de bricoler un indicatif :
// l'UI n'affiche alors simplement pas le bouton, ce qui vaut mieux qu'un lien
// qui ouvre WhatsApp sur un mauvais numéro.
//
// Conversation VIDE, volontairement : aucun texte n'est écrit au nom du voisin.
// On ne peut pas savoir si le numéro a WhatsApp — le libellé du bouton annonce
// le canal, il ne promet pas une réponse.

// E.164 : `+` puis 8 à 15 chiffres.
const E164 = /^\+(\d{8,15})$/;

export function waMeUrl(phoneE164: string | null | undefined): string | null {
  if (!phoneE164) return null;
  const compact = phoneE164.replace(/\s/g, '');
  const match = E164.exec(compact);
  if (!match) return null;
  return `https://wa.me/${match[1]}`;
}
```

- [ ] **Step 4 : Lancer le test pour vérifier qu'il passe**

Run: `npx vitest run lib/artisans/whatsapp.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5 : Commit**

```bash
git add lib/artisans/whatsapp.ts lib/artisans/whatsapp.test.ts
git commit -m "feat(artisan): helper waMeUrl (E.164 → lien wa.me, null si invalide)"
```

---

### Task 3 : Bouton WhatsApp sur la fiche

**Files:**

- Modify: `app/[locale]/community/artisan/[slug]/_components/artisan-header.tsx`
- Modify: `messages/fr.json`, `messages/ar.json` (namespace `community.artisan`)
- Modify: `tests/artisan/artisan-fiche.test.tsx`

**Interfaces:**

- Consumes: `waMeUrl` (Task 2), `ArtisanDetail.phoneE164`.
- Produces: aucune nouvelle interface.

- [ ] **Step 1 : Ajouter les clés i18n**

`messages/fr.json`, namespace `community.artisan`, après `"call"` :

```json
      "whatsapp": "WhatsApp",
      "whatsappAriaLabel": "Écrire à {name} sur WhatsApp",
```

`messages/ar.json`, même endroit :

```json
      "whatsapp": "واتساب",
      "whatsappAriaLabel": "راسل {name} على واتساب",
```

- [ ] **Step 2 : Écrire les tests qui échouent**

Ajouter dans le `describe('ArtisanHeader')` de `tests/artisan/artisan-fiche.test.tsx` :

```tsx
it('bouton WhatsApp pointant sur wa.me, ouvert dans un nouvel onglet', () => {
  wrap(<ArtisanHeader locale="fr" artisan={ARTISAN} />);
  const wa = screen.getByRole('link', { name: 'Écrire à Hassan Plombier sur WhatsApp' });
  expect(wa.getAttribute('href')).toBe('https://wa.me/212600000001');
  expect(wa.getAttribute('target')).toBe('_blank');
  expect(wa.getAttribute('rel')).toContain('noopener');
});

it('numéro non E.164 → pas de bouton WhatsApp (plutôt qu’un lien cassé)', () => {
  wrap(<ArtisanHeader locale="fr" artisan={{ ...ARTISAN, phoneE164: '0600000001' }} />);
  expect(screen.queryByRole('link', { name: /WhatsApp/ })).toBeNull();
});
```

- [ ] **Step 3 : Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run tests/artisan/artisan-fiche.test.tsx`
Expected: FAIL — aucun lien WhatsApp dans le rendu.

- [ ] **Step 4 : Implémenter**

Dans `artisan-header.tsx` : ajouter `MessageCircle` à l'import Lucide, importer le helper, et remplacer le bloc du téléphone par le téléphone + le bouton WhatsApp :

```tsx
import { ArrowLeft, MessageCircle, MoreHorizontal, Phone } from 'lucide-react';
import { waMeUrl } from '@/lib/artisans/whatsapp';
```

```tsx
<p className="flex items-center gap-2 text-base text-neutral-700">
  <Phone className="size-4 text-neutral-400" aria-hidden />
  <span aria-label={t('phoneAriaLabel')} className="tabular-nums tracking-wide">
    {formatPhone(artisan.phoneE164)}
  </span>
</p>;

{
  /* Lien sortant simple, sans script tiers (promesse « sans tracker »).
          Absent si le numéro n'est pas un E.164 exploitable. */
}
{
  whatsappHref && (
    <a
      href={whatsappHref}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t('whatsappAriaLabel', { name: artisan.displayName })}
      className="inline-flex min-h-touch w-fit items-center gap-2 rounded-[14px] bg-bg-soft px-4 text-base font-medium text-neutral-900 motion-safe:transition-colors hover:bg-neutral-200"
    >
      <MessageCircle className="size-4 text-neutral-500" aria-hidden />
      {t('whatsapp')}
    </a>
  );
}
```

et calculer `whatsappHref` en tête de composant, juste après le `const t = …` :

```tsx
const whatsappHref = waMeUrl(artisan.phoneE164);
```

- [ ] **Step 5 : Lancer les tests pour vérifier qu'ils passent**

Run: `npx vitest run tests/artisan/artisan-fiche.test.tsx`
Expected: PASS — les 2 nouveaux cas et tous les cas existants du fichier.

- [ ] **Step 6 : Commit**

```bash
git add "app/[locale]/community/artisan/[slug]/_components/artisan-header.tsx" messages/fr.json messages/ar.json tests/artisan/artisan-fiche.test.tsx
git commit -m "feat(artisan): bouton WhatsApp sur la fiche (conversation vide)"
```

---

### Task 4 : Créateur affiché sur la fiche

**Files:**

- Modify: `app/[locale]/community/artisan/[slug]/data.ts`
- Modify: `app/[locale]/community/artisan/[slug]/_components/artisan-header.tsx`
- Modify: `messages/fr.json`, `messages/ar.json` (namespace `community.artisan`)
- Modify: `tests/artisan/artisan-fiche.test.tsx` (fixture + 3 cas)

**Interfaces:**

- Consumes: `resolveNeighbourLabels` et `authorLabelFromIdentityMode` de `@/lib/content/author-label` (PR #16), type `AuthorLabel`.
- Produces: `ArtisanDetail.createdByLabel: AuthorLabel` — champ **requis** (`{ authorName: string | null; pseudonymSuffix: string | null }`), et la constante `ARTISAN_PSEUDONYM_SCOPE = 'artisans'` exportée par `data.ts`.

- [ ] **Step 1 : Ajouter les clés i18n**

`messages/fr.json`, namespace `community.artisan`, après `"whatsappAriaLabel"` :

```json
      "createdByNamed": "Fiche ajoutée par {name}",
      "createdByPseudonym": "Fiche ajoutée par Voisin #{suffix}",
      "createdByDeleted": "Fiche ajoutée par un voisin supprimé",
```

`messages/ar.json`, même endroit :

```json
      "createdByNamed": "أضاف البطاقة {name}",
      "createdByPseudonym": "أضاف البطاقة جار #{suffix}",
      "createdByDeleted": "أضاف البطاقة جار محذوف",
```

- [ ] **Step 2 : Écrire les tests qui échouent**

Dans `tests/artisan/artisan-fiche.test.tsx`, ajouter le champ à la fixture `ARTISAN` (après `isOwner: false,`) :

```tsx
  createdByLabel: { authorName: 'Nora', pseudonymSuffix: null },
```

puis ajouter dans le `describe('ArtisanHeader')` :

```tsx
it('créateur en identité affichée → nom', () => {
  wrap(<ArtisanHeader locale="fr" artisan={ARTISAN} />);
  expect(screen.getByText('Fiche ajoutée par Nora')).toBeDefined();
});

it('créateur en pseudo → pseudonyme, jamais le nom', () => {
  wrap(
    <ArtisanHeader
      locale="fr"
      artisan={{ ...ARTISAN, createdByLabel: { authorName: null, pseudonymSuffix: 'A3F2' } }}
    />,
  );
  expect(screen.getByText('Fiche ajoutée par Voisin #A3F2')).toBeDefined();
  expect(screen.queryByText(/Nora/)).toBeNull();
});

it('créateur purgé RGPD → « voisin supprimé »', () => {
  wrap(
    <ArtisanHeader
      locale="fr"
      artisan={{ ...ARTISAN, createdByLabel: { authorName: null, pseudonymSuffix: null } }}
    />,
  );
  expect(screen.getByText('Fiche ajoutée par un voisin supprimé')).toBeDefined();
});
```

- [ ] **Step 3 : Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run tests/artisan/artisan-fiche.test.tsx`
Expected: FAIL — les 3 libellés sont absents du rendu (et `tsc` signalerait `createdByLabel` inconnu sur le type).

- [ ] **Step 4 : Résoudre le libellé côté serveur**

Dans `data.ts` : ajouter l'import et la constante de scope

```ts
import { resolveNeighbourLabels, authorLabelFromIdentityMode } from '@/lib/content/author-label';
import type { AuthorLabel } from '@/lib/content/author-label';

/** Scope HMAC du pseudonyme des créateurs de fiches (stable par voisin). */
export const ARTISAN_PSEUDONYM_SCOPE = 'artisans';
```

ajouter le champ au type `ArtisanDetail`, après `isOwner: boolean;` :

```ts
/** Libellé du voisin créateur (FR16). `user_id` n'est JAMAIS sérialisé. */
createdByLabel: AuthorLabel;
```

et dans `_fetchArtisanBySlug`, juste avant le `return`, résoudre le libellé puis le passer :

```ts
// Créateur affiché selon la préférence globale du voisin (même sémantique que
// les bons plans). Admin client server-only : un résident ne peut pas lire le
// display_name d'un autre via RLS.
const creatorLabels = await resolveNeighbourLabels([row.created_by], {
  scope: ARTISAN_PSEUDONYM_SCOPE,
});
const createdByLabel = authorLabelFromIdentityMode(
  row.created_by ? creatorLabels.get(row.created_by) : undefined,
);
```

```ts
      isOwner: uid != null && row.created_by === uid,
      createdByLabel,
      state: row.state,
```

- [ ] **Step 5 : Afficher le libellé dans l'en-tête**

Dans `artisan-header.tsx`, ajouter juste après le bloc `<h1>`/prix (avant les tags) :

```tsx
{
  /* Qui a ajouté la fiche — nom ou pseudonyme selon la préférence du voisin. */
}
<p className="text-sm text-neutral-500">
  {artisan.createdByLabel.authorName
    ? t('createdByNamed', { name: artisan.createdByLabel.authorName })
    : artisan.createdByLabel.pseudonymSuffix
      ? t('createdByPseudonym', { suffix: artisan.createdByLabel.pseudonymSuffix })
      : t('createdByDeleted')}
</p>;
```

- [ ] **Step 6 : Lancer les tests et les portes de qualité**

Run: `npx vitest run tests/artisan/artisan-fiche.test.tsx && pnpm typecheck && pnpm lint && pnpm test`
Expected: tout vert. `tsc` valide au passage qu'aucun autre site de construction d'`ArtisanDetail` n'a été oublié.

- [ ] **Step 7 : Commit**

```bash
git add "app/[locale]/community/artisan/[slug]" messages/fr.json messages/ar.json tests/artisan/artisan-fiche.test.tsx
git commit -m "feat(artisan): afficher le voisin créateur sur la fiche (nom ou pseudonyme)"
```

---

### Task 5 : Vérification bout en bout et PR

**Files:** aucun (vérification).

- [ ] **Step 1 : Vérifier sur la stack locale avec une vraie session**

Réutiliser la technique validée sur le chantier 1 : générer un OTP via l'API admin locale, `verifyOtp`, forger le cookie `sb-127-auth-token` (`base64-` + base64url du JSON de session, chunké au-delà de 3180 caractères), puis `fetch` les pages avec ce cookie.

Contrôles attendus sur `GET /fr/community/annuaire` et `GET /fr/community/artisan/<slug>` :

- annuaire : `200`, et pour une carte donnée le lien `tel:` est présent dans le même `<header>` que le nom, aucun `<footer>` dans l'`<article>` ;
- fiche : `200`, présence de `https://wa.me/…` avec `target="_blank"`, et d'une ligne « Fiche ajoutée par … » ;
- aucune erreur dans les logs du serveur de dev.

- [ ] **Step 2 : Reconnaître la limite de la vérification**

Le caractère « plus compact » de la carte est un jugement visuel : il ne peut pas être prouvé par un test. Les tests garantissent la **structure** (3 rangées, bouton dans l'en-tête, pied supprimé) ; le rendu final est à regarder sur le preview Vercel de la PR. Le dire explicitement dans le corps de la PR plutôt que de laisser croire à une validation visuelle.

- [ ] **Step 3 : Ouvrir la PR**

```bash
git push -u origin feat/annuaire-fiche-artisan
gh pr create --base feat/suggestions-identite --head feat/annuaire-fiche-artisan
```

Base = `feat/suggestions-identite` (PR empilée, retargetée automatiquement sur `main` au merge de #16). Le corps précise : les trois évolutions, la contrepartie assumée du libellé rétroactif, ce qui est testé, ce qui relève du jugement visuel, et l'absence de migration.

Ne pas merger.

---

## Notes de plan

- **Ordre** : 1 → 2 → 3 → 4 → 5. La Task 1 est indépendante ; la 3 dépend de la 2 ; la 4 dépend du helper de la PR #16.
- **Pas de bouton WhatsApp sur les cartes** : contraire à l'objectif de compacité de la Task 1 (décision actée dans la spec).
- **Pas de message pré-rempli** : choix explicite de Stéphane — aucun texte écrit au nom du voisin.
