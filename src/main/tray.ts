import { Tray, Menu, nativeImage, Notification } from 'electron'
import { resourcePath } from './resources'

export interface TrayCallbacks {
  onCapture: () => void
  onSettings: () => void
  onQuit: () => void
}

/** Menu-bar presence: trigger capture, open settings, quit, surface hotkey health. */
export class AppTray {
  private tray: Tray | null = null
  private hotkeyOk = true
  private hotkeyLabel = ''

  constructor(private readonly cb: TrayCallbacks) {}

  init(hotkeyLabel: string, hotkeyOk: boolean): void {
    this.hotkeyLabel = hotkeyLabel
    this.hotkeyOk = hotkeyOk

    const icon = nativeImage.createFromPath(resourcePath('trayTemplate.png'))
    icon.setTemplateImage(true)
    this.tray = new Tray(icon)
    this.tray.setToolTip('Fipsi — AI Reply Assistant')
    this.tray.on('click', () => this.tray?.popUpContextMenu())
    this.rebuild()
  }

  /** Reflects hotkey registration health (plan Milestone 1: visible failure). */
  setHotkeyState(ok: boolean): void {
    if (this.hotkeyOk === ok) return
    this.hotkeyOk = ok
    if (!ok) {
      this.tray?.setTitle(' ⚠') // visible marker next to the menu-bar glyph
      new Notification({
        title: 'Fipsi hotkey unavailable',
        body: `${this.hotkeyLabel} is already in use by another app. Trigger capture from the menu-bar icon instead.`
      }).show()
    } else {
      this.tray?.setTitle('')
    }
    this.rebuild()
  }

  private rebuild(): void {
    if (!this.tray) return
    const menu = Menu.buildFromTemplate([
      {
        label: this.hotkeyOk ? `Capture   ${this.hotkeyLabel}` : 'Capture',
        click: () => this.cb.onCapture()
      },
      ...(this.hotkeyOk
        ? []
        : [
            {
              label: `⚠ Hotkey ${this.hotkeyLabel} unavailable`,
              enabled: false
            } as const
          ]),
      { type: 'separator' as const },
      { label: 'Settings…', click: () => this.cb.onSettings() },
      { type: 'separator' as const },
      { label: 'Quit Fipsi', click: () => this.cb.onQuit() }
    ])
    this.tray.setContextMenu(menu)
  }

  destroy(): void {
    this.tray?.destroy()
    this.tray = null
  }
}
