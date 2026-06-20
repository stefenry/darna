# Story 2.7: Édition / retrait de ses propres contributions (artisan, rating, commentaire)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

> ⚠️ **3 décisions structurantes** (détaillées en Dev Notes §Décisions) : (1) **Édition PII (display_name / phone) sur artisan published → re-consent loop** : on **pivote l'état** de l'artisan en place (`published → pending_consent`), génère un nouveau token HMAC, ré-envoie le SMS — l'ancien artisan reste visible avec une mention « modification en cours » jusqu'à acceptation. (2) **Cascade soft-delete artisan → ratings (+ commentaires) → tokens** via **RPC `SECURITY DEFINER`** `retract_artisan(p_artisan_id)` (transactionnelle, pattern 2.5) — pas de trigger DB, pas d'app-side multi-statement non-atomique. (3) **Retrait d'un rating = soft-delete** (`deleted_at=now()`) **pas un UPDATE à NULL** (le CHECK `ratings_at_least_one_score_check` interdit 0 axe) — colonnes `deleted_*` non grantées → **RPC `SECURITY DEFINER`** `retract_own_rating(p_rating_id)` qui réécrit aussi `user_id=NULL` pour conformer à `ratings_resident_update_own`.

## Story

As a **résident contributeur (Nadia post-publication — Journey 4 closing loop)**,
I want **éditer ou retirer chaque contribution que j'ai publiée (fiche artisan, note, commentaire) avec une cascade propre et un re-consent SMS si je change le téléphone ou le nom de l'artisan**,
so that **je garde le contrôle de ce que j'expose sur mes voisins et que mes corrections respectent les droits de l'artisan (CNDP / FR21)**.

Story aval directe de **2.3** (panel contributeur stubbed → déstubbed ici), **2.4** (workflow consentement réutilisé pour la PII), **2.5** (RPC SECURITY DEFINER pattern + 4ᵉ état token), **2.6** (rating upsert path → retrait ici). Couvre les **trois entités contributives** existantes au stade Epic 2 : `artisans`, `ratings`, et le **comment_text porté par ratings** (pas de table `alert_comments`/`guide_entries` au moment de 2.7 — elles arrivent Epics 3-4, hors-scope).

## Acceptance Criteria

> Source verbatim : `_bmad-output/planning-artifacts/epics.md` § « Story 2.7 » (l. 1056-1088). FR21 / NFR17 / CC #19. Adaptations techniques (re-consent en place, RPC, distinction edit-comment vs retract-rating) signalées en gras et tranchées en Dev Notes — elles priment.

1. **AC1 — Panel contributeur câblé sur la fiche.** Étant donné que j'ouvre `/[locale]/community/artisan/[slug]` et que `artisans.created_by = auth.uid()`, quand la page rend, alors le `ContributorPanel` (déjà présent en 2.3, AC5) **expose 2 actions actives** : « Modifier ma contribution » → page `…/[slug]/modifier` ; « Retirer la fiche » → confirmation 2 étapes (Dev Notes §UX destructif). Les autres résidents **ne voient jamais** ces actions (RLS-aware UI check **+** RLS DB).

2. **AC2 — Édition non-PII (compétences, prix, facture).** Étant donné que j'édite ma fiche, quand je change **uniquement** des champs **non-PII** (`tag_keys`, `price_relative`, `has_invoice`, `display_name_ar` optionnel pour le slot AR), alors les changements s'appliquent **immédiatement** quel que soit l'état (`pending_consent` ou `published`). **Aucun re-consent** : la fiche reste publiée et visible aux voisins.

