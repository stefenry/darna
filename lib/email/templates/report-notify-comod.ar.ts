// TODO V1.5 — traduire en AR (RTL). Le HTML doit recevoir `dir="rtl" lang="ar"`
// au moment de la traduction. Aujourd'hui : copie FR pour préserver la structure
// et permettre l'import dynamique sans casser le typage en V1.5.
import {
  reportNotifyComodTemplate as reportNotifyComodFr,
  type ReportNotifyComodVars,
  type RenderedTemplate,
} from './report-notify-comod.fr';

export type { ReportNotifyComodVars, RenderedTemplate };

export function reportNotifyComodTemplate(vars: ReportNotifyComodVars): RenderedTemplate {
  return reportNotifyComodFr(vars);
}
