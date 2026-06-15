// CAVEAT TURBOPACK : Serwist 9.x ne tourne PAS en dev Turbopack.
// Utiliser `pnpm dev:webpack` pour itérer sur le SW en local.
// La prod (`pnpm build && pnpm start`) marche normalement.
import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { Serwist } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope & {
  registration: ServiceWorkerRegistration & {
    navigationPreload?: { enable: () => Promise<void> };
  };
};

const supportsNavigationPreload =
  typeof self !== 'undefined' && 'registration' in self && 'navigationPreload' in self.registration;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST ?? [],
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: supportsNavigationPreload,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();
