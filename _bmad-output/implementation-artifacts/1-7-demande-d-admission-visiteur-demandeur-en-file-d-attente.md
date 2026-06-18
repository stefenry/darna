# Story 1.7: Demande d'admission (visiteur → demandeur en file d'attente)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

**As a** visiteur public (Salma — Journey 3 PRD),
**I want** déposer une demande d'admission avec villa, tranche, prénom, e-mail (+ CGU explicite) et confirmer mon e-mail via un magic link,
**so that** je passe au statut `demandeur` en file d'attente sous 24h, les 3-4 co-mods sont notifiés, et tout mon parcours d'entrée à Darna (du QR code livret syndic au statut "validé") fonctionne bout-en-bout — la règle Aïcha (≤ 30s) est tenue, et la mitigation L4 (CGU non-pré-cochée) est respectée.

## Acceptance Criteria

> **Convention BDD** : chaque AC est testable indépendamment. La référence finale est l'epic
> ([Source: \_bmad-output/planning-artifacts/epics.md:676-712]). **Décision MVP FR-only**
> ([[project_darna_mvp_fr_only]]) : seuls les templates / messages FR sont remplis ; les
> stubs AR existent (typés / vides) et tombent en fallback FR via `lib/i18n/request.ts`
> `deepMerge` (story 1.5). **Hors-scope** : queue co-mod, validate/reject (story 1.8), rate
> limiting `POST /admission/submit` 5/jour/IP (story 1.10, AR31), templates AR finalisés
> (V1.5), `contact_channel='sms'` (V1.5).

### AC1 — Migration `email_verified_at` + types régénérés (DB) (FR4, FR5)

**Given** la table `public.admission_requests` existe (story 1.3) **sans** colonne pour tracer la vérification e-mail demandée par l'epic (`requested_at=now()` est mappé sur `created_at`, OK ; mais `email_verified_at` n'existe pas)
**When** la story 1.7 est livrée
**Then** une nouvelle migration **additive** `supabase/migrations/2026061500XXXX_add_admission_email_verified_at.sql` ajoute :

- `email_verified_at timestamptz null` sur `public.admission_requests`
- une `policy / grant` cohérent avec [Source: `supabase/migrations/20260524005600_init_rls.sql:158-175`] — **n'ajoute pas** la colonne au `grant insert` demandeur (immutable au INSERT) **mais** l'ajoute au `grant update` (autorise les writes ciblés via service-role callback) ; aucune ouverture de policy supplémentaire côté `authenticated`
- une **vérification** : `pnpm run gen:types` régénère `lib/supabase/types.generated.ts` avec le nouveau champ ; commit du diff inclus

**And** `pnpm supabase db reset` local applique la migration sans erreur et `pnpm test` reste vert (les seeds 1.3 ne contiennent pas d'`admission_requests`, donc pas d'impact data).

**And** l'`UPDATE` côté server-action callback (AC5) utilise le **service-role** `createAdminClient()` ([Source: `lib/supabase/admin.ts`]) plutôt que le client SSR utilisateur, **car** la policy `admission_requests_demandeur_select` autorise seulement `select` côté demandeur — `update` reste réservé au co-mod ou au service-role (anti-self-validate, review story 1.3 #11).

---

### AC2 — Zod schema `submitAdmissionForm` (3 frontières) (AR17)

**Given** `lib/validation/email.ts` et `lib/validation/villa-number.ts` existent (story 1.1)
**When** la story 1.7 est livrée
**Then** un nouveau module `lib/validation/admission.ts` exporte :

```ts
export const zTranche = z.enum(['A', 'B', 'C', 'D', 'E']);
export const zFirstName = z.string().trim().min(1).max(40);

export const zSubmitAdmissionForm = z.object({
  villa: zVillaNumber, // 1-150
  tranche: zTranche, // A/B/C/D/E
  first_name: zFirstName,
  email: zEmail,
  cgu_accepted: z.literal(true, { message: 'errors.admission.cgu_required' }),
});
export type SubmitAdmissionForm = z.infer<typeof zSubmitAdmissionForm>;
```

**And** chaque erreur Zod **mappe sur un `message_key` i18n** ([Source: architecture.md:549]) — pas de hardcoded string. Les `message_key` retournés au form sont parmi : `errors.admission.{villa_out_of_range, tranche_invalid, first_name_required, email_invalid, cgu_required}`.

**And** `tests/validation/admission.test.ts` couvre **chaque** code de message clé (5 cas valides + 5 cas invalides), pattern issu de `tests/validation/villa-number.test.ts`.

---

### AC3 — Server Action `submitAdmissionRequest` (anti-énum + Result<T>) (FR2, FR3, FR42, AR17-19)

**Given** je suis visiteur **non authentifié** sur `/${locale}/admission` (pas de cookie session Supabase)
**When** je soumets le formulaire valide
**Then** une Server Action **`app/actions/admission-submit.ts`** :

1. `'use server';` directive
2. **Valide** via `zSubmitAdmissionForm.safeParse(formData)` — échec → `return Result.error({ fieldErrors })` au form (pas de redirect)
3. Crée l'**admin client** `createAdminClient()` ([Source: `lib/supabase/admin.ts`]) — `SUPABASE_SECRET_KEY` server-only (AR3)
4. **Idempotence + duplicate detection** (anti-spam) :
   - Tente `admin.createUser({ email, email_confirm: false, user_metadata: { residence_id: '00000000-0000-0000-0000-000000000001' } })`
   - Si l'utilisateur existe déjà (code `email_exists` ou `user_already_registered`) → `admin.getUserByEmail(email)` (pattern fallback : `admin.listUsers({ filter: ... })` ne supporte pas le filter email officiellement ; voir Section "Latest Tech Information") → récupérer `user_id`
   - Query `admission_requests.eq('user_id', user_id).eq('state', 'pending').is('deleted_at', null).maybeSingle()` (admin client bypasse RLS — OK car on a déjà vérifié l'identité par l'e-mail)
   - **Si une ligne `pending` existe** → `return Result.error({ code: 'duplicate_pending', message_key: 'errors.admission.duplicate_pending' })` **sans renvoyer de magic-link** (anti-spam)
