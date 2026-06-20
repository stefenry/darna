// Story 2.6 review P11 — helper centralisé pour mapper la visibilité du form
// (`pseudonym`/`named`) vers l'enum DB `profiles.identity_mode` (`pseudo`/`identified`).
//
// Dedupe Task 3 (2.6) directive : remplace les implémentations parallèles
// dans `annuaire/nouveau/actions.ts` et `noter/actions.ts`.

export function mapVisibilityToIdentityMode(v: 'pseudonym' | 'named'): 'pseudo' | 'identified' {
  return v === 'named' ? 'identified' : 'pseudo';
}
