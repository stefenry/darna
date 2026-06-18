# Darna — Runbook opérationnel

> Procédures d'exploitation pour le solo-dev / co-mod technique. Conforme NFR29-32 (AR34).
> Stack : Vercel (app, EU) · Supabase Free tier (DB+Auth, Frankfurt) · Cloudflare R2 (backups) ·
> Brevo (e-mail, FR) · Upstash Redis (rate-limit, Frankfurt) · GlitchTip/Sentry (erreurs).

---

## 1. Récupération (recovery)

| Perte              | Procédure                                                                                                                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Domaine**        | Le domaine est chez le registrar (vault 1Password). Re-pointer les DNS vers Vercel (records A/CNAME documentés dans le vault). En attendant, l'URL `*.vercel.app` reste fonctionnelle.                 |
| **Accès Supabase** | Restaurer depuis le dernier dump R2 (cf. §4) : créer un nouveau projet Supabase EU, `psql < dump.sql`, repointer `NEXT_PUBLIC_SUPABASE_URL`/clés dans Vercel. RPO = 7 jours (Free tier, cf. ADR 0007). |
| **Accès Vercel**   | Le repo Git est la source de vérité. Reconnecter le repo à un nouveau projet Vercel, re-saisir les variables d'env (liste complète : `lib/env.ts`), redéployer.                                        |
| **Accès R2**       | Régénérer les clés API R2 (Cloudflare dashboard), mettre à jour `R2_*` dans l'env Vercel + les secrets de l'Edge Function. Les dumps existants restent dans le bucket.                                 |

---

## 2. Rotation des secrets

Secrets stockés dans le **vault partagé 1Password Families**. Rotation recommandée tous les 6 mois
ou immédiatement en cas de compromission suspectée :

1. `SUPABASE_SECRET_KEY` (service-role) — Supabase dashboard → API → roll. Mettre à jour Vercel.
2. `CRON_SECRET` — générer 40+ chars random (`openssl rand -hex 24`), mettre à jour Vercel (les
   crons reçoivent le Bearer injecté par Vercel).
3. `BREVO_API_KEY`, `UPSTASH_REDIS_REST_TOKEN`, `R2_*` — roll côté provider, mettre à jour Vercel.
4. Après rotation : redéployer + vérifier un smoke (login, admission, un cron manuel).

---

## 3. Invitation des co-modérateurs (AR34)

Procédure en 2 temps, **jamais de secret/e-mail co-mod en SQL ou dans Git** :

1. Définir la variable d'env **`INITIAL_COMOD_EMAILS`** (CSV) dans l'environnement Vercel
   (ou localement pour un env de test).
2. Exécuter **`pnpm invite:comods`** (= `scripts/invite-co-mods.ts`) : pour chaque e-mail,
   `inviteUserByEmail()` envoie une invitation Supabase **avec `app_metadata.role='co_mod'`
   pré-assigné** (+ `residence_id`), et synchronise `public.users.role='co_mod'`. Idempotent.
3. **Supprimer la variable `INITIAL_COMOD_EMAILS`** de l'environnement après usage (aucun e-mail
   co-mod ne doit persister en clair).

**Notes** :

- Script idempotent : si une étape (app_metadata / users.role) échoue, le co-mod a un `auth.users`
  mais pas son rôle complet — **ré-exécuter `pnpm invite:comods`** récupère le cas (le 2e passage
  re-pose app_metadata + role).
- En cas de désync `public.users.role` ↔ `app_metadata` (ex. `admission.app_metadata_sync_failed`
  remonté Sentry), ré-exécuter le script ou poser manuellement `app_metadata` via le dashboard.
- `scripts/grant-comod.ts` (alias `pnpm grant:comod`) est l'outil **dev/local** équivalent (via
  `generateLink`, sans envoi d'invitation).

---

## 4. Vérification du backup hebdomadaire

Le cron `weekly-backup` tourne le dimanche 03:00 UTC (cf. ADR 0007).

**Checklist mensuelle** :

1. Vérifier dans les logs Vercel (ou Sentry) l'event `cron.backup_completed` du dernier dimanche
   (et l'absence de `cron.backup_failed`).
2. Lister le bucket R2 `darna-backups/postgres/` : un objet `YYYY-MM-DD.sql.gz` par semaine,
   ≤ 12 objets (rétention rolling).
3. **Test de restauration trimestriel** : télécharger le dernier dump, `psql` vers une DB jetable,
   vérifier que les tables clés (`users`, `profiles`, `admission_requests`, `moderation_log`) sont
   peuplées et cohérentes.

**⚠️ État MVP (scaffold, ADR 0007 D6)** : tant que les secrets `R2_*` ne sont pas provisionnés,
l'Edge Function est un **no-op** (log `r2_not_configured`). **Avant la bêta** : provisionner le
bucket R2 + les secrets, déployer l'Edge Function, dérouler cette checklist sur un 1er dump réel.

---

## 5. Contacts d'urgence & SLA

| Rôle                              | Contact                                      | SLA                                                                |
| --------------------------------- | -------------------------------------------- | ------------------------------------------------------------------ |
| **Dev technique (fallback)**      | `LEGAL_CONTACT_EMAIL` / vault 1Password      | Best-effort < 48h                                                  |
| **Recours juridique (CNDP/RGPD)** | DPO / conseil juridique (vault)              | Selon obligation légale (CNDP : réponse demande d'effacement < 7j) |
| **Incident sécurité**             | Roll des secrets (§2) immédiat + post-mortem | Confinement < 24h                                                  |

> Principe : Darna est un commun à faible criticité (lecture annuaire/guide/alertes). Aucune
> donnée bancaire. La priorité incident est la **confidentialité** (fuite RLS → §2 + audit
> `moderation_log`) puis la **disponibilité**.
