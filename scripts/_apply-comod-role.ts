import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types.generated';

export async function applyComodRole(
  admin: SupabaseClient<Database>,
  userId: string,
  residenceId: string,
  label: string,
): Promise<boolean> {
  const meta = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { role: 'co_mod', residence_id: residenceId },
  });
  if (meta.error) {
    console.error(`[comod] updateUserById failed for ${label}: ${meta.error.message}`);
    return false;
  }

  // .select('id') forces PostgREST return=representation so real DB errors surface in row.error.
  const row = await admin.from('users').update({ role: 'co_mod' }).eq('id', userId).select('id');
  if (row.error) {
    console.error(`[comod] users.update(role) failed for ${label}: ${row.error.message}`);
    return false;
  }

  return true;
}
