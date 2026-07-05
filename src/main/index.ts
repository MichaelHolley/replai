import { app, globalShortcut, ipcMain, clipboard, systemPreferences, Notification } from 'electron'
import { randomUUID } from 'node:crypto'
import { electronApp, is } from '@electron-toolkit/utils'
import { CaptureService } from './capture'
import { AppTray } from './tray'
import { WindowManager } from './windows'
import { SettingsStore } from './settings-store'
import { OpenRouterService } from './openrouter'
import { IPC } from '../shared/types'
import { MODELS } from '../shared/models'
import { PRESETS } from '../shared/styles'
import type {
  AppConfig,
  CapturedImage,
  KeyValidationResult,
  SettingsSnapshot,
  StreamEvent,
  SubmitRequest
} from '../shared/types'

/** Global hotkey (plan default). Accelerator + human-readable label. */
const HOTKEY_ACCELERATOR = 'CommandOrControl+Shift+R'
const HOTKEY_LABEL = '⌘⇧R'

/** Deep link to the Screen Recording pane in System Settings. */
const SCREEN_PREFS_URL =
  'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'

/** In-memory working state for the current capture (never persisted). */
interface Session {
  image: CapturedImage
}

/**
 * Top-level app controller: tray, hotkey, capture, and the capture → panel →
 * OpenRouter streaming loop. The screenshot lives only in `session` and is
 * cleared on every panel hide (privacy rule §5.4).
 */
class AppController {
  private readonly capture = new CaptureService()
  private readonly wm = new WindowManager()
  private readonly settings = new SettingsStore()
  private readonly openrouter = new OpenRouterService()
  private readonly tray = new AppTray({
    onCapture: () => void this.triggerCapture(),
    onSettings: () => this.wm.showSettings(),
    onQuit: () => app.quit()
  })

  private session: Session | null = null
  private currentAbort: AbortController | null = null
  private permissionGranted = false
  private pollTimer: ReturnType<typeof setInterval> | null = null

  start(): void {
    this.registerIpc()
    this.tray.init(HOTKEY_LABEL, true)

    // Permission gate BEFORE hotkey registration (plan Milestone 5). Screen
    // Recording cannot be prompted programmatically — we deep-link + poll.
    this.permissionGranted = systemPreferences.getMediaAccessStatus('screen') === 'granted'
    if (!this.permissionGranted) {
      this.showOnboarding()
      return
    }

    this.enableCapture()
  }

  /** Wires up the panel + hotkey once screen permission is confirmed. */
  private enableCapture(): void {
    const panel = this.wm.getPanel()
    panel.on('hide', () => this.clearSession())
    const hotkeyOk = this.registerHotkey()
    this.tray.setHotkeyState(hotkeyOk)
  }

  // --- Hotkey ---

  private registerHotkey(): boolean {
    try {
      globalShortcut.register(HOTKEY_ACCELERATOR, () => void this.triggerCapture())
      const ok = globalShortcut.isRegistered(HOTKEY_ACCELERATOR)
      if (!ok) console.warn('[hotkey] registration failed (conflict?) for', HOTKEY_ACCELERATOR)
      return ok
    } catch (err) {
      console.error('[hotkey] registration threw:', (err as Error).message)
      return false
    }
  }

  // --- Capture ---

  private async triggerCapture(): Promise<void> {
    if (!this.permissionGranted) {
      this.showOnboarding()
      return
    }
    if (this.capture.isCapturing || this.wm.isPanelVisible()) return
    const payload = await this.capture.capture()
    if (!payload) return // clean cancel — do nothing

    this.session = { image: payload }
    this.wm.showPanel()
    await this.wm.sendToPanel(IPC.CaptureReady, {
      ...payload,
      presetId: this.settings.getConfig().presetId
    })
  }

  // --- Generation ---

  private async handleSubmit(req: SubmitRequest): Promise<void> {
    if (!this.session) return

    // Supersede any in-flight request.
    this.currentAbort?.abort()
    const abort = new AbortController()
    this.currentAbort = abort
    const requestId = randomUUID()

    const key = this.resolveKey()
    if (!key) {
      this.emit({
        type: 'error',
        requestId,
        error: { kind: 'no_key', message: 'No API key set. Add one in Settings.' }
      })
      return
    }

    const config = this.settings.getConfig()
    const startedAt = Date.now()
    let sawFirstToken = false

    await this.openrouter.stream(
      {
        apiKey: key,
        modelId: config.modelId,
        presetId: req.presetId || config.presetId,
        intent: req.intent,
        image: this.session.image,
        requestId,
        signal: abort.signal
      },
      (event) => {
        if (abort.signal.aborted) return
        if (event.type === 'token' && !sawFirstToken) {
          sawFirstToken = true
          console.log('[stream] first token in %dms', Date.now() - startedAt)
        }
        this.emit(event)
      }
    )
  }

