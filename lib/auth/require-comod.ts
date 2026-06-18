import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

// Story 1.8 — Garde de rôle co-mod (NFR21). Matérialise le `requireRole('co_mod')`
// évoqué architecture.md:930 (lib/auth/rbac.ts n'existe pas encore — scope co_mod
// uniquement ; la généralisation requireRole<R> est différée à epic 2+).
//
// Le rôle est lu dans `user.app_metadata.role` (le JWT), source de vérité côté
// proxy + RLS. La synchro public.users.role → app_metadata est assurée par le
// bootstrap `scripts/grant-comod.ts` (co-mods) et par updateUserById à
// l'acceptation (nouveaux résidents). Voir story 1.8 D3.
//
// Utilisé par (comod)/layout.tsx (rend la vue 403) ET par les Server Actions
// de décision (défense en profondeur derrière le proxy).
export async function requireComod(): Promise<{ ok: true; user: User } | { ok: false }> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  const user = data?.user ?? null;
  if (error || !user) return { ok: false };
  if (user.app_metadata?.role !== 'co_mod') return { ok: false };
  return { ok: true, user };
}
