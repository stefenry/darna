// TODO V1.5 — traduire en AR (RTL). Aujourd'hui : copie FR (fallback structure).
import {
  contentRemovedAuthorTemplate as contentRemovedAuthorFr,
  type ContentRemovedAuthorVars,
  type RenderedTemplate,
} from './content-removed-author.fr';

export type { ContentRemovedAuthorVars, RenderedTemplate };

export function contentRemovedAuthorTemplate(vars: ContentRemovedAuthorVars): RenderedTemplate {
  return contentRemovedAuthorFr(vars);
}
