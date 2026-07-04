import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'

/**
 * Resolves a file shipped in `resources/`, working in both dev and the packaged
 * app (electron-builder copies `resources/` via extraResources).
 */
export function resourcePath(name: string): string {
  const base = is.dev
    ? join(__dirname, '../../resources')
    : join(process.resourcesPath, 'resources')
  return join(base, name)
}
