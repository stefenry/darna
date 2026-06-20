# Story 2.8: Droit de réponse artisan

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

> ⚠️ **4 décisions structurantes** (détaillées en Dev Notes §Décisions) : (1) **Nouvelle table `artisan_responses`** (entité dédiée FR22, pas un overload de `ratings` — `target_kind` discriminé `'rating'|'listing'`, FK artisan_id, response_text 500 sanitizé, pas de soft-delete client). (2) **Extension `artisan_consent_tokens.purpose enum('consent','respond')`** — réutilisation propre du store HMAC 2.4 ; nouvelle RPC `process_artisan_response` SECURITY DEFINER distincte de `process_artisan_consent` (signatures et statuts indépendants). (3) **Page publique `/artisan/contact` (HORS `[locale]`) → RPC `request_artisan_contact_link(phone)` SECURITY DEFINER + indistinguabilité AR38 stricte** (même réponse générique phone valide/inexistant + égalisation timing). (4) **Rectification queue = persistance MVP + UI co-mod différée Epic 5** : nouvelle table `artisan_rectification_requests` (rows passives), `moderation_log` action `artisan_rectification_requested` posée immédiatement (transparence FR22) ; le **traitement** queue co-mod arrive en 5.x.

## Story

As an **artisan (Fatima — Journey 4 post-publication)**,
I want **un chemin parallèle, sans compte, pour (a) publier ma réponse à une note ou à ma fiche, (b) demander rectification d'une donnée de ma fiche, et (c) re-déclencher moi-même un nouveau magic-link depuis mon téléphone si j'ai perdu le SMS**,
so that **mon droit de réponse CNDP / droit marocain est opérationnel (FR22) et que je garde un canal de remédiation indépendant du contributeur**.

Story aval directe de **2.4** (token HMAC + `artisan_consent_tokens`), **2.5** (page `/consent/[token]` + RPC SECURITY DEFINER + AR38 indistinguabilité + scrubber Sentry + cache no-store + SW NetworkOnly + PRG done sans token), **2.6** (ratings/comments — cibles d'une réponse), **2.7** (rectification déclenche queue co-mod ; le contributeur a son propre chemin d'édition). **Aval** : Epic 5 (queue UI co-mod pour traiter les rectifications). Couvre la **création** : les **`artisan_responses`** rendues publiquement sur la fiche, les **`artisan_rectification_requests`** persistées en attente Epic 5.

## Acceptance Criteria

> Source verbatim : `_bmad-output/planning-artifacts/epics.md` § « Story 2.8 » (l. 1092-1120). FR22 / AR38 / NFR18 / CC #20. Adaptations techniques (table `artisan_responses` dédiée, `purpose` enum tokens, RPC dédiée, rectification queue persistée passive) signalées en gras et tranchées en Dev Notes — elles priment.

1. **AC1 — Page `/artisan/contact` (HORS `[locale]`).** Étant donné que je suis un artisan référencé sur Darna (publié, `state='published'`, non soft-deleted) et que je n'ai plus le SMS de consentement, quand j'ouvre `darna.org/artisan/contact` (lien depuis l'e-mail contributeur post-consent 2.5 OU QR code futur fiche), alors je vois un formulaire **public, sans session** : champ `phone` (E.164 `+212`, validé `zPhoneMaroc` 2.4) + bouton « Envoyer le lien ». Toggle FR/AR (`?lang=`, identique 2.5). (FR22, AR38)

2. **AC2 — Demande de magic-link (AR38 indistinguabilité).** Étant donné que je soumets un téléphone, quand l'action `requestArtisanContactLink` tourne, alors **(a)** rate-limit IP **(10/h)** + rate-limit par phone normalisé **(3/h)** anti-flooding SMS ; **(b)** lookup admin `artisans` `phone_e164 = ?` AND `state='published'` AND `deleted_at IS NULL` (`order by published_at desc limit 1` — D4 latest published) ; **(c) si artisan trouvé** : générer nouveau token HMAC (`generateConsentToken` 2.4), INSERT `artisan_consent_tokens` avec **`purpose='respond'`** + expiry 24h (alignement 2.5/P28), SMS via `lib/sms/send` template `artisan-respond.fr` (lien `darna.org/respond/[raw]`) ; **(d) si artisan introuvable** : `await sleep` pour égaliser timing avec la branche (c) (mesure approximative `~150ms`, voir §Sécurité §Timing). **Dans les deux cas** : réponse générique inline « Si ce numéro est associé à une fiche publiée, vous recevrez un SMS dans quelques minutes » — **JAMAIS** révéler l'existence ou la non-existence (AR38 strict).

3. **AC3 — Page `/respond/[token]` (HORS `[locale]`).** Étant donné que je clique le magic link reçu, quand la page charge **sans authentification** (accès token-based, pattern 2.5), alors la route `app/respond/[token]/page.tsx` (RSC, public, **hors `[locale]`**) : **(a)** appelle `resolveResponseToken(raw, locale)` (nouveau `lib/consent/lookup-response.ts`, branche dédiée — re-HMAC + filtre `purpose='respond'`) ; **(b)** si `valid` → affiche ma fiche courante (`display_name`, `phone` masqué partiellement type `+212 6XX XX XX 01`, `tags`, agrégat rating si déjà noté — section read-only) + **deux onglets/sections distinctes** : « Publier une réponse » (textarea 500 + sélecteur cible : `'listing'` global OU `'rating'` ciblé sur une note existante via dropdown, optionnel) ; « Demander rectification » (sélecteur champ cible parmi `'display_name_fr'|'display_name_ar'|'phone_e164'|'competences'|'price_relative'|'has_invoice'` + champ valeur souhaitée (text 200) + textarea justification 500) ; **(c)** si `invalid|expired|used` → écran générique (AR38, calque 2.5). Toggle FR/AR. Aucune session. (FR22)

4. **AC4 — Publication d'une réponse.** Étant donné que je remplis la section « Publier une réponse » et que je soumets, quand le form POSTe vers `app/api/webhook/artisan-respond/route.ts`, alors **en transaction via RPC `process_artisan_response`** : (a) `artisan_responses` est inséré (`artisan_id`, `target_kind`, `target_id` (uuid rating si ciblé, sinon NULL), `response_text` (sanitizé NFC + strip control/bidi, ≤ 500), `created_at=now()`) ; (b) `artisan_consent_tokens.used_at=now()` (idempotence) ; (c) `moderation_log` enregistre `actor_id=null`, `action='artisan_response_published'`, `target_kind='artisan'`, `target_id=artisan.id` (CC #20, FR33) ; (d) PRG redirect → `/respond/done?status=published` (URL **SANS token**, pattern 2.5 D1). Aucun e-mail au contributeur au MVP (différé Epic 7 notifications). (FR22)

5. **AC5 — Demande de rectification.** Étant donné que je remplis la section « Demander rectification » et que je soumets, quand le webhook est appelé avec `kind='rectification'`, alors via RPC `process_artisan_response` (branche `rectification`) : (a) `artisan_rectification_requests` est inséré (`artisan_id`, `field_target` enum, `requested_value` 200 sanitizée, `justification_text` 500 sanitizée, `state='pending'` par défaut, `created_at=now()`) ; (b) `used_at=now()` ; (c) `moderation_log` enregistre `action='artisan_rectification_requested'`. **Aucune mutation immédiate** sur `artisans` — la rectification entre en queue **passive** jusqu'à traitement co-mod (Epic 5.x, hors-scope 2.8). PRG → `/respond/done?status=rectification_pending`. (FR22, CC #20, NFR17)

6. **AC6 — Token expiré (> 24h).** Étant donné un token expiré, quand j'ouvre l'URL, alors la page affiche un écran générique « Cette demande a expiré. Demandez un nouveau lien sur darna.org/artisan/contact » (FR) / équivalent AR. **Aucune action possible** (form non rendu).

7. **AC7 — Token falsifié / déjà utilisé.** Étant donné un token trafiqué OU déjà consommé, quand la requête atteint la route, alors **HTTP 401** (webhook) / écran générique (page GET) — **JAMAIS** révéler l'état (AR38, pattern 2.5). Le webhook idempotent : re-POST sur un token `used` → no-op + redirect `/respond/done?status=used`.

8. **AC8 — Affichage des réponses sur la fiche publique.** Étant donné une fiche `darna.org/[locale]/community/artisan/[slug]` qui a `artisan_responses` non-vides, quand un résident la visite, alors un nouveau bloc « Réponses de l'artisan » apparaît : chaque entrée = `<blockquote>` avec **(a)** signature obligatoire `display_name_fr` (ou `display_name_ar` selon locale) — **jamais pseudonyme** pour les réponses artisan (FR22 : droit de réponse identifié), **(b)** timestamp `created_at` formaté FR (`dd MMMM yyyy`), **(c)** texte `response_text` rendu en texte simple (pas de markdown — `whiteSpace:'pre-wrap'`), **(d)** si `target_kind='rating'`, badge contextuel « En réponse à une note » (lien ancre vers le rating ciblé dans la section commentaires). Les réponses orphelines (`target_id` rating soft-deleted) restent affichées (FR22 : la réponse de l'artisan ne disparaît pas avec la note).

