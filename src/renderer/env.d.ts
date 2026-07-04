/// <reference types="svelte" />
/// <reference types="vite/client" />

import type { FipsiApi } from '../preload/index'

declare global {
  interface Window {
    api: FipsiApi
  }
}

export {}
