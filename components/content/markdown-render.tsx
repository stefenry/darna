// Story 3.2 (AC3/AC8) — renderer Markdown partagé (Guide 3.2, Pack 3.4, preview
// co_mod 3.5). RSC-compatible (pas de 'use client' — fonctionne aussi côté client
// pour la preview live de l'éditeur 3.5).
//
// SÉCURITÉ (AR17) : aucun HTML brut rendu. `skipHtml` ignore tout nœud HTML d'un
// `body_*_markdown` (pas de `rehype-raw`) → `<script>` / `<img onerror=…>` sont
// inertes, jamais injectés dans le DOM. `urlTransform` (défaut react-markdown)
// neutralise les URLs dangereuses (`javascript:` …). Liens externes en
// `rel="noopener noreferrer"`.

import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

// Tokens borderless v2 : prose sobre, liens accent, pas de dépendance au plugin
// `prose` Tailwind (non installé) → classes utilitaires explicites.
const components: Components = {
  h1: ({ children }) => (
    <h1 className="mt-6 mb-2 text-2xl font-semibold tracking-tight text-neutral-900 first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-5 mb-2 text-xl font-semibold tracking-tight text-neutral-900 first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-4 mb-1.5 text-lg font-semibold text-neutral-900 first:mt-0">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="my-3 text-base leading-relaxed text-neutral-800">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="my-3 list-disc space-y-1 ps-5 text-base text-neutral-800">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-3 list-decimal space-y-1 ps-5 text-base text-neutral-800">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-neutral-900">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-s-4 border-neutral-200 ps-4 text-neutral-600 italic">
      {children}
    </blockquote>
  ),
  code: ({ children }) => (
    <code className="rounded bg-bg-soft px-1.5 py-0.5 font-mono text-sm text-neutral-800">
      {children}
    </code>
  ),
  a: ({ href, children }) => {
    const isExternal = typeof href === 'string' && /^https?:\/\//.test(href);
    return (
      <a
        href={href}
        className="font-medium text-accent-600 underline underline-offset-2 hover:text-accent-700"
        {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {children}
      </a>
    );
  },
};

export function MarkdownRender({ source }: { source: string }) {
  return (
    <div className="break-words">
      <Markdown remarkPlugins={[remarkGfm]} skipHtml components={components}>
        {source}
      </Markdown>
    </div>
  );
}