9. **AC9 — Sécurité (FR22, AR38, NFR18, défense en profondeur).** Étant donné que toute la story 2.8 expose des chemins token-based publics sans session, alors : **(a)** scrubber Sentry étendu pour `/respond/[token]` ET `/artisan/contact` (regex `lib/sentry/scrub.ts`) ; **(b)** Cache-Control `private, no-store` étendu à `/respond/*` ET `/artisan/contact` (`next.config.ts`) ; **(c)** SW NetworkOnly étendu pour `/respond/*` ET `/artisan/contact` (HTML contient `display_name` + structure fiche) ; **(d)** `proxy.ts` exclut `/respond` ET `/artisan/contact` du middleware locale (matcher négatif) ; **(e)** CSRF webhook Origin/Sec-Fetch-Site check ; **(f)** rate-limit IP + token_hash + Content-Length max 4KB sur webhook ; **(g)** `request.formData()` try/catch → 400 (AR38) ; **(h)** `response_text`, `justification_text`, `requested_value` strip control+bidi NFC normalize (pattern 2.4 P3) ; **(i)** Aucune écriture directe `artisans` depuis `/respond/*` (la rectification passe par queue passive, pas de bypass édition contributeur — défense en profondeur vs 2.7).

10. **AC10 — Pas de session artisan.** Et **aucune session artisan n'est créée** — accès strictement token-scopé à la seule action `response/rectification` en cours. Aucun cookie, aucun `supabase.auth`. (Pattern 2.5 AC7.)

### AC additionnel (régression — obligatoire)

11. **AC11 — Tests + sécurité verts.** RLS étendue dans `tests/rls.test.ts` (suite gated `SUPABASE_LOCAL_TEST`) couvre : **(a)** `artisan_responses` deny-all client INSERT/UPDATE (lecture publique scopée par fiche `published` + residence comme `ratings`) ; **(b)** `artisan_rectification_requests` deny-all client (lecture co-mod résidence uniquement) ; **(c)** RPC `process_artisan_response` revoke `anon`/`authenticated`, grant `service_role` (pattern 2.5/P2) ; **(d)** RPC `request_artisan_contact_link` idem grant `service_role` ; **(e)** purpose='respond' rejette un token purpose='consent' (cross-purpose ne fuit pas) ; **(f)** moderation_log policy étendue : actions `artisan_response_published` + `artisan_rectification_requested` ajoutées à la lecture restreinte par résidence (pattern 2.5/P5, anti side-channel AR38). **Et** `pnpm typecheck`/`lint`/`test` verts ; aucun raw token en log ; types regen ; cron purge étendu pour tokens `purpose='respond'`.

## Tasks / Subtasks

