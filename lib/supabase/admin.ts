import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import type { Database } from '@/lib/supabase/types.generated';

// Server-only admin client. Uses SUPABASE_SECRET_KEY (service role).
// NEVER import this from a Client Component or expose its return value
// to the browser. Use only inside Server Actions / Route Handlers that
// genuinely need admin scope (e.g. `auth.admin.generateLink`).
export function createAdminClient() {
  return createClient<Database>(
    env.client.NEXT_PUBLIC_SUPABASE_URL,
    env.server.SUPABASE_SECRET_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
