# Supabase Auth — configuration manuelle (story 1.6)

Ces réglages se font dans le dashboard Supabase ([Auth → Providers → Email] et [Auth → Sessions]). Ils ne sont pas (encore) exposés via la CLI au moment de l'écriture. À refaire pour chaque projet (dev / staging / prod).

## 1. Désactiver l'envoi e-mail natif Supabase pour le magic-link

L'envoi e-mail est désormais piloté par `lib/email/send.ts` + Brevo (AR16). Supabase ne doit plus envoyer ses propres e-mails.

1. **Auth → Email Templates → Magic Link**
2. Décocher **« Enable email »**
3. **Save**

> Vérification : sur un appel `signInWithOtp({ email })` côté dashboard test runner, aucun e-mail Supabase ne part. L'envoi passe par `auth-signin.ts` (admin.generateLink + sendTransactionalEmail).

## 2. Expiration magic-link 15 min, single-use (NFR12)

1. **Auth → Email Templates → Magic Link** (ou Auth → URL Configuration)
2. **OTP expiration** = `900` secondes (15 min)
3. **Save**

## 3. Sessions 12 mois + refresh silencieux (NFR13, AR13)

1. **Auth → Sessions**
2. **JWT expiry** = `3600` (1 heure)
3. **Refresh token reuse interval** = `10` secondes
4. **Refresh token lifetime** = `31536000` secondes (1 an / 12 mois)
5. **Inactivity timeout** = `0` (désactivé — le refresh silencieux porte la session tant qu'une requête survient)
6. **Save**

## 4. (Optionnel) Cooldown anti-spam natif

Supabase impose un cooldown serveur de 60 s entre 2 magic-link à la même adresse. Ne pas modifier. Le rate-limiting fin (3/15min/email) viendra en story 1.10 via Upstash.

## Smoke test post-config

```bash
# Depuis le dashboard SQL editor (ou local supabase):
SELECT
  raw_app_meta_data,
  email_confirmed_at,
  last_sign_in_at
FROM auth.users
WHERE email = 'ton-e-mail-test@example.com';
```

Puis depuis l'app :

1. `pnpm build && pnpm start` + tunnel HTTPS
2. Aller sur `/fr/auth/login`
3. Soumettre l'e-mail test → tu dois recevoir l'e-mail Brevo (pas Supabase)
4. Cliquer le lien → callback → redirect `/fr/admission` (404 attendu en story 1.6, livré en 1.7)
