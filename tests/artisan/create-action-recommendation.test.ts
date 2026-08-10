// @vitest-environment node
//
// Feedback bêta 2026-08-08 — la « recommandation » saisie à la création n'était
// PAS persistée. `createArtisan` lisait `comment` depuis le FormData, le validait
// par Zod, puis ne s'en servait plus jamais : aucune écriture en base. Le
// formulaire promettait « Votre recommandation (optionnel) » et jetait la saisie.
//
// Origine : la story 2.4 avait acté la persistance comme « différée à 2.6 »
// (`ratings` impose ≥1 note, donc un commentaire seul n'est pas un rating), avec
// la mention « collecté puis ignoré, OU retiré du formulaire — à acter ». La 2.6
// a livré les avis notés sans revenir sur ce champ. Aucun test ne couvrait
// l'action : le champ manquant dans l'INSERT était invisible.
//
// Ce test verrouille le contenu réel de l'INSERT `artisans`.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const artisanInsertMock = vi.fn();
const checkLimitMock = vi.fn();

// Chaîne minimale du client SESSION : from('users').select().eq().maybeSingle(),
// from('artisans').insert().select().single(), from('tags').select().in(),
// from('artisan_tags').insert(), from('profiles').update()…
function makeSessionClient() {
  return {
    from(table: string) {
      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { residence_id: 'res-1', role: 'resident' },
              }),
            }),
          }),
        };
      }
      if (table === 'artisans') {
        return {
          insert: (payload: Record<string, unknown>) => {
            artisanInsertMock(payload);
            return {
              select: () => ({
                single: async () => ({ data: { id: 'artisan-1' }, error: null }),
              }),
            };
          },
        };
      }
      if (table === 'tags') {
        return {
          select: () => ({
            in: async () => ({ data: [{ id: 'tag-1', key: 'plomberie' }] }),
          }),
        };
      }
      if (table === 'artisan_tags') {
        return { insert: async () => ({ error: null }) };
      }
      if (table === 'profiles') {
        return { update: () => ({ eq: async () => ({ error: null }) }) };
      }
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) };
    },
  };
}

function makeAdminClient() {
  // Deux chaînes distinctes sur `artisans` :
  //   findSlugByPhone   → .select().eq().is().neq().limit().maybeSingle()
  //   resolveUniqueSlug → .select().like()
  const artisansSelect = () => ({
    eq: () => ({
      is: () => ({
        neq: () => ({
          limit: () => ({ maybeSingle: async () => ({ data: null }) }),
        }),
      }),
    }),
    like: async () => ({ data: [] }),
  });
  return {
    from(table: string) {
      if (table === 'artisan_consent_tokens') {
        return { insert: async () => ({ error: null }) };
      }
      return { select: artisansSelect };
    },
  };
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => makeSessionClient(),
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => makeAdminClient(),
}));
vi.mock('@/lib/auth/require-resident', () => ({
  requireResident: async () => ({ ok: true, user: { id: 'user-1' } }),
}));
vi.mock('@/lib/rate-limit', () => ({
  checkLimit: (...args: unknown[]) => checkLimitMock(...args),
}));
vi.mock('@/lib/sms/send', () => ({
  sendTransactionalSms: async () => ({ ok: true }),
  isSmsDisabled: () => true,
}));
vi.mock('@/lib/email/send', () => ({ sendTransactionalEmail: async () => ({ ok: true }) }));
vi.mock('@/lib/comod/recipients', () => ({ fetchComodEmails: async () => [] }));
vi.mock('@/lib/logger', () => ({ log: () => undefined }));
vi.mock('@/lib/env', () => ({
  env: {
    server: { CONSENT_TOKEN_SECRET: 'c'.repeat(40) },
    client: { NEXT_PUBLIC_SITE_URL: 'https://darna.test' },
  },
}));

import { createArtisan } from '@/app/[locale]/community/annuaire/nouveau/actions';

function formDataFor(comment: string | null): FormData {
  const fd = new FormData();
  fd.set('display_name_fr', 'Younes Climatisation');
  fd.set('phone', '+212600001234');
  fd.append('tag_keys', 'plomberie');
  fd.set('visibility', 'pseudonym');
  fd.set('consent_confirmed', 'on');
  if (comment !== null) fd.set('comment', comment);
  return fd;
}

describe('createArtisan — persistance de la recommandation (feedback 2026-08-08)', () => {
  beforeEach(() => {
    artisanInsertMock.mockClear();
    checkLimitMock.mockReset();
    checkLimitMock.mockResolvedValue({ success: true });
  });

  it('écrit la recommandation dans recommendation_text', async () => {
    const texte = 'Très réactif, il est venu un dimanche pour une fuite.';
    const res = await createArtisan({ ok: false } as never, formDataFor(texte));

    expect(res.ok, `action en échec : ${JSON.stringify(res)}`).toBe(true);
    expect(artisanInsertMock).toHaveBeenCalledTimes(1);
    const payload = artisanInsertMock.mock.calls[0]![0] as Record<string, unknown>;
    expect(
      payload.recommendation_text,
      'la recommandation doit atteindre la base — régression 2026-08-08',
    ).toBe(texte);
  });

  it('met null quand le champ est vide ou absent (et non une chaîne vide)', async () => {
    for (const vide of ['', '   ', null]) {
      artisanInsertMock.mockClear();
      const res = await createArtisan({ ok: false } as never, formDataFor(vide));
      expect(res.ok).toBe(true);
      const payload = artisanInsertMock.mock.calls[0]![0] as Record<string, unknown>;
      expect(payload.recommendation_text, `entrée ${JSON.stringify(vide)}`).toBeNull();
    }
  });

  it('refuse au-delà de 500 caractères, sans écrire', async () => {
    const res = await createArtisan({ ok: false } as never, formDataFor('a'.repeat(501)));
    expect(res.ok).toBe(false);
    expect(artisanInsertMock).not.toHaveBeenCalled();
  });
});
