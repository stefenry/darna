// Story 3.4 (AC1/AC3) — état d'onboarding du résident courant (server-only).
//
// Deux signaux lifecycle `users` (posés en 1.3, grantés UPDATE self en init_rls) :
//   - first_login_at         : Pack consommé (onboarding complété).
//   - pack_accueil_dismissed_at : bannière écartée.
// La bannière s'affiche ssi les DEUX sont null (D2). Lecture client session (RLS
// users_resident_select_self) — jamais d'admin client.

import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

export type OnboardingState = { showPackBanner: boolean };

export const fetchOnboardingState = cache(_fetchOnboardingState);

async function _fetchOnboardingState(): Promise<OnboardingState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id ?? null;
  if (!uid) return { showPackBanner: false };

  const { data, error } = await supabase
    .from('users')
    .select('first_login_at, pack_accueil_dismissed_at')
    .eq('id', uid)
    .maybeSingle();
  // Bénin : toute erreur/absence → ne pas pousser la bannière (non bloquant).
  if (error || !data) return { showPackBanner: false };

  return {
    showPackBanner: data.first_login_at === null && data.pack_accueil_dismissed_at === null,
  };
}
