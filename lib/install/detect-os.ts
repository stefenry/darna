export type InstallTarget =
  | { kind: 'ios-safari' }
  | { kind: 'ios-whatsapp-webview' }
  | { kind: 'android-chrome' }
  | { kind: 'android-webview' }
  | { kind: 'desktop' }
  | { kind: 'other-mobile' };

const UA_MAX_LENGTH = 512;
const ANDROID_WEBVIEW_TOKENS =
  /FBAV|FBAN|Instagram|MicroMessenger|Line\/|GSA\/|LinkedInApp|Snapchat|Pinterest/;
const IOS_NON_SAFARI_TOKENS = /CriOS|FxiOS|EdgiOS|DuckDuckGo|OPiOS|YaBrowser/;

export function detectInstallTarget(userAgent: string | null): InstallTarget {
  if (!userAgent) return { kind: 'desktop' };

  const ua = userAgent.slice(0, UA_MAX_LENGTH);
  const isIOS = /iPhone|iPad|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);

  if (isIOS) {
    const hasInAppWebView = /WhatsApp|Instagram|FBAV|FBAN/.test(ua);
    const hasSafariToken = /Safari/.test(ua);
    const hasNonSafariIOSBrowser = IOS_NON_SAFARI_TOKENS.test(ua);

    if (hasInAppWebView || !hasSafariToken || hasNonSafariIOSBrowser) {
      return { kind: 'ios-whatsapp-webview' };
    }

    return { kind: 'ios-safari' };
  }

  if (isAndroid) {
    if (ANDROID_WEBVIEW_TOKENS.test(ua)) {
      return { kind: 'android-webview' };
    }

    const hasChrome = /Chrome/.test(ua);
    const hasEdge = /Edg\//.test(ua);
    const hasOpera = /OPR\//.test(ua);
    const hasSamsung = /SamsungBrowser/.test(ua);

    if (hasChrome && !hasEdge && !hasOpera && !hasSamsung) {
      return { kind: 'android-chrome' };
    }

    return { kind: 'other-mobile' };
  }

  return { kind: 'desktop' };
}
