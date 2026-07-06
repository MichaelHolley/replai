import { spawn } from 'node:child_process'
import { clipboard, systemPreferences } from 'electron'
import type { TargetApp } from '@shared/types'

/** How long to wait after issuing ⌘V before restoring the prior clipboard. */
const RESTORE_DELAY_MS = 400

/**
 * Pastes generated replies back into the app that was frontmost when the hotkey
 * fired. macOS-only, dependency-free: everything goes through `osascript`.
 *
 * Two-permission model — reading the frontmost app needs nothing, but the
 * synthetic ⌘V keystroke needs Accessibility (System Settings → Privacy).
 */
export class InsertService {
  /**
   * Resolves the frontmost application. Must be called BEFORE the panel is
   * shown, while the user's target app still owns focus. Reading `frontmost`
   * does not require any permission.
   */
  async getFrontmostApp(): Promise<TargetApp | null> {
    // Emit name + bundle id on two lines; `missing value` for a bundle-less proc.
    const script = `tell application "System Events"
  set proc to first application process whose frontmost is true
  set procName to name of proc
  set procId to bundle identifier of proc
end tell
return procName & linefeed & procId`

    try {
      const out = await this.osascript(script)
      const [name, rawId] = out.split('\n')
      if (!name) return null
      const bundleId = rawId && rawId !== 'missing value' ? rawId : null
      return { name: name.trim(), bundleId }
    } catch (err) {
      console.warn('[insert] could not read frontmost app:', (err as Error).message)
      return null
    }
  }

  /**
   * Whether we're allowed to send synthetic keystrokes. When `prompt` is true
   * and access is missing, macOS opens the Accessibility settings pane (once).
   */
  isTrusted(prompt: boolean): boolean {
    return systemPreferences.isTrustedAccessibilityClient(prompt)
  }

  /**
   * Puts `text` on the clipboard, re-activates `target`, sends ⌘V, then restores
   * the previous clipboard text after a short delay. Returns false if the
   * keystroke could not be delivered (caller should fall back to plain copy).
   *
   * Clipboard restore is text-only — a prior image/file on the clipboard is not
   * preserved (documented tradeoff for v1).
   */
  async insert(text: string, target: TargetApp): Promise<boolean> {
    const previous = clipboard.readText()
    clipboard.writeText(text)

    // Target by bundle id when available (survives app renames / duplicates);
    // fall back to process name. Quotes are escaped for the AppleScript string.
    const selector = target.bundleId
      ? `bundle identifier is "${escapeAs(target.bundleId)}"`
      : `name is "${escapeAs(target.name)}"`

    const script = `tell application "System Events"
  set frontmost of (first application process whose ${selector}) to true
  delay 0.05
  keystroke "v" using command down
end tell`

    try {
      await this.osascript(script)
    } catch (err) {
      console.warn('[insert] paste keystroke failed:', (err as Error).message)
      // Leave the reply on the clipboard so the user can paste it manually.
      return false
    }

    // Restore asynchronously so the paste lands first. Best-effort.
    setTimeout(() => {
      if (clipboard.readText() === text) clipboard.writeText(previous)
    }, RESTORE_DELAY_MS)

    return true
  }

  /** Runs an AppleScript snippet, resolving its trimmed stdout. */
  private osascript(script: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn('osascript', ['-e', script])
      let stdout = ''
      let stderr = ''
      child.stdout.on('data', (d) => (stdout += d))
      child.stderr.on('data', (d) => (stderr += d))
      child.on('error', reject)
      child.on('exit', (code) => {
        if (code === 0) resolve(stdout.trim())
        else reject(new Error(stderr.trim() || `osascript exited ${code}`))
      })
    })
  }
}

/** Escapes `"` and `\` for embedding in an AppleScript double-quoted string. */
function escapeAs(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}
