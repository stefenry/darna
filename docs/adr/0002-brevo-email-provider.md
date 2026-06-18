# 0002 — E-mail transactionnel : Brevo (pas de Resend/Postmark US)

## Context

Darna envoie des e-mails transactionnels (magic-link auth, notifications co-mod, décisions
d'admission, bienvenue/rejet). Exigences : hébergement/traitement EU (CNDP/RGPD, zéro service
hors-UE), free tier généreux, API simple. Candidats : Resend (US), Postmark (US), Brevo
(ex-Sendinblue, France).

## Decision

Utiliser **Brevo** (France, EU-résident, GDPR-native). Free tier 300 e-mails/jour (≈9000/mois,
couvre largement le MVP : ≈50 villas en bêta). Intégration via **fetch direct** sur l'API REST
v3 (`lib/email/client.ts`), **pas de SDK** (dépendance évitée). Toute la couche applicative
passe par une **boundary unique** `lib/email/send.ts` (`sendTransactionalEmail`, AR16) avec une
discriminated union de templates.

## Consequences

- ✅ Conformité EU, free tier suffisant, zéro sous-traitant US.
- ✅ Boundary unique → tous les templates testés pour la parité FR/AR + l'absence de PII dans
  les logs.
- ⚠️ Brevo 5xx traité comme erreur terminale (pas de retry/queue au MVP) — un blip perd un
  envoi ; mitigé par le fail-open côté flux (le magic-link demandeur prime) ; retry/queue
  différé post-MVP.
- ⚠️ Le domaine expéditeur doit être vérifié dans Brevo (sinon spam) — cf. `docs/ops/brevo-sender-setup.md`.

## Status

Accepted — décision step-04. Implémenté stories 1.6 (magic-link), 1.7/1.8 (admission/décision).
