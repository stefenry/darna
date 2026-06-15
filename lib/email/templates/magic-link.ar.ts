// TODO V1.5 — traduire en AR (RTL). Le HTML doit recevoir `dir="rtl" lang="ar"`
// au moment de la traduction. Aujourd'hui : copie FR pour préserver la structure
// et permettre l'import dynamique sans casser le typage en V1.5.
import {
  magicLinkTemplate as magicLinkTemplateFr,
  type MagicLinkVars,
  type RenderedTemplate,
} from './magic-link.fr';

export type { MagicLinkVars, RenderedTemplate };

export function magicLinkTemplate(vars: MagicLinkVars): RenderedTemplate {
  return magicLinkTemplateFr(vars);
}
