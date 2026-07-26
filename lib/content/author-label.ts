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
//   - suggestions → le flag `signed` figé sur la ligne à l'envoi
//     (`lib/content/suggestion-author.ts`).
//
// Le suffixe pseudonyme est dérivé par HMAC(user_id, scope) — un scope constant par
// surface ('tips', 'suggestions', 'artisans') donne un pseudonyme stable pour un
// même voisin sur cette surface.

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
 * Règle « préférence globale » (FR16) : le nom réel seulement si le voisin a opt-in
 * ET a un `display_name`. Tout le reste → pseudonyme ; purgé → les deux null,
 * l'UI affiche « Voisin supprimé ».
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
