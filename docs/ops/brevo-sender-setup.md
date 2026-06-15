# Brevo sender domain setup — `darna.org`

Story 1.6 livre la stack technique d'envoi e-mail mais la **délivrabilité** (≥ 95 % cible, NFR44 + risque T1) dépend des DNS records SPF/DKIM/DMARC du domaine sender. Ce document est la checklist ops.

> **Domaine recommandé** : `darna.org` (cohérent avec la documentation PRD figée).
> **Adresse sender** : `noreply@darna.org`.
> **NE PAS** utiliser `darna.app` (deferred 1.2, non vérifié).

## 1. Créer le sender dans Brevo

1. Dashboard Brevo → **Senders & IPs** → **Senders** → **Add a sender**
2. Sender name : `Darna`
3. Sender e-mail : `noreply@darna.org`
4. **Save** — Brevo envoie un e-mail de vérification à cette adresse (ou demande validation DNS).

## 2. DNS records (registrar darna.org)

### 2.1 SPF

```
Type:  TXT
Name:  @ (apex)
Value: "v=spf1 include:spf.sendinblue.com -all"
TTL:   3600
```

> Si un autre provider envoie déjà des e-mails depuis ce domaine, fusionner :
> `"v=spf1 include:spf.sendinblue.com include:_spf.google.com -all"`

### 2.2 DKIM (CNAME fourni par Brevo)

Brevo génère 2 records CNAME (1 sélecteur + 1 sélecteur de secours). Dans Brevo → **Senders & IPs → Domains → darna.org → Authenticate** :

```
Type:  CNAME
Name:  mail._domainkey.darna.org
Value: mail.domainkey.brevo.com

Type:  CNAME
Name:  mail2._domainkey.darna.org
Value: mail2.domainkey.brevo.com
```

> **Les valeurs exactes peuvent varier** — copier celles fournies par Brevo.

### 2.3 DMARC

```
Type:  TXT
Name:  _dmarc.darna.org
Value: "v=DMARC1; p=quarantine; rua=mailto:dmarc@darna.org; aspf=s; adkim=s"
TTL:   3600
```

> Démarrer en `p=quarantine` 30 jours, monter à `p=reject` après vérification rapports DMARC sans incident.

### 2.4 BIMI (optionnel, V1.5)

Logo Darna visible dans Gmail/Yahoo si BIMI + VMC. Hors scope MVP.

## 3. Vérification

```bash
./scripts/check-brevo-domain.sh darna.org
```

Le script vérifie SPF, DKIM (sélecteur `mail`), DMARC.

Puis test délivrabilité :

1. https://www.mail-tester.com/ — créer un test → envoyer via le tunnel HTTPS magic-link → score cible **≥ 8/10**
2. Envoyer un magic-link de test à 5 providers : Gmail, Outlook, Yahoo, ProtonMail, Free
3. Vérifier tous arrivent en **inbox** (pas spam, pas promotions)

## 4. Monitoring post-déploiement

- Brevo dashboard → **Statistics** → bounce rate < 2 %, spam complaints < 0.1 %
- Rapports DMARC envoyés à `dmarc@darna.org` chaque jour → revue hebdo en bêta

## Liens

- Brevo SPF guide : https://help.brevo.com/hc/en-us/articles/209507625
- DMARC.org generator : https://dmarc.org/
- Mail Tester : https://www.mail-tester.com/
