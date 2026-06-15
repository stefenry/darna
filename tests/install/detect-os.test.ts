import { describe, expect, it } from 'vitest';
import { detectInstallTarget } from '@/lib/install/detect-os';

const UA = {
  iosSafari17:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  iosWhatsApp:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 WhatsApp/24.4.79',
  iosFacebook:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/450.0.0]',
  iosChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/123.0.6312.52 Mobile/15E148 Safari/604.1',
  iosFirefox:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/125.0 Mobile/15E148 Safari/605.1.15',
  iosEdge:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) EdgiOS/123.0.0.0 Mobile/15E148 Safari/604.1',
  ipadSafari:
    'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  androidChrome14:
    'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.6312.118 Mobile Safari/537.36',
  androidFacebookWebview:
    'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.6312.118 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/450.0.0.0]',
  androidInstagramWebview:
    'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.6312.118 Mobile Safari/537.36 Instagram 320.0.0.0',
  androidWeChat:
    'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 MicroMessenger/8.0.40',
  androidSamsung:
    'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/115.0.0.0 Mobile Safari/537.36',
  androidEdge:
    'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.6312.118 Mobile Safari/537.36 EdgA/123.0.0.0 Edg/123.0.0.0',
  androidFirefox: 'Mozilla/5.0 (Android 14; Mobile; rv:125.0) Gecko/125.0 Firefox/125.0',
  desktopChrome:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  desktopEdge:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.2420.65',
} as const;

describe('detectInstallTarget', () => {
  it('detects iOS Safari', () => {
    expect(detectInstallTarget(UA.iosSafari17)).toEqual({ kind: 'ios-safari' });
    expect(detectInstallTarget(UA.ipadSafari)).toEqual({ kind: 'ios-safari' });
  });

  it('detects in-app WebView on iOS (WhatsApp, Facebook)', () => {
    expect(detectInstallTarget(UA.iosWhatsApp)).toEqual({
      kind: 'ios-whatsapp-webview',
    });
    expect(detectInstallTarget(UA.iosFacebook)).toEqual({
      kind: 'ios-whatsapp-webview',
    });
  });

  it('routes non-Safari iOS browsers to the WebView banner (Chrome iOS, Firefox iOS, Edge iOS)', () => {
    expect(detectInstallTarget(UA.iosChrome)).toEqual({
      kind: 'ios-whatsapp-webview',
    });
    expect(detectInstallTarget(UA.iosFirefox)).toEqual({
      kind: 'ios-whatsapp-webview',
    });
    expect(detectInstallTarget(UA.iosEdge)).toEqual({
      kind: 'ios-whatsapp-webview',
    });
  });

  it('detects Android Chrome', () => {
    expect(detectInstallTarget(UA.androidChrome14)).toEqual({
      kind: 'android-chrome',
    });
  });

  it('detects Android in-app WebViews (FB, Instagram, WeChat)', () => {
    expect(detectInstallTarget(UA.androidFacebookWebview)).toEqual({
      kind: 'android-webview',
    });
    expect(detectInstallTarget(UA.androidInstagramWebview)).toEqual({
      kind: 'android-webview',
    });
    expect(detectInstallTarget(UA.androidWeChat)).toEqual({
      kind: 'android-webview',
    });
  });

  it('flags non-Chrome Android browsers as other-mobile', () => {
    expect(detectInstallTarget(UA.androidSamsung)).toEqual({
      kind: 'other-mobile',
    });
    expect(detectInstallTarget(UA.androidEdge)).toEqual({
      kind: 'other-mobile',
    });
    expect(detectInstallTarget(UA.androidFirefox)).toEqual({
      kind: 'other-mobile',
    });
  });

  it('detects desktop', () => {
    expect(detectInstallTarget(UA.desktopChrome)).toEqual({ kind: 'desktop' });
    expect(detectInstallTarget(UA.desktopEdge)).toEqual({ kind: 'desktop' });
  });

  it('defaults to desktop when UA is missing', () => {
    expect(detectInstallTarget(null)).toEqual({ kind: 'desktop' });
    expect(detectInstallTarget('')).toEqual({ kind: 'desktop' });
  });

  it('caps oversized User-Agent strings to bound regex cost', () => {
    const padded = 'A'.repeat(10_000) + UA.iosSafari17;
    // The story 1-5 token "iPhone" is past the slice window; expect desktop default.
    expect(detectInstallTarget(padded)).toEqual({ kind: 'desktop' });
  });
});
