import { createAdminClient } from '@/lib/supabase/admin';
import { sendTransactionalEmail, type SendArgs } from '@/lib/email/send';
import { log } from '@/lib/logger';

// Story 7.2 — Boundary unique de DÉLIVRANCE des notifications résident qui
// respectent l'opt-in (FR40) et la locale par profil (FR41/FR42/NFR44).
//
// Contrairement à `lib/email/send.ts` (qui envoie inconditionnellement un
// e-mail transactionnel essentiel : magic-link, décision admission, notif
// co_mod…), ce module gate l'envoi sur la catégorie de préférence du
// destinataire et résout sa langue avant d'invoquer la boundary e-mail.
//
// Web Push (FR41) est marqué V1.5 — voir `lib/notifications/web-push.ts`.
// Au MVP l'e-mail est l'unique canal actif.

export type NotificationCategory =
  | 'alerts_urgentes'
  | 'nouvelles_entrees_annuaire'
  | 'activite_contributions';

// Map catégorie → colonne booléenne de notifications_prefs.
const CATEGORY_COLUMN = {
  alerts_urgentes: 'alerts_urgentes_enabled',
  nouvelles_entrees_annuaire: 'nouvelles_entrees_annuaire_enabled',
  activite_contributions: 'activite_contributions_enabled',
} as const satisfies Record<NotificationCategory, string>;

// Défauts FR40 si la row notifications_prefs manque (anomalie de provisioning) :
// le comportement sûr est de coller aux defaults de la table.
const CATEGORY_DEFAULT: Record<NotificationCategory, boolean> = {
  alerts_urgentes: true,
  nouvelles_entrees_annuaire: false,
  activite_contributions: true,
};

export type DispatchResult =
  | { status: 'sent'; messageId: string }
  | { status: 'skipped_opt_out' }
  | { status: 'skipped_no_recipient' }
  | { status: 'failed'; errorCode: string };

// Le builder reçoit le contexte résolu (destinataire + locale) et compose les
// `SendArgs` finaux. Garde le typage du discriminated union intact côté appelant.
type ArgsBuilder = (ctx: { to: string; locale: 'fr' | 'ar' }) => SendArgs;

/**
 * Notifie UN résident pour une catégorie donnée, en respectant son opt-in et
 * sa langue. Best-effort : l'appelant ne doit jamais bloquer son flux principal
 * sur le résultat (l'action métier est déjà committée).
 *
 * - opted-out → `notification.skipped_opt_out` (info, sans PII) + skip
 * - pas d'e-mail → `notification.skipped_no_recipient` + skip
 * - échec d'envoi → `email.failed` est déjà loggé par send.ts (error → GlitchTip)
 */
export async function notifyResident(params: {
  userId: string | null | undefined;
  category: NotificationCategory;
  build: ArgsBuilder;
}): Promise<DispatchResult> {
  const { userId, category, build } = params;
  if (!userId) return { status: 'skipped_no_recipient' };

  try {
    const admin = createAdminClient();

    // 1. Préférence opt-in (gate). Row garantie par le trigger 1.3 ; fallback défauts FR40.
    const column = CATEGORY_COLUMN[category];
    const { data: prefRow } = await admin
      .from('notifications_prefs')
      .select(
        'alerts_urgentes_enabled, nouvelles_entrees_annuaire_enabled, activite_contributions_enabled',
      )
      .eq('user_id', userId)
      .maybeSingle();
    const enabled = prefRow ? Boolean(prefRow[column]) : CATEGORY_DEFAULT[category];
    if (!enabled) {
      log({
        level: 'info',
        event: 'notification.skipped_opt_out',
        user_id: userId,
        residence_id: null,
        request_id: null,
        payload: { category },
      });
      return { status: 'skipped_opt_out' };
    }

    // 2. Destinataire (e-mail vit dans auth.users → admin getUserById).
    const { data: userData } = await admin.auth.admin.getUserById(userId);
    const email = userData?.user?.email ?? null;
    if (!email) {
      log({
        level: 'warn',
        event: 'notification.skipped_no_recipient',
        user_id: userId,
        residence_id: null,
        request_id: null,
        payload: { category },
      });
      return { status: 'skipped_no_recipient' };
    }

    // 3. Locale par profil (FR48 fallback FR).
    const { data: profileRow } = await admin
      .from('profiles')
      .select('language')
      .eq('user_id', userId)
      .maybeSingle();
    const locale: 'fr' | 'ar' = profileRow?.language === 'ar' ? 'ar' : 'fr';

    // 4. Envoi (send.ts logge email.sent / email.failed lui-même).
    const result = await sendTransactionalEmail(build({ to: email, locale }));
    if (result.ok) return { status: 'sent', messageId: result.messageId };
    return { status: 'failed', errorCode: result.errorCode };
  } catch (cause) {
    log({
      level: 'error',
      event: 'notification.dispatch_threw',
      user_id: userId,
      residence_id: null,
      request_id: null,
      payload: { category, errorName: cause instanceof Error ? cause.name : 'unknown' },
    });
    return { status: 'failed', errorCode: 'dispatch_threw' };
  }
}

export type FanoutCounts = { sent: number; skipped: number; failed: number };

/**
 * Fan-out d'une notification de catégorie à TOUS les résidents opt-in d'une
 * résidence (ex. alerte urgente, digest annuaire). Sélectionne les abonnés via
 * le service-role puis délègue à `notifyResident` (qui re-vérifie l'opt-in, la
 * locale et l'e-mail par destinataire). `excludeUserId` évite de se notifier soi.
 */
export async function notifyResidentsByCategory(params: {
  residenceId: string;
  category: NotificationCategory;
  excludeUserId?: string | null;
  build: (ctx: { to: string; locale: 'fr' | 'ar'; userId: string }) => SendArgs;
}): Promise<FanoutCounts> {
  const { residenceId, category, excludeUserId, build } = params;
  const counts: FanoutCounts = { sent: 0, skipped: 0, failed: 0 };

  const admin = createAdminClient();
  const column = CATEGORY_COLUMN[category];
  const { data: rows, error } = await admin
    .from('notifications_prefs')
    .select('user_id')
    .eq('residence_id', residenceId)
    .eq(column, true);

  if (error || !rows) {
    log({
      level: 'error',
      event: 'notification.fanout_query_failed',
      user_id: null,
      residence_id: residenceId,
      request_id: null,
      payload: { category, errorCode: error?.code ?? 'unknown' },
    });
    return counts;
  }

  for (const row of rows) {
    if (excludeUserId && row.user_id === excludeUserId) continue;
    const res = await notifyResident({
      userId: row.user_id,
      category,
      build: ({ to, locale }) => build({ to, locale, userId: row.user_id }),
    });
    if (res.status === 'sent') counts.sent += 1;
    else if (res.status === 'failed') counts.failed += 1;
    else counts.skipped += 1;
  }

  log({
    level: 'info',
    event: 'notification.fanout_done',
    user_id: null,
    residence_id: residenceId,
    request_id: null,
    payload: { category, ...counts },
  });
  return counts;
}
