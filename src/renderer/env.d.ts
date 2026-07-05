/// <reference types="svelte" />
/// <reference types="vite/client" />

import type { ReplaiApi } from '../preload/index'

declare global {
  interface Window {
    api: ReplaiApi
  }
}

export {}
