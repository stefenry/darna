import { describe, it, expect } from 'vitest';
import { respondSmsTemplate } from './respond.fr';

describe('respondSmsTemplate', () => {
  it('inclut le nom sanitizé et le lien', () => {
    const body = respondSmsTemplate({
      artisanName: 'Hassan',
      link: 'https://darna.test/respond/abc',
    });
    expect(body).toContain('Hassan');
    expect(body).toContain('https://darna.test/respond/abc');
    expect(body).toContain('droit de reponse');
  });

  it('strip les caractères bidi/control du nom', () => {
    const body = respondSmsTemplate({ artisanName: 'Has‮san', link: 'x' });
    expect(body).toContain('Hassan');
    expect(body).not.toContain('‮');
  });

  it('fallback « voisin » si le nom est vide', () => {
    const body = respondSmsTemplate({ artisanName: '   ', link: 'x' });
    expect(body).toContain('voisin');
  });
});
