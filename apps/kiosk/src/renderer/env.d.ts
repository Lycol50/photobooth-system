/// <reference types="vite/client" />

import type { GraceBoothBridge } from '@grace-booth/shared';

declare global {
  // Window is an existing platform interface and must be augmented, not replaced by a type alias.
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface Window {
    graceBooth?: GraceBoothBridge;
  }
}

export {};
