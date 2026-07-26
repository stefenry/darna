# Suggestions anonymes ou signées — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** un résident choisit, à l'envoi de sa suggestion, si les co_mods voient son nom et sa villa ou un pseudonyme.

**Architecture:** une colonne `signed` sur `public.suggestions` fige le choix à l'envoi (jamais rétroactif). Le libellé d'auteur côté co_mod est résolu côté serveur par un helper admin généralisé (`resolveNeighbourLabels`) qui renvoie la matière brute — nom, villa, préférence, pseudonyme, purgé — chaque surface appliquant sa propre règle. Aucun `user_id` ne traverse vers le client.

**Tech Stack:** Next 16 (App Router, RSC), Supabase (Postgres + RLS + grants colonne), Zod 4, vitest + @testing-library/react, next-intl.

**Spec:** [`docs/superpowers/specs/2026-07-26-suggestions-identite-design.md`](../specs/2026-07-26-suggestions-identite-design.md)

## Global Constraints

- Branche de travail : `feat/suggestions-identite` (part de `main`). Commits conventionnels, un par tâche, avec `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Portes de qualité à chaque tâche : `pnpm typecheck`, `pnpm lint`, `pnpm test` — les trois doivent passer avant le commit.
- Commentaires et libellés en français ; DB en `snake_case` (AR8).
- ADR 0004 : écriture résident bornée par des **grants colonne**, jamais par confiance applicative.
- Défaut sûr non négociable : toute branche d'échec (profil manquant, `display_name` vide, utilisateur purgé, colonne absente) affiche un pseudonyme ou « Voisin supprimé » — **jamais un nom par accident**.
- `user_id` n'est jamais sérialisé vers le client : seul le libellé résolu franchit la frontière serveur → client.
- a11y (job CI bloquant) : toute cible tactile ≥ 44 px (`min-h-touch`), tout contrôle a un label lié.
- L'e-mail de notification aux co_mods reste inchangé : extrait seul, jamais l'auteur (FR42).
- AR : `messages/ar.json` peut omettre une clé (fallback FR via `deepMerge`), mais le namespace `suggestion` est entièrement traduit — on garde cette qualité et on ajoute les clés AR.

---

### Task 1 : Migration `signed` + types générés

**Files:**

- Create: `supabase/migrations/20260726090000_suggestions_signed.sql`
- Modify: `lib/supabase/types.generated.ts` (bloc `suggestions:` → `Row`, `Insert`, `Update`)

**Interfaces:**

- Consumes: rien.
- Produces: colonne `public.suggestions.signed boolean not null default false` ; types `Database['public']['Tables']['suggestions']['Row'].signed: boolean` et `…['Insert'].signed?: boolean`.

- [ ] **Step 1 : Écrire la migration**

Créer `supabase/migrations/20260726090000_suggestions_signed.sql` :

```sql
-- Chantier « suggestions : anonyme ou signée » — le suggérant choisit à l'envoi si
-- les co_mods voient son nom. Le choix est FIGÉ sur la ligne : changer
-- `profiles.identity_mode` plus tard ne dé-anonymise jamais rétroactivement une
-- suggestion déjà envoyée.
--
-- `default false` → les suggestions déjà en base restent anonymes, conformément à
-- la promesse sous laquelle elles ont été écrites (story 6.5 : auteur toujours
-- pseudonymisé côté co_mod).

alter table public.suggestions
  add column signed boolean not null default false;

comment on column public.suggestions.signed is
  'true = le suggérant a choisi que les co_mods voient son nom et sa villa. Figé à l''envoi.';

-- ADR 0004 — grants colonne : le résident peut désormais écrire `body` ET `signed`.
-- `user_id` / `residence_id` restent posés par défaut, `state` reste réservé au
-- co_mod (grant update séparé, inchangé).
grant insert (body, signed) on public.suggestions to authenticated;
```

- [ ] **Step 2 : Mettre à jour les types générés**

Dans `lib/supabase/types.generated.ts`, bloc `suggestions:`, insérer `signed` entre `residence_id` et `state` dans les trois formes (ordre alphabétique du générateur) :

```ts
        Row: {
          // …
          residence_id: string;
          signed: boolean;
          state: Database['public']['Enums']['suggestion_state'];
          // …
        };
        Insert: {
          // …
          residence_id?: string;
          signed?: boolean;
          state?: Database['public']['Enums']['suggestion_state'];
          // …
        };
        Update: {
          // …
          residence_id?: string;
          signed?: boolean;
          state?: Database['public']['Enums']['suggestion_state'];
          // …
        };
