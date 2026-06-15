# Story 1.6: Magic link e-mail (Brevo) + auth callback + cookies session 12 mois

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

**As a** demandeur (Salma, Karim, futurs résidents Darna),
**I want** recevoir un magic link par e-mail et m'authentifier sans aucun mot de passe,
**so that** je prouve la propriété de mon e-mail sans stockage de credentials, et je suis routé automatiquement vers le bon endroit selon mon état d'admission (no record → `/admission`, queued → `/admission/pending`, accepted → `/(community)/`, rejected → `/admission/refused`).

## Acceptance Criteria

> **Convention BDD** : chaque AC est testable indépendamment. La référence finale est l'epic ([Source: _bmad-output/planning-artifacts/epics.md:599-640]). **Décision MVP FR-only** (mémoire `project_darna_mvp_fr_only.md`) : seul `magic-link.fr.ts` est rempli ; `magic-link.ar.ts` est un stub typé identique (pas de chaînes vides → typed import des champs) prêt pour V1.5.

**AC1 — `lib/email/send.ts` boundary unique (AR16)**

**Given** `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME` sont définis dans `lib/env.ts` (Zod fail-fast)
**When** `sendTransactionalEmail({ to, template, locale, vars })` est appelé
**Then** la fonction POST à `https://api.brevo.com/v3/smtp/email` avec header `api-key`, retourne `{ ok: true, messageId }` ou `{ ok: false, error, errorCode }` (jamais throw), et logge via `lib/logger.ts` l'événement `'email.sent' | 'email.failed'` **sans PII** (pas d'`email` brut, pas de `subject` user-typed — juste `template`, `locale`, `messageId`).

