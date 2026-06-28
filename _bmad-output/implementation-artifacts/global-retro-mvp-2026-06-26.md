# Rétrospective globale — Darna MVP (Epics 1 → 8)

**Date :** 2026-06-26
**Périmètre :** projet complet, 8 epics, 52 stories, toutes `done`
**Facilitation :** Amelia (Developer) · Participant : Stephane (Project Lead)
**Première rétrospective du projet** (aucune rétro d'epic antérieure).

---

## 1. Métriques de livraison (faits, pas d'estimations temps)

| Indicateur                                 | Valeur                                                   |
| ------------------------------------------ | -------------------------------------------------------- |
| Epics livrés                               | 8 / 8 (`epic-1..8`)                                      |
| Stories livrées                            | 52 / 52 `done`                                           |
| Répartition                                | E1:13 · E2:8 · E3:5 · E4:5 · E5:5 · E6:5 · E7:6 · E8:5   |
| Items de dette tracés (`deferred-work.md`) | **165**                                                  |
| Rétrospectives antérieures                 | 0 (celle-ci est la 1re)                                  |
| Décision structurante                      | MVP **FR-only** (2026-05-23), AR différé V1.5            |
| Cible bêta                                 | **début juillet 2026** → **imminente (~quelques jours)** |

> Amelia (Developer) : « 52 stories, 8 epics, zéro rétro en cours de route — on a livré tête baissée. C'est l'occasion de capitaliser avant la bêta. »

---

## 2. Ce qui a bien marché (patterns à reproduire)

1. **RPC `SECURITY DEFINER` pour mutation + audit atomiques.** Le pattern « RPC qui mute + écrit `moderation_log` dans la même transaction, re-check rôle/résidence en interne » est devenu la colonne vertébrale (admission, modération, escalade, consent, retrait, purge). Robuste, testable, défense en profondeur.
2. **`moderation_log` comme piste d'audit immuable + vue publique redactée.** Un seul journal, `security_invoker=false`, whitelist colonnes/actions, pseudonymes uniquement. Il a directement nourri 3 features (journal 5.4, export CNDP 8.4, compteurs 8.1) sans retouche du modèle. Excellent investissement.
3. **RLS + GRANT colonne en défense en profondeur.** Tenant figé (jamais lu du form), `residence_id` déduit du JWT, grants colonne explicites. La sécurité by-design a tenu sur 8 epics.
4. **Discipline `deferred-work.md`.** 165 items datés, localisés (`fichier:ligne`), avec raison du report et jalon cible. C'est ce qui rend CETTE rétro possible et la bêta pilotable. À garder comme rituel.
5. **Conventions partagées.** Templates email `*.fr.ts`/`*.ar.ts`, `lib/logger` avec strip-PII systématique, `requireResident`/`requireComod`, pagination keyset composite, `MarkdownRender` durci (skipHtml, no-img, urlTransform). Réutilisés tels quels en epic 8 → vélocité.
6. **Consolidation du hardening (story 1.10 → 1.10a/b/c/d).** Plutôt que disperser, regrouper les durcissements sécurité/ops en clusters indépendants a payé.

---

## 3. Ce qui a coincé (thèmes récurrents — systémiques, sans blâme)

### 3.1 🔴 La vérification au runtime est massivement reportée (thème n°1)

Présent à chaque epic. Trois sous-chaînes jamais exécutées réellement :

- **`pnpm test:rls`** : suite gated `skipIf`, validée par assertion sur PG nu, **jamais rejouée sur Docker réel** (1.x, 2.1, 2.2…). `types.generated.ts` **écrit à la main**, `gen:types` jamais rejoué.
- **E2E (`pnpm e2e`)** : Serwist KO sous Turbopack, jsdom incompatible `useActionState`/webhooks POST. Offline, replay background-sync, flows webhook consent/respond → **non vérifiés**.
- **Magic-link** : le doute `generateLink({type:'magiclink'})` vs guard `type!=='email'` traîne depuis 1.6 → « valider E2E obligatoire pré-bêta » répété 3×. Docker Colima était down pendant le dev 1.7.

**Risque :** la bêta est à quelques jours et le chemin critique de vérification n'a jamais tourné de bout en bout sur un environnement réel.

### 3.2 🟠 R2 jamais provisionné → workarounds en cascade

`R2_*` optionnels depuis le début. Conséquences : backup hebdo = **no-op** (`r2_not_configured`), dossier escalade (5.5) et exports RGPD/CNDP (8.3/8.4) basculés sur **Supabase Storage**. Les workarounds sont propres et documentés, mais : **aucune sauvegarde réelle n'existe encore**, et les lifecycle policies (purge 24h exports, 12 sem. dumps) restent à poser.

### 3.3 🟠 La dette AR/RTL s'accumule (conséquence assumée du FR-only)

Décision MVP FR-only saine, mais elle a essaimé : templates AR = fallback FR, bugs RTL annuaire/fiche (`tel:`, overflow, `<bdi>`), manifest `lang:fr`/`dir:ltr` codés en dur, namespace `transparency` absent en AR. La **structure** est prête (clés, fichiers, `dir` dynamique), mais V1.5 = un vrai chantier i18n, pas un interrupteur.

### 3.4 🟡 Hypothèses mono-résidence codées en dur (dette V3)

`RESIDENCE_ID_DARNA` constant, `villa CHECK 1..150`, `LEGAL_CONTACT_EMAIL` unique, compteurs/exports globaux non bornés par résidence. Cohérent au MVP, à dé-câbler avant tout multi-tenant.

### 3.5 🟡 Écart de process sur l'epic 8

Epic 8 a été **développé en direct, sans story files BMad** (pas de `create-story`/`dev-story`). Code livré, testé, tracé — mais l'epic n'a pas d'artefacts de story comme les epics 1-7. Vélocité gagnée, traçabilité BMad perdue.

### 3.6 🟡 Tests préexistants cassés (typecheck rouge)

7 tests (`tests/artisan|community|comod/*`) importent `*_INITIAL` depuis `actions` alors que ces constantes ont migré vers `state.ts` (commit `7bcfff4`, epic 2). **`pnpm typecheck` est rouge depuis epic 2** — passé inaperçu jusqu'à epic 8.

---

## 4. Continuité (pas de rétro antérieure)

C'est la première rétrospective : aucun engagement antérieur à auditer. La bonne nouvelle — `deferred-work.md` a tenu le rôle de mémoire long-terme. La moins bonne — sans rétro régulière, les thèmes récurrents (3.1 surtout) ne se sont jamais transformés en action corrective ; ils se sont juste empilés story après story.

**Engagement n°1 pour la suite :** une rétro courte en fin d'epic, pas seulement en fin de MVP.

---

## 5. Plan d'action — chemin critique avant bêta

> Priorité absolue : transformer « vérifié par assertion » en « vérifié au runtime ». Tout le reste est secondaire tant que ceci n'est pas fait.

**🔴 BLOQUANT bêta (vérification runtime) :**

1. `supabase db reset && pnpm test:rls` sur Docker réel + `pnpm gen:types` rejoué (diff byte-à-byte vs `types.generated.ts`). — _valide RLS + types des 8 epics d'un coup_
2. Smoke E2E du flow magic-link sur clic réel (signin + admission acceptée → `/community`). — _lève le doute `type:'magiclink'` qui traîne depuis 1.6_
3. `pnpm e2e` offline + webhooks (consent/respond) sur build webpack + device réel.
4. Appliquer les 2 migrations epic 8 (`20260709090000`, `20260709090100`) sur staging.

**🟠 Réglages hors-code (à poser avant bêta) :** 5. Provisionner R2 + secrets, dérouler un 1er dump backup réel (runbook §4). 6. Lifecycle policies Storage : purge 24h exports, 12 sem. dumps. Vercel log retention = 30j, GlitchTip ≤ 90j (runbook §6, dashboards). 7. Vérifier domaine expéditeur Brevo (sinon magic-links en spam) + couverture SMS Maroc.

**🟡 Hygiène (rapide, fort ROI) :** 8. Corriger les 7 imports `*_INITIAL` (`actions` → `../state`) → typecheck vert + CI fiable. 9. Test device réel iOS (install PWA WhatsApp WebView, parcours Salma).

**Différé assumé post-bêta / V1.5 :** chantier AR/RTL complet, dé-câblage mono-résidence (V3), durcissements timing/anti-enum résiduels, présence live Realtime modération.

---

## 6. Découverte significative

⚠️ **Désalignement calendrier ↔ readiness.** La cible bêta (début juillet) arrive alors que le chemin critique de vérification runtime (§5.1-5.4) **n'a jamais tourné**. Ce n'est pas un problème de code (les 52 stories sont AC-conformes par assertion) mais un problème de **preuve d'exécution**. Recommandation : traiter §5 items 1-4 comme une « checklist go/no-go bêta » explicite, et ne pas dater la bêta tant qu'ils ne sont pas verts.

---

## 7. Décisions structurantes validées sur le MVP (référence)

- ADR-driven : 8 ADRs (Supabase EU, R2 backup, FTS Postgres, FR-only…).
- Sécurité : RLS + grants colonne + RPC SECURITY DEFINER + `moderation_log` immuable.
- Transparence radicale : journal public redacté + compteurs agrégés no-PII + exports RGPD/CNDP self-service.
- Conformité : données 100% UE (loi 09-08 art. 43), purge J+7 comptes, rétention 30j logs, zéro analytics.

---

_Rétrospective générée le 2026-06-26. Prochaine étape : exécuter la checklist go/no-go bêta (§5)._