```

- [ ] **Step 3 : Vérifier que les types compilent**

Run: `pnpm typecheck`
Expected: aucune erreur (les erreurs `.next/dev/types/… 2.ts` préexistantes, dues à des fichiers dupliqués par iCloud, ne comptent pas — filtrer avec `| grep -v '^\.next/'`).

- [ ] **Step 4 : Vérifier la migration sur la stack locale (si Docker tourne)**

Run: `pnpm supabase start && pnpm supabase db reset && pnpm gen:types && git diff --stat lib/supabase/types.generated.ts`
Expected: `db reset` rejoue toutes les migrations sans erreur, et `gen:types` ne produit **aucune** différence avec l'édition manuelle de l'étape 2. Si Docker n'est pas disponible, sauter cette étape : la migration sera appliquée en prod par `release.yml` (`db push --linked`) et l'édition manuelle des types est vérifiée par `pnpm typecheck`.

- [ ] **Step 5 : Commit**

```bash
git add supabase/migrations/20260726090000_suggestions_signed.sql lib/supabase/types.generated.ts
git commit -m "feat(db): colonne suggestions.signed (choix anonyme/signé figé à l'envoi)"
```

---

### Task 2 : Validation — `zSuggestion.signed`

**Files:**

- Modify: `lib/validation/suggestion.ts`
- Create: `lib/validation/suggestion.test.ts`

**Interfaces:**

- Consumes: rien.
- Produces: `zSuggestion` parse désormais `{ body: string; signed: boolean }` ; `SuggestionInput` gagne `signed: boolean`.

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `lib/validation/suggestion.test.ts` :

```ts
import { describe, expect, it } from 'vitest';
import { zSuggestion, SUGGESTION_MAXLEN } from '@/lib/validation/suggestion';