3. **AC3 — Édition PII sur `published` → re-consent loop.** Étant donné que j'édite ma fiche et que **`display_name_fr` ou `phone_e164`** change sur un artisan **`state='published'`**, quand je soumets, alors **en transaction via RPC `request_artisan_reconsent`** : (a) la fiche **conserve son contenu courant publié** (les voisins continuent de voir l'ancienne version pendant le re-consent) ; (b) un **nouveau token HMAC** est créé (`artisan_consent_tokens`, expiry 24h cf. 2.5/P28) — **les tokens précédents non-utilisés sont invalidés** (`used_at = now()`) ; (c) un **draft des nouvelles PII** est stocké pour application post-acceptation (Dev Notes §Décision 1) ; (d) le SMS magic-link est ré-envoyé à **la nouvelle PII** (ou l'ancien numéro si seul le nom change — Dev Notes §Décision 1) ; (e) la fiche **affiche un badge « modification en cours »** côté contributeur (uniquement) ; (f) `moderation_log` enregistre `artisan_reconsent_requested`. **À l'acceptation** : la RPC `process_artisan_consent` (étendue) applique les PII du draft + remet `state='published'` ; **au refus** : le draft est jeté, la fiche reste **inchangée** (l'ancienne reste publiée — pas de soft-delete).

4. **AC4 — Édition PII sur `pending_consent` → re-consent immédiat.** Étant donné que j'édite ma fiche encore en `pending_consent` (pas encore consentie) et que je change `display_name_fr` ou `phone_e164`, quand je soumets, alors les PII sont **écrites en place sur la ligne `artisans`**, l'ancien token est **invalidé** (`used_at=now()` sur les tokens non-utilisés), un nouveau token est généré et le SMS est ré-envoyé. **Aucun draft** : la fiche n'a jamais été visible (RLS `published`), donc on peut muter directement.

5. **AC5 — Modifier ma note.** Étant donné que j'ai noté un artisan (ligne `ratings` avec `user_id=auth.uid()`) et que j'ouvre la fiche, quand je tape « Modifier ma note », alors je suis redirigé vers `…/[slug]/noter` (page 2.6 réutilisée — elle pré-remplit ma note via `fetchMyRating` et fait un UPDATE). **Aucune nouvelle UI** côté 2.7 pour l'édition de note — le CTA fiche bascule en « Modifier ma note » dès qu'un rating existe (déjà câblé 2.6 Task 6). 2.7 documente seulement ce câblage pour traçabilité FR21.

6. **AC6 — Retirer ma note.** Étant donné que j'ai noté un artisan, quand je tape « Retirer ma note » (CTA secondaire dédié sur `…/[slug]/noter` quand `existingRating` est non-null), alors **via RPC `retract_own_rating`** : (a) la ligne `ratings` est **soft-deletée** (`deleted_at=now()`, `deleted_by=auth.uid()`, `deletion_reason='author_retract'`, `user_id=NULL` — Dev Notes §Décision 3) ; (b) `moderation_log` enregistre `rating_removed` (action enum existante, l.39 init_enums.sql) ; (c) la vue `artisan_rating_aggregates` perd cette ligne au prochain rendu (`security_invoker` + `deleted_at IS NULL` côté RLS) ; (d) l'UI re-render via `revalidatePath` — le CTA repasse en « Noter cet artisan ».

7. **AC7 — Retirer un commentaire seul (laisser la note).** Étant donné que j'ai noté ET commenté un artisan, quand je tape « Retirer mon commentaire » (CTA secondaire dans le form 2.6 quand `comment_text` non-vide), alors la **note est conservée** (les scores restent dans l'agrégat) et **seulement** `comment_text=NULL` est écrit via `submitRating` (chemin UPDATE 2.6 existant — le champ comment passe à vide). Aucune RPC nécessaire (UPDATE column-grant déjà OK). `moderation_log` enregistre `comment_removed` via une RPC dédiée `retract_own_comment` (la colonne `comment_text` est grantable mais l'INSERT log demande SECURITY DEFINER — Dev Notes §Décision 3.bis).

8. **AC8 — Retirer ma fiche artisan (cascade complète).** Étant donné que je suis le contributeur d'un artisan (`pending_consent` ou `published`) et que je confirme le retrait (UX 2 étapes — type `SUPPRIMER` ou bouton danger long-press, Dev Notes §UX), alors **via RPC `retract_artisan(p_artisan_id)` (SECURITY DEFINER, transactionnelle)** : (a) `artisans` → `deleted_at=now()`, `deleted_by=auth.uid()`, `deletion_reason='author_retract'` ; (b) **tous les `ratings` de cet artisan** → soft-delete cascade (`deleted_at=now()`, `deleted_by=auth.uid()`, `deletion_reason='artisan_retracted'`, `user_id` **inchangé** — c'est leur auteur d'origine qui est anonymisé seulement en cas de purge RGPD, pas ici) ; (c) **tous les `artisan_consent_tokens` non-utilisés** → `used_at=now()` ; (d) `moderation_log` enregistre `artisan_retracted` (**nouvelle valeur enum à ajouter** — voir Task 1) ; (e) le `slug` reste **tombstoné** (slug unique global déjà couvert par 2.1) ; (f) l'UI redirige vers `/[locale]/community/annuaire` avec un toast « Ta fiche a été retirée ».

9. **AC9 — Sécurité défense en profondeur.** Étant donné qu'un résident **non-contributeur** tente de cibler une fiche/note qui n'est pas la sienne (forge `slug`, `rating_id` ou ID dans le form-encoded), alors **toutes les voies** rejettent : (a) UI ne montre pas le panel (`isOwner=false`) ; (b) Server Action checke `created_by = auth.uid()` côté DB avant d'appeler la RPC ; (c) la **RPC valide elle-même `auth.uid() = artisans.created_by` / `ratings.user_id`** en interne (la RPC n'est PAS un bypass autorité — c'est seulement un bypass des grants column-level deleted\_\*) ; (d) `moderation_log` enregistre toujours `actor_id=auth.uid()` (pas null comme 2.5 — c'est une action utilisateur identifiée). **Jamais** d'admin client côté action (sauf lookup slug existant éventuel — pattern 2.4).

10. **AC10 — `ratings.artisan_rating_aggregates` propre après retrait.** Étant donné qu'une fiche artisan est retirée (AC8 cascade), quand un voisin re-visite l'annuaire, alors **(a)** la fiche n'apparaît plus dans la liste (RLS `state='published' AND deleted_at IS NULL`), **(b)** la fiche elle-même renvoie un 404 (data.ts `kind: 'not-found'` — review 2.3 P21 a abandonné la distinction 410), **(c)** les agrégats associés ne fuient pas (la vue est `security_invoker` et filtre déjà `deleted_at IS NULL` au niveau ratings via les policies en cascade — confirmer Task 9).

### AC additionnel (régression — obligatoire)

11. **AC11 — Tests RLS + Server Actions + i18n verts.** RLS étendue dans `tests/rls.test.ts` (suite gated `SUPABASE_LOCAL_TEST`) couvre : (a) update non-PII d'un artisan par son contributeur → OK ; (b) update PII via RPC (lance le re-consent) ; (c) update artisan d'autrui → `42501` (la policy `artisans_resident_update_own` rejette) ; (d) RPC `retract_artisan` par un user qui n'est pas `created_by` → `raise exception 'forbidden'` ; (e) RPC `retract_own_rating` cible la note d'un autre user → `raise exception 'forbidden'` ; (f) cascade soft-delete : après `retract_artisan`, `select count(*) from ratings where artisan_id=? and deleted_at is null` = 0. **Et** `pnpm typecheck`/`lint`/`test` verts ; aucune nouvelle PII en log ; tokens raw jamais loggués ; `lib/supabase/types.generated.ts` régénéré.

## Tasks / Subtasks

- [x] **Task 1 — Migration : enum + 3 RPCs SECURITY DEFINER** (AC: 3, 4, 6, 7, 8, 11)
  - [x] Migration `<ts>_artisan_self_actions.sql`. **Étape A — enum extension** (additif, à committer avant la RPC qui l'utilise — leçon 2.5) : `alter type public.moderation_action add value if not exists 'artisan_retracted'; alter type ... add value if not exists 'artisan_reconsent_requested';`. Les valeurs `rating_removed` / `comment_removed` existent déjà (init_enums.sql l.39).
  - [x] **Étape B — schema additif** : ajouter à `artisans` deux colonnes **draft PII** nullables pour le re-consent en place :
        `sql
    alter table public.artisans
      add column pending_display_name_fr text,
      add column pending_phone_e164 text;
    `
        Pas de FTS sur ces colonnes draft (sinon la recherche annuaire indexerait des données non-consenties). Aucun grant column-level supplémentaire pour `authenticated` — ces colonnes sont écrites **uniquement** par la RPC SECURITY DEFINER (cf. Task 5).
  - [x] **Étape C — RPC `request_artisan_reconsent(p_artisan_id uuid, p_new_name_fr text, p_new_phone text)` `SECURITY DEFINER set search_path=public`** (AC3) :
    - guard ownership : `select created_by from artisans where id = p_artisan_id` ; si ≠ `auth.uid()` ou si introuvable / `deleted_at not null` → `raise exception 'forbidden'`
    - si `state = 'published'` ET PII change : **écrire le draft** (`pending_display_name_fr`, `pending_phone_e164`) et **conserver** `state='published'` (les voisins continuent de voir l'ancien) ; pivoter sur `pending_consent` **uniquement** au moment où l'artisan accepte
    - si `state = 'pending_consent'` ET PII change : **écrire les PII en place** (`display_name_fr`, `phone_e164`), pas de draft
    - dans les deux branches : `update artisan_consent_tokens set used_at = now() where artisan_id = p_artisan_id and used_at is null and expires_at > now()` (invalide les pending) → ré-insère un **nouveau token** (`token_hash`, `expires_at = now() + 24h` — alignement 2.5/P28) ; `insert moderation_log (residence_id, actor_id=auth.uid(), action='artisan_reconsent_requested', target_kind='artisan', target_id=p_artisan_id)`
    - renvoie `(token_raw_hash_pair via OUT params? non — la RPC ne génère PAS le hash)`. Décision : **le raw token est généré côté Server Action** (réutilise `lib/consent/token.ts`), seul `token_hash` est passé en paramètre à la RPC qui l'insère. Signature : `request_artisan_reconsent(p_artisan_id uuid, p_new_name_fr text, p_new_phone text, p_new_token_hash text)` returns table(`status text, sms_target_phone text, sms_artisan_name text`). `sms_target_phone` = nouveau ou ancien selon ce qui change ; `sms_artisan_name` = nouveau si change, ancien sinon. Le webhook re-utilise le pattern Server Action 2.4.
    - `revoke execute on function ... from public, anon, authenticated; grant execute to authenticated` (la RPC est appelée par le contributeur authentifié, pas par anon — divergence de 2.5).
  - [x] **Étape D — RPC `retract_artisan(p_artisan_id uuid)` `SECURITY DEFINER`** (AC8) :
    - guard ownership + non déjà supprimé
    - soft-delete cascade en transaction :
      ```sql
      update artisans set deleted_at=now(), deleted_by=auth.uid(),
        deletion_reason='author_retract', updated_at=now() where id=p_artisan_id;
      update ratings set deleted_at=now(), deleted_by=auth.uid(),
        deletion_reason='artisan_retracted', updated_at=now()
        where artisan_id=p_artisan_id and deleted_at is null;
      update artisan_consent_tokens set used_at=now()
        where artisan_id=p_artisan_id and used_at is null;
      insert into moderation_log(residence_id, actor_id, action, target_kind, target_id)
        values ((select residence_id from artisans where id=p_artisan_id),
                auth.uid(), 'artisan_retracted', 'artisan', p_artisan_id);
      ```
    - revoke public/anon ; grant authenticated.
  - [x] **Étape E — RPC `retract_own_rating(p_rating_id uuid)` `SECURITY DEFINER`** (AC6) :
    - guard ownership : `select user_id from ratings where id=p_rating_id`. Si ≠ `auth.uid()` → `raise exception 'forbidden'`. Si `deleted_at not null` → idempotent (return sans erreur).
    - `update ratings set deleted_at=now(), deleted_by=auth.uid(), deletion_reason='author_retract', user_id=null, updated_at=now() where id=p_rating_id`. **Pourquoi user_id=null** : la policy `ratings_resident_update_own` exige `user_id=auth.uid()` en `USING`+`WITH CHECK` ; si on garde le `user_id`, un éventuel UPDATE postérieur via session client serait toujours possible. Le `user_id=null` matérialise l'idée que le rating est tombstoné côté propriétaire (ADR 0006 §anonymisation). `moderation_log` : `actor_id=auth.uid()`, `action='rating_removed'`, `target_kind='rating'`, `target_id=p_rating_id`.
  - [x] **Étape F — RPC `retract_own_comment(p_rating_id uuid)` `SECURITY DEFINER`** (AC7) :
    - guard ownership identique à E. `update ratings set comment_text=null, updated_at=now() where id=p_rating_id and user_id=auth.uid()` (la note reste). `insert moderation_log ... action='comment_removed'`. **Pourquoi pas un simple UPDATE client session** : la colonne `comment_text` EST grantée en UPDATE, mais l'INSERT dans `moderation_log` n'est pas accessible au client (la policy `moderation_log_public_select` régit la lecture, et il n'y a aucune policy INSERT — l'écriture passe par SECURITY DEFINER, cf. 2.5).
  - [x] `pnpm supabase db reset` + `pnpm gen:types` (les 4 RPC + 2 valeurs enum + 2 colonnes draft apparaissent dans les types). Voir `[[project_rls_tests_local_setup]]`.

- [x] **Task 2 — Validation Zod édition fiche** (AC: 2, 3, 4, 9)
  - [x] `lib/validation/artisan-edit.ts` : `zEditArtisanForm` (calque allégé de `zCreateArtisanForm`) — `display_name_fr`, `display_name_ar`, `phone` (zPhoneMaroc), `tag_keys` (1..8), `price_relative`, `has_invoice`. **Pas de `consent_confirmed`** (réservé à la création). Préprocess identique (sanitizeName NFC + strip bidi/control — réutilise `STRIP_CONTROL_AND_BIDI` de `lib/validation/artisan.ts`, **extraire le helper en `lib/validation/sanitize.ts`** pour réutilisation propre). Mapping erreurs typé `mapEditArtisanFieldError` → clés `errors.artisan.*` (réutilise les clés existantes). Tests purs ≥1 axe (`tag_keys.min(1)`), borne 120, phone E.164.
  - [x] `lib/artisans/diff-pii.ts` : helper pur `piiChanged(old, next): boolean` qui retourne `true` si `display_name_fr` ou `phone_e164` change (après normalisation — `replace(PHONE_NORMALIZE…)`). Tests purs.

- [x] **Task 3 — Server Action `updateArtisan`** (AC: 2, 3, 4, 9, 11)
  - [x] `app/[locale]/community/artisan/[slug]/modifier/actions.ts` (`'use server'`). Signature `(_prev: UpdateArtisanState, formData: FormData) => Promise<UpdateArtisanState>` (pattern 2.6 `useActionState`). Union discriminée : `{ ok:true; slug; reconsent:'none'|'in_place'|'draft'; sms_sent?:boolean }` | `{ ok:false; error:{ code; field?; message_key } }`. Codes : `validation | rate_limited | unauthenticated | forbidden | not_found | submit_failed`.
  - [x] Garde : `requireResident()` + role check explicite (`resident|co_mod`, cf. 2.4/P7), rate-limit `checkLimit('artisan-edit:${userId}', 10, 600)`. Validation Zod (Task 2).
  - [x] **Lookup ownership + état** via **client session** : `select id, state, display_name_fr, phone_e164, created_by from artisans where slug=? and deleted_at is null` (la RLS `artisans_resident_select_published` ne matchera pas un `pending` d'autrui — `own_pending` matchera le mien). Si row absent ou `created_by != userId` → `forbidden` (jamais distinguer `not_found` d'`forbidden` — pas de side-channel).
  - [x] **Branche 1 — non-PII uniquement** (AC2) : `update artisans set display_name_ar=?, price_relative=?, has_invoice=?, updated_at=now() where id=?` (client session, column-grant OK) + diff tags (delete + insert dans `artisan_tags` — voir Task 3.bis). Retour `{ ok:true, reconsent:'none' }`.
  - [x] **Branche 2 — PII change ET state='pending_consent'** (AC4) : générer un nouveau token (`generateConsentToken(env.server.CONSENT_TOKEN_SECRET)`), appeler RPC `request_artisan_reconsent(p_artisan_id, new_name, new_phone, hash)`. La RPC écrit les PII en place + invalide les anciens tokens + crée le nouveau. Côté Server Action : envoyer le SMS via `lib/sms/send` (template `artisan-consent` existant, réutilisé). Retour `{ ok:true, reconsent:'in_place' }`.
  - [x] **Branche 3 — PII change ET state='published'** (AC3) : générer un nouveau token, appeler RPC `request_artisan_reconsent` (mode draft — la RPC détecte `state='published'` et écrit `pending_*` au lieu d'overwriter les colonnes principales). SMS au **nouveau** phone si phone change, sinon ancien. Retour `{ ok:true, reconsent:'draft' }`.
  - [x] **Cas dégénéré : tags-only change sans PII** → branche 1 (déclare-le explicitement, pas de re-consent).
  - [x] Sécurité : aucune écriture sur `state`, `published_at`, `deleted_*`, `created_by` (column-grant les exclut déjà ; ne PAS tenter — défense en profondeur). Aucune PII dans les logs (`event:'artisan.edit_submitted'`, `payload:{ reconsent: 'in_place'|'draft'|'none', tagsChanged: boolean }`). Token raw jamais loggé.

- [x] **Task 3.bis — Diff tags (création + suppression)** (AC: 2)
  - [x] Helper pur `lib/artisans/diff-tags.ts` : `diffTagKeys(currentKeys, nextKeys): { toAdd: string[]; toRemove: string[] }`.
  - [x] Dans `updateArtisan` : lire les tags actuels (jointure `artisan_tags ( tags ( key ) )` côté session) ; calculer le diff ; lookup id → key (1 query `tags.select(id,key).in(key,…)`) ; **DELETE puis INSERT** sur `artisan_tags`. **Note RLS** : la policy `artisan_tags_resident_insert` (l.342 schema) gate par `artisans.created_by = auth.uid()` — OK pour la 1.4 ; il n'y a **pas de policy DELETE** sur `artisan_tags`. → **À ajouter dans la migration Task 1** : `create policy artisan_tags_resident_delete on artisan_tags for delete using (exists (select 1 from artisans a where a.id = artisan_id and a.created_by = auth.uid()))`. + `grant delete on artisan_tags to authenticated` (REVOKE par défaut depuis le schema additif). Le scope retrait reste légitime puisque la cascade artisan-side passe par la RPC `retract_artisan` (FK `on delete cascade` ne se déclenche pas sur soft-delete, donc le ménage des liens N-N reste utile à l'édition).

- [x] **Task 4 — Server Action `retractArtisan`** (AC: 8, 9)
  - [x] `…/[slug]/modifier/actions.ts` (même fichier que Task 3) : `retractArtisan(_prev, formData)`. Lit `confirm` (le form pré-Task 6 envoie `confirm='RETIRER'` typé). Garde résident + role + lookup ownership comme Task 3. Appelle `supabase.rpc('retract_artisan', { p_artisan_id: artisanId })` (client session — la RPC fait `auth.uid()` en interne pour la guard). Retour `{ ok:true }` (le client redirige vers l'annuaire). `revalidatePath('/[locale]/community/annuaire')`.

- [x] **Task 5 — Server Actions retract rating / comment** (AC: 6, 7, 9)
  - [x] `app/[locale]/community/artisan/[slug]/noter/actions.ts` (fichier 2.6) : ajouter deux exports.
    - `retractOwnRating(_prev, formData)` : garde résident, parse `rating_id` (UUID), `supabase.rpc('retract_own_rating', { p_rating_id })`. `revalidatePath('/[locale]/community/artisan/[slug]')`. Retour discriminé.
    - `retractOwnComment(_prev, formData)` : idem mais appelle `retract_own_comment`.

- [x] **Task 6 — Pages : `…/modifier` et confirm retrait fiche** (AC: 1, 2, 3, 4, 8)
  - [x] `app/[locale]/community/artisan/[slug]/modifier/page.tsx` (RSC, `force-dynamic`). Garde résident via layout. Lookup `fetchArtisanBySlug` (existant 2.3) ; si `kind:'not-found'` ou `isOwner=false` → `notFound()`. Sert le `<EditArtisanForm>` avec valeurs courantes pré-remplies. `loading.tsx` skeleton.
  - [x] `_components/edit-artisan-form.tsx` (`'use client'`) : calqué sur `create-artisan-form.tsx` (2.4) **sans** la case `consent_confirmed`. Affiche un **encart d'avertissement orange** dès que l'utilisateur modifie `display_name_fr` ou `phone` ET que `state==='published'` : « Changer le nom ou le téléphone va re-déclencher le consentement de l'artisan par SMS. La fiche actuelle reste visible tant qu'il n'a pas accepté. » (clé i18n `community.artisanEdit.reconsentWarning`). Utilise `useActionState(updateArtisan, …)`.
  - [x] **Bouton retrait fiche dans l'edit page** (en bas, séparé visuellement — pattern « Danger Zone » story 1.9) : bouton `destructive` qui ouvre un sous-form de confirmation **inline** type SUPPRIMER (champ texte « tape RETIRER pour confirmer »), pas de `ConfirmDialog` modal au MVP (cohérent UX spec §N7 et §ConfirmDialog réservé à 1.9 compte). Submit → `retractArtisan` Server Action.
  - [x] **CTA panel contributeur (fiche 2.3)** : modifier `_components/contributor-panel.tsx` pour rendre les boutons **actifs** : `<Link href=".../modifier">Modifier ma contribution</Link>` + `<Link href=".../modifier#retrait">Retirer la fiche</Link>` (anchor pour scroller vers la Danger Zone). Retirer `disabled`/`aria-disabled` et le tooltip « bientôt » (clé `community.artisan.owner.soon` à conserver pour archive ou supprimer — choisir supprimer).

- [x] **Task 7 — CTAs retrait rating & commentaire sur `/noter`** (AC: 5, 6, 7)
  - [x] `…/noter/_components/rate-form.tsx` (story 2.6, à enrichir) : quand `existingRating` non-null, afficher en bas du form 2 boutons secondaires :
    - « Retirer ma note » (`destructive` ghost) → ouvre une mini-confirmation inline (un second tap « Confirmer ») → `retractOwnRating` (hidden input `rating_id`). Sur succès → toast + `router.push(.../slug)`.
    - « Retirer mon commentaire seulement » (visible **seulement** si `existingRating.commentText` non vide) → `retractOwnComment`. Sur succès → la note reste, le form se re-render avec `comment_text` vide.
  - [x] Le CTA principal « Modifier ma note » reste celui du form 2.6 (AC5 = câblage déjà existant 2.6 Task 6).

- [x] **Task 8 — Acceptation du re-consent avec draft PII (extension RPC 2.5)** (AC: 3)
  - [x] **Étendre `process_artisan_consent`** (migration `<ts+1>_artisan_consent_with_draft.sql`) — la RPC actuelle (story 2.5, durcie par 20260623090000) doit, **dans la branche `accept`**, vérifier si `pending_display_name_fr` ou `pending_phone_e164` est non-null et, le cas échéant, les promouvoir vers les colonnes principales :
        `sql
    if v.a_state = 'pending_consent' then
      update public.artisans
        set state='published',
            published_at=now(),
            display_name_fr=coalesce(pending_display_name_fr, display_name_fr),
            phone_e164=coalesce(pending_phone_e164, phone_e164),
            pending_display_name_fr=null,
            pending_phone_e164=null,
            updated_at=now()
        where id=v.a_id;
    elsif v.a_state = 'published' and (pending_display_name_fr is not null or pending_phone_e164 is not null) then
      -- Cas re-consent draft sur fiche déjà published (AC3) : promouvoir les drafts.
      update public.artisans set ... -- idem
    end if;
    `
  - [x] **Branche `refuse`** : si on est sur un re-consent (`state='published'` ET drafts non-null), **ne pas soft-delete** la fiche (elle reste publiée à l'ancien contenu) ; effacer les drafts uniquement (`pending_*=null`) + `used_at=now()` + log dédié `artisan_reconsent_refused` (nouvelle valeur enum à ajouter Task 1). **Cas refuse classique** (state était `pending_consent` sans draft) : comportement existant 2.5 (`refused`+soft-delete).
  - [x] Mettre à jour `lib/consent/lookup.ts` et la page `/consent/[token]` (2.5) pour afficher la **diff PII** quand un re-consent draft est en cours (« Nadia souhaite mettre à jour ton nom de "X" à "Y" » / « ton numéro de "Z" à "W" »). Nouvelle clé i18n `consent.reconsentDiff.{nameChange,phoneChange,bothChange}`.

- [x] **Task 9 — Tests RLS étendus + tests Server Actions** (AC: 11)
  - [x] `tests/rls.test.ts` (gated `SUPABASE_LOCAL_TEST`) — ajouter un block « RLS artisans/ratings — édition & retrait (Story 2.7 AC11) » : (a) `update artisans set price_relative='$$' where id=publishedArtisanId` par alice (créatrice) → OK ; (b) même update par bob → 0 rows affected (RLS); (c) `rpc('retract_artisan', publishedArtisanId)` par bob → exception `forbidden` ; (d) `rpc('retract_own_rating', myRatingId)` par le contributeur de la note → OK + check `deleted_at not null` + `user_id null` ; (e) `rpc('retract_own_rating', someoneElsesRatingId)` → exception `forbidden` ; (f) après `retract_artisan` réussi : `select count(*) from ratings where artisan_id=? and deleted_at is null` = 0 (cascade). Réutiliser les seeds `publishedArtisanId`/`makeResident` existants.
  - [x] Test unitaire Server Action `updateArtisan` (node, mocks chaînés cf. `tests/profil/profile-actions.test.ts`) : (a) update non-PII sans token créé ; (b) update PII published → RPC `request_artisan_reconsent` appelée + SMS log adapter touché ; (c) update sur slug d'autrui → `forbidden` sans révéler.
  - [x] Test unitaire `lib/artisans/diff-pii.ts` + `lib/artisans/diff-tags.ts`.
  - [x] **AUCUN test composant React** post-submit (cluster 1.10c E2E, leçon 2.4/2.6 : `useActionState` jsdom incompatible).

- [x] **Task 10 — i18n + a11y + intégration** (AC: 1, 2, 3, 4, 6, 7, 8)
  - [x] `messages/fr.json` : nouveau namespace `community.artisanEdit.*` (titre page « Modifier ma fiche », `reconsentWarning`, `dangerZoneTitle`, `dangerZoneDescription`, `confirmPhraseLabel`, `confirmPhrase` = `"RETIRER"`, CTA « Enregistrer », « Retirer ma fiche définitivement », « Modification en cours, l'artisan reçoit un nouveau SMS »). Étendre `community.artisanRate.*` (2.6) avec `retractRating`, `retractComment`, `retractRatingConfirm`, `retractCommentConfirm`, `noteRetracted`, `commentRetracted`. Étendre `community.artisan.owner.*` (2.3) en retirant `soon`. Étendre `errors.artisan.*` avec `edit_forbidden`, `edit_submit_failed`, `not_found`. Étendre `consent.*` avec `reconsentDiff.{nameChange,phoneChange,bothChange}`.
  - [x] `messages/ar.json` : stubs miroirs vides (convention 1.5/2.6, MVP FR-only).
  - [x] A11y : confirmation `RETIRER` typé = pattern story 1.9 (déjà éprouvé) ; `<button>` `destructive` `min-h-touch-lg` ; `aria-live='polite'` sur l'encart re-consent warning ; pas de modal.

## Dev Notes

> **Stack & conventions** : identiques 2.2-2.6 (Next 16.2.6 RSC + Server Actions, `@supabase/ssr`, RLS column-grant, RPC SECURITY DEFINER pour bypass deleted\_\*, next-intl 4.12, Zod 4, Vitest 4, Tailwind 3.4 tokens Darna). Voir 2.2 §Architecture, 2.5 §RPC, 2.6 §Décisions.

### §Décisions (3 points structurants, tranchés)

1. **Édition PII (display_name / phone) sur artisan published → re-consent en place avec draft.**
   AC FR21 dit « new consent loop is triggered, until they accept the fiche stays as-is ». Deux options techniques :
   - **(a) Pivot en place** : artisan reste **`state='published'`**, draft écrit dans 2 nouvelles colonnes `pending_*`, l'ancienne fiche **reste visible inchangée**, l'artisan voit la diff PII proposée sur la page `/consent/[token]` ; à l'acceptation, la RPC promeut les drafts vers les colonnes principales et efface les drafts.
   - **(b) Clone** : nouvelle ligne `artisans` en `pending_consent` avec les nouvelles PII (+ un FK self-référant pour le swap), à l'acceptation on soft-delete l'ancienne et publie la nouvelle.
     **Reco — option (a)** : moins de plomberie (pas de FK self), pas de problème de slug (slug unique global — un clone forcerait un slug différent), idempotente naturellement, et la transition « publication d'un draft » a une sémantique propre dans `process_artisan_consent` déjà existante. La cible SMS du re-consent : **si seul le nom change** → ancien phone ; **si phone change** → nouveau phone (la spec UX FR21 « artisan SMS-notified of the change request » est ambiguë — privilégier le nouveau phone pour éviter de spam l'ancien sur une fiche qui va potentiellement perdre son lien avec lui).
     **Implication AC additionnel** : le DB doit empêcher un re-consent **en cours** d'être doublé (token précédent invalidé via `update used_at` — déjà fait dans la RPC). Si l'artisan **refuse** le re-consent, la fiche reste publiée à l'ancien contenu (pas de soft-delete). Si le contributeur déclenche un **2ᵉ re-consent** alors qu'un draft est en cours, le draft précédent est **écrasé** (les drafts ne sont qu'une intention, pas un état persistant — pas d'historique de drafts au MVP).

2. **Cascade soft-delete : RPC SECURITY DEFINER, pas de trigger DB.**
   Trigger Postgres `on update of deleted_at` qui cascade `ratings`/`artisan_consent_tokens` serait élégant **mais** : (a) il rendrait les writes column-grant `update(... updated_at)` côté résident dangereux (un UPDATE benin déclencherait une cascade si un attaquant trouvait le moyen d'écrire `deleted_at` — défense en profondeur cassée) ; (b) `deleted_*` ne sont **pas grantées** au contributeur, donc seul service-role / SECURITY DEFINER peut les écrire — un trigger ne se déclenche pas tout seul, il faut une RPC qui déclenche l'UPDATE initial. Pattern RPC déjà éprouvé par 2.5 (`process_artisan_consent`). **Reco : RPC `retract_artisan` qui fait les 3 UPDATEs + l'INSERT log en transaction.** Aucun trigger requis.

3. **Retrait d'un rating = soft-delete (pas update à NULL).**
   `ratings_at_least_one_score_check` (l.111-113 schema 2.1) interdit `num_nonnulls(scores) = 0` → un UPDATE qui mettrait tous les axes à NULL violerait la contrainte. **Donc retrait = soft-delete obligatoire** (`deleted_at=now()`). Colonnes `deleted_*` non grantées au résident → **RPC SECURITY DEFINER `retract_own_rating`**. **Décision supplémentaire** : la RPC réécrit aussi `user_id=NULL` (anonymisation immédiate du rating retiré, cohérent ADR 0006 §anonymisation — sinon le rating reste lié au user mais devient invisible, ce qui complique le ré-affichage si un jour on construit un dashboard « mes contributions »). À acter : **garder `user_id` non-null** ferait plus de sens pour un futur « mes contributions retirées » dashboard (V1.5). **Reco : user_id=NULL au MVP** (simplification — un retrait est définitif côté UI résident, et la cascade RGPD du compte le ferait de toute façon). Le dev peut diverger si une story 6.x exige le contraire.

   **3.bis — Retrait d'un commentaire (laisser la note)** : `comment_text=NULL` est OK (pas violé par CHECK). La colonne est grantée en UPDATE → un UPDATE client session suffirait pour le payload. **Mais** l'INSERT dans `moderation_log` (`comment_removed`) demande SECURITY DEFINER (pas de policy INSERT sur moderation_log). → RPC dédiée `retract_own_comment` qui fait les deux atomiquement.

### §Réutilisation directe (NE PAS réinventer)

- **`ContributorPanel`** (`app/[locale]/community/artisan/[slug]/_components/contributor-panel.tsx`) — déjà câblé en 2.3, déstub seulement (retirer `disabled`, transformer en `<Link>`).
- **`fetchArtisanBySlug`** (`…/[slug]/data.ts`) — déjà calcule `isOwner` (l.115). Réutiliser tel quel pour la page `…/modifier`.
- **`createArtisan` Server Action** (`…/annuaire/nouveau/actions.ts`) — pattern complet (garde résident + role, rate-limit, Zod, slug, RPC, SMS, log sans PII). `updateArtisan` calque la garde + rate-limit + Zod ; remplace la branche INSERT par UPDATE + RPC reconsent éventuelle.
- **`lib/consent/token.ts`** — `generateConsentToken(secret)` réutilisé pour le re-consent.
- **`lib/sms/send.ts`** — boundary, template `artisan-consent` déjà OK pour le re-consent (texte « confirme ta fiche » s'applique aussi à une mise à jour PII — pas besoin d'un 2ᵉ template au MVP).
- **`process_artisan_consent`** RPC (migration 20260622120000 + durcissement 20260623090000) — **étendre** pour gérer le draft PII (Task 8).
- **RLS `artisans_resident_update_own`** + column-grant `(display_name_fr, display_name_ar, phone_e164, price_relative, has_invoice, updated_at)` (l.233-251 schema 2.1) — couvre déjà l'UPDATE non-PII. La PII en re-consent in-place s'écrit aussi via ces grants (UPDATE direct) ; en draft, c'est la RPC SECURITY DEFINER qui écrit (col `pending_*` non grantée).
- **`tests/rls.test.ts`** — block « RLS artisans / ratings (AC8) » a déjà les seeds (`publishedArtisanId`, `makeResident`) ; étendre avec un sous-block « édition & retrait ».
- **Story 1.9 RPC `request_account_deletion`** — pattern SECURITY DEFINER avec guard `auth.uid()` + revoke public + grant authenticated. Modèle direct pour `retract_artisan` et `retract_own_rating`.
- **Pattern confirm phrase typée `RETIRER`** — réutilise `zDeleteAccount` de 1.9 (mais constante `RETIRER` vs `SUPPRIMER`). `lib/validation/artisan-edit.ts` exporte un `zRetractArtisanConfirm`.

### §Sécurité (FR21 transparence, NFR17 traçabilité, AR38 reconfirm, NFR18 RGPD)

- **Ownership double check** : (1) `isOwner` côté UI **+** (2) `created_by = auth.uid()` côté Server Action (lookup avant action) **+** (3) `auth.uid() = created_by` côté RPC SECURITY DEFINER (la RPC peut être appelée directement via PostgREST par un client mal intentionné — chaque RPC valide elle-même).
- **Tokens** : raw token jamais loggué/stocké ; HMAC-SHA256 hex en DB. Réutilise `lib/consent/token.ts`. Token précédent invalidé par `update used_at = now()` (pas DELETE — on garde la trace).
- **moderation_log** : `actor_id = auth.uid()` (l'utilisateur est identifié, contrairement à 2.5 où l'artisan est anonyme). Nouvelles valeurs enum : `artisan_retracted`, `artisan_reconsent_requested`, `artisan_reconsent_refused`. Re-vérifier le test `moderation_log_consent_residence_select` (20260623090000 P5) — les actions consent restent restreintes par résidence ; les nouvelles `artisan_retracted` et `artisan_reconsent_*` doivent être ajoutées à la liste si on veut éviter le side-channel cross-residence (re-vérifier ADR 0004 §FR33 transparence radicale vs side-channel — **à acter : ajouter `artisan_retracted` et `artisan_reconsent_requested` à la lecture restreinte par résidence**).
- **PII en logs** : `event:'artisan.edit_submitted'`, `payload:{ reconsent, tagsChanged, piiChanged }` — pas de display_name ni phone dans le payload.
- **Rate-limit** : par userId pour l'édition (`artisan-edit:${userId}`, 10/h) **+** par phone destinataire pour le re-consent SMS (`artisan-sms:${phone}`, 3/h — pattern 2.4/P2). Le rate-limit `artisan-create` reste isolé.
- **CSRF** : Server Actions Next 14+ ont la protection native (déjà en 2.4).
- **Tombstone slug** : la cascade `retract_artisan` ne réutilise jamais le slug (la contrainte `unique` sur `artisans.slug` couvre les lignes soft-deleted — 2.1 explicite). Si Nadia veut « remettre » la fiche, elle doit créer une nouvelle fiche (nouveau slug auto-suffixé via `resolveUniqueSlug`).

### §UX destructif

UX spec §Modal Patterns ban les modaux d'erreur génériques (l.1224) mais explicite **ConfirmDialog Radix** pour les actions destructives (l.1215, l.1144). Réservé à 1.9 (suppression compte) au MVP — pour 2.7 on **n'introduit pas** de nouveau modal Radix. Pattern retenu, cohérent avec 1.9 §AC5 :

- **Édition** : action 1-tap (« Enregistrer ») sans confirmation, sauf si PII change → afficher un encart d'avertissement orange inline (pas modal) **avant** le bouton Submit.
- **Retrait fiche** : **Danger Zone inline** en bas de la page d'édition (pas de modal, pas de nouvelle page) avec champ « tape RETIRER pour confirmer » (pattern 1.9 §AC5 — phrase typée constante).
- **Retrait note** : 2 taps inline (premier tap → confirm secondaire en place, second tap → action). Pas de phrase typée pour une note (moins critique que retirer une fiche entière).
- **Retrait commentaire (note conservée)** : idem 2 taps.

### §Scope boundaries

- **DANS** : édition artisan (non-PII immédiate, PII via re-consent en place avec draft sur published / direct sur pending), retrait artisan cascade (artisan + ratings + tokens), retrait rating (soft-delete via RPC), retrait commentaire (chemin RPC dédié), `moderation_log` exhaustif, panel contributeur déstubbé, tests RLS RPC, i18n FR (AR stub).
- **HORS** : édition/retrait `alerts`/`alert_comments`/`guide_entries` (tables n'existent pas — épics 3/4) ; relance auto si artisan ne répond pas au re-consent (auto-revert au draft refusé → V1.5) ; UI « modification en cours » côté résident voisin (le contributeur seul voit le badge — élargir aux voisins serait UX confuse) ; export RGPD self-service des contributions retirées (story 8.3) ; dashboard « mes contributions retirées » (V1.5).

### §Cas limite à expliciter

- **Contributeur soft-deleted RGPD (1.9) tandis qu'il a des contributions actives** : sa cascade RGPD met `users.deleted_at = now()`. Ses `ratings.user_id` → SET NULL (FK existante). Les artisans qu'il a créés gardent `created_by = NULL` (FK existante, ADR 0006). **Ces artisans ne sont plus éditables/retirables par personne** au MVP (la garde `created_by = auth.uid()` rejette tout user). C'est **accepté** : la cascade RGPD ne purge pas les contributions communautaires (ADR 0006 décision). Si une fiche orpheline pose problème (artisan qui n'existe plus), un co-mod la traitera via Epic 5 (retrait par modération, hors-scope 2.7).
- **Race condition : Nadia retire la fiche pendant qu'un voisin clique « Noter »** : la policy `ratings_resident_insert` exige `state='published' AND deleted_at IS NULL` sur l'artisan référencé (l.281-288 schema 2.1) → l'INSERT du voisin échouera proprement (`42501`). Bénin.
- **Race condition : 2ᵉ re-consent en cours alors qu'un draft existe** : la RPC `request_artisan_reconsent` `update used_at` les tokens non-utilisés ET `update pending_*` (overwrite du draft précédent) en une transaction. Le draft précédent est perdu. **Acceptable** au MVP (le contributeur le sait s'il re-clique).
- **Race condition : contributeur clique « retrait fiche » pendant qu'un artisan clique « accepter » sur un re-consent** : la RPC `retract_artisan` est postérieure (lock UPDATE sur artisans) → soit l'accept passe d'abord (la fiche est publiée à la nouvelle PII puis retirée — 2 entrées dans `moderation_log` : `artisan_published` puis `artisan_retracted`, traçable), soit le retract passe d'abord (la fiche est soft-deleted ; le `process_artisan_consent` détecte `deleted_at not null` via le guard P1 du durcissement 2.5 et renvoie `already_used`). Les deux issues sont propres.

### Project Structure Notes

- **NEW** :
  - `supabase/migrations/<ts>_artisan_self_actions.sql` (enum extensions + 2 colonnes draft + 4 RPCs + policy artisan_tags_resident_delete).
  - `supabase/migrations/<ts+1>_artisan_consent_with_draft.sql` (extension `process_artisan_consent` pour promouvoir le draft + branche refuse re-consent).
  - `app/[locale]/community/artisan/[slug]/modifier/{page,loading,actions}.tsx` + `_components/edit-artisan-form.tsx`.
  - `lib/validation/artisan-edit.ts` (+ `.test.ts`).
  - `lib/validation/sanitize.ts` (extraction du helper `sanitizeName` de `lib/validation/artisan.ts`).
  - `lib/artisans/diff-pii.ts` (+ `.test.ts`).
  - `lib/artisans/diff-tags.ts` (+ `.test.ts`).
  - `tests/artisan/update-action.test.ts` (action node).
- **UPDATE** :
  - `app/[locale]/community/artisan/[slug]/_components/contributor-panel.tsx` (déstubbed : `<Link>` actifs).
  - `app/[locale]/community/artisan/[slug]/noter/actions.ts` (ajout `retractOwnRating` + `retractOwnComment`).
  - `app/[locale]/community/artisan/[slug]/noter/_components/rate-form.tsx` (boutons retrait conditionnels).
  - `app/consent/[token]/page.tsx` + `lib/consent/lookup.ts` (afficher diff PII si draft).
  - `messages/fr.json` (`community.artisanEdit.*` + extensions `community.artisanRate.*`/`community.artisan.owner.*`/`errors.artisan.*`/`consent.reconsentDiff.*`).
  - `messages/ar.json` (stubs miroirs).
  - `lib/validation/artisan.ts` (importe désormais `sanitizeName` depuis `lib/validation/sanitize.ts`).
  - `lib/supabase/types.generated.ts` (regen post-migration : 4 RPCs + 2 colonnes draft + 3 valeurs enum).
  - `tests/rls.test.ts` (block édition & retrait).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` §Story-2.7 (l.1056-1088)] — AC verbatim, FR21, NFR17, CC #19.
- [Source: `_bmad-output/planning-artifacts/prd.md`] — FR21 (droit de réponse / édition), NFR17 (modération traçable), NFR18 (RGPD), AR10 (anonymisation), FR33 (transparence).
- [Source: `_bmad-output/planning-artifacts/architecture.md` Gap #5 (l.1428-1438)] — modèle soft-delete cascade + anonymisation user_id NULL.
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` l.159, 440, 1215, 1224] — Maîtrise « édition/retrait à tout moment », panel contributeur, ConfirmDialog destructif réservé.
- [Source: `_bmad-output/implementation-artifacts/2-3-fiche-artisan-detaillee-action-tel.md` AC5] — panel déjà câblé en stub.
- [Source: `_bmad-output/implementation-artifacts/2-5-page-magic-link-consentement-artisan-accept-refuse-1-tap-sans-compte.md`] — RPC SECURITY DEFINER pattern + idempotence + AR38 + P1 (guards state/deleted_at).
- [Source: `_bmad-output/implementation-artifacts/2-6-notation-typee-multi-axes-commentaire-pseudo-identite.md`] — `fetchMyRating`, `submitRating`, idempotence rating.
- [Source: `_bmad-output/implementation-artifacts/1-9-profil-resident-deconnexion-suppression-compte-rgpd-cascade.md` AC1+AC5] — pattern RPC `request_account_deletion` + Danger Zone phrase typée.
- [Source: `supabase/migrations/20260619090000_artisans_schema.sql`] — RLS update-own, column-grant deleted\_\* exclus, ratings CHECK ≥1 axe (l.111-113), unique slug global incl. soft-deleted (l.65).
- [Source: `supabase/migrations/20260622120000_artisan_consent_rpc.sql` + `20260623090000_consent_review_hardening.sql`] — pattern RPC + guard P1.
- [Source: `supabase/migrations/20260524005527_init_enums.sql` l.33-40] — `moderation_action` ; valeurs existantes `rating_removed`, `comment_removed`.
- [Source: `supabase/migrations/20260524005559_init_schema.sql` l.103-117] — `moderation_log` schéma + immutabilité.
- [Source: `docs/adr/0006-soft-delete-cascade-anonymization.md`] — anonymisation soft-delete (référence pour user_id=NULL sur retract rating).
- [Source: `docs/adr/0004-rls-vs-fk-discipline.md`] — défense en profondeur RLS + column-grant + SECURITY DEFINER pour écritures sensibles.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Claude Opus 4.8, 1M context) — bmad-dev-story, 2026-06-19

### Debug Log References

- 3 migrations appliquées **pour de vrai** (`supabase db reset`) + `gen:types` régénéré (4 RPCs + 2 colonnes draft + 3 valeurs enum + extension `process_artisan_consent`).
- **Gated RLS** `tests/rls.test.ts` → **35/35** contre Postgres réel (25 pré-existants + 4 de 2.6 + **6 nouveaux 2.7** : édition non-PII own OK, édition d'autrui bloquée 0-ligne, `retract_artisan` forbidden, cascade soft-delete 0-rating-actif, `retract_own_rating` + `user_id` NULL, `retract_own_rating` forbidden).
- **Gated RPC** `tests/consent-rpc.test.ts` → **6/6** (4 + 2 nouveaux re-consent draft : accept promeut les PII / refuse jette le draft, fiche reste publiée). ⚠️ Corrigé au passage un bug pré-existant du seed 2.5 (phone hardcodé `+212600000099` → collision sur `artisans_phone_e164_active_unique` ajouté après ; phone rendu unique par seed).
- Bug attrapé en test : `42702` (ambiguous column) — les colonnes RHS du `coalesce` dans la RPC entraient en conflit avec les **paramètres OUT homonymes** (`display_name_fr`) ; corrigé en lisant via le record `v` qualifié (capture de `a_phone` ajoutée).
- Suite complète non-gated : **319 pass / 41 skip** (+gated). typecheck + lint (0 erreur) verts.

### Completion Notes List

**Livré et validé (typecheck + lint + `test` 319 verts ; RLS 35/35 + RPC 6/6 contre Postgres réel) :**

- **Migrations** (3) : `artisan_self_actions_enum` (3 valeurs enum), `artisan_self_actions` (2 colonnes draft `pending_*`, policy `artisan_tags_resident_delete` + grant, **4 RPCs SECURITY DEFINER** `request_artisan_reconsent`/`retract_artisan`/`retract_own_rating`/`retract_own_comment`), `artisan_consent_with_draft` (extension `process_artisan_consent` : promotion draft à l'accept, refus re-consent garde publié + restriction résidence des actions self-action dans `moderation_log`).
- **Validation** : `lib/validation/sanitize.ts` (extraction `sanitizeName`), `lib/validation/artisan-edit.ts` (`zEditArtisanForm` sans consent, `zRetractArtisanConfirm` RETIRER), `lib/artisans/diff-pii.ts`, `lib/artisans/diff-tags.ts` — 24 tests purs.
- **Server Actions** : `updateArtisan` (non-PII immédiat / PII→re-consent draft ou in-place + SMS), `retractArtisan` (RPC cascade), `retractOwnRating`/`retractOwnComment` (ajoutées au fichier 2.6) — 5 tests `updateArtisan`.
- **Pages/UI** : `…/modifier/{page,loading}.tsx` + `edit-artisan-form.tsx` (encart re-consent si PII change sur published, Danger Zone inline phrase RETIRER), `ContributorPanel` déstubbed (Links actifs), `rate-form.tsx` enrichi (retrait note/commentaire 2-taps), page consent affiche le diff PII.
- **Data** : `fetchArtisanForEdit`, `MyRating.id`, `lib/consent/lookup.ts` (diff re-consent).
- **i18n** : `community.artisanEdit.*`, extensions `community.artisanRate.*`/`errors.artisan.*`/`consent.reconsentDiff.*`, retrait `owner.soon` (FR + stubs AR).

**Décisions appliquées (story spec §Décisions) :** (1) re-consent published = draft en place (`pending_*`, option a), (2) cascade via RPC `retract_artisan` (pas de trigger), (3) retrait rating = soft-delete + `user_id=NULL` via RPC.

**⚠️ Résidus de validation (gated/externe) :**

1. **Flux post-soumission `useActionState`** (édition/retrait, succès inline, redirections) non e2e-testé (limite jsdom, cf. 2.4/2.6) → cluster E2E 1.10c.
2. **Provider SMS/e-mail réels** (re-consent) : stub en test, à provisionner avant bêta.

### File List

**NEW :**

- `supabase/migrations/20260624090000_artisan_self_actions_enum.sql`
- `supabase/migrations/20260624090100_artisan_self_actions.sql`
- `supabase/migrations/20260624090200_artisan_consent_with_draft.sql`
- `app/[locale]/community/artisan/[slug]/modifier/{page,loading,actions}.tsx`
- `app/[locale]/community/artisan/[slug]/modifier/_components/edit-artisan-form.tsx`
- `lib/validation/sanitize.ts`, `lib/validation/artisan-edit.ts` (+ `.test.ts`)
- `lib/artisans/diff-pii.ts` (+ `.test.ts`), `lib/artisans/diff-tags.ts` (+ `.test.ts`)
- `tests/artisan/update-action.test.ts`

**MODIFIED :**

- `lib/validation/artisan.ts` (importe `sanitizeName`)
- `app/[locale]/community/artisan/[slug]/data.ts` (`fetchArtisanForEdit`, `MyRating.id`)
- `app/[locale]/community/artisan/[slug]/page.tsx` (props `ContributorPanel`)
- `app/[locale]/community/artisan/[slug]/_components/contributor-panel.tsx` (déstub)
- `app/[locale]/community/artisan/[slug]/noter/actions.ts` (`retractOwnRating`/`retractOwnComment`)
- `app/[locale]/community/artisan/[slug]/noter/_components/rate-form.tsx` (RetractControls)
- `app/consent/[token]/page.tsx`, `lib/consent/lookup.ts` (diff re-consent)
- `messages/fr.json`, `messages/ar.json`
- `lib/supabase/types.generated.ts` (regen)
- `tests/rls.test.ts` (+6), `tests/consent-rpc.test.ts` (seed fix + 2 re-consent)
- `tests/artisan/artisan-fiche.test.tsx`, `tests/artisan/rate-form.test.tsx`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

| Date       | Version | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-06-19 | 0.1     | Création story 2.7 (context engine). 3 décisions structurantes : (1) édition PII published → re-consent en place avec colonnes drafts `pending_*` (option a, pas de clone), (2) cascade soft-delete artisan → ratings → tokens via RPC SECURITY DEFINER `retract_artisan` (pas de trigger DB), (3) retrait rating = soft-delete + `user_id=NULL` via RPC `retract_own_rating` (CHECK ≥1 axe interdit UPDATE à NULL ; deleted\_\* non grantées). 2 migrations : `artisan_self_actions` (4 RPCs + enum extensions + colonnes draft + policy artisan_tags_delete) + `artisan_consent_with_draft` (extension RPC 2.5 pour promouvoir draft). Server Actions `updateArtisan`/`retractArtisan`/`retractOwnRating`/`retractOwnComment`. Pages `.../modifier` + Danger Zone inline phrase typée RETIRER. ContributorPanel 2.3 déstubbed. Tests RLS étendus. Status → ready-for-dev. |
| 2026-06-19 | 0.2     | Implémentation 2.7. 3 migrations (4 RPCs SECURITY DEFINER + colonnes draft + policy artisan_tags_delete + extension process_artisan_consent draft). Server Actions updateArtisan/retractArtisan/retractOwnRating/retractOwnComment. Pages modifier + Danger Zone RETIRER. ContributorPanel déstubbed. Page consent diff PII. i18n. Corrigé bug seed pré-existant consent-rpc + ambiguïté 42702. typecheck/lint verts ; test 319/41 ; RLS 35/35 + RPC 6/6 contre Postgres réel. Status → review.                                                                                                                                                                                                                                                                                                                                                                             |

### Review Findings

> Code review 2026-06-19 — Blind Hunter + Edge Case Hunter + Acceptance Auditor (3 couches adverses parallèles). ~73 findings bruts → 32 post-triage/vérif : **3 décisions**, **19 patches** (7 sécurité critique), **7 différés**, **6 noise écartés**.

#### Decisions (à trancher avant patches)

- [x] [Review][Decision] **D1 — `moderation_log` policy split pour actions self-retract** — `retract_own_rating` et `retract_own_comment` logent avec `action='rating_removed'`/`comment_removed` (actions historiques co-mod, FR33 publiques via policy `moderation_log_public_select`). Un attaquant connaissant `artisan.id` voit qui a retiré quoi côté résident → side-channel AR38. Le `user_id=NULL` est posé côté ratings (ADR 0006 OK), mais le log reste exposé. Options : (a) **nouvelle enum value** `rating_self_retracted` / `comment_self_retracted` + policy private (résident résidence) ; (b) **filtrer `actor_id IS NOT NULL` dans la policy publique** (les actions self ont `actor_id=user`, les co-mod ont `actor_id=co_mod_user` — pas discriminant) ; (c) **garder publique** + assumer la transparence (FR33 littéral, mais contredit AR38).
- [x] [Review][Decision] **D2 — Atomicité `updateArtisan`** — Aujourd'hui : `UPDATE non-PII` puis tags diff puis `RPC request_artisan_reconsent`. Aucune transaction, pas de rollback applicatif. Si la RPC échoue mid-flow, DB en état mixte (prix/tags écrits, PII pas re-consentie). Options : (a) **tout déplacer dans une RPC `update_artisan_self`** SECURITY DEFINER transactionnelle (lourd refactor, signature N params) ; (b) **réordonner** : RPC reconsent en premier, non-PII + tags après seulement si reconsent OK (élégant, garde la séparation column-grant) ; (c) **accept-as-is + monitoring** alertes Sentry sur partial-state.
- [x] [Review][Decision] **D3 — SMS template reconsent dédié** — `updateArtisan` envoie un SMS via `template: 'artisan-consent'` (le template _invitation initiale_). L'artisan déjà publié reçoit « Voulez-vous être inscrit ? » alors qu'on lui propose une mise à jour. Options : (a) **nouveau template `artisan-reconsent.{fr,ar}.ts`** + ajout `SendArgs`, body « Mise à jour proposée par votre voisin » ; (b) **template existant avec flag `isReconsent: boolean`** + branche conditionnelle interne ; (c) **garder + reformuler** le wording du template existant pour couvrir les 2 cas (plus court).

#### Patches sécurité critique

- [x] [Review][Patch] **P1 — Fuite PII drafts `pending_*` via SELECT RLS résident** [`supabase/migrations/20260624090100_artisan_self_actions.sql:23-25`] — Le grant `select on all tables to authenticated` (`20260621090000_base_table_grants_local_parity.sql:14`) + RLS `artisans_resident_select_published` autorisent un résident à `select pending_display_name_fr, pending_phone_e164 from artisans where state='published'`. Tout voisin voit le draft en cours. Fix : `revoke select (pending_display_name_fr, pending_phone_e164) on public.artisans from authenticated, anon;` + grant SELECT à `service_role` uniquement (les lectures publiques utilisent les colonnes principales, le draft n'est lu que par le webhook via admin).
- [x] [Review][Patch] **P2 — Collision phone pendant promotion → 500 artisan** [`supabase/migrations/20260624090200_artisan_consent_with_draft.sql:107-130`] — `UPDATE artisans SET phone_e164 = coalesce(pending, current)` lève `23505` sur index unique partiel `artisans_phone_e164_active_unique` si le user a posé un draft sur un phone d'un autre artisan published. Webhook 2.5 retourne 500 brut. Fix : (a) bloquer la collision côté `request_artisan_reconsent` (lookup `where phone_e164 = p_new_phone and state != 'refused' and deleted_at is null and id != p_artisan_id`) → raise `phone_already_used` ; (b) catch `23505` dans `process_artisan_consent` + retourner `status='phone_collision'` mappé vers `/consent/done?status=phone_collision`.
- [x] [Review][Patch] **P3 — `requireResident` ne gate pas le rôle (leçon 2.4 P7)** [`app/[locale]/community/artisan/[slug]/modifier/actions.ts:105-109,259-263`] — `requireResident` retourne OK pour tout user auth (incl. `demandeur`, RGPD-supprimé pre-purge). Ownership protège du dommage mais défense en profondeur cassée. Fix : ajouter `select role, deleted_at from users where id = userId` + reject si `role not in ('resident','co_mod')` ou `deleted_at not null`. Pattern déjà appliqué dans `noter/actions.ts:98-106` (2.6).
- [x] [Review][Patch] **P4 — Tags DELETE→INSERT sans transaction** [`actions.ts:178-187`] — Si `INSERT links` échoue (FK miss, RLS, transient), les anciens tags sont déjà DELETE → fiche sans compétences. L'erreur INSERT n'est même pas testée (`await ... .insert(links)` sans capture). Fix : déplacer dans une RPC `update_artisan_tags(artisan_id, new_keys)` SECURITY DEFINER transactionnelle, OU vérifier `insErr` et catch DELETE rollback.
- [x] [Review][Patch] **P5 — Update non-PII silent 0 rows → `ok:true` menteur** [`actions.ts:140-159`] — `.update().eq()` ne retourne pas d'erreur pour 0 lignes. Race si soft-delete dans un autre onglet, ou RLS bloque (state='refused'), → user voit "Modifications enregistrées" sans écriture DB. Fix : ajouter `.select()` après update → check `data.length === 1` ou retourner `submit_failed`.
- [x] [Review][Patch] **P6 — `state='refused'` non bloqué côté action** [`actions.ts:127-148`] — La RPC `request_artisan_reconsent` bloque `refused` (raise `forbidden`), mais l'action commit non-PII + tags AVANT la RPC. Une fiche `refused` (recoverable theoretically par admin) peut avoir prix/invoice/tags écrasés. Fix : guard `state != 'refused' AND deleted_at IS NULL` côté action après SELECT, AVANT toute écriture.
- [x] [Review][Patch] **P7 — Gate atomique RETURNING manquante (4 RPCs)** [`20260624090100_artisan_self_actions.sql:73-92,124-141,180-201,113-141`] — Double-clic concurrent passe le check `if deleted_at is not null then return` deux fois → double `moderation_log`. Leçon 2.5 P1 non appliquée. Fix : pattern `UPDATE ... WHERE ... IS NULL RETURNING id INTO v_id; IF v_id IS NULL THEN return; END IF;` dans chaque RPC retract.

#### Patches robustesse / UX / défense en profondeur

- [x] [Review][Patch] **P8 — `retract_artisan` cascade ne NULL pas `ratings.user_id` (ADR 0006 violé)** [`20260624090100_artisan_self_actions.sql:113-141`] — Cohérence avec `retract_own_rating` qui anonymise. Fix : ajouter `user_id = NULL` au UPDATE ratings cascade.
- [x] [Review][Patch] **P9 — `request_artisan_reconsent` ne valide pas params (bypass Zod via RPC direct)** [`20260624090100_artisan_self_actions.sql:43-105`] — Token authenticated peut appeler `supabase.rpc('request_artisan_reconsent', { p_new_phone: 'garbage' })`. La RPC écrit `phone_e164 = 'garbage'` direct sur `pending_consent`. Fix : check `p_new_phone ~ '^\+[1-9]\d{7,14}$'` et `length(trim(p_new_name_fr)) > 0` dans la RPC + sanitize (NFC, strip bidi équiv. `lib/validation/sanitize.ts`).
- [x] [Review][Patch] **P10 — `moderation_log` action `'artisan_published'` faussement utilisé sur reconsent accept** [`20260624090200_artisan_consent_with_draft.sql:131-132`] — Pollution log de transparence FR33. Fix : ajouter enum value `'artisan_reconsent_accepted'` à `moderation_action`, l'utiliser dans la branche reconsent du `process_artisan_consent`.
- [x] [Review][Patch] **P11 — Rate-limit SMS bypass via variation phone destinataire** [`actions.ts:710-713`] — `checkLimit('artisan-sms:${form.phone}', 3, 3600)` : un attaquant change le phone à chaque édition → 10 SMS unsollicités (limite `artisan-edit` 10/10min). Fix : double-limit (a) `artisan-sms:${userId}` global (3 SMS/h par contributeur) + (b) garder `artisan-sms:${phone}` (anti-harcèlement victime).
- [x] [Review][Patch] **P12 — Confirm phrase 'RETIRER' FR hardcodé** [`lib/validation/artisan-edit.ts:1164`] — Client compare via `t('confirmPhrase')` (locale-aware), serveur compare à literal FR. Désalignement AR. Fix : (a) accepter `'RETIRER' | 'إزالة'` (enum) côté serveur OU (b) accepter n'importe quoi côté serveur + validation côté form-client uniquement (faible défense en profondeur mais simple).
- [x] [Review][Patch] **P13 — Asymétrie tags vs PII draft** [`actions.ts:162-188 vs 191-237`] — Tags écrits immédiatement, PII en draft. L'artisan accepte PII sans savoir tags ont muté. Fix : (a) inclure tag diff dans le draft (colonnes `pending_tag_keys text[]`) — lourd ; (b) bloquer édition tags pendant reconsent draft actif — simple ; (c) accept-as-is + documenter (tags pas PII, pas de droit légal CNDP sur compétences déclarées).
- [x] [Review][Patch] **P14 — Page consent ne différencie pas 1er vs re-consent** [`app/consent/[token]/page.tsx:67-90`, `messages/fr.json:477-503`] — Intro générique « Un voisin vous recommande ». Sur reconsent l'artisan croit que c'est sa fiche initiale. Fix : intro conditionnelle `result.reconsent !== null ? t('reconsentIntro') : t('intro')` + badge visuel « Mise à jour proposée ».
- [x] [Review][Patch] **P15 — Slug pas libéré post-retract** [`20260624090100_artisan_self_actions.sql:128-141`] — Index `slug` unique global (incl. soft-deleted, AC #19 tombstone voulu pour partage URL). Mais le contributeur ne peut PAS recréer une fiche pour le même artisan plus tard. Fix : tombstone slug est correct (spec §Décisions #1) ; ce qui manque c'est l'UX "vous avez déjà une fiche retirée pour cet artisan — voulez-vous la restaurer ?" — décision produit, défère ou clarifier UX.
- [x] [Review][Patch] **P16 — `artisan_tags_resident_delete` policy ne filtre pas `a.deleted_at IS NULL`** [`20260624090100_artisan_self_actions.sql:25-36`] — Inconsistance avec UPDATE/SELECT policies. Fix : ajouter `and a.deleted_at is null` au `exists` check.
- [x] [Review][Patch] **P17 — Tests update-action gap (retract, SMS échec, RPC error, tag diff edge cases)** [`tests/artisan/update-action.test.ts`] — Couverture lacunaire (5 cas). Fix : ajouter retract complet, sms.ok=false → smsFailed, RPC error → submit_failed, tag unknown_key, update 0-row.
- [x] [Review][Patch] **P18 — Tests RLS gap (pending\_\* SELECT bloqué, retract idempotent, request_artisan_reconsent rejets)** [`tests/rls.test.ts:742-859`] — Fix : (a) bob.select(pending\_\*) doit retourner null/forbidden après P1 ; (b) double retract → idempotent (1 log seulement après P7) ; (c) cross-user request_artisan_reconsent → forbidden.
- [x] [Review][Patch] **P19 — `revalidatePath` non-typesafe locale** [`actions.ts:746,802-803`] — Locale attaquable via hidden input. Fix : `routing.locales.includes(locale) ? locale : 'fr'`.

#### Différés

- [x] [Review][Defer] **CHECK constraint pending\_\* invariant DB** — Bug applicatif futur. Schéma post-stabilisation.
- [x] [Review][Defer] **NFC normalize sur `piiChanged` côté `current` (DB)** — Edge case import bizarre. Bénin.
- [x] [Review][Defer] **Race deadlock concurrent request_artisan_reconsent + process_artisan_consent** — Postgres handle, exception remonte à l'artisan rarement.
- [x] [Review][Defer] **Notification SMS/email artisan post-retract** — Décision produit (artisan ne sait pas pourquoi les appels cessent). À acter post-bêta.
- [x] [Review][Defer] **`sanitize` strip bidi peut casser texte AR mixte légitime** — V1.5 AR-aware.
- [x] [Review][Defer] **RetractZone aria-live + focus management sur `#retrait`** — a11y polish post-MVP.
- [x] [Review][Defer] **`piiTouched` client/server désynchro sur format phone alternatif** — UX edge minor, bénin (serveur source de vérité).

#### Dismissed

- Slug hidden input attaquant — ownership check protège.
- `confirm` non-NFC validation strict — accepté volontairement.
- Magic strings dans `event:` log payload — pattern projet.
- `state.ok` redirection `useEffect` cleanup — pas un finding (action one-shot).
- `display_name_fr` XSS via i18n — Acceptance vérifié, pas de `rich={}`.
- Token hash collision — `UNIQUE` index déjà posé 2.5 P4 (vérifié).