- [x] **Task 1 — Migrations : schéma + RPCs SECURITY DEFINER + enum extensions** (AC: 2, 4, 5, 7, 11)
  - [x] Migration `<ts>_artisan_response.sql`. **Étape A — enum extensions** (additives, commit avant usage — leçon 2.5) :
        `sql
    alter type public.moderation_action add value if not exists 'artisan_response_published';
    alter type public.moderation_action add value if not exists 'artisan_rectification_requested';
    `
        Migration séparée si nécessaire (`ADD VALUE` ne peut tourner dans le même bloc transactionnel qu'un usage immédiat).
  - [x] **Étape B — `artisan_consent_tokens.purpose enum`** :
        `sql
    create type public.consent_token_purpose as enum ('consent', 'respond');
    alter table public.artisan_consent_tokens
      add column purpose public.consent_token_purpose not null default 'consent';
    create index idx_artisan_consent_tokens_purpose_hash
      on public.artisan_consent_tokens (purpose, token_hash);
    `
        La RLS deny-all client reste (2.1) — purpose ne change pas le périmètre, seulement la discrimination interne. Les tokens existants restent `'consent'` (default).
  - [x] **Étape C — table `artisan_responses`** (FR22, AR9 soft-delete homogène) :
        ``sql
    create type public.artisan_response_target as enum ('listing', 'rating');
    create table public.artisan_responses (
      id uuid primary key default gen_random_uuid(),
      artisan_id uuid not null references public.artisans(id) on delete cascade,
      residence_id uuid not null references public.residences(id) on delete restrict,
      target_kind public.artisan_response_target not null,
      target_id uuid,  -- rating.id si target_kind='rating', NULL si 'listing'
      response_text text not null check (length(response_text) between 1 and 500),
      response_tsv tsvector generated always as
        (to_tsvector('french', coalesce(response_text, ''))) stored,
      created_at timestamptz not null default now(),
      deleted_at timestamptz,
      deleted_by uuid references public.users(id) on delete set null,
      deletion_reason text
    );
    create index idx_artisan_responses_artisan_id on public.artisan_responses (artisan_id, created_at desc);
    create index idx_artisan_responses_tsv on public.artisan_responses using gin (response_tsv);
    alter table public.artisan_responses enable row level security;
    -- SELECT : public scopé comme `ratings` (fiche published + même résidence + deleted_at IS NULL).
    create policy artisan_responses_resident_select on public.artisan_responses
      for select using (
        deleted_at is null and exists (
          select 1 from public.artisans a
          where a.id = artisan_id and a.state='published' and a.deleted_at is null
            and a.residence_id = (
              select residence_id from public.users
              where id = auth.uid() and role in ('resident','co_mod')
                and deleted_at is null
            )
        )
      );
    -- Pas de policy INSERT/UPDATE/DELETE → écriture via RPC SECURITY DEFINER seule.
    ``
        `response_tsv` posé tout de suite pour préparer la recherche full-text future (Epic 6) — coût stockage négligeable.
  - [x] **Étape D — table `artisan_rectification_requests`** (queue passive, traitement Epic 5) :
        `sql
    create type public.artisan_rectification_state as enum ('pending', 'accepted', 'rejected');
    create type public.artisan_rectification_field as enum (
      'display_name_fr', 'display_name_ar', 'phone_e164',
      'competences', 'price_relative', 'has_invoice'
    );
    create table public.artisan_rectification_requests (
      id uuid primary key default gen_random_uuid(),
      artisan_id uuid not null references public.artisans(id) on delete cascade,
      residence_id uuid not null references public.residences(id) on delete restrict,
      field_target public.artisan_rectification_field not null,
      requested_value text not null check (length(requested_value) between 1 and 200),
      justification_text text not null check (length(justification_text) between 1 and 500),
      state public.artisan_rectification_state not null default 'pending',
      decided_by uuid references public.users(id) on delete set null,
      decided_at timestamptz,
      decision_reason text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create index idx_artisan_rectification_requests_state
      on public.artisan_rectification_requests (state, created_at);
    create trigger trg_artisan_rectification_updated_at
      before update on public.artisan_rectification_requests
      for each row execute function public.set_updated_at();
    alter table public.artisan_rectification_requests enable row level security;
    -- SELECT : co-mods de la résidence (queue privée — pas de transparence publique
    -- avant traitement, contrairement à moderation_log). FR22 ne demande pas
    -- de queue publique ; protège les données PII demandées en rectification.
    create policy artisan_rectification_resident_select_comod on public.artisan_rectification_requests
      for select using (
        public.auth_role() = 'co_mod' and residence_id = public.auth_residence_id()
      );
    -- Pas de policy write → tout passe par RPC SECURITY DEFINER (insertion 2.8, traitement Epic 5).
    `
  - [x] **Étape E — RPC `request_artisan_contact_link(p_phone_e164 text, p_token_hash text, p_expires_at timestamptz)` SECURITY DEFINER set search_path=public** (AC2) :
    - Signature : `returns table(status text, sms_target_phone text, sms_artisan_name text)`. Le **raw token est généré côté Server Action** (réutilise `lib/consent/token.ts`), seul `token_hash` + `expires_at` sont passés à la RPC.
    - Logique : lookup `artisans` `phone_e164 = p_phone_e164` AND `state='published'` AND `deleted_at IS NULL` `order by published_at desc limit 1`.
    - Si trouvé : insert `artisan_consent_tokens (artisan_id, residence_id, token_hash, expires_at, purpose='respond')` ; return `('sent', phone_e164, display_name_fr)`.
    - Si introuvable : return `('not_found', null, null)` **sans `raise exception`** (la Server Action mappe vers la même réponse générique côté UI — AR38 indistinguabilité).
    - `revoke execute from public, anon, authenticated; grant execute to service_role` (la Server Action appelle via `createAdminClient` — pattern 2.5/P2 strict).
  - [x] **Étape F — RPC `process_artisan_response(p_token_hash text, p_kind text, p_payload jsonb)` SECURITY DEFINER** (AC4, AC5, AC7) :
    - Signature : `returns table(status text, artisan_id uuid, slug text)`. `p_kind in ('response', 'rectification')`. `p_payload` :
      - `kind='response'` : `{ response_text: string, target_kind: 'listing'|'rating', target_id?: uuid }`
      - `kind='rectification'` : `{ field_target: string, requested_value: string, justification_text: string }`
    - Logique (calque atomicité 2.5/P1) :
      - Lookup token : `from artisan_consent_tokens t join artisans a on a.id = t.artisan_id where t.token_hash = p_token_hash`.
      - Si introuvable → `('not_found', null, null)`. Si `t.purpose != 'respond'` → `('not_found', null, null)` (AR38 : ne révèle pas qu'un consent token existe avec ce hash).
      - Si `a.state != 'published'` OR `a.deleted_at is not null` → `('not_found', null, null)` (l'artisan a été retiré entre-temps, AR38).
      - Si `t.used_at is not null` → `('already_used', a.id, a.slug)`.
      - Si `t.expires_at < now()` → `('expired', a.id, a.slug)`.
      - Gate atomique race : `update artisan_consent_tokens set used_at=now() where id=t.id and used_at is null returning id` → si null → `('already_used', …)` (pattern 2.5).
      - Branche `kind='response'` : valider longueur `response_text` (1..500 via CHECK DB) ; valider `target_kind in ('listing','rating')` ; si `target_kind='rating'`, valider `target_id` ∈ `ratings.id where artisan_id=a.id` (sinon → set `target_id=null`, dégradé silencieux — un rating supprimé entre temps ne doit pas planter la publication). INSERT `artisan_responses`. INSERT `moderation_log (residence_id=a.residence_id, actor_id=null, action='artisan_response_published', target_kind='artisan', target_id=a.id)`. Return `('published', a.id, a.slug)`.
      - Branche `kind='rectification'` : valider enum `field_target`, longueurs. INSERT `artisan_rectification_requests` (`state='pending'`). INSERT `moderation_log (action='artisan_rectification_requested', target_kind='artisan', target_id=a.id)`. Return `('rectification_pending', a.id, a.slug)`.
      - Sinon (`p_kind` invalide) → `('invalid_decision', null, null)`.
    - `revoke execute from public, anon, authenticated; grant execute to service_role`.
  - [x] **Étape G — moderation_log policy** : étendre la policy `moderation_log_consent_residence_select` (2.5/P5) aux 2 nouvelles actions consent — actions privées par résidence, pas publiques (anti side-channel AR38) :
        `sql
    drop policy if exists moderation_log_public_select on public.moderation_log;
    drop policy if exists moderation_log_consent_residence_select on public.moderation_log;
    create policy moderation_log_public_select on public.moderation_log
      for select using (
        action not in (
          'artisan_published', 'artisan_consent_refused',
          'artisan_response_published', 'artisan_rectification_requested'
        )
      );
    create policy moderation_log_consent_residence_select on public.moderation_log
      for select to authenticated using (
        action in (
          'artisan_published', 'artisan_consent_refused',
          'artisan_response_published', 'artisan_rectification_requested'
        )
        and exists (
          select 1 from public.users u
          where u.id = auth.uid() and u.residence_id = moderation_log.residence_id
            and u.deleted_at is null
        )
      );
    `
  - [x] `pnpm supabase db reset` + `pnpm gen:types` (2 nouvelles tables + 4 nouveaux enums + 2 RPCs + 2 valeurs `moderation_action`). Voir [[project_rls_tests_local_setup]].

- [x] **Task 2 — Lookup token réponse (lecture)** (AC: 3, 6, 7)
  - [x] `lib/consent/lookup-response.ts` (server) : `resolveResponseToken(raw, locale): Promise<ResponseLookup>` calqué sur `lib/consent/lookup.ts` (2.5).
    - Bornes `RAW_MIN=16`, `RAW_MAX=200` (anti-DoS HMAC, pattern 2.5 P16).
    - Hash via `hashConsentToken(raw, env.server.CONSENT_TOKEN_SECRET)` (réutilise 2.4).
    - Lookup admin filtré sur **`purpose='respond'`** + jointure `artisans` (filtre `state='published'` AND `deleted_at IS NULL` — un artisan retiré entre temps coupe le flow, AR38).
    - Type discriminé : `{status:'invalid'}` | `{status:'expired'}` | `{status:'used'}` | `{status:'valid', artisanId, displayName, phoneMasked, tags, recentRatings}` où `phoneMasked = '+212 6XX XX XX 01'` (4 derniers chiffres visibles, le reste `X`) et `recentRatings = [{id, scoreSummary, createdAt}]` (5 derniers, pour le sélecteur de cible si l'artisan veut répondre à un rating spécifique).
    - Comparaison `consentHashEquals` côté code (timing-safe, défense en profondeur).
  - [x] Tests unitaires colocalisés (mock chaining admin client) : 4 statuts + filtre purpose='consent' rejette + masquage phone (regex précise + edge cases : phones < 10 chiffres impossibles vu zPhoneMaroc).

- [x] **Task 3 — Server Action `requestArtisanContactLink`** (AC: 1, 2, 9)
  - [x] `app/artisan/contact/actions.ts` (`'use server'`, **hors `[locale]`**). Signature `(_prev: ContactLinkState, formData: FormData) => Promise<ContactLinkState>` (pattern 2.6 `useActionState`, mais **publique sans auth**).
  - [x] Logique :
    - Pas de `requireResident` (action publique, artisan sans session).
    - Parse `phone` (form), normalise whitespace (`replace(/[\s.\-()]/g, '')` — pattern 2.4 P11), Zod `zPhoneMaroc`. Erreur Zod → `{ok:true, status:'generic_sent_message'}` (AR38 : on ne révèle pas un format invalide à un attaquant — silently consume).
    - **Rate-limit IP** : `checkLimit('artisan-contact-ip:${ip}', 10, 3600)` (10/h).
    - **Rate-limit phone normalisé** : `checkLimit('artisan-contact-phone:${phone}', 3, 3600)` (3/h, anti-flooding SMS).
    - Si rate-limit dépassé → **MÊME** réponse générique `'generic_sent_message'` (AR38 : ne pas distinguer flooding d'un phone inexistant — log côté serveur pour observabilité).
    - Générer token : `const { raw, hash } = generateConsentToken(env.server.CONSENT_TOKEN_SECRET)`.
    - `expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()` (24h, alignement 2.5/P28).
    - Appel RPC : `supabase.rpc('request_artisan_contact_link', { p_phone_e164: phone, p_token_hash: hash, p_expires_at: expiresAt })` via `createAdminClient`.
    - **Si RPC retourne `'sent'`** : envoi SMS via `lib/sms/send` template `artisan-respond` (nouveau, Task 5), `to = sms_target_phone`, `vars = { artisanName: sms_artisan_name, link: \`${siteOrigin}/respond/${raw}\` }`. Si SMS échoue → log error, ne PAS révéler côté UI (AR38).
    - **Si RPC retourne `'not_found'`** : `await sleep(150)` (timing-equalize approximatif — le coût RPC + SMS est ~100-300ms, la branche not_found doit s'aligner). Voir §Sécurité §Timing.
    - **Dans tous les cas** : return `{ok:true, status:'generic_sent_message'}`. Token raw jamais loggué.
    - Log boundary : `event:'artisan.contact_link_requested'`, `payload:{ rate_limit_hit: bool, status: 'sent'|'not_found' }` — pas de phone dans le log payload (uniquement hash si besoin debug).

- [x] **Task 4 — Server Action / Page `/artisan/contact`** (AC: 1, 9)
  - [x] `app/artisan/contact/page.tsx` (RSC, `force-dynamic`, **HORS `[locale]`** — calque exact `/consent/[token]`). Toggle FR/AR via `?lang=` (zEnum + catch `'fr'`, pattern 2.5/P15). `generateMetadata` → `robots: { index: false }` (la page ne doit pas être indexée).
  - [x] `_components/contact-form.tsx` (`'use client'`, `useActionState(requestArtisanContactLink, ...)`). Champ `phone` (input `type='tel'` + helper « +212 6XX XX XX XX »), bouton submit. Sur succès : message inline générique « Si ce numéro est associé à une fiche publiée, vous recevrez un SMS dans quelques minutes » + bouton « Renvoyer » désactivé 60s (anti-spam UX). Erreur Zod côté client : **silencieuse** (juste re-render, pas de message d'erreur explicite — AR38 par défaut). i18n namespace `artisanContact.*`.
  - [x] `app/artisan/contact/loading.tsx` skeleton (squelette form, dir=ltr par défaut — flash AR cosmétique, defer).
  - [x] Mettre à jour `lib/email/templates/artisan-consent-accepted.{fr,ar}.ts` (UPDATE 2.5) pour **inclure un lien vers `/artisan/contact`** dans l'e-mail contributeur post-consent (« Si vous avez besoin de contacter Darna en tant qu'artisan, [cliquez ici](URL/artisan/contact). »). C'est le canal de découverte primaire du droit de réponse — sans QR code MVP (différé Epic 6).

- [x] **Task 5 — SMS template + boundary extension** (AC: 2)
  - [x] `lib/sms/templates/respond.fr.ts` : calque exact `consent.fr.ts` (sanitize `artisanName` NFC + strip control/bidi, truncate 40 chars). Message : `Darna : ${safe}, votre droit de réponse. Publiez votre réponse ou demandez rectification (sans compte) : ${link}` (≤ 160 chars GSM-7 multi-segment OK). Tests colocalisés (calque `consent.fr.test.ts`).
  - [x] Étendre l'union `SmsArgs` de `lib/sms/send.ts` :
        `ts
    export type SmsArgs =
      | { template: 'artisan-consent'; to: string; vars: ConsentSmsVars }
      | { template: 'artisan-respond'; to: string; vars: RespondSmsVars };
    ` + switch dans `sendTransactionalSms` (pattern `lib/email/send.ts`). Logique d'adapter (`log` MVP / `brevo` provisionné) inchangée.

- [x] **Task 6 — Page `/respond/[token]` + form sections** (AC: 3, 4, 5, 6, 7, 10)
  - [x] `app/respond/[token]/page.tsx` (RSC, **HORS `[locale]`**). Toggle FR/AR. Rate-limit GET (`checkLimit('respond-get:${ip}', 30, 600)`, fail-open — pattern 2.5/P18). `force-dynamic`. `generateMetadata` → `robots:noindex`.
  - [x] Appelle `resolveResponseToken(token, locale)`. Branches :
    - `valid` → header fiche read-only (`displayName`, `phoneMasked`, tags) + composant client `<RespondForm artisanId={…} token={raw} recentRatings={…}>` avec 2 sections séparées par tabs ou sections distinctes.
    - `expired`/`invalid`/`used` → `<Notice>` générique (calque 2.5).
  - [x] `_components/respond-form.tsx` (`'use client'`) : 2 sections (radio toggle « Publier une réponse » / « Demander rectification »).
    - **Section réponse** : `<select name="target_kind">` (`listing` par défaut OU `rating` avec dropdown des 5 derniers ratings, signature : `Note du dd/mm — \"comment_text.slice(0,40)…\"`), `<textarea name="response_text" maxLength=500>` (compteur live), bouton submit `name="kind" value="response"`.
    - **Section rectification** : `<select name="field_target">` (6 valeurs i18n), `<input name="requested_value" maxLength=200>`, `<textarea name="justification_text" maxLength=500>`, bouton submit `name="kind" value="rectification"`.
    - Form POSTe natif vers `/api/webhook/artisan-respond` (pas `useActionState` — pattern 2.5 form GET-natif PRG, évite jsdom `useActionState` cluster review 2.4/2.6).
    - Hidden input `token` (raw, depuis le RSC).
  - [x] `app/respond/[token]/loading.tsx` skeleton (calque consent).

- [x] **Task 7 — Route Handler webhook `/api/webhook/artisan-respond`** (AC: 4, 5, 7, 9)
  - [x] `app/api/webhook/artisan-respond/route.ts` (POST, **hors `[locale]`**). Calque **exact** structure `app/api/webhook/sms-consent/route.ts` :
    - CSRF (P6) : `origin === siteOrigin()` + `sec-fetch-site === 'same-origin'|null|none`.
    - Content-Length max 4KB (P16) — corps reste petit (~600 chars max).
    - Rate-limit IP `consent:${ip}` 20/600 (réutilise la clé, anti-spam global).
    - `try { request.formData() } catch { 400 }` (P19).
    - Lecture form : `token`, `kind`, `response_text` OU (`field_target`, `requested_value`, `justification_text`).
    - Validation Zod côté webhook : `kind ∈ ('response','rectification')`, longueurs respectées, `target_kind ∈ ('listing','rating')` si `kind='response'`. **Sanitize** : `response_text`, `requested_value`, `justification_text` → NFC normalize + strip control+bidi (extraire `STRIP_CONTROL_AND_BIDI` en `lib/validation/sanitize.ts` cf. 2.7, cluster Task 11).
    - Hash : `tokenHash = hashConsentToken(raw, env.server.CONSENT_TOKEN_SECRET)`.
    - Rate-limit token (P17) : `consent-token:${tokenHash.slice(0,16)}` 5/600.
    - Construction `p_payload jsonb` selon `kind`. Appel RPC `process_artisan_response` via `createAdminClient`.
    - Mapping statut → redirect :
      - `not_found` → **401** (AR38, ne révèle rien).
      - `expired` → `/respond/done?status=expired` (303).
      - `already_used` → `/respond/done?status=used` (idempotent).
      - `published` → `/respond/done?status=published`.
      - `rectification_pending` → `/respond/done?status=rectification_pending`.
      - `invalid_decision` → 400.
    - Log boundary : `event:'artisan.response_submitted'`, `payload:{ kind, status }` — pas de `response_text` ni `phone` dans le payload.
  - [x] **Pas de notif e-mail au contributeur au MVP** (différé Epic 7 — la fiche publique affiche la réponse, c'est le canal de surface).

- [x] **Task 8 — Page `/respond/done`** (AC: 4, 5, 6, 7, 9)
  - [x] `app/respond/done/page.tsx` (calque **exact** `app/consent/done/page.tsx` — pattern 2.5 D1 mitigation). PRG sans token dans l'URL.
  - [x] zEnum status : `'published'|'rectification_pending'|'expired'|'used'|'invalid'`, catch `'used'`. Toggle FR/AR. Titre + body i18n namespace `artisanRespond.done*` (cf. Task 10).

- [x] **Task 9 — Affichage `artisan_responses` sur la fiche publique** (AC: 8)
  - [x] UPDATE `app/[locale]/community/artisan/[slug]/data.ts` : étendre `fetchArtisanBySlug` (ou ajouter `fetchArtisanResponses(artisanId)`) — lecture publique scopée par RLS `artisan_responses_resident_select`. Mapping `{id, targetKind, targetId, responseText, createdAt}`.
  - [x] UPDATE `app/[locale]/community/artisan/[slug]/page.tsx` : injecter `<ArtisanResponses responses={…} locale={…} />` après `<CommentsList>` (section dédiée). Pas dans le header — FR22 droit de réponse a un poids éditorial distinct de l'agrégat.
  - [x] NEW `_components/artisan-responses.tsx` (server component) : itère les réponses. Chaque entrée :
        `tsx
    <blockquote className="border-l-4 border-accent-500 bg-accent-50 px-4 py-3">
      <p className="text-xs font-medium text-accent-700">
        {t('signature', { name: artisan.displayName })} · {formatDate(r.createdAt, locale)}
      </p>
      {r.targetKind === 'rating' && <span className="text-xs text-neutral-500">{t('inReplyToRating')}</span>}
      <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-800">{r.responseText}</p>
    </blockquote>
    `
        Le `displayName` est **toujours** affiché (FR22 : réponse identifiée), jamais pseudonyme — même si le contributeur du rating cible est en pseudo.
  - [x] Pas de pagination MVP (Epic 6+) — afficher les 10 réponses les plus récentes, calque `comments-list.tsx` (defer documenté 2.3).

- [x] **Task 10 — i18n + a11y** (AC: 1, 3, 4, 5, 6, 7, 8)
  - [x] **`messages/fr.json`** : 3 nouveaux namespaces (FR vrai, pas stub — l'artisan peut être arabophone, exception au MVP FR-only, cf. 2.5) :
    - `artisanContact.*` : `pageTitle`, `intro` (contexte droit de réponse), `phoneLabel`, `phoneHelper`, `submit`, `successGeneric`, `langToggle`.
    - `artisanRespond.*` : `pageTitle`, `ficheTitle`, `phoneMasked`, `competences`, `recentRatings`, `tabResponse`, `tabRectification`, `responseTextLabel`, `responseTextPlaceholder`, `targetKindListing`, `targetKindRating`, `submitResponse`, `fieldTargetLabel`, `requestedValueLabel`, `justificationLabel`, `submitRectification`, `signature`, `inReplyToRating`, `responsesSectionTitle`, `expiredTitle`, `expiredBody`, `invalidTitle`, `invalidBody`, `usedTitle`, `usedBody`, `doneTitle`, `donePublishedTitle`, `donePublishedBody`, `doneRectificationPendingTitle`, `doneRectificationPendingBody`, `langToggle`.
    - `errors.artisanResponse.*` : `submit_failed`, `validation`, `expired`, `used`, `invalid` (utilisés côté webhook si besoin — pour l'instant le webhook fait des redirects).
    - **Champ field_target i18n** : sous-clé `artisanRespond.fields.{display_name_fr|display_name_ar|phone_e164|competences|price_relative|has_invoice}` pour le label du `<select>`.
  - [x] **`messages/ar.json`** : miroirs RÉELS (pas stubs — pattern 2.5). Traduction effective FR→AR.
  - [x] A11y : labels associés, `aria-describedby` pour le compteur de chars, `role='alert' aria-live='polite'` sur le message générique post-submit, focus management. Cibles ≥48px (touch tokens Darna). `inputMode='tel'` sur le champ phone.

- [x] **Task 11 — Sécurité défense en profondeur (extensions infra)** (AC: 9)
  - [x] UPDATE `proxy.ts` `config.matcher` : ajouter `respond/` et `artisan/contact` à la liste négative (à côté de `consent/`) — exclusion middleware locale :
        `ts
    source: '/((?!_next/static|...|consent/|respond/|artisan/contact|...).*)'
    `
  - [x] UPDATE `next.config.ts` `headers()` : étendre `Cache-Control: private, no-store` :
        `ts
    { source: '/respond/:path*', headers: [{ key: 'Cache-Control', value: 'private, no-store' }] },
    { source: '/artisan/contact', headers: [{ key: 'Cache-Control', value: 'private, no-store' }] },
    `
  - [x] UPDATE `sw/index.ts` `runtimeCaching` : étendre le matcher NetworkOnly :
        `ts
    const responseBypass: RuntimeCaching = {
      matcher: ({ url, sameOrigin }) =>
        sameOrigin && (
          url.pathname.startsWith('/consent/') ||
          url.pathname.startsWith('/respond/') ||
          url.pathname === '/artisan/contact'
        ),
      handler: new NetworkOnly(),
    };
    `
        (fusionner le matcher consent existant, ou ajouter une seconde entrée — un seul matcher fusionné est plus lisible).
  - [x] UPDATE `lib/sentry/scrub.ts` : étendre la regex `CONSENT_PATH` → `CONSENT_OR_RESPOND_PATH` :
        `ts
    const CONSENT_OR_RESPOND_PATH = /\/(consent|respond)\/[^/?#]+/g;
    `
        Le scrubber remplace par `/$1/[REDACTED]` (préserve la classe pour debug agrégé).
  - [x] UPDATE `app/api/cron/purge-expired/route.ts` (cluster 2.5/P24) : la requête `DELETE FROM artisan_consent_tokens WHERE expires_at < now() - interval '90 days' AND used_at IS NULL` couvre déjà les 2 purposes (pas de discrimination par `purpose` requis — un token expiré est expiré quel que soit le purpose).
  - [x] UPDATE `lib/validation/sanitize.ts` (cluster 2.7 NEW) : extraire `STRIP_CONTROL_AND_BIDI` de `lib/sms/templates/consent.fr.ts` + `lib/validation/artisan.ts` (cluster review 2.4/P3 + 2.5/P23) en helper réutilisable `sanitizeUserText(raw, { maxLen, fallback })`. Réutilisé par le webhook respond.

- [x] **Task 12 — Tests étendus** (AC: 11)
  - [x] `tests/rls.test.ts` (gated `SUPABASE_LOCAL_TEST`) — nouveau block « RLS artisan_responses & rectification_requests (Story 2.8 AC11) » :
    - `artisan_responses` SELECT par alice (résidence Darna, fiche `publishedArtisanId`) → voit la réponse seedée.
    - `artisan_responses` SELECT par charlie (résidence 2) → 0 rows (cross-tenant).
    - `artisan_responses` INSERT direct par alice (client session) → `42501` (RLS deny).
    - `artisan_rectification_requests` SELECT par alice (résident) → 0 rows ; par eve (co_mod) → seedée visible.
    - RPC `process_artisan_response` non grantée à `authenticated` : `supabase.rpc` côté alice → `42501`.
    - RPC `request_artisan_contact_link` idem.
    - Cross-purpose : insert token `purpose='consent'` → POST webhook `/artisan-respond` avec ce hash → RPC retourne `not_found` (purpose filter rejet).
    - `moderation_log` lecture cross-residence pour action `artisan_response_published` → 0 rows (policy restriction par résidence — pattern 2.5/P5).
  - [x] `tests/consent-respond-rpc.test.ts` (gated, calque `tests/consent-rpc.test.ts`) : 7 cas RPC `process_artisan_response` : response listing OK, response rating OK, rectification OK, not_found, expired, already_used (gate atomique), invalid_kind.
  - [x] `tests/consent/lookup-response.test.ts` (unitaire mocké) : 4 statuts (valid/expired/used/invalid) + filtre purpose='consent' ignoré + masquage phone.
  - [x] `tests/artisan/contact-action.test.ts` (action node) : (a) phone valide AR38 generic ; (b) phone inexistant generic identique ; (c) rate-limit IP atteint → generic ; (d) rate-limit phone atteint → generic ; (e) Zod fail → generic (pas d'erreur révélatrice).
  - [x] **AUCUN test composant React** post-submit (cluster 1.10c E2E, leçon 2.4/2.6/2.7 : `useActionState` jsdom incompatible).
  - [x] `pnpm typecheck`/`lint`/`test` verts. Smoke : sur stack locale, `pnpm dev:webpack`, ouvrir `/artisan/contact`, soumettre un phone d'un artisan published seedé → vérifier `artisan_consent_tokens` ligne `purpose='respond'` + SMS loggué (`SMS_PROVIDER=log`) → ouvrir `/respond/[raw]` → publier une réponse → vérifier `artisan_responses` + `moderation_log` + affichage sur `/community/artisan/[slug]`.

## Dev Notes

> **Stack & conventions** : identiques 2.2-2.7 (Next 16.2.6 RSC + Server Actions, `@supabase/ssr` + admin pour les écritures sensibles, RLS column-grant + SECURITY DEFINER pour bypass, next-intl 4.12, Zod 4, Vitest 4, Tailwind 3.4 tokens Darna). Voir 2.5 §RPC + AR38, 2.4 §SMS boundary, 2.7 §RPC ownership.

### §Décisions (4 points structurants, tranchés)

1. **Nouvelle table `artisan_responses` (pas un overload de `ratings`).**
   FR22 distingue clairement « droit de réponse » (action légale de l'artisan, identifié, sans note) de « commentaire/note » (action communautaire d'un résident, pseudo ou nommé). Overloader `ratings` avec une colonne `visibility='artisan_response'` saturerait le CHECK `num_nonnulls(score_*) >= 1` (le droit de réponse n'a pas de note) et confondrait les deux journeys au niveau requêtage (agrégats, FTS). **Reco — table dédiée `artisan_responses`** : (a) target_kind discriminé `'listing'|'rating'` (réponse globale à la fiche OU contextualisée à un rating spécifique), (b) `response_text` 1..500 avec CHECK DB, (c) `response_tsv` pré-positionné pour Epic 6 (FTS sur réponses), (d) soft-delete homogène (deleted_at/by/reason) — le retrait sera **co-mod uniquement** (Epic 5), pas l'artisan (pas d'auto-retract MVP — l'artisan a publié, l'acte est posé ; il peut redemander un magic-link pour publier un complément, jamais éditer/retirer sa propre réponse). RLS publique scopée par fiche `published` + résidence comme `ratings`. Pas de policy INSERT — écriture RPC uniquement. Coût migration : +1 table, +2 enums.

2. **Extension `artisan_consent_tokens.purpose enum`.**
   Réutiliser la table de tokens 2.4/2.5 plutôt que créer `artisan_response_tokens` : (a) HMAC pattern identique, (b) lifecycle expires_at/used_at identique, (c) cron purge couvre déjà les deux, (d) RLS deny-all client couvre déjà les deux. Discrimination via `purpose enum ('consent','respond')` — la RPC `process_artisan_response` filtre `purpose='respond'`, `process_artisan_consent` filtre `purpose='consent'` (extension à acter dans `20260622120000_artisan_consent_rpc.sql` durci par 20260623090000 — pour ne pas casser le contrat 2.5, on ajoute le filtre `purpose='consent'` dans la RPC existante via nouvelle migration). **Cross-purpose attack mitigation** : un token `purpose='consent'` POSTé sur `/respond` → RPC retourne `not_found` (filtre purpose dans le WHERE de la jointure), pas d'erreur révélatrice. UNIQUE `(token_hash)` (2.5/P4) reste — un même hash ne peut exister qu'une fois quel que soit le purpose, le purpose est porté par la ligne.

3. **AR38 indistinguabilité stricte sur `/artisan/contact` + timing equalize.**
   La page est publique sans CAPTCHA fort (MVP — Stephane validera la sensibilité au scan automatisé pré-bêta). L'attaquant peut tenter `enumerate_phones` en bouclant sur des numéros marocains. Mitigations en couches :
   - **Rate-limit double** : IP 10/h + phone normalisé 3/h. Le rate-limit par phone protège contre une rotation d'IPs (CGNAT, botnet).
   - **Indistinguabilité réponse UI** : même `successGeneric` qu'un phone trouvé ou pas. **Pas d'erreur Zod côté serveur** (silent consume) — un phone mal formé ne révèle pas qu'on ne peut pas chercher.
   - **Timing equalize** : un phone trouvé déclenche RPC + INSERT token + envoi SMS (~150-400ms typique Brevo) ; un phone inexistant retourne `not_found` instantanément (~10ms). Différence observable → side-channel. **Solution MVP** : `await sleep(150)` dans la branche `not_found`. C'est approximatif (SMS Brevo varie 100-500ms), pas constant-time strict. **Solution V1.5** (defer §) : décorréler timing avec un job async (`waitUntil` Vercel Edge) qui envoie le SMS dans un background task — la réponse HTTP est constante (~50ms) quelle que soit la branche. Au MVP, `sleep(150)` réduit le signal sans l'éliminer ; acceptable contre l'attaquant manuel, pas contre un attaquant statistique en volume (rate-limit phone limite déjà la portée).
   - **Pas de leak via Sentry** : scrubber étendu (Task 11) — l'URL `/artisan/contact` n'a pas de raw token mais Sentry peut capturer le `phone` en POST body. Sentry default config strippe les bodies de requête (vérifié review 2.4 dismissed).
   - **Headers `referrer-policy: strict-origin-when-cross-origin`** déjà global (1.10a) — l'URL externe vers `/artisan/contact` ne fuit pas le path complet.

4. **Rectification queue = persistance MVP + UI co-mod différée Epic 5.**
   Epic 5 livre la queue UI co-mod générique (signalements, modération réactive, droit de retrait). Sans Epic 5 livré, on a deux options :
   - **(a) Bloquer la rectification** : l'AC5 dit « request enters the co-mod moderation queue (Epic 5) for review ». Si Epic 5 n'existe pas, AC5 est inapplicable strict.
   - **(b) Persister la rectification + log moderation, traitement async Epic 5** : crée la table `artisan_rectification_requests` maintenant, accepte les soumissions, INSERT row `state='pending'`, INSERT `moderation_log` action `artisan_rectification_requested` (CC #20 transparence FR33). La queue UI sera **lue** par Epic 5 (`select … where state='pending' order by created_at`). L'UX artisan répond « Demande reçue, un modérateur la traitera bientôt ».
     **Reco — option (b)** : conforme FR22 (« request enters queue ») même sans UI co-mod livrée ; FR33 transparence radicale satisfaite via `moderation_log` ; pas de régression Epic 5 (la table est prête à être consommée). Le traitement = Epic 5 (action co-mod : accepter → mutate `artisans` du champ ciblé + log `'rectification_accepted'` ; rejeter → log `'rectification_rejected'`). **Au MVP, les rectifications s'accumulent dans `pending` et c'est documenté dans `deferred-work.md` 2.8 + sprint planning Epic 5.** Risque : si l'artisan attend une réponse longue, frustration. Mitigation : l'e-mail contributeur (2.5) inclut déjà un lien `/artisan/contact` ; la persistance + log montre que la demande est tracée. **Si Epic 5 livre AVANT que 2.8 ferme** : 2.8 expose directement la queue UI co-mod (refactor inline, pas de migration de données — les rows pendantes restent valides).

### §Réutilisation directe (NE PAS réinventer)

- **`lib/consent/token.ts`** (2.4) : `generateConsentToken(secret)`, `hashConsentToken`, `consentHashEquals` (timing-safe). Réutilisés tels quels.
- **`lib/consent/lookup.ts`** (2.5) : **pattern**, pas le code. `lookup-response.ts` est un fork avec filtre `purpose='respond'` + masquage phone.
- **`lib/sms/send.ts` + `lib/sms/client.ts`** (2.4) : boundary unique. On ajoute juste le template `respond.fr.ts` et étend l'union.
- **`lib/sentry/scrub.ts`** (2.5) : étendre la regex, pas dupliquer.
- **`lib/rate-limit.ts`** : `checkLimit` pattern double-clé (IP + spécifique).
- **`app/consent/[token]/page.tsx`** + **`app/consent/done/page.tsx`** (2.5) : **calque** structurel exact pour `/respond/[token]` + `/respond/done` (toggle FR/AR, dir, rate-limit GET, statuts discriminés, PRG sans token).
- **`app/api/webhook/sms-consent/route.ts`** (2.5) : **calque** structurel exact pour `/api/webhook/artisan-respond` (CSRF Origin, Content-Length, rate-limit double, try/catch formData, mapping RPC → redirect).
- **`createAdminClient`** : seul chemin d'écriture (RPCs revoke authenticated).
- **`process_artisan_consent`** RPC (durci 20260623090000) : **modèle** pour `process_artisan_response` (gate atomique used_at, guards state/deleted_at, revoke anon/authenticated, structure retour `(status, artisan_id, slug)`).
- **moderation_log policy split** (2.5/P5) : étendue aux 2 nouvelles actions consent dans la même migration que les enums.
- **`lib/validation/artisan.ts` + sanitize NFC+bidi** (2.4/P3 + 2.5/P23 + cluster 2.7) : extraire en `lib/validation/sanitize.ts` réutilisable.

### §Sécurité (FR22, AR38, NFR18, défense en profondeur)

**Surface d'attaque** :

1. `/artisan/contact` POST → enumeration de phones marocains. **Mitigations** : rate-limit IP+phone, indistinguabilité UI, timing equalize (sleep 150ms), pas de CAPTCHA MVP (defer V1.5 si abus mesuré).
2. `/respond/[token]` GET → token harvesting via leak (URL bar, Sentry, SW cache, Vercel logs, browser history). **Mitigations** : SW NetworkOnly, Cache-Control no-store, Sentry scrubber, PRG redirect sans token, TTL 24h (réduit fenêtre), `referrer-policy: strict-origin-when-cross-origin` (le clic d'un lien externe ne fuit pas le path).
3. `/api/webhook/artisan-respond` POST → cross-purpose attack (token consent réutilisé sur respond), CSRF, body abuse, replay. **Mitigations** : RPC filtre `purpose='respond'`, CSRF Origin/Sec-Fetch-Site, Content-Length 4KB, rate-limit IP+token_hash, gate atomique used_at, idempotence.
4. `artisan_responses` lu par tous les résidents de la résidence → AR38 confidentialité côté autres résidences. **Mitigation** : RLS scopée `artisans.residence_id = auth.users.residence_id`.
5. `artisan_rectification_requests` contient des PII proposées (nouveau nom, nouveau phone). **Mitigation** : RLS co_mod résidence uniquement (pas de transparence publique avant traitement — protège l'intention).
6. `moderation_log` action `artisan_response_published` révèle quand un artisan a répondu. **Mitigation** : policy split (Task 1 §G) — actions consent+response+rectification restreintes à la résidence (réutilise et étend 2.5/P5).

**PII en logs** : pas de `phone`, `response_text`, `justification_text` dans les payloads `log()`. Seulement des statuts agrégés (`event:'artisan.contact_link_requested'`, `payload:{rate_limit_hit, status}`).

**Token raw** : généré côté Server Action `requestArtisanContactLink`, transmis à la RPC uniquement comme `token_hash`, envoyé à l'artisan via SMS dans l'URL `/respond/[raw]`. Le raw n'apparaît jamais en DB (seul `token_hash`). Sentry scrubber masque l'URL. SW NetworkOnly empêche la cache. PRG redirect sans token sur le done.

**Timing equalize approximation** : `sleep(150)` MVP. V1.5 = `waitUntil` background SMS, constant-time réponse.

### §Cas limite à expliciter

- **Artisan retire sa fiche après avoir reçu le SMS magic-link respond** : la RPC `process_artisan_response` filtre `state='published' AND deleted_at IS NULL` → `not_found` (AR38). L'artisan voit l'écran générique « lien invalide ».
- **Rating ciblé `target_id` soft-deleted entre l'ouverture page et le submit** : la RPC dégrade silencieusement à `target_id=null` (la réponse reste publiée comme « réponse à la fiche »). FR22 conservé.
- **Re-POST idempotent (double-click)** : la gate atomique `update tokens set used_at=now() where used_at is null returning id` garantit qu'un seul appel insère la réponse. Le second voit `used` → redirect `/respond/done?status=used`, pas d'erreur.
- **Phone disposable / VOIP** : pas de filtre MVP — l'artisan a un numéro saisi par le contributeur lors de la création (2.4), Darna ne vérifie pas la portabilité. Risque acceptable.
- **Artisan multi-résidence (théorique V3)** : `order by published_at desc limit 1` → la **plus récente** fiche est ciblée. Documenté en AC verbatim (D4).
- **Contributeur soft-deleted RGPD pendant qu'une réponse artisan existe** : `artisans.created_by` → SET NULL (FK existante). La réponse reste affichée (FR22 droit conservé). `artisan_responses.deleted_by` non concerné (la réponse n'a pas été supprimée, juste son contexte d'origine effacé).
- **Race condition : artisan publie une réponse pendant qu'un co-mod retire la fiche** : la RPC `process_artisan_response` détecte `deleted_at != null` → `not_found` (AR38 mais bénin — l'artisan voit « lien invalide », pas d'erreur). Alternative : laisser passer la réponse et soft-delete cascade en Epic 5 — moins propre, plus de fuite. Reco actuelle reste.

### §Scope boundaries

- **DANS** : page publique `/artisan/contact` (request magic-link), page publique `/respond/[token]` (réponse + rectification), webhook `/api/webhook/artisan-respond`, 2 RPCs SECURITY DEFINER, table `artisan_responses` + RLS public scopée, table `artisan_rectification_requests` (queue passive) + RLS co_mod, enum `consent_token_purpose`, `moderation_log` policy étendue, SMS template `respond.fr`, scrubber Sentry étendu, SW NetworkOnly étendu, Cache-Control no-store étendu, proxy matcher étendu, affichage `artisan_responses` sur la fiche, i18n FR + AR (réel), tests RLS + RPC + lookup + action.
- **HORS** :
  - **UI co-mod queue rectification** (Epic 5.x — traitement accept/reject + mutate `artisans`).
  - **Notification in-app au contributeur** quand l'artisan répond (Epic 7.x).
  - **Notification e-mail au contributeur** quand l'artisan répond (peut être ajouté V1.5 si demande forte ; au MVP la fiche publique affiche la réponse — canal suffisant).
  - **QR code sur fiche pointant `/artisan/contact`** (Epic 6 partage).
  - **Édition/retrait par l'artisan de sa propre réponse** (pas de session artisan — pour éditer, il redemande un magic-link et republie un complément ; pour retirer, il fait une rectification ciblée sur la réponse en demandant son retrait, traité co-mod Epic 5).
  - **CAPTCHA fort sur `/artisan/contact`** (V1.5 si abus mesuré).
  - **Timing equalize constant-time** (V1.5 via `waitUntil` background).
  - **Multi-résidence (V3)** : MVP supporte une seule fiche per phone (`limit 1`).

### Project Structure Notes

- **NEW** :
  - `supabase/migrations/<ts>_artisan_response_enums.sql` (enum extensions `moderation_action` — commitée AVANT la suivante, leçon 2.5).
  - `supabase/migrations/<ts+1>_artisan_response.sql` (purpose enum + colonne tokens + tables `artisan_responses`/`artisan_rectification_requests` + indexes + RLS + 2 RPCs + moderation_log policy split).
  - `lib/consent/lookup-response.ts` (+ `.test.ts`).
  - `app/artisan/contact/{page,loading,actions}.tsx` + `_components/contact-form.tsx`.
  - `app/respond/[token]/{page,loading}.tsx` + `_components/respond-form.tsx`.
  - `app/respond/done/page.tsx`.
  - `app/api/webhook/artisan-respond/route.ts`.
  - `lib/sms/templates/respond.fr.ts` (+ `.test.ts`).
  - `lib/validation/sanitize.ts` (extraction `STRIP_CONTROL_AND_BIDI` + helper `sanitizeUserText` — cluster 2.7).
  - `app/[locale]/community/artisan/[slug]/_components/artisan-responses.tsx`.
  - `tests/consent-respond-rpc.test.ts` (gated, calque 2.5).
  - `tests/artisan/contact-action.test.ts`.
- **UPDATE** :
  - `proxy.ts` (matcher exclusions `respond/` + `artisan/contact`).
  - `next.config.ts` (Cache-Control no-store `/respond/*` + `/artisan/contact`).
  - `sw/index.ts` (NetworkOnly matcher étendu).
  - `lib/sentry/scrub.ts` (regex `CONSENT_OR_RESPOND_PATH`).
  - `lib/sms/send.ts` (union `SmsArgs` + switch template).
  - `lib/email/templates/artisan-consent-accepted.{fr,ar}.ts` (lien `/artisan/contact` ajouté pour découverte droit de réponse — UPDATE 2.5).
  - `app/[locale]/community/artisan/[slug]/data.ts` (+ `fetchArtisanResponses`).
  - `app/[locale]/community/artisan/[slug]/page.tsx` (injection `<ArtisanResponses>`).
  - `messages/fr.json` (3 nouveaux namespaces : `artisanContact`, `artisanRespond`, `errors.artisanResponse`).
  - `messages/ar.json` (miroirs RÉELS, pas stubs — pattern 2.5 AR effectif).
  - `lib/supabase/types.generated.ts` (regen post-migration : 2 tables + 4 enums + 2 RPCs).
  - `tests/rls.test.ts` (block « RLS artisan_responses & rectification_requests »).
  - `_bmad-output/implementation-artifacts/deferred-work.md` (entrées 2.8 : rectification queue UI Epic 5, timing equalize V1.5, notif e-mail contributeur V1.5).
- **Réutiliser** : `lib/consent/token`, `createAdminClient`, `lib/sms/send`, `lib/rate-limit`, `lib/i18n`, `lib/logger`, `lib/sentry/scrub`.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` §Story-2.8 (l.1092-1120)] — AC verbatim, FR22, CC #20, AR38.
- [Source: `_bmad-output/planning-artifacts/prd.md`] — FR22 (droit de réponse / rectification CNDP), FR33 (transparence radicale), AR38 (indistinguabilité 401), NFR17 (modération traçable), NFR18 (RGPD).
- [Source: `_bmad-output/planning-artifacts/architecture.md` l.85,292,310-315] — magic-link artisan, droit de réponse, webhook HMAC + idempotence, modération queue.
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md`] — parcours artisan post-consent, droit de réponse Journey 4 closing loop.
- [Source: `_bmad-output/implementation-artifacts/2-5-page-magic-link-consentement-artisan-accept-refuse-1-tap-sans-compte.md`] — RPC SECURITY DEFINER pattern, idempotence, AR38 401, page `/consent/done` sans token (D1), scrubber Sentry, NetworkOnly SW, cache-control no-store, rate-limit IP + token_hash, idempotence, gate atomique used_at (P1), revoke anon/authenticated (P2), UNIQUE token_hash (P4), moderation_log policy split (P5), CSRF Origin/Sec-Fetch-Site (P6), Content-Length 4KB (P16), try/catch formData (P19), purge cron étendue (P24).
- [Source: `_bmad-output/implementation-artifacts/2-4-creation-fiche-artisan-workflow-consentement-sms-asynchrone.md`] — `lib/consent/token.ts` HMAC, `artisan_consent_tokens`, SMS boundary `lib/sms/send.ts` + adapter log MVP, sanitization NFC + strip bidi/control (P3).
- [Source: `_bmad-output/implementation-artifacts/2-7-edition-retrait-de-ses-propres-contributions.md`] — cluster édition créateur (l'artisan ici a un chemin parallèle indépendant), pattern RPC ownership, extraction `lib/validation/sanitize.ts`.
- [Source: `_bmad-output/implementation-artifacts/2-6-notation-typee-multi-axes-commentaire-pseudo-identite.md`] — pattern ratings/comment, `fetchMyRating`, `submitRating`.
- [Source: `_bmad-output/implementation-artifacts/2-3-fiche-artisan-detaillee-action-tel.md`] — affichage fiche, `<CommentsList>` pattern (calque pour `<ArtisanResponses>`).
- [Source: `_bmad-output/implementation-artifacts/1-8-validation-co-mod-file-admission-accept-reject-notification-decision.md`] — queue modération pattern (réutiliser layout pour rectification queue Epic 5).
- [Source: `supabase/migrations/20260619090000_artisans_schema.sql`] — `artisan_consent_tokens` deny-all RLS, `artisans` state/deleted_at, RLS pattern column-grant.
- [Source: `supabase/migrations/20260622120000_artisan_consent_rpc.sql` + `20260623090000_consent_review_hardening.sql`] — RPC SECURITY DEFINER pattern, gate atomique, guards state/deleted_at, revoke + grant service_role, UNIQUE token_hash, moderation_log policy split.
- [Source: `lib/consent/token.ts`, `lib/consent/lookup.ts`, `lib/sms/send.ts`, `lib/sms/templates/consent.fr.ts`, `app/api/webhook/sms-consent/route.ts`, `app/consent/[token]/page.tsx`, `app/consent/done/page.tsx`, `lib/sentry/scrub.ts`, `proxy.ts`, `next.config.ts`, `sw/index.ts`] — code existant à calquer/étendre.
- [Source: `docs/adr/0002-brevo-email-provider.md`] — Brevo (e-mail contributeur + lien `/artisan/contact`).
- [Source: `docs/adr/0004-rls-vs-fk-discipline.md`] — défense en profondeur RLS + column-grant + SECURITY DEFINER pour écritures sensibles.
- [Source: `docs/adr/0006-soft-delete-cascade-anonymization.md`] — soft-delete homogène (artisan_responses), anonymisation FK SET NULL.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Claude Opus 4.8, 1M context) — bmad-dev-story, 2026-06-19

### Debug Log References

- 2 migrations appliquées **pour de vrai** (`supabase db reset`) + `gen:types` (purpose enum + colonne, 2 tables, 4 enums, 2 RPCs, filtre purpose sur process_artisan_consent, policy split).
- **Gated RPC** `tests/consent-respond-rpc.test.ts` → **10/10** contre Postgres réel (response listing/rating, dégradation cible invalide, rectification, cross-purpose→not_found, expired, idempotence already_used, invalid_kind non-consommé, request_artisan_contact_link sent/not_found).
- **Gated RLS** `tests/rls.test.ts` → **40/40** (+5 de 2.8 : responses select résidence-scopé, INSERT direct→42501, rectification résident→0 / co-mod visible, RPCs non grantées authenticated, moderation_log cross-résidence→0).
- **Gated consent-rpc** `tests/consent-rpc.test.ts` → **6/6** (non-régression du filtre purpose='consent' ajouté).
- Bug attrapé : `42702` (ambiguous column) — `artisan_id` non qualifié dans la sous-requête de validation rating entrait en conflit avec le **param OUT** `artisan_id` ; corrigé via alias de table `r`.
- Suite complète non-gated : **334 pass / 56 skip**. typecheck + lint (0 erreur) verts.

### Completion Notes List

**Livré et validé (typecheck + lint + `test` 334 verts ; RLS 40/40 + RPC respond 10/10 + consent 6/6 contre Postgres réel) :**

- **Migrations** (2) : `artisan_response_enums` (2 valeurs `moderation_action`) ; `artisan_response` (purpose enum + colonne tokens, tables `artisan_responses` + `artisan_rectification_requests` + RLS, **2 RPCs SECURITY DEFINER** `request_artisan_contact_link` (AR38 not_found sans raise) + `process_artisan_response` (response/rectification, gate atomique, payload validé avant gate), filtre `purpose='consent'` sur `process_artisan_consent`, moderation_log policy split étendue).
- **Lookup** `lib/consent/lookup-response.ts` (purpose='respond', masquage phone, ratings récents) — 7 tests.
- **Server Action** `app/artisan/contact/actions.ts` (AR38 indistinguabilité stricte : double rate-limit, Zod silencieux, timing equalize sleep 150ms, admin client) — 5 tests.
- **Webhook** `app/api/webhook/artisan-respond/route.ts` (CSRF, Content-Length 4KB, rate-limit IP+token, try/catch formData, sanitize, RPC, PRG sans token, 401 AR38).
- **Pages** `/artisan/contact` (+form+loading), `/respond/[token]` (+form 2 sections POST natif+loading), `/respond/done` — calquées 2.5.
- **SMS** `respond.fr.ts` + union `SmsArgs` étendue — 3 tests. **E-mail** : lien `/artisan/contact` ajouté au template accepted (FR+AR).
- **Affichage** `<ArtisanResponses>` sur la fiche (signature artisan obligatoire FR22, pre-wrap, badge si réponse à une note) + `fetchArtisanResponses`.
- **Infra sécu** : `proxy.ts` (matcher exclut `/respond`,`/artisan/contact`), `next.config.ts` (Cache-Control no-store), `sw/index.ts` (NetworkOnly étendu), `lib/sentry/scrub.ts` (regex consent|respond).
- **sanitize** : `sanitizeUserText` (multiline préservant les sauts de ligne) ajouté à `lib/validation/sanitize.ts`.
- **i18n** `artisanContact` + `artisanRespond` + `errors.artisanResponse` — **FR + AR réels** (l'artisan peut être arabophone).

**Décisions appliquées (§Décisions) :** (1) table `artisan_responses` dédiée, (2) `purpose` enum sur tokens + RPC distincte, (3) AR38 indistinguabilité + timing equalize sleep, (4) rectification = queue passive persistée (traitement Epic 5).

**⚠️ Résidus de validation (gated/externe) — ajoutés à deferred-work.md :**

1. **UI co-mod queue rectification** → Epic 5.x (les rows s'accumulent en `pending`).
2. **Timing equalize constant-time** (`sleep(150)` approximatif MVP) → V1.5 via `waitUntil` background SMS.
3. **Notification e-mail/in-app au contributeur** quand l'artisan répond → V1.5 / Epic 7.
4. **Flux post-submit** (webhook PRG, pages) non e2e-testé (POST natif, pas jsdom) → smoke E2E 1.10c.

### File List

**NEW :**

- `supabase/migrations/20260625090000_artisan_response_enums.sql`
- `supabase/migrations/20260625090100_artisan_response.sql`
- `lib/consent/lookup-response.ts` (+ `tests/consent/lookup-response.test.ts`)
- `app/artisan/contact/{page,loading,actions}.tsx` + `_components/contact-form.tsx`
- `app/respond/[token]/{page,loading}.tsx` + `_components/respond-form.tsx`
- `app/respond/done/page.tsx`
- `app/api/webhook/artisan-respond/route.ts`
- `lib/sms/templates/respond.fr.ts` (+ `.test.ts`)
- `app/[locale]/community/artisan/[slug]/_components/artisan-responses.tsx`
- `tests/consent-respond-rpc.test.ts`, `tests/artisan/contact-action.test.ts`

**MODIFIED :**

- `lib/validation/sanitize.ts` (`sanitizeUserText`)
- `lib/sms/send.ts` (union `SmsArgs` + switch)
- `lib/sentry/scrub.ts`, `proxy.ts`, `next.config.ts`, `sw/index.ts` (extensions sécu `/respond` + `/artisan/contact`)
- `lib/email/templates/artisan-consent-accepted.{fr,ar}.ts` (lien `/artisan/contact`)
- `app/[locale]/community/artisan/[slug]/data.ts` (`fetchArtisanResponses`), `page.tsx` (`<ArtisanResponses>`)
- `messages/fr.json`, `messages/ar.json` (3 namespaces FR+AR réels)
- `lib/supabase/types.generated.ts` (regen)
- `tests/rls.test.ts` (+5 block 2.8)
- `_bmad-output/implementation-artifacts/{sprint-status.yaml,deferred-work.md}`

### Change Log

| Date       | Version | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-06-19 | 0.1     | Création story 2.8 (context engine). 4 décisions structurantes : (1) nouvelle table `artisan_responses` dédiée FR22 (pas overload `ratings` — target_kind listing/rating, response_text 500 sanitizée), (2) extension `artisan_consent_tokens.purpose enum('consent','respond')` + RPC `process_artisan_response` SECURITY DEFINER distincte de `process_artisan_consent`, (3) page publique `/artisan/contact` HORS [locale] + RPC `request_artisan_contact_link` + AR38 indistinguabilité stricte (rate-limit IP+phone, timing equalize sleep 150ms, indistinguabilité UI), (4) rectification queue = persistance MVP + UI co-mod différée Epic 5 (table `artisan_rectification_requests` rows passives, `moderation_log` action posée immédiatement). 2 migrations (enum extensions + schema/RPCs/policy split). Server Actions + Route Handler webhook calqués 2.5. SW NetworkOnly + Cache-Control no-store + Sentry scrubber + proxy matcher étendus. Affichage `<ArtisanResponses>` sur fiche publique. i18n FR + AR réels (exception MVP FR-only, pattern 2.5). Tests RLS + RPC + lookup + action. Status → ready-for-dev. |
| 2026-06-19 | 0.2     | Implémentation 2.8. 2 migrations (purpose enum + 2 tables + RLS + 2 RPCs SECURITY DEFINER + filtre purpose sur process_artisan_consent + moderation_log policy split). Pages publiques /artisan/contact + /respond/[token] + /respond/done + webhook (calque 2.5). SMS respond + e-mail contact link. Affichage ArtisanResponses sur fiche. Infra sécu étendue (proxy/next.config/sw/sentry). i18n FR+AR réels. Corrigé ambiguïté 42702. typecheck/lint verts ; test 334/56 ; gated RLS 40/40 + RPC respond 10/10 + consent 6/6 contre Postgres réel. Status → review.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
