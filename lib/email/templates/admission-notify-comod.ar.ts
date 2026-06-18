// TODO V1.5 — traduire en AR (RTL). Le HTML doit recevoir `dir="rtl" lang="ar"`
// au moment de la traduction. Aujourd'hui : copie FR pour préserver la structure
// et permettre l'import dynamique sans casser le typage en V1.5.
import {
  admissionNotifyComodTemplate as admissionNotifyComodFr,
  type AdmissionNotifyComodVars,
  type RenderedTemplate,
} from './admission-notify-comod.fr';

export type { AdmissionNotifyComodVars, RenderedTemplate };

export function admissionNotifyComodTemplate(vars: AdmissionNotifyComodVars): RenderedTemplate {
  return admissionNotifyComodFr(vars);
}