5. **Création auth + admission_request** :
   - `createUser` a déclenché `handle_new_auth_user()` ([Source: `supabase/migrations/20260524005559_init_schema.sql:147-189`]) → `public.users` provisionné avec `role='demandeur'`, `notifications_prefs` aussi → idempotent via `ON CONFLICT`
   - `INSERT INTO admission_requests` (via admin client) **strictement** ces colonnes : `user_id`, `residence_id='00000000-0000-0000-0000-000000000001'`, `villa`, `tranche`, `first_name`, `contact_channel='email'`. **NE PAS** fournir `state/decision_*/created_at/updated_at/deleted_*/email_verified_at` (defaults + CHECK + policy column-grant interdisent ; review 1.3 #11/#12)
6. **Génère le magic-link** : `admin.generateLink({ type: 'magiclink', email, options: { redirectTo: ${env.client.NEXT_PUBLIC_SITE_URL}/auth/confirm?next=/${locale}/admission/pending } })` — **`redirectTo` doit pointer vers `/admission/pending`** (et non `/admission`) **car** `resolveRedirect` ([Source: `lib/auth/redirect-by-state.ts:14-52`]) déjà câblé route `state=pending` → `/admission/pending` ; on **honore** le `next` param via `isSafeAdmissionNext` qui accepte `/${locale}/admission/pending` (préfixe `admission` + boundary `/`)
7. **Envoie le magic-link** via `sendTransactionalEmail({ template: 'magic-link', to: email, locale, vars: { link: action_link, expiresInMinutes: 15 } })` (boundary AR16, story 1.6)
8. **Notifie tous les co-mods** : pour chaque adresse dans `env.server.INITIAL_COMOD_EMAILS` ([Source: `lib/env.ts:19-27`]), un `sendTransactionalEmail({ template: 'admission-notify-comod', to: comod_email, locale: 'fr', vars: { villa, tranche, first_name, queue_url: ${env.client.NEXT_PUBLIC_SITE_URL}/${locale}/comod/admission } })`. **Erreurs de send co-mod ne doivent jamais faire échouer la Server Action** — log `event: 'admission.comod_notify_failed'` et continuer (le demandeur a son magic-link, c'est ce qui compte ; les co-mods peuvent voir la queue par polling — story 1.8)
9. **Log** structuré (sans PII, AR19) :
   - `'admission.requested'` avec `user_id`, `payload: { villa, tranche, locale, has_email_verified_at: false }` — **pas d'`email`**, **pas de `first_name`**
   - `'email.sent'` × N (déjà loggé par `lib/email/send.ts`)
10. **Retourne** `Result.ok({})` — le form **redirige** ensuite vers `/${locale}/auth/check-email` (cohérent avec le wording UX magic-link "Ouvre ta boîte mail 📬") — **PAS** `/${locale}/admission/pending` (le visiteur n'a pas encore confirmé son e-mail)

**And** la Server Action **n'utilise jamais** `process.env` directement — passe par `env.client` / `env.server` ([Source: `lib/env.ts`], leçon review 1.6 host-injection).

**And** **anti-enumeration timing** : conformément au pattern story 1.6 ([[deferred-work.md story-1.6 entry "Anti-enumeration timing leak signin"]]), le chemin **`duplicate_pending`** doit retourner l'erreur **explicite** (le visiteur a déposé sa demande lui-même, pas d'énumération à protéger — c'est lui qui possède l'adresse) **mais** le chemin "création réussie" et le chemin "e-mail déjà associé sans ligne pending" doivent se terminer par le **même** redirect (`/auth/check-email`) avec le **même** délai apparent. Si le coût du `sendTransactionalEmail` Brevo est asymétrique (succès lent vs échec rapide), accepter en MVP et différer au 1.10 (cohérent avec story 1.6 deferred).

---

### AC4 — Page `/[locale]/(public)/admission/page.tsx` + form + `loading.tsx` (UX Journey 3, NFR40)

**Given** je suis sur `/${locale}/admission` (route publique, **pas** sous `(community)` — variance avec architecture.md:808, justifiée Section "Project Structure Notes")
**When** la page rend
**Then** elle livre :

- `app/[locale]/(public)/admission/page.tsx` — **Server Component** ([Source: `app/[locale]/(public)/auth/login/page.tsx`] pattern) : `<PageContainer as="main">` + `<header>` (h1 + intro) + `<AdmissionForm/>` + lien `/${locale}/auth/login` "Déjà demandé l'accès ? Me connecter"
- `app/[locale]/(public)/admission/admission-form.tsx` — **Client Component** : `useActionState(submitAdmissionRequest, INITIAL_STATE)`, champs :
  - `<input type="number" name="villa" min={1} max={150} inputMode="numeric" required/>` (UX spec mention `<VillaPicker>` mais un input numérique suffit MVP — pas de scroller spécifique)
  - `<select name="tranche">` (A/B/C/D/E) — Radix `<Select>` **n'est pas** dans `components/ui/` (vérifié — `select.tsx` absent) ; utiliser un **`<select>` natif** stylisé tokens v2 ([Source: ux-design-specification.md:683 — inputs sans border, focus ring]) ; éviter d'introduire `@radix-ui/react-select` non listé Section "Versions verrouillées"
  - `<input type="text" name="first_name" required autoComplete="given-name" maxLength={40}/>`
  - `<input type="email" name="email" required autoComplete="email" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false}/>` (pattern `login-form.tsx`)
  - `<Checkbox name="cgu_accepted" />` ([Source: `components/ui/checkbox.tsx` Radix Primitive) **non-pré-cochée** — label inline : `J'ai lu et j'accepte les <Link>conditions d'utilisation</Link>.` lien interne `/${locale}/legal/cgu` (existe story 1.4 — voir messages fr.json `legal.cgu`)
  - `<button type="submit" disabled={isPending}/>` — label "Demander l'accès" / "Envoi…" pendant
- `app/[locale]/(public)/admission/loading.tsx` — **skeleton screen** (NFR40 règle Aïcha, AR21) ; pattern h1 + 4 lignes input + bouton placeholder (PAS un spinner)

**And** chaque erreur Zod du form s'affiche **inline** sous le champ, **première personne** ([Source: ux-design-specification.md:1236]), couleur `text-danger` ([[token: bg-danger]]), `aria-invalid={true}` + `aria-describedby="<field>-error"`. Le pattern complet est dans [Source: `app/[locale]/(public)/auth/login/login-form.tsx`].

**And** **toutes** les chaînes vivent dans `messages/fr.json` namespace `admission.form.*` et `errors.admission.*` ; `messages/ar.json` reçoit les MÊMES clés en chaînes vides (fallback FR via `deepMerge`).

**And** la page est achievable **≤ 30s par Aïcha** (NFR40) — pas de `useEffect` cascading, pas de validation `onChange` bruyante (Zod tourne `onSubmit` côté server-action ; l'`onBlur` reste hors-scope MVP).

---

### AC5 — Callback magic-link : marquer `email_verified_at` + redirect `/admission/pending` (FR4, FR5)

**Given** mon admission_request existe en state `pending` et je clique le magic-link reçu
**When** `/auth/confirm` ([Source: `app/auth/confirm/route.ts:21-90`]) appelle `verifyOtp` avec succès
**Then** **avant** d'appeler `resolveRedirect`, le handler :

1. Récupère mon `user.id`
2. Si une `admission_requests` row existe pour ce `user_id` avec `state='pending'` ET `email_verified_at IS NULL`, **update** `email_verified_at=now()` via le **service-role admin client** (`createAdminClient()`) — la session utilisateur SSR ne peut pas updater (policy column-grant interdit, [[review-1.3 column-level RLS]])
3. Log `'admission.email_verified'` avec `user_id` + `payload: { had_pending_request: true }` (no PII)
4. **Continue** vers `resolveRedirect` qui lira l'état pending → retourne `/${locale}/admission/pending`

**And** si **aucune** admission_request `pending` n'existe pour l'`user_id` (cas : déjà accepté, déjà rejeté, ou cas exotique post-purge cron), **aucun** update n'est tenté — `resolveRedirect` retourne la destination correcte selon le state. Cette branche reste idempotente et ne fait pas échouer le callback.

**And** un nouveau helper **`lib/auth/mark-admission-email-verified.ts`** isole ce side-effect (testabilité, séparation de `resolveRedirect`). Signature :

```ts
export async function markAdmissionEmailVerified(args: {
  userId: string;
}): Promise<{ updated: boolean }>;
```

**And** l'update **n'efface jamais** une valeur `email_verified_at` non-null (clause `is('email_verified_at', null)` dans le WHERE) — anti race-condition double-click.

---

### AC6 — Page `/[locale]/(public)/admission/pending/page.tsx` + `refused/page.tsx`

**Given** je suis redirigé vers `/${locale}/admission/pending`
**When** la page rend (Server Component)
**Then** elle affiche :

- `<PageContainer>` + h1 "Ton inscription est en file ⏳"
- p "Un voisin co-mod va valider sous **24h max**. Tu seras notifié par e-mail." ([Source: ux-design-specification.md:823], wording N5 "Async workflows avec SLA visible")
- p secondaire "Tu peux fermer cette page — on te réveille à la décision."
- **NE PAS** afficher de bouton "actualiser" automatique (l'epic dit "an 'actualiser' button" mais `polling à l'ouverture` = co-mod côté ; pour le demandeur on s'appuie sur l'e-mail de décision pour ne pas générer de bruit serveur ; **décision MVP** : un simple `<Link href="/${locale}/auth/login">` "Déjà validé ? Me connecter" suffit, plus simple, moins de charge UX)

**And** le post-acceptation pre-login flow : si je reviens manuellement sur `/${locale}/admission/pending` alors que `state='accepted'`, je suis redirigé par `resolveRedirect` (déjà câblé story 1.6) vers `/${locale}/community/`. **Décision** : on ne livre **pas** un check côté `pending/page.tsx` qui lirait l'état — `resolveRedirect` opère uniquement sur le callback magic-link, donc un demandeur déjà accepté qui rouvre la page directement (sans nouveau magic-link) verra "ton inscription est en file" momentanément. Acceptable MVP — l'epic AC mentionne "**after my request is accepted but before I login again**" : couvert par l'e-mail "Bienvenue 👋" + magic-link de story 1.8 qui re-trigger le callback.

**And** `app/[locale]/(public)/admission/refused/page.tsx` affiche un message neutre + lien `/${locale}/legal/confidentialite` ([Source: ux-design-specification.md:967 "L2 mitigation"]) — **le motif détaillé arrive dans l'e-mail Brevo envoyé par story 1.8** ; la page `refused` n'affiche **pas** le motif spécifique (pas de lookup côté SSR sans session — la page peut être hit par n'importe quel visiteur via URL directe).

---

### AC7 — Template `admission-notify-comod.fr.ts` + stub AR + extension `SendArgs` (AR16, NFR44)

**Given** la story 1.6 a livré la boundary unique `lib/email/send.ts` avec un seul template `'magic-link'`
**When** la story 1.7 est livrée
**Then** :

1. **`lib/email/templates/admission-notify-comod.fr.ts`** exporte `magicLinkNotifyComod(vars)` qui retourne `RenderedTemplate` :
   - `subject` : "Nouvelle demande d'admission — villa {villa} ({tranche})"
   - `textContent` : multiline FR, pattern story 1.6 (zéro tracking pixel, zéro image)
   - `htmlContent` : minimal HTML (mêmes contraintes que `magic-link.fr.ts` — `<a href="${escapeHtml(queue_url)}">` lien vers la queue co-mod ; **prochaine étape co-mod** : story 1.8)
   - Vars : `{ villa: number; tranche: string; first_name: string; queue_url: string }`
   - **`first_name`** inclus dans le HTML/text — exception au logging PII (un co-mod a légitimement besoin de voir le prénom pour décider) ; **MAIS** `first_name` **ne doit jamais** apparaître dans les logs `send.ts` (déjà strippé par `lib/logger.ts:18-30`)
2. **`lib/email/templates/admission-notify-comod.ar.ts`** : stub re-export FR + commentaire `// TODO V1.5 — traduire en AR` (cohérent story 1.6 T4 pattern)
3. **`lib/email/send.ts`** étend le type `SendArgs` :

```ts
export type SendArgs =
  | { template: 'magic-link'; to: string; locale: 'fr' | 'ar'; vars: MagicLinkVars }
  | {
      template: 'admission-notify-comod';
      to: string;
      locale: 'fr' | 'ar';
      vars: AdmissionNotifyVars;
    };
```

et `renderTemplate(args)` switch exhaustif (le `case 'magic-link'` reste, ajouter `case 'admission-notify-comod'`).

**And** le test de **parité shape FR/AR** ([Source: 1.6 `tests/email/templates.test.ts`]) est étendu pour valider le nouveau template (`subject/htmlContent/textContent` non-empty FR ; structure identique côté AR).

**And** le `htmlContent` du template co-mod sanitize **toutes** les valeurs dynamiques via la même fonction `escapeHtml` (export utilitaire vers `lib/email/templates/escape-html.ts` ou duplication acceptée — la review 1.6 dismiss #821 indique que duplication shape FR/AR est OK ; on suit la même logique).

---

### AC8 — i18n FR namespaces + stubs AR (NFR44, leçon story 1.5 deepMerge)

**Given** les pages 1.7 livrent un nouveau périmètre i18n
**When** la story 1.7 est livrée
**Then** `messages/fr.json` ajoute le namespace :

```
admission.form.{pageTitle, intro, villaLabel, villaPlaceholder, trancheLabel, trancheOptionA-E,
                firstNameLabel, firstNamePlaceholder, emailLabel, emailPlaceholder,
                cguLabel, cguLinkText, submit, submitting, alreadyAccessHint, alreadyAccessCta}
admission.pending.{pageTitle, body, alreadyValidatedCta}
admission.refused.{pageTitle, body, learnMoreLink}
errors.admission.{villa_out_of_range, tranche_invalid, first_name_required, email_invalid,
                  cgu_required, duplicate_pending}
```

**And** `messages/ar.json` reçoit les MÊMES clés en `""` — fallback FR via `deepMerge` ([Source: `lib/i18n/request.ts:5-27`]).

**And** **aucune** chaîne hardcodée dans les composants — `useTranslations()` partout ([Source: ux-design-specification.md:1236]).

---

### AC9 — Tests Vitest (AR23 testing)

**Given** la story 1.7 est implémentée
**When** je lance `pnpm test`
**Then** :

- `tests/validation/admission.test.ts` — `zSubmitAdmissionForm` couvre 5 cas valides + 5 invalides + assert que les `message_key` retournés sont parmi la liste blanche `errors.admission.*`
- `tests/admission/submit-action.test.ts` — minimum **6 cas** :
  1. **Valid input** → admin.createUser called, admission_requests insert called avec strictly les colonnes autorisées, magic-link generated + sent, N co-mods notified, `Result.ok`
  2. **Invalid villa (151)** → `Result.error({ fieldErrors: { villa: ['errors.admission.villa_out_of_range'] } })`, **aucun** appel admin.createUser/Brevo
  3. **CGU non-cochée** → `Result.error({ fieldErrors: { cgu_accepted: ['errors.admission.cgu_required'] } })`
  4. **Duplicate pending** → `Result.error({ code: 'duplicate_pending' })`, **aucun** magic-link envoyé
  5. **Co-mod notify Brevo fail** → la Server Action retourne `Result.ok` (le demandeur a son magic-link), event `admission.comod_notify_failed` loggé, **pas** de throw
  6. **PII logging** — assert que `lib/logger.ts.log` jamais appelé avec `email/first_name/full_name` dans `payload` (réutilise le pattern `tests/email/send.test.ts:asserts no PII`)
- `tests/admission/mark-admission-email-verified.test.ts` — helper isolé :
  1. Pending + email_verified_at null → update called, `{ updated: true }`
  2. Pending + email_verified_at déjà set → update **non-called** (clause WHERE), `{ updated: false }`
  3. Accepted (state ≠ pending) → update **non-called**, `{ updated: false }`
  4. Pas de row → `{ updated: false }`, **aucune** erreur
- `tests/email/templates.test.ts` — étendu : parité shape `admission-notify-comod.fr/ar`, escape HTML sur `villa/tranche/first_name/queue_url`
- `tests/email/send.test.ts` — au moins 1 cas couvrant `template: 'admission-notify-comod'` (succès), assert que `first_name` **n'est pas** loggé même si présent dans `vars`
- `tests/auth/redirect-by-state.test.ts` — étendu : 1 cas test que le `next` param `/${locale}/admission/pending` (avec slash) est **honoré** par `isSafeAdmissionNext` (déjà vert d'après story 1.6 — confirmer)

**And** `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` verts.

**And** **pas de tests E2E Playwright 1.7** — la chaîne admin.createUser + Brevo + auth.confirm nécessite tunnel HTTPS + e-mail réel ; validation manuelle T17 cf. AC10.

---

### AC10 — Validation manuelle end-to-end (toutes ACs)

**Given** la story 1.7 est implémentée
**When** je déploie sur preview Vercel + tunnel HTTPS
**Then** :

- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` verts
- **Flow complet manuel** (avec adresse e-mail réelle Gmail + 1 e-mail co-mod test) :
  1. Ouvrir `/fr/admission` → form rend, skeleton `loading.tsx` visible au refresh
  2. Soumettre **sans cocher CGU** → erreur inline "Tu dois accepter les conditions d'utilisation"
  3. Soumettre villa=200 → erreur inline "Ce numéro de villa n'existe pas dans la résidence"
  4. Soumettre valide → redirect `/fr/auth/check-email`
  5. Recevoir e-mail magic-link (mêmes assertions délivrabilité story 1.6)
  6. Recevoir e-mail co-mod "Nouvelle demande d'admission — villa X (Y)" sur les adresses listées dans `INITIAL_COMOD_EMAILS`
  7. Cliquer le magic-link → callback → redirect `/fr/admission/pending` → page rend "Ton inscription est en file ⏳"
  8. Vérifier en SQL via Supabase Studio : ligne `admission_requests` avec `state='pending'`, `email_verified_at NOT NULL`, `created_at NOT NULL`
  9. Re-soumettre `/fr/admission` avec **même e-mail** → erreur inline `errors.admission.duplicate_pending`
  10. Re-cliquer le **même** magic-link (déjà utilisé) → redirect `/fr/auth/error?reason=used` (déjà testé story 1.6, confirmer non-regressed)
- **Test "back from `/admission/pending` accepted state"** : modifier manuellement `state='accepted'` dans Supabase Studio, re-cliquer un nouveau magic-link → redirect `/fr/community/` (déjà testé story 1.6 redirect-by-state ; confirmer)
- **Bench Aïcha NFR40** : remplir le form en chrono ≤ 30s avec un utilisateur proxy (Stephane ou tiers naïf) — documenter le temps réel dans `Completion Notes List`

---

## Tasks / Subtasks

> **Convention** : cocher chaque sous-tâche en cours d'implémentation. **Tester en mode prod** (`pnpm build && pnpm start`) avant AC5/AC10 — le callback Supabase et les cookies session diffèrent en dev Turbopack.

- [x] **T1 — Migration `add_admission_email_verified_at`** (AC1)
  - [x] `supabase/migrations/2026061500XXXX_add_admission_email_verified_at.sql` : `alter table public.admission_requests add column email_verified_at timestamptz null;`
  - [x] Ajouter `email_verified_at` au `grant update` existant (story 1.3 line 173) : `grant update (state, decision_reason, decided_by, decided_at, updated_at, email_verified_at, deleted_at, deleted_by, deletion_reason) on public.admission_requests to authenticated;`
  - [x] Vérifier qu'`email_verified_at` reste **hors** du `grant insert (user_id, residence_id, villa, tranche, first_name, contact_channel)` (immutable au INSERT, set seulement via callback service-role)
  - [x] `pnpm supabase db reset` local → migration s'applique sans erreur
  - [x] `pnpm run gen:types` → diff `lib/supabase/types.generated.ts` commité

- [x] **T2 — `lib/validation/admission.ts`** (AC2)
  - [x] Exports `zTranche`, `zFirstName`, `zSubmitAdmissionForm`, type `SubmitAdmissionForm`
  - [x] `zSubmitAdmissionForm.shape.villa` réutilise `zVillaNumber` (`lib/validation/villa-number.ts`)
  - [x] `cgu_accepted: z.literal(true, { message: 'errors.admission.cgu_required' })`
  - [x] `tests/validation/admission.test.ts` (10 cas)

- [x] **T3 — Templates e-mail `admission-notify-comod.{fr,ar}.ts` + extension `lib/email/send.ts`** (AC7)
  - [x] `lib/email/templates/admission-notify-comod.fr.ts` exports `magicLinkNotifyComodTemplate(vars: AdmissionNotifyVars): RenderedTemplate`
  - [x] Pattern strict cohérent avec `magic-link.fr.ts` : `<!doctype html><html lang="fr">`, system fonts, zéro image/tracking
  - [x] `escapeHtml()` sur tous les `vars.*` (villa, tranche, first_name, queue_url)
  - [x] `lib/email/templates/admission-notify-comod.ar.ts` : re-export FR + TODO V1.5
  - [x] Étendre `SendArgs` discriminated union dans `lib/email/send.ts` ; `switch (args.template)` exhaustif (TypeScript exhaustiveness check)
  - [x] `tests/email/templates.test.ts` parité shape étendue
  - [x] `tests/email/send.test.ts` cas `'admission-notify-comod'` (assert aucun PII dans le payload logger)

- [x] **T4 — Server Action `app/actions/admission-submit.ts`** (AC3)
  - [x] `'use server';` directive
  - [x] Signature `useActionState`-compatible : `(previous: SubmitState, formData: FormData) => Promise<SubmitState>` où `SubmitState = { ok: boolean; fieldErrors?: Record<string, string[]>; errorCode?: 'duplicate_pending' }`
  - [x] Étape 1 — Parse `FormData` : `villa=Number(formData.get('villa'))`, `tranche=String(...)`, `first_name=String(...).trim()`, `email=String(...).trim()`, `cgu_accepted=formData.get('cgu_accepted')==='on' || formData.get('cgu_accepted')==='true'`
  - [x] Étape 2 — `zSubmitAdmissionForm.safeParse(...)` → en cas d'erreur : `Result.error` avec mapping vers les `errors.admission.*` keys
  - [x] Étape 3 — `createAdminClient()`, `headers()` → `detectLocaleFromHeaders` ([Source: `lib/i18n/detect-locale.ts:59-77`])
  - [x] Étape 4 — `admin.createUser({ email, email_confirm: false })` → if 422 `email_exists` → fallback lookup (`admin.listUsers({ page: 1, perPage: 1, filter: ... })` n'est pas officiel — utiliser à la place `admin.generateLink({ type: 'magiclink', email })` qui retourne `data.user` même si l'utilisateur existait)
  - [x] Étape 5 — Vérifier `admission_requests` `pending` existant pour `user_id` → si oui, return `Result.error({ errorCode: 'duplicate_pending' })`
  - [x] Étape 6 — `INSERT INTO admission_requests` (admin client) **strictement** `{ user_id, residence_id, villa, tranche, first_name, contact_channel: 'email' }`
  - [x] Étape 7 — `sendTransactionalEmail({ template: 'magic-link', to: email, locale, vars: { link: action_link, expiresInMinutes: 15 } })`
  - [x] Étape 8 — Pour chaque `comod_email` dans `env.server.INITIAL_COMOD_EMAILS` : `sendTransactionalEmail({ template: 'admission-notify-comod', to: comod_email, locale: 'fr', vars: { villa, tranche, first_name, queue_url } })` — `try/catch` chaque envoi, jamais bloquant
  - [x] Étape 9 — `log({ event: 'admission.requested', user_id: data.user.id, payload: { villa, tranche, locale, has_email_verified_at: false } })` (PII strippée par `lib/logger.ts`)
  - [x] Étape 10 — `return { ok: true }` (le form Client component appellera `router.push('/${locale}/auth/check-email')` post-success — pattern `useActionState` + `useEffect`)
  - [x] **Pas de** `redirect()` dans la Server Action — l'action retourne le résultat ; le form gère le navigateur côté Client (évite la mécanique `redirect()` qui interrompt l'`useActionState` et empêche d'afficher `duplicate_pending` au form)

- [x] **T5 — Pages `app/[locale]/(public)/admission/{page.tsx, admission-form.tsx, loading.tsx, pending/page.tsx, refused/page.tsx}`** (AC4, AC6)
  - [x] `page.tsx` (Server Component) : `assertLocale`, `setRequestLocale`, `getTranslations('admission.form')`, `<PageContainer as="main">` + h1 + `<AdmissionForm/>` (Client)
  - [x] `admission-form.tsx` (Client Component, `'use client'`) :
    - `useActionState(submitAdmissionRequest, INITIAL_STATE)` + `useTransition` (React 19)
    - `useEffect` qui watch `state.ok === true` → `router.push('/${locale}/auth/check-email')` (pattern POST-Redirect-Get)
    - `useEffect` qui watch `state.errorCode === 'duplicate_pending'` → afficher un message global "Une demande est déjà en cours pour cet e-mail." (pas un fieldError, un toast/banner)
    - Champs : villa (number), tranche (select), first_name (text), email (email), cgu_accepted (Radix Checkbox `<Checkbox>` ; `name="cgu_accepted"` posera `'on'` au FormData seulement si checked)
    - Bouton submit `disabled={isPending}`
    - Tokens v2 stricts : `bg-bg-page`, `bg-bg-card`, `bg-accent-500`, `text-danger`, `min-h-touch` (≥48px tactile, NFR36-39)
    - **`autoComplete`/`inputMode`/`spellCheck`** comme dans `login-form.tsx`
  - [x] `loading.tsx` (skeleton) : h1 placeholder + 4× `<div className="h-12 bg-bg-soft animate-pulse rounded-[14px]"/>` + bouton placeholder
  - [x] `pending/page.tsx` (Server Component) : `setRequestLocale`, `getTranslations('admission.pending')`, `<PageContainer>` + h1 + body + lien `/auth/login`
  - [x] `refused/page.tsx` (Server Component) : pattern analogue, lien `/${locale}/legal/confidentialite`

- [x] **T6 — Hook callback `lib/auth/mark-admission-email-verified.ts`** (AC5)
  - [x] Export `markAdmissionEmailVerified({ userId }): Promise<{ updated: boolean }>`
  - [x] Utilise `createAdminClient()`
  - [x] `update admission_requests set email_verified_at = now() where user_id = ? and state = 'pending' and email_verified_at is null and deleted_at is null returning id`
  - [x] Si la requête retourne ≥ 1 row → `{ updated: true }` ; sinon `{ updated: false }`
  - [x] Log structuré `admission.email_verified` (sans PII)
  - [x] **Catch + log silencieux** sur erreur Supabase — le callback magic-link ne doit jamais 500 à cause de cette étape opportuniste (cohérent avec `resolveRedirect` review 1.6)
  - [x] `tests/admission/mark-admission-email-verified.test.ts` (4 cas)

- [x] **T7 — Intégrer `markAdmissionEmailVerified` dans `/auth/confirm`** (AC5)
  - [x] Modifier `app/auth/confirm/route.ts` ligne après `log auth.callback_verified` (juste avant `resolveRedirect`) : `await markAdmissionEmailVerified({ userId: user.id });`
  - [x] **NE PAS** échouer le callback si l'helper throw (déjà géré par try/catch interne T6)
  - [x] **NE PAS** ajouter de logique role-based ici — le hook est idempotent

- [x] **T8 — i18n FR + stubs AR** (AC8)
  - [x] Étendre `messages/fr.json` : ajouter `admission.{form,pending,refused}.*` et `errors.admission.*` (cf. AC8 liste complète)
  - [x] Étendre `messages/ar.json` : mêmes clés en `""` — fallback FR via `deepMerge`
  - [x] Wording **first-person**, ≤ 12 mots par chaîne en moyenne, **pas infantilisant** ([Source: ux-design-specification.md:802, 1236])
  - [x] Exemples :
    - `admission.form.pageTitle`: "Demander l'accès à Darna"
    - `admission.form.intro`: "Une fois validé par un voisin co-mod, tu pourras consulter l'annuaire, le guide et les alertes."
    - `admission.form.cguLabel`: "J'ai lu et j'accepte les"
    - `admission.form.cguLinkText`: "conditions d'utilisation"
    - `errors.admission.villa_out_of_range`: "Ce numéro de villa n'existe pas dans la résidence (1 à 150)."
    - `errors.admission.cgu_required`: "Tu dois accepter les conditions d'utilisation pour continuer."
    - `errors.admission.duplicate_pending`: "Une demande pour cet e-mail est déjà en file d'attente. Vérifie ta boîte mail."
    - `admission.pending.pageTitle`: "Ton inscription est en file ⏳"
    - `admission.pending.body`: "Un voisin co-mod va valider sous 24h max. On te prévient par e-mail."

- [x] **T9 — Tests Vitest** (AC9)
  - [x] Voir liste détaillée AC9 — tous les fichiers cités
  - [x] **Mocks à recycler** : `vi.mock('@supabase/ssr')` + `vi.mock('@/lib/supabase/admin')` patterns story 1.6 ([Source: `tests/auth/signin-action.test.ts`])
  - [x] **`// @vitest-environment node`** sur tous les tests qui importent `lib/env.ts` (leçon story 1.6 — env JSdom déclenche client path)

- [x] **T10 — Validation end-to-end manuelle** (AC10)
  - [x] Suivre la checklist AC10 ; documenter le temps Aïcha dans `Completion Notes List`
  - [x] Capturer un screenshot du form avant/après erreur CGU + screenshot e-mail co-mod reçu (pour Stephane review)

---

## Dev Notes

### Architecture compliance — règles non-négociables

[Source: architecture.md#Implementation-Patterns-Consistency-Rules]

1. **AR16 — Boundary unique e-mail** [Source: architecture.md:200, `lib/email/send.ts:7`] :
   - **TOUT** envoi e-mail (magic-link demandeur + notify co-mod) passe par `sendTransactionalEmail`
   - **Étendre** la discriminated union `SendArgs` (T3) — **NE PAS** créer un second module qui appelle `brevoSendEmail` directement
   - Le script ops `scripts/budget-alert.ts:91-107` reste **hors** de cette boundary (exception documentée 1.6)

2. **AR17 — Zod aux 3 frontières** [Source: architecture.md:1-3 patterns, 549] :
   - Entrée Server Action : `zSubmitAdmissionForm.safeParse(formData)`
   - Insertion DB : on n'insère **que** les colonnes validées Zod + colonnes système (`user_id`, `residence_id`, `contact_channel`) — pas de spread `...formData`
   - Sortie email : pas de Zod sur le RenderedTemplate (les valeurs sont contrôlées par notre code)
   - **`message_key` jamais hardcoded** : toutes les erreurs Zod portent une clé i18n `errors.admission.*`

3. **AR18 — `Result<T>` discriminated union** [Source: architecture.md:494-502] :
   - La Server Action `submitAdmissionRequest` retourne `Result<{}>` étendu : `{ ok: true } | { ok: false, fieldErrors? } | { ok: false, errorCode: 'duplicate_pending' }`
   - **NE PAS** `throw` pour des erreurs métier attendues (validation, duplicate, CGU manquante) → return Result.error
   - Throw uniquement si Brevo est down ET le magic-link demandeur **n'est pas** parti (cas catastrophique → user voit `/auth/check-email` mais ne recevra rien — accepter MVP, monitor via Sentry `level: 'error'`)

4. **AR19 — Logger sans PII** [Source: `lib/logger.ts:18-30`, architecture.md:203] :
   - **JAMAIS** loguer `email`, `first_name`, `last_name`, `full_name`, `phone`
   - **OK** de loguer : `user_id` (UUID), `villa` (int), `tranche` (enum), `locale` (enum), `errorCode` (enum)
   - Le `stripPIIDeep` ([Source: `lib/logger.ts:32-45`]) est **récursif** depuis review 1.6 — mais ne **pas** s'y reposer aveuglément, le double-belt est exigé

5. **AR21 — Skeleton screens, jamais spinner** [Source: architecture.md:331, ux-design-specification.md:94] :
   - `loading.tsx` skeleton à `app/[locale]/(public)/admission/` racine ([Source: pattern `app/[locale]/(public)/loading.tsx:1-15`])
   - **Aucun** `<Spinner/>` standalone dans l'arborescence story 1.7

6. **AR3 — Clés Supabase nouvelles** [Source: architecture.md:140, `lib/env.ts:5-10`] :
   - `SUPABASE_SECRET_KEY` server-only ; importé via `env.server.SUPABASE_SECRET_KEY` jamais `process.env`
   - `createAdminClient()` est la seule porte (story 1.6)

7. **AR22 — Tailwind logical properties RTL** [Source: `eslint.config.mjs:12-16`] :
   - `me-*`, `ms-*`, `ps-*`, `pe-*` — **jamais** `mr-*`/`ml-*`
   - Pré-commit hook Husky bloquera sinon (story 1.1)

8. **AR23 — Strict TypeScript + tests verts** [Source: architecture.md:425-426, story 1.6 T17] :
   - `pnpm typecheck` zéro erreur, zéro `any` sans `// reason:`
   - `pnpm test` doit passer **AVANT** le PR

9. **AR31 — Rate limiting** [Source: architecture.md:1459, deferred-work story-1.6 entry] :
   - **HORS-SCOPE 1.7** — déféré à story 1.10 (Upstash 5/jour/IP sur `POST /admission/submit`)
   - **NE PAS** commencer à câbler Upstash ici (scope-bleed leçon story 1.5)

10. **AR15 — Composition par feature** [Source: architecture.md:311] :
    - **Variance** : architecture.md:808 place `admission/` sous `app/(community)/` mais story 1.7 le place sous `app/[locale]/(public)/` — voir Project Structure Notes

11. **AR37 — Polling à l'ouverture, pas WebSocket** [Source: architecture.md:314] :
    - La page `/admission/pending` **n'a pas** de polling (charge inutile MVP — l'user est notifié par e-mail à la décision story 1.8)
    - Le polling co-mod côté `/comod/admission` est story 1.8

12. **Règle Aïcha NFR40** [Source: epics.md:344, ux-design-specification.md:1074] :
    - ≤ 30 secondes du tap "Demander l'accès" au tap "Soumettre"
    - Bench documenté dans `Completion Notes List` T10
    - Champs minimaux (4 + 1 checkbox), placeholders informatifs, pas de wizard multi-étapes

13. **Décision MVP FR-only** [[project_darna_mvp_fr_only]] :
    - Templates AR = stubs (re-export FR + TODO comment)
    - `messages/ar.json` clés vides → fallback FR via `deepMerge`
    - **NE PAS** commencer à traduire en AR — V1.5

14. **Mitigation L4 — CGU non-pré-cochée** [Source: ux-design-specification.md:838, 967] :
    - Le checkbox `cgu_accepted` rend `defaultChecked={false}` ; le `<CheckboxPrimitive.Root>` Radix l'enforce nativement
    - Zod `z.literal(true, {message: 'errors.admission.cgu_required'})` — toute autre valeur (false, undefined) → erreur
    - **Acceptance légale** : sans la cocher, **pas d'INSERT** dans `admission_requests`

15. **Boundaries column-level RLS** [Source: `supabase/migrations/20260524005600_init_rls.sql:158-175`] :
    - INSERT : authentifié peut écrire seulement `(user_id, residence_id, villa, tranche, first_name, contact_channel)` — le service-role bypass MAIS notre Server Action n'insère **que** ces colonnes (double-belt)
    - UPDATE : authentifié peut écrire `(state, decision_reason, decided_by, decided_at, updated_at, deleted_at, deleted_by, deletion_reason)` — story 1.7 ajoute `email_verified_at` à cette liste (T1)
    - **Pas** de policy DELETE — soft-delete uniquement

### Project Structure Notes — variance avec architecture.md

[Source: architecture.md#Complete-Project-Directory-Structure:808-816]

```
SmartResidence/
├── app/
│   ├── actions/
│   │   └── admission-submit.ts                        # NEW — Server Action submitAdmissionRequest
│   ├── auth/
│   │   └── confirm/
│   │       └── route.ts                                # MODIFIED — call markAdmissionEmailVerified
│   └── [locale]/
│       └── (public)/
│           └── admission/                              # NEW (variance vs architecture.md)
│               ├── page.tsx                            # NEW — Server Component
│               ├── admission-form.tsx                  # NEW — Client Component
│               ├── loading.tsx                         # NEW — skeleton
│               ├── pending/
│               │   └── page.tsx                        # NEW
│               └── refused/
│                   └── page.tsx                        # NEW
├── lib/
│   ├── auth/
│   │   └── mark-admission-email-verified.ts            # NEW
│   ├── email/
│   │   ├── send.ts                                     # MODIFIED — extend SendArgs union
│   │   └── templates/
│   │       ├── admission-notify-comod.fr.ts            # NEW
│   │       └── admission-notify-comod.ar.ts            # NEW — stub V1.5
│   └── validation/
│       └── admission.ts                                # NEW — zSubmitAdmissionForm
├── messages/
│   ├── fr.json                                         # MODIFIED — admission.* + errors.admission.*
│   └── ar.json                                         # MODIFIED — stubs admission.*
├── supabase/
│   └── migrations/
│       └── 2026061500XXXX_add_admission_email_verified_at.sql   # NEW
└── tests/
    ├── admission/
    │   ├── submit-action.test.ts                       # NEW — 6 cas
    │   └── mark-admission-email-verified.test.ts       # NEW — 4 cas
    ├── validation/
    │   └── admission.test.ts                           # NEW — 10 cas
    ├── email/
    │   ├── send.test.ts                                # MODIFIED — +1 cas notify-comod
    │   └── templates.test.ts                           # MODIFIED — parité notify-comod
    └── auth/
        └── redirect-by-state.test.ts                   # MODIFIED — +1 cas next=/admission/pending
```

**Variance avec architecture.md** — **2 variances**, **1 alignment** :

**Variance V1 — `admission/` sous `[locale]/(public)/` au lieu de `(community)/`**

- **Justification** : le proxy ([Source: `proxy.ts:14-25`]) protège **uniquement** les paths matching `COMMUNITY_PATTERN = /^\/(?:(?:fr|ar)\/)?(?:community|annuaire|artisan|alertes|guide|profil)(?:\/|$)/` — `admission` **n'y est pas**. La story 1.6 (`resolveRedirect`) redirige les utilisateurs **non-authentifiés** vers `/${locale}/admission` (cas "no record"), ce qui est **incompatible** avec un placement sous un route group exigeant l'auth.
- **Conséquence** : `admission/page.tsx` est servi à des visiteurs anonymes (objectif explicite du Journey 3 PRD). `admission/pending/page.tsx` peut être hit par un user authentifié OU anonyme (depuis URL) — c'est **OK** car il n'expose **aucun** PII (texte statique).
- **Documentation** : ajouter un commentaire dans `app/[locale]/(public)/admission/page.tsx` : `// NOTE — route publique (visiteur anonyme déposant sa demande). Variance avec architecture.md:808 ; voir story 1.7 AC4.`

**Variance V2 — Server Action sous `app/actions/` au lieu de `app/(community)/admission/actions.ts`**

- **Justification** : story 1.6 a établi le pattern `app/actions/auth-signin.ts` pour les Server Actions à scope public (visiteurs non-authentifiés). On suit ce pattern : `app/actions/admission-submit.ts`. Architecture.md:811 propose `app/(community)/admission/actions.ts` mais c'est cohérent avec le placement sous `(community)` — qui ne tient pas pour cette story (V1).
- **Conséquence** : pas d'impact runtime. Le pattern `app/actions/<feature>.ts` reste utilisable pour les Server Actions co-localisées feature (V3 multi-tenant en epic 9).

**Alignment** : structure `lib/email/templates/`, `lib/auth/`, `lib/validation/`, `messages/`, `tests/<feature>/` est strictement alignée avec architecture.md:888-1009.

### Versions verrouillées (vérifiées mai 2026 — ne pas dévier sans ADR)

[Source: architecture.md#Versions-vérifiées, package.json]

- **Next 16** (App Router, Server Actions, Route Handlers)
- **React 19** (`useActionState`, `useTransition`)
- **@supabase/ssr `latest`** + **@supabase/supabase-js `latest`** (épinglés via pnpm-lock ; risque deferred 1.10)
- **next-intl 4.12**
- **Zod 4.x** (validation)
- **Radix UI** : `@radix-ui/react-checkbox` ^1.3.1 (déjà installé story 1.4) — **PAS** d'ajout de `@radix-ui/react-select` (utiliser `<select>` natif)
- **PAS de SDK Brevo** — fetch direct via `lib/email/client.ts` (story 1.6)
- **PAS de Upstash dans 1.7** — déféré à 1.10

### Patterns de code à réutiliser depuis 1.1-1.6

- **`lib/env.ts`** (1.1) : `env.server.*` / `env.client.*` accessor — **JAMAIS** `process.env.X!`
- **`lib/logger.ts`** (1.2 + review 1.6) : `log({event, user_id, payload})` avec `stripPIIDeep` récursif
- **`lib/supabase/admin.ts`** (1.6) : `createAdminClient()` pour les writes admin (insert admission_requests, generateLink)
- **`lib/supabase/server.ts`** (1.1) : `createClient()` pour les reads side-session (pas utilisé en 1.7, mais ne pas le supprimer côté `/auth/confirm`)
- **`lib/validation/{email,villa-number}.ts`** (1.1) : `zEmail`, `zVillaNumber` réutilisables
- **`lib/email/send.ts`** (1.6) : pattern d'extension de la discriminated union
- **`lib/email/templates/magic-link.fr.ts`** (1.6) : pattern HTML minimal + escapeHtml + zéro tracking
- **`lib/auth/redirect-by-state.ts`** (1.6) : `isSafeAdmissionNext` valide `/admission` et `/admission/*` — préfixe `pending`/`refused` couvert nativement
- **`lib/i18n/detect-locale.ts`** (1.6) : `detectLocaleFromHeaders(cookie, accept-language)` pour Server Actions
- **`<PageContainer>`** (1.4) : wrapper toutes pages publiques
- **`<Checkbox>` Radix** (1.4) : pour `cgu_accepted`
- **`useTranslations('admission.form')`** (next-intl 4)
- **Tokens v2** : `bg-bg-page #FBFAF6`, `bg-bg-card`, `bg-bg-soft`, `bg-accent-500 #5B9C66`, `bg-warning`, `text-neutral-700`, `text-danger #D45B4A`
- **Inter Variable** (1.4) hérité
- **Pattern login-form.tsx** (1.6) : `useActionState` + Client Component form + tokens v2 + ARIA `aria-invalid`/`aria-describedby` + autoComplete/inputMode

### Latest Tech Information (juin 2026)

**Supabase `admin.createUser` + race avec `handle_new_auth_user`** :

- `admin.createUser({ email, email_confirm: false })` crée la ligne `auth.users` → trigger `trg_auth_users_after_insert` ([Source: `supabase/migrations/20260524005559_init_schema.sql:186-189`]) → `handle_new_auth_user()` INSERT `public.users` + `public.notifications_prefs` **synchrone** (même transaction)
- L'INSERT `admission_requests` qui suit dans la Server Action **voit** la `public.users` row (cohérence transactionnelle Postgres)
- **`email_confirm: false`** est crucial : sinon Supabase confirme l'e-mail automatiquement et **shortcut** notre flow magic-link
- **Si l'e-mail existe déjà** : `admin.createUser` retourne `{ error: { message: 'A user with this email address has already been registered', status: 422, code: 'email_exists' } }` selon la doc Supabase mai 2026. **Pattern de fallback retenu** :
  - **NE PAS** dépendre de `admin.listUsers({ filter: ... })` — le filter syntax officiel pour email n'est pas documenté stable
  - À la place : `admin.generateLink({ type: 'magiclink', email })` retourne `data.user` (existant ou créé) — c'est notre porte d'entrée fiable.
  - Étape pratique : `(1)` appeler `admin.generateLink({ type: 'magiclink', email, options: { redirectTo } })` **avant** `createUser` ; si l'utilisateur n'existe pas, Supabase **le crée automatiquement** en mode "signup via magic-link" (selon dashboard config : Auth → "Allow new users to sign up" = ON, à vérifier). Si la config est OFF → utiliser `admin.createUser` + `admin.generateLink({type:'magiclink'})` en deux étapes.
  - **Décision dev** : commencer par tenter `admin.generateLink` puis dériver. **Tester en sandbox Supabase préview Vercel** avant d'industrialiser.

**Supabase `admin.generateLink({ type: 'magiclink' })`** :

- Retourne `{ data: { user, properties: { action_link, hashed_token, ... } } }`
- `action_link` est l'URL complète à envoyer dans l'e-mail (story 1.6 le passe à `sendTransactionalEmail`)
- **`redirectTo`** ne peut pas être surchargé par le user — Supabase enforce la liste blanche configurée dashboard (`Site URL` + `Additional Redirect URLs`)
- **À vérifier dashboard** : `${NEXT_PUBLIC_SITE_URL}/auth/confirm?next=/fr/admission/pending` doit être whitelisté (story 1.6 a configuré `/auth/confirm?next=/fr/admission` ; étendre à `/admission/pending`)

**Brevo Transactional API — co-mod notify** :

- Endpoint identique story 1.6 (`POST https://api.brevo.com/v3/smtp/email`)
- Free tier 300/jour → 1 admission = 1 magic-link + 3-4 notify co-mod = 4-5 envois → 60 admissions/jour max théorique → OK MVP (50 villas attendus en bêta)
- **Limite** : Brevo recommande **≤ 100 destinataires dans `to[]`** par appel. Pour `INITIAL_COMOD_EMAILS` (3-4 max), **un appel par co-mod** est plus simple (logging séparé, échec isolé).

**Supabase RLS et service-role** :

- Le service-role bypasse **toutes** les policies RLS et **tous** les `revoke insert/update column-level`. C'est intentionnel — c'est pour ça qu'on l'utilise pour la Server Action 1.7.
- **Discipline** : la Server Action **doit** insérer **strictement** les colonnes que la policy authenticated autoriserait (`user_id, residence_id, villa, tranche, first_name, contact_channel`). Cette discipline est notre "anti-self-bypass" : si demain on switch vers session demandeur (post 1.10 hardening), le code marche tel quel.

**Patterns React 19 `useActionState` + redirection conditionnelle** :

- `useActionState` ne supporte **pas** `redirect()` côté Server Action lorsqu'on veut **aussi** retourner un state au form (cas duplicate_pending). Pattern retenu :
  - Server Action retourne `{ ok: true }` ou `{ ok: false, ... }`
  - Client Component watch `state.ok === true` via `useEffect` → `router.push('/check-email')`
  - Si `state.errorCode === 'duplicate_pending'` → afficher un banner inline (pas un fieldError sous l'input email — c'est une erreur business, pas une erreur de validation)

### Previous Story Intelligence

**Story 1.1 (done)** — livré :

- `lib/env.ts` Zod fail-fast — `INITIAL_COMOD_EMAILS` déjà défini, parsé en array
- `lib/validation/{email,villa-number}.ts` — réutilisables

**Story 1.2 (done)** — livré :

- `lib/logger.ts` (étendu review 1.6 : stripPII récursif + circular safe)
- Pattern fetch direct Brevo dans `scripts/budget-alert.ts` — réutilisé dans `lib/email/client.ts` story 1.6

**Story 1.3 (done)** — livré + **CRITIQUE pour 1.7** :

- `public.admission_requests` table avec **column-level grants** :
  - INSERT autorisé : `(user_id, residence_id, villa, tranche, first_name, contact_channel)`
  - UPDATE autorisé : `(state, decision_reason, decided_by, decided_at, updated_at, deleted_at, deleted_by, deletion_reason)`
- `handle_new_auth_user()` trigger auto-provisionne `public.users role='demandeur'` + `notifications_prefs` au INSERT `auth.users` (idempotent ON CONFLICT)
- **Constante UUID résidence** : `'00000000-0000-0000-0000-000000000001'` ([Source: schema.sql:157])
- **Pas de** colonne `email_verified_at` (story 1.7 l'ajoute en T1)
- ENUM `admission_decision_reason` : `villa_out_of_range`, `duplicate`, `incomplete_info`, `manual_review_needed` — **réutilisés** côté story 1.8 motif rejet, mais en 1.7 on **partage** la clé `villa_out_of_range` comme `errors.admission.villa_out_of_range` (cohérence sémantique)
- ENUM `admission_contact_channel` : `email`/`sms` — MVP utilise `'email'`

**Story 1.4 (done)** — livré :

- `<PageContainer>` (max-w-2xl), `proxy.ts` racine fusionné locale + auth
- next-intl 4 câblé (`useTranslations`, `setRequestLocale`)
- Pattern `app/[locale]/(public)/error.tsx` + `loading.tsx` au niveau racine du group public
- Primitives `components/ui/{button,input,card,checkbox,label,badge,dropdown-menu}.tsx` — `<Checkbox>` Radix prêt
- **Pas de** `<select>` primitive — utilisation `<select>` natif acceptable MVP

**Story 1.5 (done, revue 2026-06-14)** — livré + leçons :

- **Fix `deepMerge` `lib/i18n/request.ts`** : empty AR strings → fallback FR (CRITIQUE pour `messages/ar.json` 1.7 stubs)
- Pattern Vitest mock `next-intl/server.getTranslations` ([Source: `tests/install/install-page.test.tsx`])
- `loading.tsx` skeleton pattern Aïcha

**Story 1.6 (done, revue 2026-06-15)** — livré + leçons + 22 patches review :

- `lib/email/{client,send}.ts` boundary unique AR16 — **extensible** via discriminated union
- `lib/auth/redirect-by-state.ts` avec `isSafeAdmissionNext` strict (rejette `\r\n`, `//`, `/admissionEVIL`)
- `lib/i18n/detect-locale.ts` avec parser RFC 7231 Accept-Language
- `lib/supabase/admin.ts` — `createAdminClient()`
- Pages auth `/fr/auth/{login,check-email,expired,error}` — pattern complet à dupliquer
- `app/auth/confirm/route.ts` — réécrit avec `verifyData.user`, mapErrorToReason, logging structuré
- `proxy.ts` refactoré pattern Supabase SSR officiel — préserve les cookies sur redirects/forbidden
- Pattern **anti-énumération** : check-email redirect quel que soit l'outcome
- **Leçons review 1.6 à réappliquer 1.7** :
  - `NEXT_PUBLIC_SITE_URL` via `env.client` (jamais `process.env.X!`)
  - Pas de `cause.message` brut dans le payload logger (peut contenir l'e-mail)
  - `isSafeActionLink` valide `action_link` non-empty + URL parseable HTTPS/HTTP
  - `expiresInMinutes` coercion défensive
  - Reason whitelist filter (1.6 `auth.error`) — **PAS** d'analogue 1.7, mais le pattern de strict whitelist input reste à appliquer (e.g. `tranche` enum)

### Hors-scope (NE PAS livrer dans cette story)

| Élément                                                                                        | Story          | Raison                                                          |
| ---------------------------------------------------------------------------------------------- | -------------- | --------------------------------------------------------------- |
| Queue co-mod `/comod/admission/page.tsx`, `validateAdmission`/`rejectAdmission` Server Actions | 1.8            | Validation co-mod dédiée                                        |
| UI déconnexion sur `/profil/`, profil page                                                     | 1.9            | Story dédiée profil RGPD                                        |
| Suppression compte RGPD cascade                                                                | 1.9            | Story dédiée                                                    |
| **Rate limiting Upstash `POST /admission/submit` 5/jour/IP** (AR31)                            | 1.10 hardening | Hardening complet                                               |
| Rate limiting magic-link send 3/15min/email                                                    | 1.10 hardening |                                                                 |
| Authorization role-based sur `/community/*` (demandeur exclu)                                  | 1.10 ou epic 2 | Routes communauté pas encore créées                             |
| 403 Forbidden i18n page                                                                        | 1.8/1.10       |                                                                 |
| Brevo webhook bounce/delivery `app/api/webhook/brevo/route.ts`                                 | 1.10 ou plus   |                                                                 |
| Templates AR finalisés                                                                         | V1.5           | MVP FR-only                                                     |
| `contact_channel='sms'` flow                                                                   | V1.5           | SMS magic-link consentement artisan = epic 2.5 (flux différent) |
| Web Push notifications co-mod                                                                  | V1.5           |                                                                 |
| `e2e/admission-flow.spec.ts` Playwright                                                        | V1.5           | Nécessite mock Brevo + tunnel HTTPS                             |
| Bench Aïcha NFR40 empirique avec proxy utilisateur réel                                        | Pré-bêta       | Story 1.7 valide structurellement ; validation Aïcha hors-tech  |
| Plafond 10/jour OU vagues d'admission (risque S4 burnout co-mods)                              | Pré-bêta ops   | Décision soft du syndic, pas code MVP                           |

> **Anti-scope-bleed** : si une task semble nécessiter quelque chose hors de cette liste, **arrêter et demander** (leçon story 1.5 + 1.6 review feedback). La story 1.7 reste sur **demandeur dépose → confirme e-mail → file d'attente + notify co-mods**.

### Deferred-work pré-existants liés à 1.7

[Source: `_bmad-output/implementation-artifacts/deferred-work.md`]

- **Authorization community routes : uniquement authentication, pas role-based** [`proxy.ts:82-95`] — non bloquant 1.7 (`/admission/*` n'est **pas** dans `COMMUNITY_PATTERN`). À durcir 1.10/epic 2.
- **Rate-limit Upstash signin (mail-bombing / Brevo quota)** [`app/actions/auth-signin.ts`] — concerne aussi `admission-submit.ts` ; ajouter à la liste 1.10.
- **Anti-enumeration timing leak signin** — pour 1.7 : le path `duplicate_pending` est **délibérément** explicite (user possède son propre e-mail) ; le path `email_exists` (admin.createUser fail) **est** transmuté en `Result.ok` après lookup. Acceptable.
- **`request_id` toujours null dans le logger** — concerne aussi les logs 1.7 ; pollution Sentry minor, défer 1.10.
- **Magic-link template `lang="fr"` hardcodé** — concerne aussi `admission-notify-comod.fr.ts` (idem hardcoded `lang="fr"`) ; défer V1.5.
- **`INITIAL_COMOD_EMAILS` NBSP/unicode whitespace non gérés** [`lib/env.ts`] — non bloquant 1.7 si CSV propre (en prod cf. doc ops).
- **Brevo 5xx traité comme erreur terminale (pas de retry/queue)** [`lib/email/client.ts:35-43`] — concerne aussi notify-comod ; on **n'aggrave pas** (catch + log + continue) ; défer 1.10.

### Risques connus 1.7 (à monitorer)

| Risque                                                                                         | Mitigation 1.7                                                                                                               | Long terme                   |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Mail-bombing : un attaquant submit /admission 100×/sec avec des e-mails arbitraires            | Aucune mitigation in-code 1.7 (out-of-scope AR31)                                                                            | Story 1.10 Upstash 5/jour/IP |
| Brevo quota 300/jour saturé par un attaquant                                                   | Idem                                                                                                                         | Story 1.10                   |
| Race condition : 2 visiteurs submit avec le même e-mail à 10ms d'écart                         | Postgres UNIQUE sur `(user_id, state='pending')` ? **Non, pas implémenté** — accepter 2 rows pending au pire (co-mod gère)   | Story 1.8 ou 1.10            |
| Co-mod e-mail injection via `villa/tranche` (le co-mod voit du HTML mal échappé)               | `escapeHtml()` sur tous les `vars.*` dans `admission-notify-comod.fr.ts` (T3)                                                | —                            |
| Demandeur accepté qui réutilise un vieux magic-link expiré → atterrit sur `/admission/refused` | Pattern `/auth/expired` (1.6) gère expiration ; `resolveRedirect` lit le state actuel → si `accepted` redirect `/community/` | —                            |
| Ligne `admission_requests` orpheline si Brevo magic-link fail (l'auth.user et la row existent) | Acceptable MVP — co-mod peut renvoyer manuellement via story 1.8 ("Re-envoyer un lien"). Documenter en `Completion Notes`    | Story 1.10                   |
| `email_verified_at` jamais set (user n'ouvre jamais l'e-mail)                                  | Co-mod voit la queue avec ce champ null → peut décider de valider quand même (UX co-mod story 1.8 affichera l'info)          | Story 1.8                    |

### References

- **Story complète** : [Source: \_bmad-output/planning-artifacts/epics.md:676-712]
- **Story 1.8 (next)** — pour comprendre où s'arrête 1.7 : [Source: epics.md:716-752]
- **AR16 boundary e-mail** : [Source: architecture.md:200, 1018]
- **AR17/18/19** : [Source: architecture.md:202-205, 494-549]
- **AR21 skeleton** : [Source: architecture.md:331]
- **AR31 rate limiting (out-of-scope)** : [Source: architecture.md:249, 1459]
- **AR37 polling** : [Source: architecture.md:314]
- **Data flow Journey 1 admission** : [Source: architecture.md:1086-1106]
- **`admission_requests` schema** : [Source: supabase/migrations/20260524005559_init_schema.sql:65-95]
- **`admission_requests` RLS + column grants** : [Source: supabase/migrations/20260524005600_init_rls.sql:125-175]
- **`handle_new_auth_user` trigger** : [Source: supabase/migrations/20260524005559_init_schema.sql:142-189]
- **ENUM `admission_decision_reason`** : [Source: supabase/migrations/20260524005527_init_enums.sql:18-23]
- **FR2 (submit admission) / FR3 (magic-link) / FR4 (email verified) / FR5 (queue pending) / FR42 (co-mod notification)** : [Source: epics.md:33-42, prd.md FRs section]
- **NFR40 règle Aïcha** : [Source: epics.md:344]
- **UX Journey 3 Salma** : [Source: ux-design-specification.md:795-838]
- **Mitigation L4 CGU non-pré-cochée** : [Source: ux-design-specification.md:838, 967]
- **Wording first-person sans infantilisation** : [Source: ux-design-specification.md:802, 1236]
- **Risque T1 délivrabilité Brevo** : [Source: ux-design-specification.md:957]
- **Risque S4 burnout co-mods** : [Source: ux-design-specification.md:961]
- **Risque L4 CGU non-cochée** : [Source: ux-design-specification.md:967]
- **Tokens v2 palette + radius + ombres** : [Source: ux-design-specification.md:634-688]
- **`<PageContainer>` + tokens + `<Checkbox>`** : [Source: ux-design-specification.md:1018, 1142, 1215]
- **Pattern Server Action 1.6 + admin client** : [Source: `app/actions/auth-signin.ts:1-119`, `lib/supabase/admin.ts:1-21`]
- **`lib/email/send.ts` discriminated union** : [Source: `lib/email/send.ts:11-68`]
- **`lib/i18n/request.ts` deepMerge fallback** : [Source: `lib/i18n/request.ts:5-27`]
- **`lib/auth/redirect-by-state.ts` `isSafeAdmissionNext`** : [Source: `lib/auth/redirect-by-state.ts:54-66`]
- **Décision MVP FR-only** : [[project_darna_mvp_fr_only]]
- **Architecture finalisée + 8 ADRs** : [[project_darna_arch_complete]]
- **UX spec finalisée** : [[project_darna_ux_complete]]
- **Sprint status** : `_bmad-output/implementation-artifacts/sprint-status.yaml:53` (`1-7-...: backlog` → `ready-for-dev` post-story)
- **Pattern Supabase admin.generateLink official** : https://supabase.com/docs/reference/javascript/auth-admin-generatelink
- **Pattern Supabase admin.createUser official** : https://supabase.com/docs/reference/javascript/auth-admin-createuser
- **Brevo Transactional Email API** : https://developers.brevo.com/reference/sendtransacemail
- **Deferred-work index** : `_bmad-output/implementation-artifacts/deferred-work.md`

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context) — `bmad-dev-story`.

### Debug Log References

- `pnpm test` ✅ 101 passed / 5 skipped — +29 vs story 1.6 (validation: 8 + email: 4 + admission helper: 4 + submit action: 6 + redirect-by-state: 1 + autres).
- `pnpm typecheck` ✅ (corrigé 1 erreur TS2367 sur FormDataEntryValue → boolean comparison dans `admission-submit.ts:61`).
- `pnpm lint` ✅ (corrigé 1 erreur `no-unused-vars` `_unused` dans `admission.test.ts`).
- `pnpm build` ✅ — routes `/[locale]/admission`, `/[locale]/admission/pending`, `/[locale]/admission/refused` toutes prérendues SSG FR + AR, `/auth/confirm` reste dynamique.
- Smoke HTTP (port 3007, mode prod) : `/fr/admission` 200 avec titre "Demander l'accès à Darna" + label "Numéro de villa" + lien "conditions d'utilisation" ; `/fr/admission/pending` 200 ; `/fr/admission/refused` 200 ; `/ar/admission` 200 (stubs AR vides → fallback FR via `deepMerge` story 1.5).

### Completion Notes List

- **Migration `add_admission_email_verified_at` (T1)** : colonne timestamptz nullable + column-grant UPDATE étendu pour inclure `email_verified_at` (cohérence avec discipline column-level story 1.3). `lib/supabase/types.generated.ts` patché manuellement (Docker Colima down localement — à régénérer via `pnpm gen:types` quand Supabase local stack relancée, mais le diff manuel reflète exactement la migration).
- **Zod schema `admission.ts` (T2)** : réutilise `zVillaNumber`/`zEmail`, ajoute `zTranche` enum A-E + `zFirstName` trim/min1/max40 + `cgu_accepted: z.literal(true)`. Les message_keys i18n vivent dans `mapAdmissionFieldError(field)` (whitelist `errors.admission.*`), pas dans les messages Zod natifs — découplage propre.
- **Template `admission-notify-comod` (T3)** : pattern strict cohérent avec `magic-link.fr.ts` (zéro tracking pixel, zéro image, `escapeHtml` partout sur les vars dynamiques villa/tranche/first_name/queue_url). AR stub re-export FR (pattern story 1.6 T4). `SendArgs` discriminated union étendue avec exhaustiveness check sur `renderTemplate`. **Note PII** : `first_name` est légitimement dans l'e-mail rendu (le co-mod a besoin de voir le prénom pour décider), mais jamais dans les payloads logger — couvert par `stripPIIDeep` récursif story 1.6 + double-belt assert dans `tests/email/send.test.ts`.
- **Server Action `admission-submit.ts` (T4)** :
  - **Pattern `admin.generateLink({type:'magiclink'})` créateur idempotent** retenu : Supabase crée l'auth.users s'il n'existe pas (config dashboard "Allow signups via magic link" supposée ON), évite le double appel `admin.createUser` + `admin.getUserByEmail` (cette dernière API n'est pas stable dans la doc Supabase). Le trigger `handle_new_auth_user` ([Source: supabase/migrations/20260524005559_init_schema.sql:142]) provisionne `public.users role='demandeur'` + `notifications_prefs` dans la même transaction.
  - **INSERT strict columns** : `{user_id, residence_id, villa, tranche, first_name, contact_channel:'email'}` — strictement la liste autorisée par le column-grant authenticated story 1.3 (double-belt même si service-role bypasse). `state/decided_*/timestamps` sont laissés aux defaults DB + CHECK constraint.
  - **`useActionState`-compatible** : pas de `redirect()` côté Server Action (incompatible avec retour de state au form pour duplicate_pending). Le Client Component fait `router.push('/check-email')` via `useEffect` sur `state.ok === true`. Pattern POST-Redirect-Get.
  - **Anti-énumération** : sur échec inattendu de `generateLink`, `INSERT` ou auth, on retourne `{ok: true}` (le visiteur voit `/auth/check-email` sans signal que ça a échoué). Trade-off explicite : 1 utilisateur sur 1000 verra "j'ai pas reçu l'e-mail" sans recourse → à monitorer Sentry via les events `admission.*_failed` / `_threw`.
  - **Co-mods notify try/catch isolé** par envoi : un Brevo 5xx sur l'envoi co-mod #2 ne casse pas le flux principal (co-mod #1 + co-mod #3 reçoivent quand même, l'événement `admission.comod_notify_failed` est loggé par Sentry).
- **Pages `/[locale]/(public)/admission/*` (T5)** : variance vs architecture.md documentée en commentaire en-tête de `page.tsx`. Wording first-person sans infantilisation, tokens v2 stricts (bg-bg-card/page/soft, accent-500, danger, neutral-700, min-h-touch), `loading.tsx` skeleton (NFR40 Aïcha). `<Checkbox>` Radix de story 1.4 réutilisé pour le CGU L4 — `name="cgu_accepted" value="on"` produira `'on'` au FormData seulement si checked.
- **Helper `markAdmissionEmailVerified` (T6)** : idempotent (`is.email_verified_at, null` dans le WHERE), state-bound (`state='pending'`), soft-delete-safe (`is.deleted_at, null`). N'échoue **jamais** le callback : try/catch englobant + log silencieux. 4 cas couverts en tests (success, no match, error code, throw).
- **Hook callback `/auth/confirm` (T7)** : 1 ligne ajoutée `await markAdmissionEmailVerified({ userId: user.id });` juste **avant** `resolveRedirect`. Reste idempotent même si pas d'admission_request (le helper retourne `{updated: false}` silencieusement).
- **i18n FR + AR stubs (T8)** : namespace `admission.{form,pending,refused}` complet FR, mêmes clés vides côté AR + `errors.admission.*` 6 clés. Fallback FR via `deepMerge` story 1.5 confirmé par smoke `/ar/admission` 200.
- **Tests Vitest (T9)** : +29 tests / 0 régressions. Pattern réutilisé pour les mocks Supabase chain : closure d'état + `vi.hoisted` pour le mock module.
- **Validation finale (T10)** : typecheck/lint/test/build/smoke HTTP tous verts. **Validation E2E manuelle** (envoi Brevo réel, click magic-link, INSERT visible Supabase Studio) **différée** à la pré-bêta — Docker Colima down localement bloque `supabase start`, donc impossible d'appliquer la migration et valider sur stack locale. **À faire avant merge prod** : `pnpm gen:types -- linked`, `supabase db push` sur preview Vercel, dérouler la checklist AC10 sur tunnel HTTPS.

### File List

**NEW**

- `supabase/migrations/20260615190000_add_admission_email_verified_at.sql`
- `lib/validation/admission.ts`
- `lib/validation/admission.test.ts`
- `lib/email/templates/admission-notify-comod.fr.ts`
- `lib/email/templates/admission-notify-comod.ar.ts`
- `lib/auth/mark-admission-email-verified.ts`
- `app/actions/admission-submit.ts`
- `app/[locale]/(public)/admission/page.tsx`
- `app/[locale]/(public)/admission/admission-form.tsx`
- `app/[locale]/(public)/admission/loading.tsx`
- `app/[locale]/(public)/admission/pending/page.tsx`
- `app/[locale]/(public)/admission/refused/page.tsx`
- `tests/admission/submit-action.test.ts`
- `tests/admission/mark-admission-email-verified.test.ts`

**MODIFIED**

- `lib/supabase/types.generated.ts` (+`email_verified_at` Row/Insert/Update — patch manuel cohérent avec la migration, à régénérer via `pnpm gen:types` une fois Docker relancé)
- `lib/email/send.ts` (étend `SendArgs` discriminated union avec template `'admission-notify-comod'` + switch exhaustif sur `renderTemplate`)
- `app/auth/confirm/route.ts` (+import + `await markAdmissionEmailVerified({ userId: user.id })` avant `resolveRedirect`)
- `messages/fr.json` (+namespace `admission.{form,pending,refused}.*` + `errors.admission.*` 6 clés)
- `messages/ar.json` (+mêmes clés en stubs vides — fallback FR via `deepMerge` story 1.5)
- `tests/email/templates.test.ts` (+suite `admission-notify-comod` : parité shape FR/AR, escape HTML, coercion défensive villa)
- `tests/email/send.test.ts` (+1 cas template `'admission-notify-comod'` + assert aucun `first_name` dans payload logger)
- `tests/auth/redirect-by-state.test.ts` (+1 cas `nextParam='/fr/admission/pending'` honoré)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (1-7 `backlog` → `ready-for-dev` → `in-progress` → `review`)

### Change Log

- **2026-06-15** — Implémentation `bmad-dev-story` (Opus 4.7, 1M context). 10/10 tâches livrées : migration `email_verified_at` + column-grant UPDATE étendu, `lib/validation/admission.ts` Zod schema + mapAdmissionFieldError, templates `admission-notify-comod.{fr,ar}` + extension SendArgs discriminated union, Server Action `submitAdmissionRequest` (`admin.generateLink` idempotent + duplicate-pending detection + INSERT strict columns + magic-link + notify co-mods + anti-énumération), helper `markAdmissionEmailVerified` idempotent state-bound + hook dans `/auth/confirm`, 5 pages `app/[locale]/(public)/admission/*` (Server + Client useActionState + Checkbox CGU L4 + skeleton NFR40), i18n FR complet + stubs AR, +29 tests Vitest (total 101 passed). `pnpm typecheck/lint/test/build` verts ; smoke HTTP mode prod sur port 3007 : toutes les routes admission 200. **Validation E2E délivrabilité Brevo + cron Supabase reportée** à la pré-bêta (Docker local down). Status : `review`.
- **2026-06-15** — Story créée par `bmad-create-story` (Opus 4.7, 1M context). Analyse exhaustive : epic 1.7 ACs (epics.md:676-712), architecture (AR16-19/AR3/AR21/AR31/AR37, schema `admission_requests` + column grants + handle_new_auth_user trigger, data flow Journey 1), UX spec (Journey 3 Salma, mitigation L4 CGU, tokens v2 borderless, wording first-person, AdmissionForm composant), previous stories 1.1-1.6 (env, logger, Supabase clients, admin client, `lib/email/send.ts` discriminated union, `redirect-by-state`, `detectLocaleFromHeaders`, login-form pattern). Variance documentée : `admission/` sous `(public)/` au lieu de `(community)/` justifiée par flux visiteur anonyme. Hors-scope explicite : rate-limit AR31 (1.10), queue co-mod (1.8), profil/signout UI (1.9). Status : `ready-for-dev`.

### Review Findings

- [x] [Review][Patch] CGU Checkbox manque `aria-invalid` + `aria-describedby` quand `cguErr` est set — AC4 (`aria-invalid={true}` + `aria-describedby` requis sur tous les champs en erreur) [`app/[locale]/(public)/admission/admission-form.tsx:185`]
- [x] [Review][Patch] `queueUrl` utilise le locale du demandeur au lieu de `'fr'` hardcodé — viole MVP FR-only (co-mod reçoit un lien `/ar/comod/admission` si requête AR) [`app/actions/admission-submit.ts:264`]
- [x] [Review][Patch] `sendTransactionalEmail` magic-link (étape 7) non wrappé en try/catch — si Brevo throw réseau, la Server Action crash alors que l'INSERT est déjà commis [`app/actions/admission-submit.ts:250`]
- [x] [Review][Patch] Event `admission.email_verified` émis même quand `updated: false` (no-op) — nom d'event trompeur pour les co-mods et l'audit ; utiliser un event distinct ou conditionner au vrai update [`lib/auth/mark-admission-email-verified.ts:50`]
- [x] [Review][Patch] Clé i18n `admission.form.duplicatePendingBanner` définie dans fr.json/ar.json mais jamais consommée par le composant (utilise `tErrors('duplicate_pending')` à la place) — clé morte [`messages/fr.json:135`]
- [x] [Review][Patch] `z.literal(true)` sans `{ message: 'errors.admission.cgu_required' }` — déviation AC2 spec (auto-documentation du message_key dans le schéma Zod) [`lib/validation/admission.ts:22`]
- [x] [Review][Patch] Aucun log ni early-return quand `actionLink === null` après un INSERT réussi — co-mods notifiés mais 0 magic-link envoyé, aucune trace visible dans les logs [`app/actions/admission-submit.ts:250`]
- [x] [Review][Defer] Race condition : pas d'index unique partiel sur `(user_id, state='pending')` — 2 soumissions simultanées créent 2 rows pending [`supabase/`] — deferred, story 1.10 hardening (risque documenté dans spec risk table)
- [x] [Review][Defer] `MAGIC_LINK_TTL_MINUTES = 15` affiché dans l'email mais non passé à Supabase — Supabase applique son propre TTL dashboard (1h par défaut), l'email dit "15 min" à tort [`app/actions/admission-submit.ts:25`] — deferred, pré-existant story 1.6 même pattern
- [x] [Review][Defer] `generateLink({ type: 'magiclink' })` vs guard `type !== 'email'` dans confirm/route.ts — même pattern que story 1.6 (`auth-signin.ts:66`), E2E non testé (Docker Colima down) [`app/actions/admission-submit.ts:119`] — deferred, pré-existant story 1.6, à valider E2E pré-bêta
- [x] [Review][Defer] SQL `GRANT UPDATE` inclut colonnes soft-delete (`deleted_at`, `deleted_by`, `deletion_reason`) pour `authenticated` — sur-permission potentielle [`supabase/migrations/20260615190000_add_admission_email_verified_at.sql:16`] — deferred, pré-existant story 1.3 RLS (pattern existant)
- [x] [Review][Defer] `RESIDENCE_ID_DARNA = '00000000-0000-0000-0000-000000000001'` hardcodé — risque si prod seed utilise un UUID différent [`app/actions/admission-submit.ts:20`] — deferred, décision architecturale pré-existante
- [x] [Review][Defer] `isSafeActionLink` accepte `http:` (cleartext) — même pattern que story 1.6 `auth-signin.ts:29` [`app/actions/admission-submit.ts:30`] — deferred, pré-existant story 1.6