  private emit(event: StreamEvent): void {
    void this.wm.sendToPanel(IPC.Stream, event)
  }

  /**
   * Resolves the OpenRouter key from secure storage. In dev only, falls back to
   * OPENROUTER_API_KEY so the pipeline can be tested before the Settings UI
   * (Milestone 4) exists. Production is safeStorage-only (privacy rule §5.5).
   */
  private resolveKey(): string | null {
    const stored = this.settings.getKey()
    if (stored) return stored
    if (is.dev && process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY
    return null
  }

  // --- Panel lifecycle ---

  private clearSession(): void {
    this.currentAbort?.abort()
    this.currentAbort = null
    this.session = null
    // Defense in depth: tell the renderer to drop image + text too.
    void this.wm.sendToPanel(IPC.PanelReset)
  }

  // --- IPC ---

  private registerIpc(): void {
    // Panel (fire-and-forget)
    ipcMain.on(IPC.Submit, (_e, req: SubmitRequest) => void this.handleSubmit(req))
    ipcMain.on(IPC.Dismiss, () => this.wm.hidePanel())
    ipcMain.on(IPC.CopyDone, (_e, text: string) => {
      if (typeof text === 'string' && text.length > 0) clipboard.writeText(text)
      this.wm.hidePanel()
    })

    // Settings (request/response)
    ipcMain.handle(IPC.SettingsGet, (): SettingsSnapshot => this.settingsSnapshot())
    ipcMain.handle(
      IPC.SettingsValidateKey,
      (_e, key: string): Promise<KeyValidationResult> => this.openrouter.validateKey(key)
    )
    ipcMain.handle(
      IPC.SettingsSaveKey,
      (_e, key: string): Promise<KeyValidationResult> => this.saveKey(key)
    )
    ipcMain.handle(
      IPC.SettingsSaveConfig,
      (_e, config: Partial<AppConfig>): AppConfig => this.settings.setConfig(config)
    )
    ipcMain.on(IPC.SettingsOpen, () => this.wm.showSettings())

    // Onboarding / permissions
    ipcMain.handle(IPC.PermissionStatus, () => this.screenStatus())
    ipcMain.on(IPC.PermissionOpenPrefs, () => WindowManager.openExternal(SCREEN_PREFS_URL))
    ipcMain.on(IPC.PermissionRelaunch, () => {
      app.relaunch()
      app.exit(0)
    })
  }

  private screenStatus(): string {
    return systemPreferences.getMediaAccessStatus('screen')
  }

  // --- Onboarding ---

  private showOnboarding(): void {
    const win = this.wm.showOnboarding()
    win.on('closed', () => this.stopPermissionPoll())
    this.startPermissionPoll()
  }

  /** Polls Screen Recording status every 2s and pushes it to the onboarding UI. */
  private startPermissionPoll(): void {
    this.stopPermissionPoll()
    this.pollTimer = setInterval(() => {
      const status = this.screenStatus()
      this.wm.send(this.wm.onboardingWindow, IPC.PermissionStatus, status)
      if (status === 'granted') {
        this.permissionGranted = true
        this.stopPermissionPoll() // user finishes via the Relaunch button
      }
    }, 2000)
  }

  private stopPermissionPoll(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  }

  private settingsSnapshot(): SettingsSnapshot {
    return {
      hasKey: this.settings.hasKey(),
      config: this.settings.getConfig(),
      models: MODELS,
      presets: PRESETS,
      hotkeyLabel: HOTKEY_LABEL
    }
  }

  /** Validates a key with a cheap call, then stores it only if valid (§5.5). */
  private async saveKey(key: string): Promise<KeyValidationResult> {
    const trimmed = key.trim()
    if (!trimmed) return { ok: false, message: 'Enter an API key.' }
    const result = await this.openrouter.validateKey(trimmed)
    if (!result.ok) return result
    try {
      this.settings.setKey(trimmed)
      return { ok: true, message: 'Key validated and saved.' }
    } catch (err) {
      return { ok: false, message: (err as Error).message }
    }
  }

  dispose(): void {
    this.stopPermissionPoll()
    globalShortcut.unregisterAll()
    this.tray.destroy()
  }
}

const controller = new AppController()

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.replai.app')
  app.dock?.hide()
  controller.start()
  if (is.dev && !process.env.OPENROUTER_API_KEY && !new SettingsStore().hasKey()) {
    new Notification({
      title: 'Replai (dev): no API key',
      body: 'Set OPENROUTER_API_KEY before capturing to test the streaming pipeline.'
    }).show()
  }
})

app.on('window-all-closed', () => {})
app.on('will-quit', () => controller.dispose())
