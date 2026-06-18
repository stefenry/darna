import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

// Story 1.9 — Garde de session pour la zone communautaire (pattern require-comod
// 1.8). Ne gate PAS le rôle : un `demandeur` authentifié peut voir son propre
// profil (le role-gating community est déféré 1.10/epic2). Le proxy redirige
// déjà les non-authentifiés vers /admission ; cette garde double la protection
// côté layout (défense en profondeur).
export async function requireResident(): Promise<{ ok: true; user: User } | { ok: false }> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  const user = data?.user ?? null;
  if (error || !user) return { ok: false };
  return { ok: true, user };
}
