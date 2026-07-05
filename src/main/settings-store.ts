import { app, safeStorage } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import type { AppConfig } from '@shared/types'
import { DEFAULT_MODEL_ID, getModel } from '@shared/models'
import { DEFAULT_PRESET_ID, getPreset } from '@shared/styles'

/**
 * Persists non-secret config as JSON and the OpenRouter API key encrypted via
 * Electron `safeStorage` (Keychain-backed on macOS).
 *
 * Privacy rules (plan §5): the key is never written in plaintext and never
 * handed to a renderer process.
 */
export class SettingsStore {
  private readonly configPath = join(app.getPath('userData'), 'config.json')
  private readonly keyPath = join(app.getPath('userData'), 'key.enc')

  private config: AppConfig = {
    modelId: DEFAULT_MODEL_ID,
    presetId: DEFAULT_PRESET_ID
  }

  constructor() {
    this.loadConfig()
  }

  private loadConfig(): void {
    try {
      if (existsSync(this.configPath)) {
        const raw = JSON.parse(readFileSync(this.configPath, 'utf8')) as Partial<AppConfig>
        // Validate against the curated lists — fall back to defaults if stale.
        this.config = {
          modelId: raw.modelId && getModel(raw.modelId) ? raw.modelId : DEFAULT_MODEL_ID,
          presetId: raw.presetId && getPreset(raw.presetId) ? raw.presetId : DEFAULT_PRESET_ID
        }
      }
    } catch (err) {
      console.error('[settings] failed to read config, using defaults:', (err as Error).message)
    }
  }

  getConfig(): AppConfig {
    return { ...this.config }
  }

  setConfig(next: Partial<AppConfig>): AppConfig {
    if (next.modelId && getModel(next.modelId)) this.config.modelId = next.modelId
    if (next.presetId && getPreset(next.presetId)) this.config.presetId = next.presetId
    this.ensureDir(this.configPath)
    writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf8')
    return this.getConfig()
  }

  hasKey(): boolean {
    return existsSync(this.keyPath)
  }

  /** Returns the decrypted API key, or `null` if unset / decryption fails. */
  getKey(): string | null {
    try {
      if (!existsSync(this.keyPath)) return null
      if (!safeStorage.isEncryptionAvailable()) {
        console.error('[settings] safeStorage encryption unavailable')
        return null
      }
      const buf = readFileSync(this.keyPath)
      return safeStorage.decryptString(buf)
    } catch (err) {
      console.error('[settings] failed to decrypt key:', (err as Error).message)
      return null
    }
  }

  /** Encrypts and stores the API key. Throws if encryption is unavailable. */
  setKey(key: string): void {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Secure key storage is unavailable on this system.')
    }
    const encrypted = safeStorage.encryptString(key)
    this.ensureDir(this.keyPath)
    writeFileSync(this.keyPath, encrypted, { mode: 0o600 })
  }

  private ensureDir(filePath: string): void {
    const dir = dirname(filePath)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  }
}
