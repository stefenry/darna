import { createAdminClient } from '@/lib/supabase/admin';
import { log } from '@/lib/logger';

// Destinataires des notifications co_mod, résolus DEPUIS LA BASE au moment de
// l'envoi.
//
// Retour bêta 2026-07-26 : les co_mods ne recevaient plus rien. Les trois
// notifications (admission, fiche artisan, suggestion) itéraient sur
// `env.server.INITIAL_COMOD_EMAILS` — une liste statique que le runbook §3
// demande explicitement de SUPPRIMER après le bootstrap des invitations
// (« aucun e-mail co-mod ne doit persister en clair »). Une fois la variable
// retirée, la boucle tournait sur un tableau vide : aucun envoi, aucune erreur,
// aucun log. Et un co_mod nommé après le bootstrap n'aurait de toute façon
// jamais rien reçu.
//
// Résoudre depuis la base corrige les deux problèmes et sert MIEUX l'intention
// du runbook : plus aucune adresse ne dort dans la configuration.
//
// Server-only : utilise le client admin (l'e-mail vit dans `auth.users`, hors
// de portée de PostgREST). Ne renvoie jamais d'exception — une notification est
// accessoire, elle ne doit jamais faire échouer l'action de l'utilisateur.

/** E-mails des co_mods actifs de la résidence. Tableau vide si indisponible. */
export async function fetchComodEmails(): Promise<string[]> {
  try {
    const admin = createAdminClient();

    const { data: comods, error } = await admin
      .from('users')
      .select('id')
      .eq('role', 'co_mod')
      .is('deleted_at', null);
    if (error) throw error;

    const ids = (comods ?? []).map((u) => u.id);
    if (ids.length === 0) {
      log({
        level: 'warn',
        event: 'comod.no_recipients',
        user_id: null,
        residence_id: null,
        request_id: null,
        payload: { reason: 'no_active_comod' },
      });
      return [];
    }

    const results = await Promise.all(ids.map((id) => admin.auth.admin.getUserById(id)));
    const emails = results
      .map((r) => r.data?.user?.email)
      .filter((e): e is string => typeof e === 'string' && e.length > 0);

    if (emails.length === 0) {
      log({
        level: 'warn',
        event: 'comod.no_recipients',
        user_id: null,
        residence_id: null,
        request_id: null,
        payload: { reason: 'no_email_resolved', comodCount: ids.length },
      });
    }
    return emails;
  } catch (cause) {
    // Un échec de résolution ne doit pas remonter jusqu'à l'utilisateur : on
    // logue et on renvoie une liste vide, comme un envoi qui échoue.
    log({
      level: 'error',
      event: 'comod.recipients_failed',
      user_id: null,
      residence_id: null,
      request_id: null,
      payload: { errorName: cause instanceof Error ? cause.name : 'unknown' },
    });
    return [];
  }
}
