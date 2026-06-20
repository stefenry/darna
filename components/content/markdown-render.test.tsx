// Story 3.2 (Task 1 / AC8) — renderer Markdown : rendu titres/listes/liens +
// preuve XSS-safe (HTML brut inerte via skipHtml, pas de rehype-raw).

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MarkdownRender } from '@/components/content/markdown-render';

describe('MarkdownRender', () => {
  it('rend titres, listes et liens', () => {
    render(
      <MarkdownRender source={'# Titre\n\n- un\n- deux\n\nVoir [le site](https://example.com).'} />,
    );
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Titre');
    expect(screen.getByText('un')).toBeDefined();
    expect(screen.getByText('deux')).toBeDefined();
    const link = screen.getByRole('link', { name: 'le site' });
    expect(link.getAttribute('href')).toBe('https://example.com');
  });

  it('lien externe a rel="noopener noreferrer" et target=_blank', () => {
    render(<MarkdownRender source={'[ext](https://example.com)'} />);
    const link = screen.getByRole('link', { name: 'ext' });
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('lien interne (/) reste sans target=_blank', () => {
    render(<MarkdownRender source={'[guide](/fr/community/guide/codes)'} />);
    const link = screen.getByRole('link', { name: 'guide' });
    expect(link.getAttribute('href')).toBe('/fr/community/guide/codes');
    expect(link.getAttribute('target')).toBeNull();
  });

  it('HTML brut <script> est inerte (skipHtml) — pas de balise script dans le DOM', () => {
    const { container } = render(
      <MarkdownRender source={'Bonjour\n\n<script>alert(1)</script>\n\nfin'} />,
    );
    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).not.toContain('alert(1)');
  });

  it('HTML brut <img onerror> est inerte (skipHtml) — pas de balise img injectée', () => {
    const { container } = render(<MarkdownRender source={'<img src=x onerror="alert(1)">'} />);
    expect(container.querySelector('img')).toBeNull();
  });

  // Review 3.2 P2 — syntaxe markdown `![](url)` doit aussi être inerte
  // (anti-leak Referer + tracking pixel).
  it('syntaxe markdown image ![alt](url) est désactivée (disallowedElements)', () => {
    const { container } = render(
      <MarkdownRender source={'![tracker](https://attacker.example/pixel.gif)'} />,
    );
    expect(container.querySelector('img')).toBeNull();
  });

  // Review 3.2 P3 — urlTransform strict : seuls http(s) absolu ET relatifs
  // commençant par `/xxx` (pas `//xxx`) sont autorisés.
  it("lien javascript: est neutralisé (href='')", () => {
    const { container } = render(<MarkdownRender source={'[evil](javascript:alert(1))'} />);
    const link = container.querySelector('a');
    expect(link?.getAttribute('href') ?? '').toBe('');
  });

  it('lien mailto: est neutralisé (urlTransform whitelist)', () => {
    const { container } = render(<MarkdownRender source={'[mail](mailto:x@y.com)'} />);
    expect(container.querySelector('a')?.getAttribute('href') ?? '').toBe('');
  });

  it('lien protocol-relative //evil.com est neutralisé', () => {
    const { container } = render(<MarkdownRender source={'[evil](//attacker.example)'} />);
    expect(container.querySelector('a')?.getAttribute('href') ?? '').toBe('');
  });

  it('lien data:text/html est neutralisé', () => {
    const { container } = render(
      <MarkdownRender source={'[evil](data:text/html,<script>alert(1)</script>)'} />,
    );
    expect(container.querySelector('a')?.getAttribute('href') ?? '').toBe('');
  });
});
