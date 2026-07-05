import { BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'

type Route = 'panel' | 'settings' | 'onboarding'

/** Loads the given renderer route in dev (vite server) or prod (packaged file). */
function loadRoute(win: BrowserWindow, route: Route): void {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/${route}/index.html`)
  } else {
    void win.loadFile(join(__dirname, `../renderer/${route}/index.html`))
  }
}

const PRELOAD = join(__dirname, '../preload/index.mjs')

/**
 * Owns the app's windows. The panel is a single reusable hidden instance
 * (fast show, memory hygiene). Settings and onboarding are created on demand.
 */
export class WindowManager {
  private panel: BrowserWindow | null = null
  private settings: BrowserWindow | null = null
  private onboarding: BrowserWindow | null = null

  /** Lazily builds the reusable, hidden panel window. */
  getPanel(): BrowserWindow {
    if (this.panel && !this.panel.isDestroyed()) return this.panel

    const win = new BrowserWindow({
      width: 460,
      height: 340,
      show: false,
      frame: false,
      resizable: false,
      transparent: true,
      hasShadow: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      fullscreenable: false,
      // Panel must be able to receive keyboard focus above other apps.
      webPreferences: {
        preload: PRELOAD,
        sandbox: false,
        contextIsolation: true
      }
    })
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

    // Hiding when focus is lost keeps the keyboard-only loop tidy.
    win.on('blur', () => {
      if (!win.webContents.isDevToolsOpened()) this.hidePanel()
    })

    loadRoute(win, 'panel')
    this.panel = win
    return win
  }

  showPanel(): void {
    const win = this.getPanel()
    win.center()
    win.show()
    win.focus()
  }

  /** Sends to the panel renderer, waiting for its first load if still pending. */
  async sendToPanel(channel: string, payload?: unknown): Promise<void> {
    const win = this.getPanel()
    if (win.webContents.isLoading()) {
      await new Promise<void>((resolve) =>
        win.webContents.once('did-finish-load', () => resolve())
      )
    }
    win.webContents.send(channel, payload)
  }

  hidePanel(): void {
    if (this.panel && !this.panel.isDestroyed() && this.panel.isVisible()) {
      this.panel.hide()
    }
  }

  isPanelVisible(): boolean {
    return !!this.panel && !this.panel.isDestroyed() && this.panel.isVisible()
  }

  showSettings(): void {
    if (this.settings && !this.settings.isDestroyed()) {
      this.settings.show()
      this.settings.focus()
      return
    }
    const win = new BrowserWindow({
      width: 520,
      height: 560,
      show: false,
      resizable: false,
      title: 'Replai Settings',
      webPreferences: { preload: PRELOAD, sandbox: false, contextIsolation: true }
    })
    win.on('ready-to-show', () => win.show())
    win.on('closed', () => (this.settings = null))
    loadRoute(win, 'settings')
    this.settings = win
  }

  showOnboarding(): BrowserWindow {
    if (this.onboarding && !this.onboarding.isDestroyed()) {
      this.onboarding.show()
      this.onboarding.focus()
      return this.onboarding
    }
    const win = new BrowserWindow({
      width: 480,
      height: 420,
      show: false,
      resizable: false,
      title: 'Replai',
      webPreferences: { preload: PRELOAD, sandbox: false, contextIsolation: true }
    })
    win.on('ready-to-show', () => win.show())
    win.on('closed', () => (this.onboarding = null))
    loadRoute(win, 'onboarding')
    this.onboarding = win
    return win
  }

  closeOnboarding(): void {
    if (this.onboarding && !this.onboarding.isDestroyed()) this.onboarding.close()
  }

  /** Best-effort broadcast helper for the onboarding poll + panel stream. */
  send(win: BrowserWindow | null, channel: string, payload?: unknown): void {
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload)
  }

  get panelWindow(): BrowserWindow | null {
    return this.panel
  }
  get onboardingWindow(): BrowserWindow | null {
    return this.onboarding
  }

  static openExternal(url: string): void {
    void shell.openExternal(url)
  }
}
