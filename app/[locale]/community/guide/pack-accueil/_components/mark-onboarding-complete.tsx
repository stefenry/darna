'use client';

// Story 3.4 (AC4 / D4) — marque l'onboarding complété au MOUNT de la page Pack.
// L'épic dit « quand je ferme la page » mais `beforeunload`/`visibilitychange`
// est non fiable sur mobile (cœur de cible) → poser au mount (« entrer dans le
// Pack = onboarding amorcé ») est robuste et idempotent (l'action garde `is null`).
// Effet sans rendu ; appel unique via ref (StrictMode double-mount safe).

import { useEffect, useRef } from 'react';
import { completeOnboarding } from '../../../_actions/onboarding';

export function MarkOnboardingComplete() {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void completeOnboarding();
  }, []);
  return null;
}
