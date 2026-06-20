// TODO V1.5 — traduire en AR (RTL). Aujourd'hui : copie FR (le contact juridique
// est francophone au MVP). Fallback structure pour l'import dynamique.
import {
  escalationLegalTemplate as escalationLegalFr,
  type EscalationLegalVars,
  type RenderedTemplate,
} from './escalation-legal.fr';

export type { EscalationLegalVars, RenderedTemplate };

export function escalationLegalTemplate(vars: EscalationLegalVars): RenderedTemplate {
  return escalationLegalFr(vars);
}