describe('zSuggestion', () => {
  it('checkbox absente du FormData → signed false (anonyme par défaut sûr)', () => {
    const r = zSuggestion.safeParse({ body: 'Une idée' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.signed).toBe(false);
  });

  it("checkbox cochée ('on') → signed true", () => {
    const r = zSuggestion.safeParse({ body: 'Une idée', signed: 'on' });
    expect(r.success && r.data.signed).toBe(true);
  });

  it('null (FormData.get sur une clé absente) → signed false', () => {
    const r = zSuggestion.safeParse({ body: 'Une idée', signed: null });
    expect(r.success && r.data.signed).toBe(false);
  });

  it("la chaîne 'false' ne doit PAS valoir true (piège de z.coerce.boolean)", () => {
    const r = zSuggestion.safeParse({ body: 'Une idée', signed: 'false' });
    expect(r.success && r.data.signed).toBe(false);
  });

  it('booléen true accepté (appel programmatique)', () => {
    const r = zSuggestion.safeParse({ body: 'Une idée', signed: true });
    expect(r.success && r.data.signed).toBe(true);
  });

  it('corps vide ou trop long refusé, quel que soit signed', () => {
    expect(zSuggestion.safeParse({ body: '   ', signed: 'on' }).success).toBe(false);
    expect(
      zSuggestion.safeParse({ body: 'x'.repeat(SUGGESTION_MAXLEN + 1), signed: 'on' }).success,
    ).toBe(false);
  });
});
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run lib/validation/suggestion.test.ts`
Expected: FAIL — les cas `signed` échouent (`signed` est `undefined`, la propriété n'existe pas encore dans le schéma).

- [ ] **Step 3 : Implémenter**

Remplacer le contenu de `lib/validation/suggestion.ts` :

```ts
// Story 6.5 — schéma de la suggestion d'évolution produit (texte libre ≤ 1000).
// `signed` (chantier identité, 2026-07-26) : le suggérant assume-t-il son nom
// auprès des co_mods ?

import { z } from 'zod';

export const SUGGESTION_MAXLEN = 1000;

// Une checkbox HTML n'envoie RIEN quand elle est décochée et 'on' quand elle est
// cochée. `z.coerce.boolean()` serait un piège ici : `Boolean('false') === true`.
// On teste donc explicitement les valeurs qui signifient « cochée », et tout le
// reste (absent, null, 'false') vaut anonyme — le défaut sûr.
const zCheckbox = z
  .unknown()
  .optional()
  .transform((value) => value === 'on' || value === 'true' || value === true);

export const zSuggestion = z.object({
  body: z.string().trim().min(1).max(SUGGESTION_MAXLEN),
  signed: zCheckbox,
});

export type SuggestionInput = z.infer<typeof zSuggestion>;
```

- [ ] **Step 4 : Lancer le test pour vérifier qu'il passe**

Run: `npx vitest run lib/validation/suggestion.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5 : Commit**

```bash
git add lib/validation/suggestion.ts lib/validation/suggestion.test.ts
git commit -m "feat(suggestion): validation du choix signed (défaut anonyme)"
```

---

### Task 3 : Helper d'identité — `resolveNeighbourLabels`

**Files:**

- Modify: `lib/content/author-label.ts`
- Create: `tests/community/neighbour-label.test.ts`
- Filet de régression existant (ne pas modifier) : `tests/community/tip-author-label.test.ts`

**Interfaces:**

- Consumes: `pseudonymSuffix(userId, scope)` de `@/lib/artisans/pseudonym` ; `createAdminClient()` de `@/lib/supabase/admin`.
- Produces:
  - `type NeighbourLabel = { displayName: string | null; villa: number | null; identityMode: 'pseudo' | 'identified'; pseudonym: string | null; deleted: boolean }`
  - `resolveNeighbourLabels(userIds: (string | null | undefined)[], opts: { scope: string }): Promise<Map<string, NeighbourLabel>>`
  - `authorLabelFromIdentityMode(label: NeighbourLabel | undefined): AuthorLabel`
  - `resolveTipAuthorLabels` / `resolveTipAuthorLabel` : signatures et comportement **inchangés**.

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `tests/community/neighbour-label.test.ts` :

```ts
// @vitest-environment node
// Chantier identité (2026-07-26) — matière brute renvoyée par
// resolveNeighbourLabels : chaque surface (bons plans, suggestions, fiches
// artisan) applique ENSUITE sa propre règle.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const usersInMock = vi.fn();
const profilesInMock = vi.fn();
const profilesSelectSpy = vi.fn();

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      select: (cols: string) => {
        if (table === 'profiles') profilesSelectSpy(cols);
        return { in: () => (table === 'users' ? usersInMock() : profilesInMock()) };
      },
    }),
  }),
}));

vi.mock('@/lib/artisans/pseudonym', () => ({
  pseudonymSuffix: (userId: string, scope: string) => `${scope}-${userId}`,
}));

import { resolveNeighbourLabels, authorLabelFromIdentityMode } from '@/lib/content/author-label';

const IDENTIFIED = 'user-identified';
const PSEUDO = 'user-pseudo';
const NOPROFILE = 'user-noprofile';
const DELETED = 'user-deleted';

beforeEach(() => {
  usersInMock.mockReset();
  profilesInMock.mockReset();
  profilesSelectSpy.mockReset();
  usersInMock.mockResolvedValue({
    data: [
      { id: IDENTIFIED, display_name: 'Salma', deleted_at: null },
      { id: PSEUDO, display_name: 'Hassan', deleted_at: null },
      { id: NOPROFILE, display_name: '   ', deleted_at: null },
      { id: DELETED, display_name: 'Ex Voisin', deleted_at: '2026-06-01T00:00:00Z' },
    ],
    error: null,
  });
  profilesInMock.mockResolvedValue({
    data: [
      { user_id: IDENTIFIED, identity_mode: 'identified', villa: 42 },
      { user_id: PSEUDO, identity_mode: 'pseudo', villa: 7 },
      // NOPROFILE volontairement absent.
    ],
    error: null,
  });
});

describe('resolveNeighbourLabels', () => {
  it('renvoie nom, villa, préférence et pseudonyme scopé', async () => {
    const map = await resolveNeighbourLabels([IDENTIFIED], { scope: 'suggestions' });
    expect(map.get(IDENTIFIED)).toEqual({
      displayName: 'Salma',
      villa: 42,
      identityMode: 'identified',
      pseudonym: `suggestions-${IDENTIFIED}`,
      deleted: false,
    });
  });

  it('lit bien la villa dans la requête profiles', async () => {
    await resolveNeighbourLabels([IDENTIFIED], { scope: 'suggestions' });
    expect(profilesSelectSpy).toHaveBeenCalledWith('user_id, identity_mode, villa');
  });

  it('display_name blanc → displayName null (jamais un libellé vide)', async () => {
    const map = await resolveNeighbourLabels([NOPROFILE], { scope: 'tips' });
    expect(map.get(NOPROFILE)?.displayName).toBeNull();
  });

  it('profil manquant → identityMode pseudo et villa null (défaut sûr)', async () => {
    const map = await resolveNeighbourLabels([NOPROFILE], { scope: 'tips' });
    expect(map.get(NOPROFILE)?.identityMode).toBe('pseudo');
    expect(map.get(NOPROFILE)?.villa).toBeNull();
  });

  it('utilisateur purgé → deleted true', async () => {
    const map = await resolveNeighbourLabels([DELETED], { scope: 'tips' });
    expect(map.get(DELETED)?.deleted).toBe(true);
  });

  it('aucune requête si la liste ne contient que null/undefined', async () => {
    const map = await resolveNeighbourLabels([null, undefined], { scope: 'tips' });
    expect(map.size).toBe(0);
    expect(usersInMock).not.toHaveBeenCalled();
  });
});

describe('authorLabelFromIdentityMode', () => {
  it('identifié avec nom → nom', async () => {
    const map = await resolveNeighbourLabels([IDENTIFIED], { scope: 'tips' });
    expect(authorLabelFromIdentityMode(map.get(IDENTIFIED))).toEqual({
      authorName: 'Salma',
      pseudonymSuffix: null,
    });
  });

  it('pseudo → pseudonyme, jamais le nom', async () => {
    const map = await resolveNeighbourLabels([PSEUDO], { scope: 'tips' });
    expect(authorLabelFromIdentityMode(map.get(PSEUDO))).toEqual({
      authorName: null,
      pseudonymSuffix: `tips-${PSEUDO}`,
    });
  });

  it('purgé → ni nom ni pseudonyme', async () => {
    const map = await resolveNeighbourLabels([DELETED], { scope: 'tips' });
    expect(authorLabelFromIdentityMode(map.get(DELETED))).toEqual({
      authorName: null,
      pseudonymSuffix: null,
    });
  });

  it('entrée absente de la map → ni nom ni pseudonyme', () => {
    expect(authorLabelFromIdentityMode(undefined)).toEqual({
      authorName: null,
      pseudonymSuffix: null,
    });
  });
});
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run tests/community/neighbour-label.test.ts`
Expected: FAIL — `resolveNeighbourLabels` et `authorLabelFromIdentityMode` ne sont pas exportés.

- [ ] **Step 3 : Implémenter**

Remplacer le contenu de `lib/content/author-label.ts` :

```ts
// Résolution du libellé d'un voisin (FR16) : identité affichée → `display_name` ;
// pseudo → « Voisin anonyme #XXXX » stable ; contributeur purgé (RGPD) → « Voisin
// supprimé ».
//
// Pourquoi un admin client (server-only) : un résident lecteur NE PEUT PAS lire le
// `users.display_name` d'un AUTRE résident via RLS (`users_resident_select_self`
// uniquement). Les notations contournent ça en snapshotant `author_display_name` à
// la création ; le contenu éphémère n'a pas ce snapshot → on résout au render côté
// serveur, sans jamais sérialiser de `user_id` (seul le libellé part au client).
//
// `resolveNeighbourLabels` renvoie la MATIÈRE BRUTE ; chaque surface applique
// ensuite SA règle :
//   - bons plans / fiches artisan → la préférence globale `identity_mode`
//     (`authorLabelFromIdentityMode`) ;
//   - suggestions → le flag `signed` figé sur la ligne à l'envoi.
//
// Le suffixe pseudonyme est dérivé par HMAC(user_id, scope) — un scope constant
// par surface ('tips', 'suggestions', 'artisans') donne un pseudonyme stable pour
// un même voisin sur cette surface.

import { createAdminClient } from '@/lib/supabase/admin';
import { pseudonymSuffix } from '@/lib/artisans/pseudonym';

export type AuthorLabel = { authorName: string | null; pseudonymSuffix: string | null };

export type NeighbourLabel = {
  displayName: string | null;
  villa: number | null;
  identityMode: 'pseudo' | 'identified';
  pseudonym: string | null;
  deleted: boolean;
};

const TIP_PSEUDONYM_SCOPE = 'tips';

/** Matière brute pour un lot d'ids (1 requête admin batch par table). */
export async function resolveNeighbourLabels(
  userIds: (string | null | undefined)[],
  { scope }: { scope: string },
): Promise<Map<string, NeighbourLabel>> {
  const ids = [...new Set(userIds.filter((x): x is string => !!x))];
  const out = new Map<string, NeighbourLabel>();
  if (ids.length === 0) return out;

  const admin = createAdminClient();
  const [usersRes, profilesRes] = await Promise.all([
    admin.from('users').select('id, display_name, deleted_at').in('id', ids),
    admin.from('profiles').select('user_id, identity_mode, villa').in('user_id', ids),
  ]);

  const profileById = new Map((profilesRes.data ?? []).map((p) => [p.user_id, p]));

  for (const u of usersRes.data ?? []) {
    const profile = profileById.get(u.id);
    out.set(u.id, {
      displayName: u.display_name?.trim() || null,
      villa: profile?.villa ?? null,
      // Défaut sûr : profil manquant ou valeur inattendue → pseudo.
      identityMode: profile?.identity_mode === 'identified' ? 'identified' : 'pseudo',
      pseudonym: pseudonymSuffix(u.id, scope),
      deleted: Boolean(u.deleted_at),
    });
  }
  return out;
}

/**
 * Règle « préférence globale » (FR16) : le nom réel seulement si le voisin a
 * opt-in ET a un `display_name`. Tout le reste → pseudonyme ; purgé → les deux
 * null, l'UI affiche « Voisin supprimé ».
 */
export function authorLabelFromIdentityMode(label: NeighbourLabel | undefined): AuthorLabel {
  if (!label || label.deleted) return { authorName: null, pseudonymSuffix: null };
  if (label.identityMode === 'identified' && label.displayName) {
    return { authorName: label.displayName, pseudonymSuffix: null };
  }
  return { authorName: null, pseudonymSuffix: label.pseudonym };
}

/** Résout les labels auteur pour un lot de `created_by` (bons plans). */
export async function resolveTipAuthorLabels(
  createdByIds: (string | null | undefined)[],
): Promise<Map<string, AuthorLabel>> {
  const raw = await resolveNeighbourLabels(createdByIds, { scope: TIP_PSEUDONYM_SCOPE });
  const out = new Map<string, AuthorLabel>();
  for (const [id, label] of raw) out.set(id, authorLabelFromIdentityMode(label));
  return out;
}

/** Label auteur pour un seul `created_by` (page détail). */
export async function resolveTipAuthorLabel(
  createdBy: string | null | undefined,
): Promise<AuthorLabel> {
  if (!createdBy) return { authorName: null, pseudonymSuffix: null };
  const map = await resolveTipAuthorLabels([createdBy]);
  return map.get(createdBy) ?? { authorName: null, pseudonymSuffix: null };
}
```

- [ ] **Step 4 : Lancer les nouveaux tests ET le filet de régression**

Run: `npx vitest run tests/community/neighbour-label.test.ts tests/community/tip-author-label.test.ts`
Expected: PASS des deux fichiers — les bons plans doivent conserver exactement leur comportement (6 tests existants verts sans modification).

- [ ] **Step 5 : Commit**

```bash
git add lib/content/author-label.ts tests/community/neighbour-label.test.ts
git commit -m "refactor(identite): resolveNeighbourLabels, matière brute + règle par surface"
```

---

### Task 4 : Server Action — persister le choix

**Files:**

- Modify: `app/[locale]/community/profil/parametres/suggestion/actions.ts`
- Modify: `tests/community/suggestion-actions.test.ts`

**Interfaces:**

- Consumes: `zSuggestion` (Task 2) — `parsed.data.signed: boolean`.
- Produces: `submitSuggestion` insère `{ body, signed }` ; le type `SubmitSuggestionState` reste inchangé.

- [ ] **Step 1 : Écrire les tests qui échouent**

Dans `tests/community/suggestion-actions.test.ts` : remplacer le helper `form` et ajouter deux cas.

Helper (remplace la version existante) :

```ts
function form(body: string, signed?: 'on'): FormData {
  const fd = new FormData();
  fd.set('body', body);
  if (signed) fd.set('signed', signed);
  return fd;
}
```

Nouveaux cas, à ajouter dans le `describe` de `submitSuggestion` :

```ts
it('checkbox absente → insert signed:false (anonyme, défaut sûr)', async () => {
  const res = await submitSuggestion(SUGGESTION_INITIAL, form('Une idée'));
  expect(res.ok).toBe(true);
  expect(insertSpy).toHaveBeenCalledWith({ body: 'Une idée', signed: false });
});

it('checkbox cochée → insert signed:true', async () => {
  const res = await submitSuggestion(SUGGESTION_INITIAL, form('Une idée', 'on'));
  expect(res.ok).toBe(true);
  expect(insertSpy).toHaveBeenCalledWith({ body: 'Une idée', signed: true });
});
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run tests/community/suggestion-actions.test.ts`
Expected: FAIL sur les deux nouveaux cas — l'action insère `{ body }` sans `signed`.

- [ ] **Step 3 : Implémenter**

Dans `app/[locale]/community/profil/parametres/suggestion/actions.ts`, remplacer le parsing et l'insert :

```ts
const raw = formData.get('body');
const parsed = zSuggestion.safeParse({
  body: typeof raw === 'string' ? raw : '',
  // FormData.get renvoie null quand la case est décochée → zSuggestion en fait
  // `false` (cf. lib/validation/suggestion.ts).
  signed: formData.get('signed'),
});
if (!parsed.success) return { ok: false, code: 'invalid' };

const supabase = await createClient();
const { error } = await supabase
  .from('suggestions')
  .insert({ body: parsed.data.body, signed: parsed.data.signed });
```

Le reste de l'action (rate-limit, garde, notification co_mod avec extrait seul, `revalidatePath`) ne change pas.

- [ ] **Step 4 : Lancer les tests pour vérifier qu'ils passent**

Run: `npx vitest run tests/community/suggestion-actions.test.ts`
Expected: PASS (cas existants + 2 nouveaux).

- [ ] **Step 5 : Commit**

```bash
git add "app/[locale]/community/profil/parametres/suggestion/actions.ts" tests/community/suggestion-actions.test.ts
git commit -m "feat(suggestion): persister le choix anonyme/signé à l'envoi"
```

---

### Task 5 : UI résident — case à cocher + badge d'historique

**Files:**

- Modify: `app/[locale]/community/profil/parametres/suggestion/_components/suggestion-form.tsx`
- Modify: `app/[locale]/community/profil/parametres/suggestion/page.tsx`
- Modify: `messages/fr.json`, `messages/ar.json` (namespace `suggestion`)
- Create: `tests/community/suggestion-form.test.tsx`

**Interfaces:**

- Consumes: `submitSuggestion` (Task 4).
- Produces: `<SuggestionForm defaultSigned={boolean} />` — nouvelle prop **requise**, la page la calcule depuis `profiles.identity_mode`.

- [ ] **Step 1 : Ajouter les clés i18n**

Dans `messages/fr.json`, namespace `suggestion`, ajouter après `"placeholder"` :

```json
    "signLabel": "Signer avec mon nom",
    "signHint": "Les co-mods verront ton nom et ta villa. Sinon, ta suggestion reste anonyme.",
```

et dans `suggestion.history`, après `"empty"` :

```json
    "signedBadge": "Signée",
    "anonymousBadge": "Anonyme",
```

Dans `messages/ar.json`, mêmes emplacements :

```json
    "signLabel": "التوقيع باسمي",
    "signHint": "سيرى المنسّقون اسمك ورقم فيلتك. وإلا يبقى اقتراحك مجهول المصدر.",
```

```json
    "signedBadge": "موقّعة",
    "anonymousBadge": "مجهولة",
```

- [ ] **Step 2 : Écrire le test qui échoue**

Créer `tests/community/suggestion-form.test.tsx` :

```tsx
// Chantier identité — la case « Signer avec mon nom » reflète la préférence de
// profil et part bien dans le FormData sous le nom `signed`.

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import frMessages from '@/messages/fr.json';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/app/[locale]/community/profil/parametres/suggestion/actions', () => ({
  submitSuggestion: vi.fn(async () => ({ ok: true })),
}));

import { SuggestionForm } from '@/app/[locale]/community/profil/parametres/suggestion/_components/suggestion-form';

function wrap(ui: ReactNode) {
  return render(
    <NextIntlClientProvider locale="fr" messages={frMessages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe('SuggestionForm — choix anonyme/signé', () => {
  it('case décochée par défaut quand le profil est en pseudo', () => {
    wrap(<SuggestionForm defaultSigned={false} />);
    const box = screen.getByRole('checkbox', { name: /Signer avec mon nom/ }) as HTMLInputElement;
    expect(box.checked).toBe(false);
    expect(box.name).toBe('signed');
  });

  it('case pré-cochée quand le profil est en identité affichée', () => {
    wrap(<SuggestionForm defaultSigned />);
    const box = screen.getByRole('checkbox', { name: /Signer avec mon nom/ }) as HTMLInputElement;
    expect(box.checked).toBe(true);
  });

  it('explique ce que verront les co-mods', () => {
    wrap(<SuggestionForm defaultSigned={false} />);
    expect(screen.getByText(/Les co-mods verront ton nom et ta villa/)).toBeDefined();
  });
});
```

- [ ] **Step 3 : Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run tests/community/suggestion-form.test.tsx`
Expected: FAIL — aucune checkbox dans le formulaire (`Unable to find role="checkbox"`).

- [ ] **Step 4 : Implémenter le formulaire**

Dans `suggestion-form.tsx` : la signature devient `export function SuggestionForm({ defaultSigned }: { defaultSigned: boolean })`, et on insère ce bloc entre le `<label>` du textarea et la zone `aria-live` :

```tsx
<label className="flex items-start gap-3">
  <input
    type="checkbox"
    name="signed"
    defaultChecked={defaultSigned}
    className="mt-0.5 size-5 shrink-0 rounded-sm accent-accent-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500"
  />
  <span className="flex flex-col gap-0.5">
    <span className="text-sm font-medium text-neutral-700">{t('signLabel')}</span>
    <span className="text-xs text-neutral-500">{t('signHint')}</span>
  </span>
</label>
```

`defaultChecked` (et non `checked`) : le champ reste non contrôlé, `formRef.current?.reset()` au succès le remet donc sur la valeur par défaut — cohérent avec le `reset()` déjà en place pour le textarea.

- [ ] **Step 5 : Lancer le test pour vérifier qu'il passe**

Run: `npx vitest run tests/community/suggestion-form.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6 : Câbler la page (préférence de profil + badge d'historique)**

Dans `page.tsx` : ajouter la lecture du profil à côté de la requête existante, passer la prop, et afficher le badge.

Lecture (après `const supabase = await createClient();`) — deux requêtes en parallèle :

```tsx
const [{ data: mine }, { data: profile }] = await Promise.all([
  supabase
    .from('suggestions')
    .select('id, body, state, created_at, signed')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(20),
  supabase.from('profiles').select('identity_mode').eq('user_id', guard.user.id).maybeSingle(),
]);
```

Rendu du formulaire :

```tsx
<SuggestionForm defaultSigned={profile?.identity_mode === 'identified'} />
```

Badge, à ajouter dans le `<li>` de l'historique juste après le badge d'état existant :

```tsx
<span className="w-fit rounded-sm bg-bg-soft px-2 py-0.5 text-xs font-medium text-neutral-500">
  {s.signed ? t('history.signedBadge') : t('history.anonymousBadge')}
</span>
```

Les deux badges vivant côte à côte, envelopper la paire dans `<div className="flex flex-wrap items-center gap-2">`.

- [ ] **Step 7 : Vérifier l'ensemble**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: tout vert. `messages-fallback.test.ts` valide au passage que les nouvelles clés existent côté FR et ne cassent pas le fallback.

- [ ] **Step 8 : Commit**

```bash
git add "app/[locale]/community/profil/parametres/suggestion" messages/fr.json messages/ar.json tests/community/suggestion-form.test.tsx
git commit -m "feat(suggestion): case « Signer avec mon nom » + badge d'historique"
```

---

### Task 6 : UI co_mod — afficher le nom quand la suggestion est signée

**Files:**

- Modify: `app/[locale]/comod/suggestions/page.tsx`
- Create: `lib/content/suggestion-author.ts`
- Create: `tests/comod/suggestion-author.test.ts`
- Modify: `messages/fr.json`, `messages/ar.json` (namespace `suggestion.comod`)

**Interfaces:**

- Consumes: `resolveNeighbourLabels` + type `NeighbourLabel` (Task 3), colonne `signed` (Task 1).
- Produces: `suggestionAuthorLabel(signed: boolean, label: NeighbourLabel | undefined): { kind: 'named'; name: string; villa: number | null } | { kind: 'pseudonym'; suffix: string } | { kind: 'deleted' }` et la constante `SUGGESTION_PSEUDONYM_SCOPE = 'suggestions'`.

- [ ] **Step 1 : Ajouter les clés i18n**

Dans `messages/fr.json`, namespace `suggestion.comod` : remplacer `"intro"` et ajouter deux clés :

```json
    "intro": "Les suggestions d’évolution partagées par les voisins. Auteur pseudonymisé, sauf si le voisin a signé.",
    "authorNamed": "{name} — villa {villa}",
    "authorNamedNoVilla": "{name}",
```

Dans `messages/ar.json`, mêmes clés :

```json
    "intro": "اقتراحات التطوير التي شاركها الجيران. الكاتب باسم مستعار، إلا إذا وقّع الجار باسمه.",
    "authorNamed": "{name} — فيلا {villa}",
    "authorNamedNoVilla": "{name}",
```

- [ ] **Step 2 : Écrire le test qui échoue**

Créer `tests/comod/suggestion-author.test.ts` :

```ts
// @vitest-environment node
// Règle d'affichage de l'auteur d'une suggestion : c'est le flag `signed` FIGÉ à
// l'envoi qui décide, PAS la préférence de profil courante.

import { describe, expect, it } from 'vitest';
import { suggestionAuthorLabel } from '@/lib/content/suggestion-author';
import type { NeighbourLabel } from '@/lib/content/author-label';

const base: NeighbourLabel = {
  displayName: 'Salma',
  villa: 42,
  identityMode: 'pseudo',
  pseudonym: 'ABCD',
  deleted: false,
};

describe('suggestionAuthorLabel', () => {
  it('signée → nom + villa, même si le profil est repassé en pseudo', () => {
    expect(suggestionAuthorLabel(true, base)).toEqual({
      kind: 'named',
      name: 'Salma',
      villa: 42,
    });
  });

  it('non signée → pseudonyme, même si le profil est en identité affichée', () => {
    expect(suggestionAuthorLabel(false, { ...base, identityMode: 'identified' })).toEqual({
      kind: 'pseudonym',
      suffix: 'ABCD',
    });
  });

  it('signée sans display_name → pseudonyme (jamais un libellé vide)', () => {
    expect(suggestionAuthorLabel(true, { ...base, displayName: null })).toEqual({
      kind: 'pseudonym',
      suffix: 'ABCD',
    });
  });

  it('signée avec nom mais sans villa → nom seul', () => {
    expect(suggestionAuthorLabel(true, { ...base, villa: null })).toEqual({
      kind: 'named',
      name: 'Salma',
      villa: null,
    });
  });

  it('auteur purgé → deleted, quel que soit signed', () => {
    expect(suggestionAuthorLabel(true, { ...base, deleted: true })).toEqual({ kind: 'deleted' });
    expect(suggestionAuthorLabel(false, { ...base, deleted: true })).toEqual({ kind: 'deleted' });
  });

  it('label absent (user_id null après purge RGPD) → deleted', () => {
    expect(suggestionAuthorLabel(true, undefined)).toEqual({ kind: 'deleted' });
  });
});
```

- [ ] **Step 3 : Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run tests/comod/suggestion-author.test.ts`
Expected: FAIL — `Cannot find module '@/lib/content/suggestion-author'`.

- [ ] **Step 4 : Implémenter la règle**

Créer `lib/content/suggestion-author.ts` :

```ts
// Affichage de l'auteur d'une suggestion côté co_mod. La décision revient au flag
// `signed` FIGÉ sur la ligne à l'envoi — surtout PAS à la préférence de profil
// courante : un voisin qui a envoyé en anonyme puis a activé « identité affichée »
// ne doit pas se retrouver nommé rétroactivement.

import type { NeighbourLabel } from '@/lib/content/author-label';

export const SUGGESTION_PSEUDONYM_SCOPE = 'suggestions';

export type SuggestionAuthor =
  | { kind: 'named'; name: string; villa: number | null }
  | { kind: 'pseudonym'; suffix: string }
  | { kind: 'deleted' };

export function suggestionAuthorLabel(
  signed: boolean,
  label: NeighbourLabel | undefined,
): SuggestionAuthor {
  if (!label || label.deleted || !label.pseudonym) return { kind: 'deleted' };
  // Défaut sûr : signée mais sans nom exploitable → pseudonyme, jamais un blanc.
  if (signed && label.displayName) {
    return { kind: 'named', name: label.displayName, villa: label.villa };
  }
  return { kind: 'pseudonym', suffix: label.pseudonym };
}
```

- [ ] **Step 5 : Lancer le test pour vérifier qu'il passe**

Run: `npx vitest run tests/comod/suggestion-author.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6 : Câbler la page co_mod**

Dans `app/[locale]/comod/suggestions/page.tsx` :

Remplacer l'import de `pseudonymSuffix` par :

```tsx
import { resolveNeighbourLabels } from '@/lib/content/author-label';
import { suggestionAuthorLabel, SUGGESTION_PSEUDONYM_SCOPE } from '@/lib/content/suggestion-author';
```

Remplacer la requête et ajouter la résolution des libellés :

```tsx
const { data } = await supabase
  .from('suggestions')
  .select('id, body, state, created_at, user_id, signed')
  .is('deleted_at', null)
  .order('created_at', { ascending: false })
  .limit(100);

const items = data ?? [];
// 1 requête admin batch pour tout l'écran ; `user_id` ne quitte pas le serveur.
const labels = await resolveNeighbourLabels(
  items.map((s) => s.user_id),
  { scope: SUGGESTION_PSEUDONYM_SCOPE },
);
```

Remplacer le calcul de `author` dans le `map` :

```tsx
const resolved = suggestionAuthorLabel(s.signed, s.user_id ? labels.get(s.user_id) : undefined);
const author =
  resolved.kind === 'deleted'
    ? t('authorDeleted')
    : resolved.kind === 'pseudonym'
      ? t('author', { suffix: resolved.suffix })
      : resolved.villa === null
        ? t('authorNamedNoVilla', { name: resolved.name })
        : t('authorNamed', { name: resolved.name, villa: resolved.villa });
```

- [ ] **Step 7 : Vérifier l'ensemble**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: tout vert (dont `messages-fallback.test.ts`).

- [ ] **Step 8 : Commit**

```bash
git add "app/[locale]/comod/suggestions/page.tsx" lib/content/suggestion-author.ts tests/comod/suggestion-author.test.ts messages/fr.json messages/ar.json
git commit -m "feat(comod): afficher nom + villa sur les suggestions signées"
```

---

### Task 7 : Vérification manuelle et PR

**Files:** aucun (vérification).

- [ ] **Step 1 : Lancer l'app**

Run: démarrer le serveur de dev (`dev:webpack` — turbopack est KO sur ce projet), ouvrir `/fr/community/profil/parametres/suggestion`.
Expected: la case « Signer avec mon nom » est présente, cochée ou non selon la préférence du profil, avec son texte d'explication ; la cible tactile est confortable au doigt.

- [ ] **Step 2 : Vérifier l'absence d'erreur serveur**

Expected: aucune erreur dans les logs du serveur de dev sur la page résident et sur `/fr/comod/suggestions`.

- [ ] **Step 3 : Ouvrir la PR**

```bash
git push -u origin feat/suggestions-identite
```

Corps de PR : problème, décisions (choix par suggestion, figé à l'envoi, défaut depuis le profil, nom + villa côté co_mod), ce qui est testé, ce qui ne l'est pas (rendu réel de la page co_mod avec un vrai compte co_mod → à voir sur le preview Vercel), et le rappel que la migration sera appliquée en prod par `release.yml`.

Ne pas merger : le merge et le tag de release restent des décisions de Stéphane.

---

## Notes de plan

- **Écart assumé avec la spec** : la spec mentionnait un cas dans `tests/rls.test.ts`. Ce fichier (3 000 lignes, harnais OTP lourd) est `describe.skipIf` sans stack Docker et n'est **jamais** exécuté en CI. L'invariant « un résident ne peut écrire que `body` et `signed`, sur sa propre ligne » est porté par le grant colonne de la Task 1 ; on ne paie pas un cas de test qui ne tournera pas. À vérifier à la main sur la stack locale si Docker est dispo.
- **Ordre des tâches** : 1 → 2 → 3 → 4 → 5 → 6. Les tâches 2 et 3 sont indépendantes entre elles ; la 4 dépend de la 2, la 6 dépend de la 1 et de la 3.
- **Fichier parasite** : un `docs/superpowers/specs/2026-07-23-comod-tags-admin-design 2.md` non suivi traîne dans le repo (doublon iCloud). Ne pas le committer ; sa suppression est une décision de Stéphane.
