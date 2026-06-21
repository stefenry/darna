// Story 5.5 — génération du dossier d'escalade juridique (Markdown). PII-SAFE :
// ne contient JAMAIS de PII d'autres résidents que les parties impliquées (auteur
// cible + reporter), et même pour celles-ci seulement des identifiants
// pseudonymisés + des données structurelles + le snippet de contenu signalé.
// Aucun e-mail, aucun nom réel.

import { TARGET_LABELS_FR, REASON_LABELS_FR } from '@/lib/moderation/labels';

// Libellés FR lisibles pour un juriste (MVP FR-only) ; repli sur le code brut
// (ex. `inconnu`) si non répertorié.
function labelTarget(t: string): string {
  return (TARGET_LABELS_FR as Record<string, string>)[t] ?? t;
}
function labelReason(r: string): string {
  return (REASON_LABELS_FR as Record<string, string>)[r] ?? r;
}

export type DossierInput = {
  reportId: string;
  targetType: string;
  reason: string;
  reporterNote: string | null;
  contextNote: string;
  targetTitle: string;
  targetBody: string | null;
  authorPseudonym: string | null; // pseudonyme (pas le nom réel)
  reporterPseudonym: string;
  priorActions: { action: string; createdAt: string }[];
  generatedAtIso: string;
};

function redactPseudonym(id: string | null): string | null {
  if (!id) return null;
  return `#${id.replace(/-/g, '').slice(-6).toUpperCase()}`;
}

// Les pseudonymes/identifiants sont PII-safe par construction. Mais les CHAMPS
// LIBRES (note du signalant, contexte du co_mod) peuvent contenir, par
// inadvertance, la PII d'un TIERS non partie (« appeler M. X au 06… / x@… »).
// On la redacte → la garantie AC6 (« jamais de PII d'autres résidents que les
// parties ») couvre aussi le texte libre, pas seulement les identifiants. Le
// contenu signalé (titre/corps) reste intact : c'est l'objet de l'avis juridique.
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
// Séquences « téléphone » : +212…, 06 12 34 56 78, (0)5-… — ≥8 chiffres (un repère
// AAAA-MM-JJ peut aussi être masqué : acceptable, on err vers la redaction).
const PHONE_RE = /\+?\d[\d\s().-]{6,}\d/g;

export function scrubThirdPartyPii(text: string): string {
  return text
    .replace(EMAIL_RE, '[e-mail masqué]')
    .replace(PHONE_RE, (m) => ((m.match(/\d/g)?.length ?? 0) >= 8 ? '[numéro masqué]' : m));
}

export function authorPseudonymFromId(authorId: string | null): string | null {
  return redactPseudonym(authorId);
}

export function generateDossierMarkdown(input: DossierInput): string {
  const lines: string[] = [];
  lines.push(`# Dossier d'escalade juridique — Darna`);
  lines.push('');
  lines.push(`- **Référence signalement** : ${input.reportId}`);
  lines.push(`- **Date du dossier** : ${input.generatedAtIso}`);
  lines.push(`- **Type de contenu** : ${labelTarget(input.targetType)}`);
  lines.push(`- **Motif du signalement** : ${labelReason(input.reason)}`);
  lines.push('');
  lines.push(`## Parties impliquées (pseudonymisées)`);
  lines.push('');
  lines.push(`- **Auteur du contenu** : ${input.authorPseudonym ?? 'inconnu / anonymisé'}`);
  lines.push(`- **Signalant** : ${input.reporterPseudonym}`);
  lines.push('');
  lines.push(`> Aucune donnée personnelle identifiante (nom, e-mail, téléphone) n'est`);
  lines.push(`> incluse dans ce dossier, conformément à la minimisation CNDP.`);
  lines.push('');
  lines.push(`## Contenu signalé`);
  lines.push('');
  lines.push(`**${input.targetTitle || '(sans titre)'}**`);
  if (input.targetBody) {
    lines.push('');
    lines.push('```');
    lines.push(input.targetBody.slice(0, 4000));
    lines.push('```');
  }
  lines.push('');
  if (input.reporterNote) {
    lines.push(`## Note du signalant`);
    lines.push('');
    lines.push(scrubThirdPartyPii(input.reporterNote));
    lines.push('');
  }
  lines.push(`## Contexte fourni par le co-modérateur`);
  lines.push('');
  lines.push(scrubThirdPartyPii(input.contextNote));
  lines.push('');
  if (input.priorActions.length > 0) {
    lines.push(`## Historique des actions de modération sur ce contenu`);
    lines.push('');
    for (const a of input.priorActions) {
      lines.push(`- ${a.createdAt} — ${a.action}`);
    }
    lines.push('');
  }
  lines.push('---');
  lines.push('');
  lines.push(`Dossier généré automatiquement par Darna pour avis juridique.`);
  return lines.join('\n');
}

// Résumé court pour le corps de l'e-mail au contact juridique.
export function dossierSummary(input: DossierInput): string {
  return `Signalement ${input.reportId} — ${labelTarget(input.targetType)} — motif : ${labelReason(input.reason)}.`;
}
