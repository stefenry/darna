// TODO V1.5 — traduire en AR (RTL). Aujourd'hui : copie FR (fallback structure).
import {
  reportKeptReporterTemplate as reportKeptReporterFr,
  type ReportKeptReporterVars,
  type RenderedTemplate,
} from './report-kept-reporter.fr';

export type { ReportKeptReporterVars, RenderedTemplate };

export function reportKeptReporterTemplate(vars: ReportKeptReporterVars): RenderedTemplate {
  return reportKeptReporterFr(vars);
}
