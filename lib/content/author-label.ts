// Résolution de l'auteur d'un bon plan (FR16, même sémantique que les notations
// artisan) : identité affichée → `display_name` ; pseudo → « Voisin anonyme
// #XXXX » stable ; contributeur purgé (RGPD) → « Voisin supprimé ».
//
// Pourquoi un admin client (server-only) : un résident lecteur NE PEUT PAS lire
// le `users.display_name` d'un AUTRE résident via RLS (`users_resident_select_self`
// uniquement). Les notations contournent ça en snapshotant `author_display_name`
// à la création ; le contenu éphémère n'a pas ce snapshot → on résout au render
// côté serveur, sans jamais sérialiser de `user_id` (seul le label part au client).
//
// Le suffixe pseudonyme est dérivé par HMAC(user_id, scope) — scope CONSTANT
// 'tips' → pseudonyme stable pour un même voisin sur tous ses bons plans.

import { createAdminClient } from '@/lib/supabase/admin';
import { pseudonymSuffix } from '@/lib/artisans/pseudonym';

export type AuthorLabel = { authorName: string | null; pseudonymSuffix: string | null };

const TIP_PSEUDONYM_SCOPE = 'tips';

/** Résout les labels auteur pour un lot de `created_by` (1 requête admin batch). */
export async function resolveTipAuthorLabels(
  createdByIds: (string | null | undefined)[],
): Promise<Map<string, AuthorLabel>> {
  const ids = [...new Set(createdByIds.filter((x): x is string => !!x))];
  const out = new Map<string, AuthorLabel>();
  if (ids.length === 0) return out;

  const admin = createAdminClient();
  const [usersRes, profilesRes] = await Promise.all([
    admin.from('users').select('id, display_name, deleted_at').in('id', ids),
    admin.from('profiles').select('user_id, identity_mode').in('user_id', ids),
  ]);

  const identityById = new Map((profilesRes.data ?? []).map((p) => [p.user_id, p.identity_mode]));

  for (const u of usersRes.data ?? []) {
    if (u.deleted_at) {
      // Contributeur purgé → « Voisin supprimé » (les deux null).
      out.set(u.id, { authorName: null, pseudonymSuffix: null });
      continue;
    }
    const identified = identityById.get(u.id) === 'identified';
    const name = u.display_name?.trim();
    if (identified && name) {
      out.set(u.id, { authorName: name, pseudonymSuffix: null });
    } else {
      // Pseudo (ou identité affichée sans display_name, ou profil manquant) →
      // pseudonyme stable. Défaut sûr : jamais le nom réel par accident.
      out.set(u.id, {
        authorName: null,
        pseudonymSuffix: pseudonymSuffix(u.id, TIP_PSEUDONYM_SCOPE),
      });
    }
  }
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
