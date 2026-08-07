import { describe, expect, it } from 'vitest';
import { buildCsp } from '@/lib/security/csp';

function directive(csp: string, name: string): string {
  const found = csp.split('; ').find((d) => d === name || d.startsWith(`${name} `));
  if (!found) throw new Error(`directive ${name} absente de la CSP`);
  return found;
}

describe('buildCsp (régression observabilité 2026-08-05)', () => {
  it('autorise l’origine RÉELLE du DSN GlitchTip dans connect-src', () => {
    const csp = buildCsp('https://abc123key@app.glitchtip.com/42');
    expect(directive(csp, 'connect-src')).toContain('https://app.glitchtip.com');
  });

  it('n’a plus le domaine erroné qui bloquait tous les envois', () => {
    // GlitchTip Cloud est sur `app.glitchtip.com`, PAS sur `*.glitchtip.app` :
    // ce whitelisting figé bloquait chaque envoi, même avec le bon DSN.
    const csp = buildCsp('https://abc123key@app.glitchtip.com/42');
    expect(csp).not.toContain('glitchtip.app');
  });

  it('suit un GlitchTip auto-hébergé sans modification de code', () => {
    const csp = buildCsp('https://k@errors.darnatips.app/3');
    expect(directive(csp, 'connect-src')).toContain('https://errors.darnatips.app');
  });

  it('n’ajoute aucune entrée pour un DSN absent ou bouchon', () => {
    for (const dsn of [undefined, '', 'https://placeholder@glitchtip.example/0']) {
      const csp = buildCsp(dsn);
      expect(csp).not.toContain('glitchtip');
      // La CSP reste par ailleurs intacte.
      expect(directive(csp, 'connect-src')).toContain("'self'");
    }
  });

  it('conserve les autres origines et directives de sécurité', () => {
    const csp = buildCsp('https://k@app.glitchtip.com/1');
    const connect = directive(csp, 'connect-src');
    expect(connect).toContain('https://*.supabase.co');
    expect(connect).toContain('wss://*.supabase.co');
    expect(connect).toContain('https://api.brevo.com');
    expect(connect).toContain('https://*.upstash.io');

    expect(directive(csp, 'default-src')).toBe("default-src 'self'");
    expect(directive(csp, 'frame-ancestors')).toBe("frame-ancestors 'none'");
    expect(directive(csp, 'form-action')).toBe("form-action 'self'");
    expect(directive(csp, 'base-uri')).toBe("base-uri 'self'");
    expect(csp).toContain('upgrade-insecure-requests');
    expect(directive(csp, 'img-src')).toContain('https://*.r2.cloudflarestorage.com');
  });
});
