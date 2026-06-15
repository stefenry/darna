import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';

beforeAll(() => {
  if (typeof window !== 'undefined' && !window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }
});
import { NextIntlClientProvider } from 'next-intl';
import frMessages from '@/messages/fr.json';
import { IOSSafariInstructions } from '@/app/[locale]/(public)/install/ios-safari-instructions';
import { AndroidChromeInstall } from '@/app/[locale]/(public)/install/android-chrome-install';
import { DesktopInstall } from '@/app/[locale]/(public)/install/desktop-install';

vi.mock('next-intl/server', async () => {
  const actual = await vi.importActual<typeof import('next-intl/server')>('next-intl/server');
  return {
    ...actual,
    getTranslations: async (arg: string | { locale?: string; namespace: string }) => {
      const namespace = typeof arg === 'string' ? arg : arg.namespace;
      const parts = namespace.split('.');
      let node: unknown = frMessages;
      for (const p of parts) {
        if (node && typeof node === 'object') {
          node = (node as Record<string, unknown>)[p];
        } else {
          node = undefined;
        }
      }
      return (key: string, values?: Record<string, string | number>) => {
        if (!node || typeof node !== 'object') return key;
        const value = (node as Record<string, unknown>)[key];
        if (typeof value !== 'string') return key;
        if (!values) return value;
        return value.replace(/\{(\w+)\}/g, (_, name: string) =>
          name in values ? String(values[name]) : `{${name}}`,
        );
      };
    },
  };
});

vi.mock('next/headers', () => ({
  headers: async () =>
    new Headers({
      host: 'darna.app',
      'x-forwarded-proto': 'https',
    }),
}));

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

function renderWithIntl(node: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="fr" messages={frMessages}>
      {node}
    </NextIntlClientProvider>,
  );
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('install page sub-components', () => {
  it('iOS Safari instructions render the 3 steps and WhatsApp notice', async () => {
    const ui = await IOSSafariInstructions();
    renderWithIntl(ui);

    expect(screen.getByText(frMessages.install.ios.step1Title)).toBeInTheDocument();
    expect(screen.getByText(frMessages.install.ios.step2Title)).toBeInTheDocument();
    expect(screen.getByText(frMessages.install.ios.step3Title)).toBeInTheDocument();
    expect(screen.getByText(frMessages.install.ios.whatsappNotice)).toBeInTheDocument();
  });

  it('Android Chrome install renders fallback after 1500ms', () => {
    vi.useFakeTimers();
    renderWithIntl(<AndroidChromeInstall />);

    expect(screen.queryByText(frMessages.install.android.fallbackTitle)).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1600);
    });

    expect(screen.getByText(frMessages.install.android.fallbackTitle)).toBeInTheDocument();
    expect(screen.getByText(frMessages.install.android.faqQuestion)).toBeInTheDocument();
  });

  it('Desktop install renders a QR <img> and the absolute URL', async () => {
    const prev = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = 'https://darna.app';
    try {
      const ui = await DesktopInstall({ locale: 'fr' });
      renderWithIntl(ui);

      const qrAltExpected = frMessages.install.desktop.qrAlt.replace(
        '{url}',
        'https://darna.app/fr/install',
      );

      expect(screen.getByAltText(qrAltExpected)).toBeInTheDocument();
      expect(screen.getByText('https://darna.app/fr/install')).toBeInTheDocument();
      expect(screen.getByText(frMessages.install.desktop.instructionsTitle)).toBeInTheDocument();
    } finally {
      process.env.NEXT_PUBLIC_SITE_URL = prev;
    }
  });
});
