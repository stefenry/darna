// Traduit la destination calculée par `resolveRedirect` en intention d'UI pour
// l'accueil. C'est la SEULE décision du chantier : la page ne fait que résoudre la
// session, le composant ne fait que rendre.
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

  // Résident, co_mod, ou toute destination future : on laisse entrer plutôt que de
  // bloquer sur un cas non prévu.
  return { kind: 'enter', href: destination };
}