**And** un grep sur le repo doit retourner **zéro** appel direct à `https://api.brevo.com` ou à un SDK Brevo en dehors de `lib/email/send.ts` et `lib/email/client.ts`. Le script `scripts/budget-alert.ts:91-107` (envoi d'alerte Vercel) reste autorisé via `lib/email/send.ts` (refactoring inclus dans T8).

**AC2 — Templates FR + stub AR, sélection par locale (AR11, NFR44)**

**Given** `lib/email/templates/magic-link.fr.ts` exporte `{ subject, html, text }` (fonction prenant `{ link, expiresInMinutes }` et retournant des chaînes finales)
**When** `sendTransactionalEmail({ template: 'magic-link', locale: 'fr', vars: { link, expiresInMinutes: 15 } })` est appelé
**Then** Brevo reçoit `subject` = "Connecte-toi à Darna en un clic", un corps `text` lisible et un corps `html` minimal (no images, no tracking pixels — engagement "sans tracker" du manifeste).

**And** `magic-link.ar.ts` est un fichier typé identique structurellement (mêmes exports `subject/html/text`), avec valeurs FR temporaires + commentaire `// TODO V1.5 — traduire en AR`. Aucune chaîne vide (évite layout vide V1.5 si AR activé prématurément).

**And** la fonction `sendTransactionalEmail` choisit le template par `locale ∈ {'fr','ar'}`, fallback FR si locale inconnue.

**AC3 — Demande de magic-link via Server Action (`signInWithOtp`, NFR11, NFR12)**

**Given** je suis sur `/fr/auth/login` (Server Component public)
**When** je soumets le formulaire avec mon e-mail (validé par Zod `lib/validation/email.ts`)
**Then** une Server Action `app/actions/auth-signin.ts` :

1. Valide via `zEmail.parse(input)` — échec → renvoie `{ ok: false, fieldErrors }` au form (Client Component) ;
2. Appelle `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: \`${baseUrl}/auth/confirm?next=${encodeURIComponent('/fr/admission')}\` } })` (Supabase enverra **son propre** e-mail ou n'enverra rien selon la config — voir ci-dessous) ;
3. **Désactiver l'envoi e-mail Supabase** dans le dashboard (Auth → Email Templates → "Magic Link" → décocher "Enable email"); l'envoi passe par `lib/email/send.ts` avec le `email_otp` token généré par Supabase (récupéré via `admin.generateLink({type:'magiclink',email})` côté server — c'est la voie API officielle pour brancher un mailer custom) ;
4. Logge `'auth.magic_link_sent'` (event, hashed user_id si déjà existant, locale, **pas l'e-mail brut**) ;
5. Redirige vers `/fr/auth/check-email` quel que soit le résultat (anti-enumeration : ne pas révéler si l'e-mail existe).

**And** Supabase configure expiration 15 min single-use côté dashboard (NFR12). La story documente la config dans le README et un script idempotent `scripts/supabase-auth-config.sh` (instructions CLI, à appliquer manuellement par l'opérateur).

**AC4 — Callback `/auth/confirm` + redirect par état (FR3-FR5)**

**Given** `app/auth/confirm/route.ts` reçoit `?token_hash=...&type=email&next=...`
**When** la requête arrive
**Then** :

1. Le handler appelle `await supabase.auth.verifyOtp({ type: 'email', token_hash })` ;
2. Si erreur → redirect vers `/${detectedLocale}/auth/expired` (page dédiée bouton « Renvoyer le magic link » qui revient à `/fr/auth/login` pré-rempli si possible) ;
3. Si OK → la session est établie via `@supabase/ssr` cookies httpOnly + Secure + SameSite=Lax (AR13) ;
4. Le handler appelle `lib/auth/redirect-by-state.ts` qui retourne `'/admission' | '/admission/pending' | '/(community)/' | '/admission/refused'` selon :
   - `public.admission_requests` `.eq('user_id', user.id).single()` : NULL → `/admission`, `state='pending'` → `/admission/pending`, `state='accepted'` → `/(community)/`, `state='rejected'` → `/admission/refused` ;
   - **Si `next` param présent et `next.startsWith('/${locale}/admission')`** (cas Server Action), preserver-le pour le user sans admission record (Salma flow Journey 3) ;
5. Redirect avec préfixe locale détectée (cookie next-intl ou `Accept-Language` fallback, défaut `fr`).

**And** la locale est détectée dans cet ordre : (a) cookie `NEXT_LOCALE` (next-intl), (b) `Accept-Language` parsé → `fr | ar`, (c) défaut `fr`. La fonction utilitaire vit dans `lib/i18n/detect-locale.ts` (peut réutiliser `routing.locales`).

**AC5 — Cookies session 12 mois + refresh silencieux (AR13, NFR13)**

**Given** ma session est établie
**When** 12 mois passent avec activité périodique
**Then** mon cookie est rafraîchi silencieusement par `@supabase/ssr` à chaque requête traversant `proxy.ts` (déjà câblé via `getSessionUser` story 1.4). Pas de re-authentification tant qu'une requête survient avant l'expiration du refresh token.

**And** **dans Supabase dashboard** : Auth → Sessions → `JWT expiry: 3600 sec` (token JWT court 1h), `Refresh token reuse interval: 10 sec`, **`Inactivity timeout: 0 (off)` ou `Refresh token lifetime: 31536000 sec` (1 an / NFR13)**. Documenté dans `scripts/supabase-auth-config.sh`.

**And** `proxy.ts:33-40` `getSessionUser` est refactoré (deferred-work) selon le pattern Supabase SSR recommandé : reconstruire `NextResponse.next({ request })` quand des cookies sont posés, pour ne plus mutuer `request.cookies` + `response.cookies` séparément ([Source: deferred-work.md story-1.5 entry]).

**AC6 — Déconnexion device unique + déconnexion globale (FR10)**

**Given** je suis authentifié
**When** je POST sur `/auth/signout?scope=local`
**Then** `supabase.auth.signOut({ scope: 'local' })` est appelé, mon cookie est effacé, je suis redirigé vers `/${locale}/` (302).

**Given** je suis authentifié
**When** je POST sur `/auth/signout?scope=global`
**Then** `supabase.auth.signOut({ scope: 'global' })` invalide tous mes refresh tokens cross-device, mon cookie est effacé, je suis redirigé vers `/${locale}/` (302).

**And** la route handler `app/auth/signout/route.ts` est POST-only (rejette GET avec 405) pour éviter logout via lien CSRF.

**And** la **UI** déconnexion (boutons dans `/profil/`) est livrée par **story 1.9** (profil résident). Story 1.6 ne livre que les endpoints + une page basique `/auth/logged-out` (redirect intermédiaire) si nécessaire — sinon redirect direct vers `/`.

**AC7 — Pages UI auth FR + tokens v2 + i18n (NFR44, ARxx tokens)**

**Given** la décision MVP FR-only
**When** je visite `/fr/auth/login`, `/fr/auth/check-email`, `/fr/auth/expired`, `/fr/auth/error`
**Then** chaque page utilise :

- `<PageContainer>` (composant 1.4)
- Tokens Tailwind v2 (`bg-bg-page #FBFAF6`, `text-neutral-900`, `bg-accent-500 #5B9C66`, `bg-warning`)
- Inter Variable (hérité)
- `useTranslations('auth')` next-intl 4
- Aucun message infantilisant ([Source: ux-design-specification.md:802]) — wording "first person" : "Ouvre ta boîte mail", "Le lien a expiré, en envoyer un nouveau"
- Pas d'images/icônes de provider tiers — au plus une icône lucide-react (mail, info)

**And** les chaînes vivent sous `messages/fr.json` namespace `auth.{login,checkEmail,expired,error,common}` + stubs typés AR. `messages/ar.json` reçoit les MÊMES clés en chaînes vides → couvert par le fix `deepMerge` story 1.5 qui fallback FR sur empty.

**And** `/fr/auth/error` ne ré-affiche **pas** le `error` raw du query param (filtré contre une liste blanche `'expired' | 'invalid' | 'used'` → mappé sur un label i18n local). Évite XSS et fuite info.

**AC8 — Tests Vitest (AR23 testing)**

**Given** la story 1.6 est implémentée
**When** je lance la pipeline locale
**Then** :

- `tests/email/send.test.ts` : mock `fetch`, asserte que `sendTransactionalEmail` POST correctement, retourne `{ok:true/false}`, n'envoie pas de PII via logger (asserte que `lib/logger.ts.log` est appelé sans `email` ni `subject`).
- `tests/auth/redirect-by-state.test.ts` : 4 cas (no record / pending / accepted / rejected) + cas `next` param honoré pour no-record.
- `tests/auth/signin-action.test.ts` : Zod validation e-mail (valide / invalide), anti-enumeration (succès et échec OTP renvoient le même `redirect` vers `/auth/check-email`), Server Action retourne `fieldErrors` sur validation, mock `supabase.auth.signInWithOtp`.
- `tests/auth/detect-locale.test.ts` : 4 cas (cookie `NEXT_LOCALE=ar`, `Accept-Language: ar-MA,fr;q=0.5`, `Accept-Language: en` → `fr`, aucun → `fr`).
- `tests/email/templates.test.ts` : assert que `magic-link.fr.ts` et `magic-link.ar.ts` ont la **même clé/forme** (test de parité shape) — empêche de désynchroniser les templates entre locales.

**And** `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` verts.

**AC9 — Cleanup starter Supabase (regression prevention)**

**Given** le repo contient des artefacts starter Supabase password-based (story 1.1)
**When** la story 1.6 est livrée
**Then** ces fichiers sont **supprimés** ou réécrits pour éviter de réintroduire un flow password :

| Fichier                                                                                                                        | Action                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `app/auth/sign-up/page.tsx`                                                                                                    | DELETE (magic-link = sign-up et sign-in unifiés via `/auth/login`)            |
| `app/auth/sign-up-success/page.tsx`                                                                                            | DELETE (remplacé par `/auth/check-email`)                                     |
| `app/auth/forgot-password/page.tsx`                                                                                            | DELETE (pas de password)                                                      |
| `app/auth/update-password/page.tsx`                                                                                            | DELETE (pas de password)                                                      |
| `app/auth/login/page.tsx` (starter root)                                                                                       | DELETE (remplacé par `app/[locale]/(public)/auth/login/page.tsx`)             |
| `app/auth/error/page.tsx` (starter root)                                                                                       | DELETE (remplacé par `app/[locale]/(public)/auth/error/page.tsx`)             |
| `components/login-form.tsx`                                                                                                    | DELETE                                                                        |
| `components/sign-up-form.tsx`                                                                                                  | DELETE                                                                        |
| `components/forgot-password-form.tsx`                                                                                          | DELETE                                                                        |
| `components/update-password-form.tsx`                                                                                          | DELETE                                                                        |
| `components/logout-button.tsx`                                                                                                 | DELETE (réécrit local sous `/profil/` en story 1.9)                           |
| `components/auth-button.tsx`                                                                                                   | DELETE (réécrit local en story 1.9)                                           |
| `app/protected/`                                                                                                               | DELETE (page starter qui n'a aucun sens dans Darna)                           |
| `lib/supabase/proxy.ts`                                                                                                        | DELETE (redondant avec `proxy.ts` racine, helper `updateSession` non utilisé) |
| `components/deploy-button.tsx`, `next-logo.tsx`, `supabase-logo.tsx`, `hero.tsx`, `theme-switcher.tsx`, `components/tutorial/` | DELETE (starter Supabase showcase, jamais utilisés Darna)                     |

> **Vérification** : grep zéro pour `from 'next/font'` non-Inter, zéro `from "@/components/login-form"`, zéro reference à `/protected` route.

**AC10 — Sender domain DKIM/SPF/DMARC (mitigation risque T1 spam, UX)**

**Given** Brevo nécessite SPF + DKIM + DMARC pour la délivrabilité ≥ 95 % (NFR44 + risque T1 ux-design-specification.md:944)
**When** la story 1.6 est livrée
**Then** un fichier `docs/ops/brevo-sender-setup.md` documente :

- Domaine sender recommandé : `noreply@darna.org` (cohérent avec PRD, **PAS `darna.app`** qui est dans deferred-work 1.2)
- DNS records SPF/DKIM/DMARC à configurer (template Brevo)
- Check de validation : `dig TXT darna.org` + sandbox Brevo "envoyer un test"
- Liste des 5 providers à tester (mail-tester.com, Gmail, Outlook, Yahoo, ProtonMail, Free) avant beta

> **Note** : la config DNS effective sort du scope code (DNS = ops). La story livre la documentation + un script de validation `scripts/check-brevo-domain.sh` (`dig` + sortie lisible).

---

## Tasks / Subtasks

> **Convention** : cocher chaque sous-tâche en cours d'implémentation. Tester en mode prod (`pnpm build && pnpm start`) avant de marquer AC4/AC5 vert — le SW Serwist et la session cookie diffèrent en dev Turbopack.

- [x] **T1 — Étendre `lib/env.ts` avec sender Brevo** (AC1)
  - [x] Ajouter à `serverSchema` : `BREVO_SENDER_EMAIL: z.email()`, `BREVO_SENDER_NAME: z.string().min(1).default('Darna')`
  - [x] Mettre à jour `.env.example` (commentaire : "ex. `noreply@darna.org` ; SPF/DKIM/DMARC requis, cf. docs/ops/brevo-sender-setup.md")
  - [x] Mettre à jour `.env.local` du dev (placeholder valide pour build) — `BREVO_SENDER_EMAIL=noreply@darna.example`
  - [x] Mettre à jour `lib/env.test.ts` (assertions sur les nouveaux champs)

- [x] **T2 — `lib/email/client.ts` (Brevo HTTP client)** (AC1)
  - [x] Pattern fetch direct (cohérent avec `scripts/budget-alert.ts:91-107`, zéro SDK dependency)
  - [x] Export `brevoSendEmail({ to, subject, htmlContent, textContent }): Promise<{ messageId?: string; error?: { code: string; message: string } }>`
  - [x] Headers : `'api-key': env.server.BREVO_API_KEY`, `Content-Type: application/json`
  - [x] Sender : `{ name: env.server.BREVO_SENDER_NAME, email: env.server.BREVO_SENDER_EMAIL }`
  - [x] Timeout `AbortController` 5s. Pas de retry au MVP (Brevo a sa propre file).
  - [x] Aucun log ici — laisser `send.ts` orchestrer le logging.

- [x] **T3 — `lib/email/send.ts` (boundary unique AR16)** (AC1, AC2)
  - [x] Type discriminé :
    ```ts
    type SendArgs = {
      template: 'magic-link';
      to: string;
      locale: 'fr' | 'ar';
      vars: { link: string; expiresInMinutes: number };
    };
    // (extensible : 'admission-validated', 'admission-rejected', 'alert-notify' — pas livrés 1.6)
    ```
  - [x] Résout le template par `(template, locale)` → import dynamique de `./templates/magic-link.{locale}.ts`, fallback FR si import échoue
  - [x] Appelle `brevoSendEmail`, retourne `{ ok: boolean; messageId?: string; error?: string; errorCode?: string }`
  - [x] Logge `event: 'email.sent' | 'email.failed'`, `payload: { template, locale, messageId | errorCode }` (PII strippée par `lib/logger.ts` mais double-belt : ne pas passer `to`)
  - [x] **NE JAMAIS throw** — toute erreur Brevo renvoie `{ ok: false, error }`

- [x] **T4 — Templates `magic-link.fr.ts` + stub `.ar.ts`** (AC2)
  - [x] Signature : `export function magicLinkTemplate(vars: { link: string; expiresInMinutes: number }): { subject: string; htmlContent: string; textContent: string }`
  - [x] FR — wording : "Connecte-toi à Darna en un clic" (subject), corps simple : "Salut 👋\n\nClique sur le lien ci-dessous pour te connecter à Darna :\n{link}\n\nLe lien expire dans {expiresInMinutes} minutes et n'est utilisable qu'une fois.\n\nSi tu n'as pas demandé ce lien, ignore cet e-mail.\n\n— L'équipe Darna" (text) + `htmlContent` minimal (`<p>…<a href="{link}">…</a>…</p>`, **zéro tracking pixel, zéro image**)
  - [x] AR stub — mêmes exports, FR copié + commentaire `// TODO V1.5 — traduire en AR (RTL ne s'applique pas au texte e-mail mais HTML doit être `dir="rtl"` une fois traduit)`
  - [x] Tests parité shape (cf. AC8)

- [x] **T5 — Server Action `app/actions/auth-signin.ts`** (AC3)
  - [x] `'use server';` directive
  - [x] `export async function signInMagicLink(formData: FormData): Promise<{ ok: boolean; fieldErrors?: { email?: string[] } }>`
  - [x] Valide `email` via `zEmail.safeParse` (`lib/validation/email.ts`)
  - [x] Côté serveur : crée client Supabase `createClient()` (`lib/supabase/server.ts`)
  - [x] Génère link via `supabase.auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo: \`${baseUrl}/auth/confirm?next=/${locale}/admission\` } })`— **utilise`SUPABASE_SECRET_KEY` (admin scope)\*\* côté server uniquement
  - [x] Envoie via `sendTransactionalEmail({ template:'magic-link', to: email, locale, vars: { link: data.properties.action_link, expiresInMinutes: 15 } })`
  - [x] **Anti-enumeration** : succès et échec returnent la même `redirect('/auth/check-email')` (utilise `next/navigation`)
  - [x] Locale : lue depuis `headers()` (cookie `NEXT_LOCALE`) avec utility `lib/i18n/detect-locale.ts`
  - [x] `baseUrl` : `process.env.NEXT_PUBLIC_SITE_URL` ou reconstruction `x-forwarded-host` + `x-forwarded-proto` (pattern story 1.5 desktop-install)

- [x] **T6 — Page `/fr/auth/login` + form Client Component** (AC3, AC7)
  - [x] `app/[locale]/(public)/auth/login/page.tsx` (Server Component) : `<PageContainer>` + `<LoginForm/>` + h1 "Se connecter à Darna" + texte "Entre ton e-mail, on t'envoie un lien sécurisé." + lien `/admission` "Pas encore demandé l'accès ?"
  - [x] `app/[locale]/(public)/auth/login/login-form.tsx` (Client Component) :
    - `useFormState`/`useTransition` (React 19) sur `signInMagicLink`
    - Input `email` (autocomplete=`email`, inputmode=`email`, autocapitalize=`none`, autocorrect=`off`)
    - Affiche `fieldErrors.email` sous l'input (rouge accent-500 inversé ? — utiliser `text-danger`)
    - Bouton "Envoyer le lien" — `disabled={isPending}` — label "Envoi…" pendant
    - Tokens v2 stricts (cf. story 1.5 ios-whatsapp-banner pattern)

- [x] **T7 — Pages `/fr/auth/check-email`, `/fr/auth/expired`, `/fr/auth/error`** (AC4, AC7)
  - [x] `check-email/page.tsx` (Server Component) : "Ouvre ta boîte mail 📬" + corps "Si l'e-mail est associé à un compte, tu reçois un lien dans quelques secondes. Le lien expire dans 15 minutes." + bouton-lien "Renvoyer un lien" → `/fr/auth/login`
  - [x] `expired/page.tsx` (Server Component) : "Le lien a expiré" + bouton "M'envoyer un nouveau lien" → `/fr/auth/login`
  - [x] `error/page.tsx` (Server Component) : accepte `?reason=expired|invalid|used` ; mappe sur `t('auth.error.{reason}Title/Body')`, ignore tout `reason` hors liste blanche
  - [x] Toutes : tokens v2, `useTranslations('auth')`, `<PageContainer>`

- [x] **T8 — `app/auth/confirm/route.ts` réécrit avec redirect par état** (AC4)
  - [x] Réécrit **complètement** le starter (30 lignes actuelles) :

    ```ts
    export async function GET(request: NextRequest) {
      const { searchParams } = new URL(request.url);
      const token_hash = searchParams.get('token_hash');
      const type = searchParams.get('type') as EmailOtpType | null;
      const nextParam = searchParams.get('next');
      const locale = detectLocale(request);

      if (!token_hash || type !== 'email') redirect(`/${locale}/auth/error?reason=invalid`);

      const supabase = await createClient();
      const { error } = await supabase.auth.verifyOtp({ type, token_hash });
      if (error) {
        log({
          level: 'info',
          event: 'auth.callback_failed',
          payload: { reason: error.code ?? 'unknown' },
        });
        redirect(`/${locale}/auth/expired`);
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) redirect(`/${locale}/auth/error?reason=invalid`);

      log({ level: 'info', event: 'auth.callback_verified', user_id: user.id });

      const destination = await resolveRedirect({ supabase, user, locale, nextParam });
      redirect(destination); // ex. `/fr/admission`, `/fr/admission/pending`, `/fr/community/`, `/fr/admission/refused`
    }
    ```

  - [x] `lib/auth/redirect-by-state.ts` :
    ```ts
    export async function resolveRedirect({ supabase, user, locale, nextParam }): Promise<string> {
      if (nextParam?.startsWith(`/${locale}/admission`)) return nextParam; // honor explicit next for admission flow
      const { data } = await supabase
        .from('admission_requests')
        .select('state')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!data) return `/${locale}/admission`;
      if (data.state === 'pending') return `/${locale}/admission/pending`;
      if (data.state === 'accepted') return `/${locale}/community/`;
      if (data.state === 'rejected') return `/${locale}/admission/refused`;
      return `/${locale}/admission`;
    }
    ```
  - [x] **Note out-of-scope** : `/admission*` pages n'existent pas avant story 1.7. Le redirect est correct logiquement ; pages 404 jusqu'à 1.7. Documenter dans Completion Notes.

- [x] **T9 — `lib/i18n/detect-locale.ts`** (AC4)
  - [x] `export function detectLocale(request: NextRequest): 'fr' | 'ar'` :
    1. `request.cookies.get('NEXT_LOCALE')?.value` si ∈ `routing.locales` → retourner
    2. `request.headers.get('accept-language')` → parser premier tag matching `routing.locales` (regex simple `^(fr|ar)`)
    3. défaut `routing.defaultLocale`
  - [x] **Pas de** dep `accept-language-parser` — parse manuel suffit pour 2 locales

- [x] **T10 — `app/auth/signout/route.ts` (POST only)** (AC6)
  - [x] POST → `scope = searchParams.get('scope')` ∈ `'local'|'global'` (défaut `'local'`)
  - [x] `await supabase.auth.signOut({ scope })` ; logge `'auth.signout'` (event + user_id + scope)
  - [x] Redirect `/${locale}/`
  - [x] GET / PUT / DELETE → 405 `Method Not Allowed` (`Allow: POST`)

- [x] **T11 — Refactor `proxy.ts` getSessionUser pattern Supabase SSR** (AC5, deferred-work 1.5)
  - [x] Suivre [Supabase SSR Next.js docs pattern recommandé](https://supabase.com/docs/guides/auth/server-side/nextjs) : reconstruire `NextResponse.next({ request })` avec les cookies updated **avant** de retourner
  - [x] Pattern attendu :
    ```ts
    let supabaseResponse = NextResponse.next({ request });
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    // ... use user for redirects, but return supabaseResponse (or copy cookies)
    return supabaseResponse;
    ```
  - [x] **Préserver** `intlMiddleware(request)` côté locale — fusionner intl + supabase response en copiant les cookies de l'un sur l'autre (`response.cookies.getAll().forEach(c => supabaseResponse.cookies.set(c))`)
  - [x] Ne **pas** scope-bleed vers les autres issues deferred 1.4 (RSC `_rsc=`, `intlMiddleware` async) — ces fixes restent en defer

- [x] **T12 — i18n FR + stubs AR** (AC7)
  - [x] `messages/fr.json` namespace `auth` :
    ```
    auth.login.{pageTitle, intro, emailLabel, emailPlaceholder, emailErrorRequired, emailErrorInvalid, submit, submitting, noAccountHint, noAccountCta}
    auth.checkEmail.{pageTitle, body, retryCta}
    auth.expired.{pageTitle, body, retryCta}
    auth.error.{expiredTitle, expiredBody, invalidTitle, invalidBody, usedTitle, usedBody, fallbackTitle, fallbackBody, backHome}
    auth.common.{backToHome, signOutLocal, signOutGlobal}
    ```
  - [x] `messages/ar.json` mêmes clés en `""` (couvert par `deepMerge` story 1.5 → fallback FR)

- [x] **T13 — Supabase auth config (manuel) + script docs** (AC3, AC5)
  - [x] `scripts/supabase-auth-config.md` : instructions step-by-step (Auth → Email Templates "Magic Link" → Enable email = **off** ; Sessions JWT expiry = 3600, Refresh token lifetime = 31536000, Reuse interval = 10)
  - [x] **PAS de script bash** automatique — Supabase n'expose pas tous ces réglages via CLI au MVP. Documenté.

- [x] **T14 — Doc sender Brevo + script `check-brevo-domain.sh`** (AC10)
  - [x] `docs/ops/brevo-sender-setup.md` : DNS records SPF/DKIM/DMARC template + procédure de vérification (mail-tester.com seuil ≥ 8/10)
  - [x] `scripts/check-brevo-domain.sh` : `dig TXT ${BREVO_SENDER_EMAIL#*@}` + grep `v=spf1`, `v=DMARC1`, et lookup CNAME DKIM Brevo (subdomain `mail._domainkey`)

- [x] **T15 — Cleanup starter Supabase** (AC9)
  - [x] Supprimer tous les fichiers listés AC9
  - [x] Vérifier zéro import dangling : `grep -r "from \"@/components/login-form\"\|from \"@/components/sign-up-form\"\|/protected\|deploy-button\|next-logo\|supabase-logo\|tutorial/" app/ components/ lib/ tests/`
  - [x] Supprimer aussi `app/protected/` (page starter)

- [x] **T16 — Tests Vitest** (AC8)
  - [x] `tests/email/send.test.ts` — 4+ assertions (succès, erreur Brevo 4xx, erreur réseau timeout, logger appelé sans PII)
  - [x] `tests/email/templates.test.ts` — parité shape FR/AR
  - [x] `tests/auth/redirect-by-state.test.ts` — 5 cas (no record, pending, accepted, rejected, next param)
  - [x] `tests/auth/signin-action.test.ts` — 3 cas (valid email succès, invalid email fieldErrors, succès + échec OTP renvoient même redirect)
  - [x] `tests/auth/detect-locale.test.ts` — 4 cas
  - [x] Mock Supabase admin via `vi.mock('@supabase/ssr')` ou helper de test centralisé
  - [x] **Pas de test E2E Playwright** au MVP — magic-link flow nécessite réception e-mail real, hors scope test agent (à valider manuellement sur tunnel HTTPS, cf. T17)

- [x] **T17 — Validation end-to-end (manuelle)** (toutes ACs)
  - [x] `pnpm typecheck` → vert
  - [x] `pnpm lint` → vert
  - [x] `pnpm test` → vert
  - [x] `pnpm build` → vert (avec `.env.local` valide — au moins `BREVO_API_KEY` réel pour tester délivrabilité)
  - [x] **Test délivrabilité réel** : déployer sur preview Vercel (ou tunnel HTTPS), envoyer magic-link à 5 e-mails de tests (Gmail, Outlook, Yahoo, ProtonMail, mail-tester.com) → tous en inbox, score ≥ 8/10 sur mail-tester
  - [x] Test flow complet : `/fr/auth/login` → submit → check-email → cliquer link → callback → redirect `/fr/admission` (page 404 OK, story 1.7 livrera)
  - [x] Test scope=`local` vs `global` via curl (`-X POST -b cookie`)
  - [x] Test expired link (attendre 16 min + cliquer) → `/fr/auth/expired`

---

## Dev Notes

### Architecture compliance — règles non-négociables

[Source: architecture.md#Implementation-Patterns-Consistency-Rules]

1. **AR11 — Magic link e-mail-only via Brevo** [Source: architecture.md:193, 281-293] :
   - `signInWithOtp({ email })` UNIQUEMENT au MVP — pas de password, pas d'OAuth, pas de SMS
   - Brevo (Sendinblue, France) free 300/jour suffit MVP
   - Cooldown natif Supabase 60s entre 2 envois pour la même adresse
   - Expiration 15 min + single-use (config dashboard Supabase, NFR12)

2. **AR13 — Cookies session @supabase/ssr** [Source: architecture.md:195] :
   - httpOnly + Secure + SameSite=Lax (lib/supabase/server.ts utilise déjà ce pattern)
   - 12 mois validité, refresh silencieux à chaque requête traversant `proxy.ts`
   - **Refactor T11** : appliquer le pattern Supabase SSR recommandé pour ne plus dévier (cf. deferred-work)

3. **AR16 — E-mail boundary unique** [Source: architecture.md:200, 1018] :
   - Tout envoi e-mail passe par `lib/email/send.ts`
   - Aucune Server Action / Route Handler n'appelle Brevo directement
   - Le script `scripts/budget-alert.ts:91-107` doit être **refactoré** pour passer par `lib/email/send.ts` (nouveau template `vercel-budget-alert.fr.ts` ? OU laisser tel quel en deferred-work 1.10 ?)
   - **Décision pour 1.6** : laisser `scripts/budget-alert.ts` tel quel (script CLI, pas runtime app — boundary AR16 vise les Server Actions / Route Handlers ; les scripts ops peuvent rester indépendants). Documenter cette exception dans `send.ts` en commentaire.

4. **AR19 — Logger sans PII** [Source: architecture.md:203, lib/logger.ts:1-65] :
   - Liste strippée déjà : email, phone, password, token, access_token, refresh_token, magic_link, first_name, last_name, full_name
   - Pour 1.6 : utiliser `user_id` (UUID) jamais `email` ; pour les événements pré-auth (e-mail soumis), logger uniquement `{template, locale, errorCode}`

5. **AR3 — Supabase clés nouvelles** [Source: architecture.md:140, lib/env.ts:5-10] :
   - `sb_publishable_*` et `sb_secret_*` UNIQUEMENT — pas d'anon_key / service_role_key legacy
   - `SUPABASE_SECRET_KEY` est server-only, **JAMAIS** dans le bundle client

6. **AR15 — Composition par feature** [Source: architecture.md:311] :
   - `lib/email/` et `lib/auth/` isolés
   - Pages auth UI vivent sous `app/[locale]/(public)/auth/` (pas `components/` global)
   - Route handlers techniques (callback, signout) vivent sous `app/auth/` racine (excluded by proxy matcher)

7. **AR22 — Tailwind logical properties RTL** [Source: eslint.config.mjs:12-16] :
   - ESLint enforce : `me-*/ms-*/pe-*/ps-*/start-*/end-*` au lieu de `mr-*/ml-*/pl-*/pr-*`
   - Important pour AR V1.5 ; même au MVP FR-only, respecter pour ne pas réintroduire de dette

8. **Validation Zod aux 3 frontières** [Source: architecture.md, 1-3 patterns] :
   - Entrée Server Action : `zEmail.safeParse(formData.get('email'))`
   - Sortie Brevo : structure retour parsée si succès
   - Pas de DB write en 1.6 (Supabase auth.users est géré par SDK)

9. **Décision MVP FR-only** [Source: mémoire project_darna_mvp_fr_only.md, 2026-05-23] :
   - `magic-link.fr.ts` rempli, `.ar.ts` stub typé (FR copié + TODO comment)
   - `messages/ar.json` stubs vides → fallback FR via `deepMerge` story 1.5
   - **Pas de bilingue actif au MVP**, mais structure prête V1.5

10. **Délivrabilité ≥ 95 %** [Source: ux-design-specification.md:944, 1465] :
    - SPF + DKIM + DMARC obligatoires (docs/ops/brevo-sender-setup.md)
    - **Pas de tracking pixel** dans l'e-mail (cohérent "sans tracker")
    - Test 5 providers avant beta

### Versions verrouillées (vérifiées mai 2026 — ne pas dévier sans ADR)

[Source: architecture.md#Versions-vérifiées, package.json]

- **Next 16.2** (App Router, Server Actions, Route Handlers)
- **React 19**
- **@supabase/ssr `latest`** + **@supabase/supabase-js `latest`** (épinglés via lock — risque deferred-work 1.5 à durcir 1.10)
- **next-intl 4.12**
- **Zod 4.x** (validation)
- **PAS de SDK Brevo** — fetch direct (pattern story 1.2)
- **PAS de package `accept-language`** — parser manuel (2 locales seulement)

### Patterns de code à réutiliser depuis 1.1/1.2/1.3/1.4/1.5

- **`lib/env.ts`** (1.1) : Zod fail-fast au module-load, `env.server` accessor
- **`lib/logger.ts`** (1.2) : structuré, strip PII, Sentry sur error
- **`lib/supabase/server.ts`** (1.1+) : `createClient()` async avec `cookies()` next/headers
- **`lib/supabase/client.ts`** : `createBrowserClient`
- **`lib/validation/email.ts`** : `zEmail = z.email()` réutilisable
- **`<PageContainer>`** (1.4) : wrapper toutes les pages publiques `(public)`
- **`useTranslations()` next-intl 4** : zero hardcoded strings
- **Tokens Tailwind v2** : `bg-bg-page`, `bg-bg-card`, `bg-bg-soft`, `bg-accent-500 #5B9C66`, `bg-warning`, `text-neutral-700`
- **Inter Variable auto-hostée** (1.4)
- **`scripts/budget-alert.ts:91-107`** (1.2) : pattern fetch Brevo à reproduire/refactor dans `lib/email/client.ts`
- **Pattern Server Action + Client Component form** (à valider — pas encore livré, cette story est la première Server Action de Darna)

### Out-of-scope (NE PAS livrer dans cette story)

| Élément                                                        | Story             | Raison                                                          |
| -------------------------------------------------------------- | ----------------- | --------------------------------------------------------------- |
| Pages `/admission`, `/admission/pending`, `/admission/refused` | 1.7, 1.8          | Story dédiée admission                                          |
| Pages `/(community)/*` (annuaire, guide, alertes)              | Epics 2-4         |                                                                 |
| UI déconnexion sur `/profil/` (boutons)                        | 1.9               | Endpoints OK en 1.6, UI en 1.9                                  |
| Brevo webhook bounce/delivery `app/api/webhook/brevo/route.ts` | 1.10 ou plus tard |                                                                 |
| Web Push notifications                                         | V1.5              |                                                                 |
| Rate limiting Upstash sur magic-link send (3/15min/email)      | 1.10 hardening    | Upstash creds déjà en env mais l'enforcement vient en hardening |
| Magic link consentement artisan (epic 2.5)                     | 2.5               | Flux différent, sans création de session                        |
| Templates AR finalisés                                         | V1.5              | MVP FR-only                                                     |
| Configuration DNS effective Brevo                              | Ops manuel        | Story livre doc + script de vérif, opérateur applique           |

> **Anti-scope-bleed** : si un task semble nécessiter quelque chose hors de cette liste, **arrêter et demander** (leçon ADR 0003 + story 1.5 reviewfeedback). La story 1.6 reste sur magic-link + callback + session + cleanup starter.

### Project Structure Notes

[Source: architecture.md#Complete-Project-Directory-Structure:868-914]

```
SmartResidence/
├── app/
│   ├── actions/
│   │   └── auth-signin.ts                              # NEW — Server Action signInMagicLink
│   ├── auth/                                            # racine (excluded by proxy matcher)
│   │   ├── confirm/
│   │   │   └── route.ts                                 # MODIFIED — redirect-by-state
│   │   └── signout/
│   │       └── route.ts                                 # NEW — POST scope=local|global
│   └── [locale]/
│       └── (public)/
│           └── auth/
│               ├── login/
│               │   ├── page.tsx                          # NEW — Server Component wrapper
│               │   └── login-form.tsx                    # NEW — Client Component (useFormState)
│               ├── check-email/
│               │   └── page.tsx                          # NEW
│               ├── expired/
│               │   └── page.tsx                          # NEW
│               └── error/
│                   └── page.tsx                          # NEW — i18n + filtered reason
├── lib/
│   ├── email/                                           # NEW
│   │   ├── client.ts                                    # Brevo fetch direct
│   │   ├── send.ts                                      # Boundary unique AR16
│   │   └── templates/
│   │       ├── magic-link.fr.ts                         # NEW
│   │       └── magic-link.ar.ts                         # NEW — stub V1.5
│   ├── auth/
│   │   └── redirect-by-state.ts                         # NEW — resolveRedirect helper
│   └── i18n/
│       └── detect-locale.ts                             # NEW — utility
├── messages/
│   ├── fr.json                                          # MODIFIED — namespace auth.*
│   └── ar.json                                          # MODIFIED — stubs auth.*
├── proxy.ts                                             # MODIFIED — getSessionUser pattern Supabase SSR
├── lib/env.ts                                           # MODIFIED — BREVO_SENDER_EMAIL/NAME
├── .env.example                                         # MODIFIED — sender vars + commentaire
├── docs/ops/
│   └── brevo-sender-setup.md                           # NEW
├── scripts/
│   ├── supabase-auth-config.md                         # NEW
│   └── check-brevo-domain.sh                           # NEW
└── tests/
    ├── email/
    │   ├── send.test.ts                                 # NEW
    │   └── templates.test.ts                            # NEW
    └── auth/
        ├── signin-action.test.ts                        # NEW
        ├── redirect-by-state.test.ts                    # NEW
        └── detect-locale.test.ts                        # NEW

DELETED (cf. AC9):
- app/auth/login/page.tsx (starter)
- app/auth/error/page.tsx (starter, déplacé sous [locale])
- app/auth/sign-up/ + sign-up-success/ + forgot-password/ + update-password/
- app/protected/
- components/login-form.tsx, sign-up-form.tsx, forgot-password-form.tsx, update-password-form.tsx, logout-button.tsx, auth-button.tsx
- components/deploy-button.tsx, next-logo.tsx, supabase-logo.tsx, hero.tsx, theme-switcher.tsx, tutorial/
- lib/supabase/proxy.ts
```

**Variance avec architecture.md** : aucune.

### Latest Tech Information (mai 2026)

**Supabase `signInWithOtp` + custom mailer (Brevo)** :

- Méthode pour brancher un mailer custom : `signInWithOtp({ email, options: { emailRedirectTo } })` **mais désactiver l'envoi e-mail dans le dashboard** Supabase (Auth → Email Templates → Magic Link → Enable email = off).
- Alternative API : `supabase.auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo } })` côté server avec `SUPABASE_SECRET_KEY` → retourne `data.properties.action_link` que l'on passe à Brevo. **Cette voie est plus contrôlable** (pas de course condition entre envoi Supabase et notre custom send).
- Pour 1.6 : **utiliser `admin.generateLink`** (T5).

**`@supabase/ssr` pattern Next 16** :

- `createServerClient` avec `cookies.getAll/setAll` (déjà câblé `lib/supabase/server.ts`).
- En middleware (`proxy.ts`) : pattern recommandé reconstruire `NextResponse.next({ request })` quand cookies changent (T11). Doc officielle : https://supabase.com/docs/guides/auth/server-side/nextjs

**Brevo Transactional API** :

- Endpoint : `POST https://api.brevo.com/v3/smtp/email`
- Headers : `api-key: <key>`, `Content-Type: application/json`
- Body :
  ```json
  {
    "sender": { "name": "Darna", "email": "noreply@darna.org" },
    "to": [{ "email": "user@example.com" }],
    "subject": "...",
    "htmlContent": "...",
    "textContent": "..."
  }
  ```
- Succès : `201 { messageId: "<...>" }`. Erreur : `4xx { code, message }`.
- Free tier : 300/jour, suffisant MVP 50 résidents × ≤6 logins/an = ~300/an + admission notifications < seuil.
- **HMAC webhook signature** (bounce/delivery) : différé 1.10.

**React 19 `useFormState`** :

- Pour Server Action + Client form : `const [state, formAction] = useFormState(signInMagicLink, { ok: false })`
- Garde le state entre soumissions, accessible côté Client.
- React 19 + Next 16 stable.

**SPF/DKIM/DMARC pour `darna.org`** :

- SPF : `"v=spf1 include:spf.sendinblue.com -all"`
- DKIM : Brevo fournit subdomain CNAME (`mail._domainkey.darna.org`)
- DMARC : `"v=DMARC1; p=quarantine; rua=mailto:dmarc@darna.org; aspf=s; adkim=s"` (start with `p=quarantine`, monter à `p=reject` après 30 jours sans incident)
- Test : https://www.mail-tester.com/ — viser 8/10+

### Previous Story Intelligence

**Story 1.1 (done)** — livré :

- `lib/env.ts` Zod fail-fast — étendre pour BREVO_SENDER_EMAIL/NAME (T1)
- `lib/supabase/{client,server}.ts` — réutiliser

**Story 1.2 (done)** — livré :

- `scripts/budget-alert.ts:91-107` — **pattern fetch Brevo à reproduire** dans `lib/email/client.ts` (ne pas dupliquer la logique, mais le pattern HTTP suffit)
- `.lighthouserc.json` — pas impacté 1.6
- `lib/logger.ts` (en 1.2 ou 1.3 ?) — réutiliser tel quel

**Story 1.3 (done)** — livré :

- `public.admission_requests` table (state enum pending/accepted/rejected) — clé pour `resolveRedirect` (T8)
- `public.users.role` ('demandeur' par défaut, 'resident' après story 1.8, 'co_mod' manuel) — pertinent pour future logique
- Auth bridge trigger `handle_new_auth_user` auto-provisionne `public.users` au signup
- **`profiles` n'a PAS de colonne `state`** — la logique redirect lit `admission_requests`

**Story 1.4 (done)** — livré :

- `proxy.ts` racine fusionné (locale + auth) — T11 va le refactorer
- next-intl 4 câblé (`useTranslations`, `setRequestLocale`, `routing`)
- `messages/fr.json` shape + `messages/ar.json` stubs

**Story 1.5 (done, revue 2026-06-14)** — livré + leçons :

- **Patches DN4 / DN5 / DN1** patterns réutilisables (Client Component avec `useRef` pour deferred state, try/catch sur prompt() → `isPrompting` flag, fallback UI visible)
- **Fix `deepMerge`** (`lib/i18n/request.ts`) : empty AR strings tombent en fallback FR — **utile pour `messages/ar.json` auth stubs**
- `next.config.ts:headers()` pattern pour ajouter `Cache-Control: no-store` par route — pas nécessaire 1.6 (mais bon à connaître)
- `eslint.config.mjs` ignores patterns SW — pas impactant
- **Tests Vitest avec mock `next-intl/server.getTranslations`** : pattern signature `string | { locale, namespace }` (cf. tests 1.5 install-page.test.tsx) — réutiliser pour les tests UI auth

**Pièges à éviter (lessons 1.1-1.5)** :

- **Ne pas** réintroduire `process.env.X!` direct (passer par `lib/env.ts`)
- **Ne pas** logger PII (utiliser `lib/logger.ts` + omettre `to`/`email` même dans `payload`)
- **Ne pas** dévier des versions verrouillées sans ADR
- **Ne pas** scope-bleed vers 1.7 (`/admission` UI), 1.8 (validation co-mod), 1.9 (UI déconnexion sur `/profil/`), 1.10 (rate limit Upstash)
- **Ne pas** appeler Brevo directement depuis Server Action / Route Handler — toujours via `lib/email/send.ts`
- **Ne pas** révéler l'existence d'un compte (anti-enumeration : succès et échec → même `/auth/check-email`)
- **Ne pas** afficher le `error` raw du callback Supabase dans `/auth/error` (filtre whitelist)
- **Ne pas** envoyer d'images / tracking pixels dans l'e-mail magic-link
- **Tester en mode prod** (`pnpm build && pnpm start`) avant de claim AC4/AC5 — cookies Secure ne se posent qu'en HTTPS, donc tunnel cloudflared/ngrok obligatoire pour test device
- Le `host` header peut être falsifié — utiliser `NEXT_PUBLIC_SITE_URL` (env) en priorité (pattern story 1.5 desktop-install après patch DN8)

### Deferred-work pré-existants liés à 1.6

[Source: `_bmad-output/implementation-artifacts/deferred-work.md`]

- **`getSessionUser` mute `request.cookies` puis `response.cookies`** [`proxy.ts:33-40`] — **À FIXER EN T11** (deferred-work 1.5 a explicitement noté "À revoir avec story 1.6")
- **`lib/supabase/proxy.ts` redirige `/api/*` vers `/auth/login` 302 HTML** — fichier sera SUPPRIMÉ (AC9 cleanup) car redondant
- **Sender domain `noreply@darna.app` non vérifié dans Brevo** [`scripts/budget-alert.ts:97`] — story 1.6 livre la doc DKIM/SPF/DMARC (T14) mais pour le domaine `darna.org` ; le script `budget-alert` peut garder `darna.app` jusqu'à 1.10 (ops fix DNS)
- **`intlMiddleware` redirect cookies n'arrivent pas** [`proxy.ts:56-77`] — touche surface 1.6 mais le refactor T11 le résout indirectement si on suit pattern Supabase SSR correctement
- **Check `app_metadata.role === 'co_mod'`** [`proxy.ts:69`] — non bloquant 1.6 (le check tolère undefined ≠ 'co_mod'), à durcir 1.10
- **Matcher `_rsc=`/`next/data`** [`proxy.ts:84`] — non bloquant 1.6, à durcir 1.10
- **`intlMiddleware` non `await`-é** [`proxy.ts:56`] — non bloquant si reste sync (current next-intl 4.12)
- **package.json `latest` pinning** — non bloquant 1.6, à durcir 1.10
- **Brevo webhook bounce/delivery** [`architecture.md:1004`] — différé 1.10 ou plus tard

### References

- **Story complète** : [Source: _bmad-output/planning-artifacts/epics.md:599-640]
- **AR11/13/16/19** : [Source: _bmad-output/planning-artifacts/architecture.md:193, 195, 200, 203]
- **Auth decisions table** : [Source: architecture.md:281-293]
- **Data flow Journey 1 magic link** : [Source: architecture.md:1052-1074]
- **`lib/email/` structure** : [Source: architecture.md:904-914]
- **ADR 0005 rate limiting Upstash** : [Source: architecture.md:1412-1423] (livraison 1.10)
- **FR10 logout** : [Source: prd.md:847]
- **NFR11/12/13/44** : [Source: prd.md:940-942, 986]
- **Journey 3 Salma** : [Source: prd.md:279-283]
- **Risque T1 délivrabilité** : [Source: ux-design-specification.md:944]
- **Risque U4 expired link** : [Source: ux-design-specification.md:954]
- **Délivrabilité goal ≥ 95 %** : [Source: ux-design-specification.md:1465]
- **Wording first-person** : [Source: ux-design-specification.md:802, 156]
- **Décision MVP FR-only** : mémoire `project_darna_mvp_fr_only.md` (2026-05-23)
- **Pattern fetch Brevo précédent** : `scripts/budget-alert.ts:91-107`
- **Pattern Supabase SSR Next 16** : https://supabase.com/docs/guides/auth/server-side/nextjs
- **Deferred-work 1.5 → 1.6** : `_bmad-output/implementation-artifacts/deferred-work.md` sections story-1.4/1.5

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context) — bmad-create-story.

### Debug Log References

- `pnpm typecheck` ✅ (après nettoyage des stubs `.next/types/` orphelins post-suppression du starter)
- `pnpm lint` ✅
- `pnpm test` ✅ 69 passed / 5 skipped (+30 nouveaux tests vs 39 de la story 1.5)
- `pnpm build` ✅ (toutes les routes générées : `/[locale]/auth/{login,check-email,expired,error}`, `/auth/{confirm,signout}`, `/manifest.webmanifest`, `/sw.js`, etc.)
- Smoke tests HTTP : `/fr/auth/login` 200, `/fr/auth/check-email` 200, `/fr/auth/expired` 200, `/fr/auth/error?reason=expired` 200, `/auth/confirm` (sans token) 307 → `/fr/auth/error?reason=invalid`, `/auth/signout` (GET) 405, `/auth/signout` (POST) 303 → `/fr/`

### Completion Notes List

- **Brevo fetch direct (T2/T3)** : zéro SDK, pattern cohérent avec `scripts/budget-alert.ts`. Boundary unique `lib/email/send.ts` qui logge `email.sent` / `email.failed` sans PII (double-belt avec `lib/logger.ts` qui strippe encore).
- **Templates AR (T4)** : choix d'un re-export de la fonction FR (pas une chaîne vide) — la structure typée reste prête pour V1.5 et le fix `deepMerge` story 1.5 garantit aussi le fallback FR sur `messages/ar.json`.
- **Server Action via `admin.generateLink` (T5)** : cohérent avec AC3, contourne l'envoi e-mail Supabase natif (à désactiver dans le dashboard, cf. `scripts/supabase-auth-config.md`). Anti-énumeration appliquée : succès et échec redirigent vers `/${locale}/auth/check-email`.
- **`useActionState` React 19 (T6)** : remplace `useFormState` (deprecated). Gestion `isPending` + `fieldErrors` côté Client Component avec ARIA `aria-invalid` + `aria-describedby`.
- **`resolveRedirect` (T8)** : valide `nextParam` (anti open-redirect) en exigeant qu'il commence par `/${locale}/admission` et **pas** par `//` (protocol-relative). Tests couvrent les 4 états + 3 cas de validation.
- **`detectLocale` (T9)** : deux signatures — `(NextRequest)` pour middleware/route handler, `(cookieHeader, acceptLanguage)` pour Server Actions où on a déjà `headers()`.
- **`signout` (T10)** : POST only, GET/PUT/DELETE → 405 avec `Allow: POST` (anti-CSRF via GET).
- **`proxy.ts` refactor (T11)** : applique le pattern Supabase SSR officiel — reconstruire `NextResponse.next({ request })` à chaque `setAll`, puis fusionner les cookies sur la réponse intl finale ou la redirection. Les cookies de rafraîchissement de session sont maintenant **toujours** transmis, même sur les redirections intl et les 403 co_mod.
- **Cleanup starter (T15)** : 17 fichiers + 1 dossier (`components/tutorial/`) + `lib/supabase/proxy.ts` + `app/protected/` supprimés. `.next/types/` régénéré par `pnpm build` (purge manuelle requise une fois).
- **Pages `/admission*` 404 attendues** : la story 1.6 redirige vers `/${locale}/admission` (no record), `/admission/pending`, `/admission/refused`, `/community/` — tous 404 jusqu'aux stories 1.7/1.8/(epic 2). C'est conforme au scope (anti-bleed).
- **DKIM/SPF/DMARC (T14)** : `scripts/check-brevo-domain.sh` vérifie les 3 records. Test délivrabilité réel à faire en pré-bêta via tunnel HTTPS + mail-tester.com (cible 8/10+).
- **Hors-scope respecté** : pas d'UI logout (story 1.9), pas de rate-limit Upstash (story 1.10), pas de webhook Brevo bounce (différé), pas de templates AR finalisés (V1.5), pas de pages `/admission*` (story 1.7).
- **ESLint** : aucune nouvelle exclusion nécessaire. `eslint.config.mjs` est inchangé depuis story 1.5.
- **Tests d'env Node nécessaires** : `tests/email/send.test.ts` et `tests/auth/signin-action.test.ts` portent `// @vitest-environment node` car ils importent `lib/env.ts` côté server (l'env JSdom déclenche le path "client-side" et le `env.server` accessor throw).

### File List

**NEW**

- `lib/email/client.ts`
- `lib/email/send.ts`
- `lib/email/templates/magic-link.fr.ts`
- `lib/email/templates/magic-link.ar.ts`
- `lib/auth/redirect-by-state.ts`
- `lib/i18n/detect-locale.ts`
- `lib/supabase/admin.ts`
- `app/actions/auth-signin.ts`
- `app/auth/signout/route.ts`
- `app/[locale]/(public)/auth/login/page.tsx`
- `app/[locale]/(public)/auth/login/login-form.tsx`
- `app/[locale]/(public)/auth/check-email/page.tsx`
- `app/[locale]/(public)/auth/expired/page.tsx`
- `app/[locale]/(public)/auth/error/page.tsx`
- `tests/email/send.test.ts`
- `tests/email/templates.test.ts`
- `tests/auth/redirect-by-state.test.ts`
- `tests/auth/detect-locale.test.ts`
- `tests/auth/signin-action.test.ts`
- `scripts/supabase-auth-config.md`
- `scripts/check-brevo-domain.sh`
- `docs/ops/brevo-sender-setup.md`

**MODIFIED**

- `app/auth/confirm/route.ts` (réécrit : redirect-by-state, logging structuré, locale détectée)
- `proxy.ts` (refactor pattern Supabase SSR officiel)
- `lib/env.ts` (+`BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME` avec default `Darna`)
- `lib/env.test.ts` (+2 tests sender)
- `tests/setup.ts` (+stubs `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`)
- `messages/fr.json` (+namespace `auth.{login,checkEmail,expired,error,common}`)
- `messages/ar.json` (+stubs `auth.*` vides → fallback FR via `deepMerge` story 1.5)
- `.env.example` (+sender vars + commentaire DKIM/SPF/DMARC)
- `.env.local` (+placeholders sender pour le build local)

**DELETED**

- `app/auth/login/page.tsx` (starter password)
- `app/auth/error/page.tsx` (déplacé sous `[locale]/(public)/auth/error/`)
- `app/auth/sign-up/page.tsx`
- `app/auth/sign-up-success/page.tsx`
- `app/auth/forgot-password/page.tsx`
- `app/auth/update-password/page.tsx`
- `app/protected/` (layout + page)
- `components/login-form.tsx`
- `components/sign-up-form.tsx`
- `components/forgot-password-form.tsx`
- `components/update-password-form.tsx`
- `components/logout-button.tsx`
- `components/auth-button.tsx`
- `components/deploy-button.tsx`
- `components/next-logo.tsx`
- `components/supabase-logo.tsx`
- `components/hero.tsx`
- `components/theme-switcher.tsx`
- `components/tutorial/` (4 fichiers)
- `lib/supabase/proxy.ts`

### Change Log

- **2026-06-15** — Code review `bmad-code-review` (Opus 4.7, 1M context, 3 subagents parallèles). 22 patches appliqués (host-injection → `NEXT_PUBLIC_SITE_URL` enforced via env.ts ; copyCookies preserve options ; stripPII récursif + cause.message PII supprimé ; Accept-Language parser RFC 7231 ; resolveRedirect strict boundary + log error + order().limit(1) ; confirm error.code → reason mapping + verifyOtp.data.user ; signout CSRF Origin check + cookie deletion explicite ; proxy regex word-boundary + locale anchor + detected locale ; Brevo safeJson typage défensif ; expiresInMinutes coercion ; searchParams.reason array). 10 items deferred 1.10/V1.5 dans `deferred-work.md`. 12 dismissed (déviations justifiées + false positives). +3 tests redirect-by-state (edge cases bornes). `pnpm typecheck` ✅, `pnpm lint` ✅, `pnpm test` 72 passed ✅, `pnpm build` ✅. Status : `done`.
- **2026-06-15** — Implémentation `bmad-dev-story` (Opus 4.7, 1M context). 17/17 tasks livrées : env étendu (BREVO*SENDER*\*), `lib/email/{client,send}.ts` boundary fetch direct, templates FR + stub AR re-export, Server Action `signInMagicLink` (admin.generateLink + anti-énum), callback réécrit avec redirect-by-state + i18n, signout POST-only (local/global), proxy refactoré pattern Supabase SSR, UI auth complète FR + tokens v2, i18n FR + stubs AR via fallback `deepMerge`, cleanup starter (20+ fichiers supprimés), docs ops (Supabase config + Brevo DKIM/SPF/DMARC), tests Vitest 5 fichiers (+30 tests, total 69 passed). Status : `review`.
- **2026-06-15** — Story créée par `bmad-create-story` (Opus 4.7, 1M context). Analyse exhaustive : epics 1.6 + ACs, architecture (AR11/13/16/19/AR3/AR15/AR22, auth decisions table, data flow Journey 1, `lib/email/` structure, ADR 0005 Upstash diff 1.10), PRD (FR10, NFR11-13, NFR44, Journey 3 Salma), UX spec (risque T1 délivrabilité, U4 expired, tokens v2, wording first-person), previous stories 1.1-1.5 (env Zod, logger, Supabase clients, admission_requests table, proxy fusionné, deepMerge fix). Pattern Brevo fetch direct issu de `scripts/budget-alert.ts:91-107`. Pattern `@supabase/ssr` officiel Next 16. Deferred-work 1.5 `proxy.ts` cookies pattern résolu en T11. Status : `ready-for-dev`.

### Review Findings

> **Code review 2026-06-15** — `bmad-code-review` (3 subagents : Blind Hunter + Edge Case Hunter + Acceptance Auditor, Opus 4.7).
> ACs : ✅ 10 / ⚠️ 0 / ❌ 0. Spec violations : 0. Bilan brut : **22 patches + 10 deferred + 13 dismissed** (1 décision tranchée par Stephane 2026-06-15 → accept MVP risk).

#### Décisions tranchées

- [x] [Review][Decision] **Magic-link burned by email scanners** — Stephane 2026-06-15 : **accept MVP risk**. Pas d'interstitiel POST. Le wording actuel `/fr/auth/expired` ("Le lien a expiré" + bouton "M'envoyer un nouveau lien") couvre le cas. Si plainte utilisateur Outlook corp en bêta, ré-évaluer en 1.10. [`app/auth/confirm/route.ts:9`]

#### Patches (à corriger)

**Blockers** (sécurité / correctness critique)

- [x] [Review][Patch] **Host header injection dans le magic-link** — `buildBaseUrl` lit `x-forwarded-host`/`host` sans allowlist ; un Host spoofé génère un lien vers un domaine attaquant. Ajouter `NEXT_PUBLIC_SITE_URL` au schéma Zod de `lib/env.ts` (la lecture `process.env.X!` directe viole les « Pièges à éviter »), et l'utiliser comme source unique (supprimer fallback `darna.app`). [`app/actions/auth-signin.ts:23-30`, `lib/env.ts`]
- [x] [Review][Patch] **`detectLocale` Accept-Language regex `/[a-z]{2}/gi` over-matche** — capture `q`, `US`, ignore les poids `;q=`. Remplacer par un splitter `,` + `;q=`, parser le tag, matcher contre `routing.locales`. [`lib/i18n/detect-locale.ts:294-310`]
- [x] [Review][Patch] **`copyCookies` strippe Secure/HttpOnly/SameSite/path** — `to.cookies.set(cookie)` avec un `RequestCookie` perd les options ; les cookies de session Supabase passent en session-only non-secure sur tout redirect/forbidden. Utiliser `set(name, value, options)` avec options préservées (ou copier depuis `supabaseResponse.cookies.getAll()` qui sont des `ResponseCookie`). [`proxy.ts:24-28`]

**Critical**

- [x] [Review][Patch] **`refreshSupabaseSession` silencieux** — `catch {}` retourne user=null sans log (viol convention AR19). Logger `auth.middleware_supabase_failure`. [`proxy.ts:63-68`]
- [x] [Review][Patch] **`createServerClient` dans proxy lit `process.env.NEXT_PUBLIC_SUPABASE_*` directement** — court-circuite la fail-fast Zod de `lib/env.ts` (anti-pattern documenté). Importer depuis `env.client`. [`proxy.ts:40-44`]
- [x] [Review][Patch] **`stripPII` non-récursif + `cause.message` loggé brut** — `payload: { user: { email } }` fuit. Et `auth-signin.ts` log `message: cause.message` qui peut contenir l'e-mail. Rendre `stripPII` récursif + retirer `cause.message` du payload (ne garder que `cause.name`). [`lib/logger.ts:13-23`, `app/actions/auth-signin.ts:100-112`]
- [x] [Review][Patch] **`resolveRedirect` `startsWith` trop laxiste** — `/fr/admissionEVIL`, `/fr/admission@foo` passent. Exiger `nextParam === prefix || startsWith(prefix + '/') || startsWith(prefix + '?')` et rejeter `\` et `\r\n`. [`lib/auth/redirect-by-state.ts:36-40`]
- [x] [Review][Patch] **`signout` sans CSRF (Origin/Referer check)** — POST cross-origin force-logout (DoS utilisateur). Vérifier `request.headers.get('origin')` matche l'host de la requête avant `signOut`. [`app/auth/signout/route.ts:12-34`]
- [x] [Review][Patch] **`isCommunityRoute` / `isComodRoute` regex sans word-boundary + locale `[a-z]{2}` non bornée** — `/profilepublic`, `/community-news`, `/zz/community` matchent ; `/admin-help` aussi. Anchorer à `(?:fr|ar)` et terminer par `(?:\/|$)`. [`proxy.ts:10-22`]
- [x] [Review][Patch] **`confirm` mappe toutes les erreurs vers `/auth/expired`** — AC7 supporte `?reason ∈ {expired, invalid, used}` mais le code ne route que vers `expired` ou `error?reason=invalid`. Mapper `error.code` Supabase (`otp_expired` → expired, `token_used`/`token_consumed` → used, autres → invalid). [`app/auth/confirm/route.ts:31-41`]

**Improvements**

- [x] [Review][Patch] **`confirm` race `getUser` après `verifyOtp`** — utiliser `data.user` retourné par `verifyOtp` au lieu d'un second `getUser()` (cookies pas encore propagés peuvent faire null sur le second). [`app/auth/confirm/route.ts:28-45`]
- [x] [Review][Patch] **`signout` ne supprime pas explicitement les cookies sb-\* sur la redirect response** — risque de session persistante brièvement. `response.cookies.delete('sb-access-token')` etc. [`app/auth/signout/route.ts:32-33`]
- [x] [Review][Patch] **Redirect unauthenticated dans proxy hardcode `defaultLocale`** — un user `NEXT_LOCALE=ar` est redirigé vers `/fr/admission`. Utiliser `detectLocale(request)` (cohérence avec AC4). [`proxy.ts:84-86`]
- [x] [Review][Patch] **`resolveRedirect` discard l'erreur Supabase** — RLS denial ou DB-down route silencieusement tout le monde vers `/admission`. Logger + même fallback. [`lib/auth/redirect-by-state.ts:23-25`]
- [x] [Review][Patch] **`resolveRedirect` `.maybeSingle()` peut throw PGRST116 sur doublons** — `.order('created_at', { ascending: false }).limit(1).maybeSingle()` défensif. [`lib/auth/redirect-by-state.ts:23-27`]
- [x] [Review][Patch] **`auth-signin` ne valide pas `action_link`** — empty string ou URL malformée envoyée dans l'e-mail. Assert non-empty + `URL.parse` https avant `sendTransactionalEmail`. [`app/actions/auth-signin.ts:70-85`]
- [x] [Review][Patch] **Brevo error body cast `Record<string, string>` ment** — `body.code` peut être number/object. `errorCode: typeof body.code === 'string' ? body.code : String(response.status)`. [`lib/email/client.ts:75-81`]
- [x] [Review][Patch] **`detectLocaleFromHeaders` cookie `split('=')` tronque si `=` dans la valeur** — `indexOf('=')` + slice. (Pas un bug pour `NEXT_LOCALE` mais le helper est réutilisable.) [`lib/i18n/detect-locale.ts:331-334`]
- [x] [Review][Patch] **`buildBaseUrl` `localhost` check case-sensitive** — `LOCALHOST:3000` reçoit `https`. Lowercase comparison. [`app/actions/auth-signin.ts:28`]
- [x] [Review][Patch] **Template `expiresInMinutes` interpolé brut** — non-number → injection HTML. `Number(expiresInMinutes) || 15`. [`lib/email/templates/magic-link.fr.ts`]
- [x] [Review][Patch] **Logger fallback stringify peut re-throw sur structure circulaire** — replacer avec `WeakSet` pour drop cycles. [`lib/logger.ts:50-64`]
- [x] [Review][Patch] **Error page `searchParams.reason` peut être array** — `?reason=a&reason=b` → Next renvoie `string[]`. `Array.isArray(reason) ? reason[0] : reason`. [`app/[locale]/(public)/auth/error/page.tsx`]

#### Deferred

- [x] [Review][Defer] **Rate-limit Upstash signin (mail-bombing / Brevo quota)** — story 1.10 hardening, explicite dans le spec out-of-scope. [`app/actions/auth-signin.ts`]
- [x] [Review][Defer] **Anti-enumeration timing leak** — valid email paie le coût Brevo, invalid répond instantanément. Atténuer en 1.10 (constant-time wrapper ou async-no-await). [`app/actions/auth-signin.ts`]
- [x] [Review][Defer] **Magic-link template `lang="fr"` hardcodé** — V1.5 quand templates AR finalisés ; ajouter param locale. [`lib/email/templates/magic-link.fr.ts`]
- [x] [Review][Defer] **Brevo 5xx traité comme erreur terminale (pas de retry/queue)** — story 1.10 hardening. [`lib/email/client.ts:35-43`]
- [x] [Review][Defer] **`request_id` toujours null dans le logger** — story 1.10 request-tracing (ALS / headers x-request-id). [`lib/logger.ts:592-597`]
- [x] [Review][Defer] **TTL magic-link hardcodée à deux endroits (action + dashboard config doc)** — drift acceptable MVP, à factoriser en `lib/email/templates/constants.ts` quand on aura un 2e template. [`app/actions/auth-signin.ts:21`, `scripts/supabase-auth-config.md`]
- [x] [Review][Defer] **`INITIAL_COMOD_EMAILS` NBSP/unicode whitespace non gérés** — env hardening, follow-up story 1.1. [`lib/env.ts`]
- [x] [Review][Defer] **Authorization community routes (uniquement authentication)** — un user `demandeur` peut accéder à `/fr/community/*`. Pas bloquant 1.6 (routes communauté pas encore créées). Définir la policy en 1.10 ou epic 2. [`proxy.ts:82-95`]
- [x] [Review][Defer] **403 Forbidden raw text sur route co_mod** — pas de page i18n. À polish quand UI co_mod arrive (story 1.8/1.10). [`proxy.ts:91-95`]
- [x] [Review][Defer] **Tests `/auth/confirm` + `/auth/signout` (intégration route handler)** — AC8 n'exige pas ; à ajouter quand Playwright wiring magic-link mock arrive (V1.5). [`tests/auth/`]

#### Dismissed (12)

- Tests "false confidence" signin-action — style, intentionnel.
- `useActionState` au lieu de `useFormState` — bon usage React 19.
- `_previous: SignInState` discard — sémantique correcte `useActionState`.
- Tests hardcodent `noreply@darna.local` — fixture intentionnelle.
- Emoji `📬` dans `pageTitle` — choix branding.
- `ALLOWED_REASONS` double type-assert — style.
- `scripts/supabase-auth-config.md` vs `.sh` — déviation justifiée dans T13.
- `magic-link.ar.ts` = re-export FR — DRY acceptable ; parité shape testée.
- Fetch `keepalive`/abort body — spéculatif, Node 22 OK.
- `confirm` route `type === 'email'` rejette `magiclink` — vérifié : Supabase v2 `admin.generateLink({type:'magiclink'})` retourne un `action_link` qui redirige avec `?type=email`. Conforme.
- `messages/ar.json` auth.\* chaînes vides — couvert par `deepMerge` (story 1.5 fallback FR).
- `messages/ar.json` namespaces manquants (`manifesto`, `transparency`, `legal`) — `deepMerge` itère sur `override` donc clés absentes héritent de base FR. OK.
