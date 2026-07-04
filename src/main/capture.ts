import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFile, unlink } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { CaptureReadyPayload } from '@shared/types'

/**
 * Interactive area capture via macOS `screencapture -i`.
 *
 * Privacy rules enforced here (see plan §5):
 *  - the temp PNG is deleted synchronously-immediately after encoding,
 *  - only a byte count is ever logged, never the payload.
 */
export class CaptureService {
  private inFlight = false

  /** True while a selection is on screen — used to avoid double-triggering. */
  get isCapturing(): boolean {
    return this.inFlight
  }

  /**
   * Runs an interactive capture.
   * @returns the encoded image, or `null` if the user cancelled (Esc / no file).
   */
  async capture(): Promise<CaptureReadyPayload | null> {
    if (this.inFlight) return null
    this.inFlight = true
    const file = join(tmpdir(), `fipsi-${randomUUID()}.png`)

    try {
      const exitCode = await this.runScreencapture(file)

      // `screencapture -i` exits 0 even on Escape, but writes no file.
      // Treat "no file" (regardless of exit code) as a clean cancel.
      if (!existsSync(file)) {
        console.log('[capture] cancelled (no file, exit %d)', exitCode)
        return null
      }

      const buf = await readFile(file)
      const payload: CaptureReadyPayload = {
        imageBase64: buf.toString('base64'),
        mimeType: 'image/png'
      }
      console.log('[capture] captured %d bytes', buf.byteLength)
      return payload
    } finally {
      // Delete the file before returning to any caller. Never leave the
      // private screenshot on disk.
      await this.safeDelete(file)
      this.inFlight = false
    }
  }

  private runScreencapture(file: string): Promise<number> {
    return new Promise((resolve, reject) => {
      // -i interactive selection, -x no capture sound.
      const child = spawn('screencapture', ['-i', '-x', file], {
        stdio: 'ignore'
      })
      child.on('error', reject)
      child.on('exit', (code) => resolve(code ?? -1))
    })
  }

  private async safeDelete(file: string): Promise<void> {
    try {
      if (existsSync(file)) await unlink(file)
    } catch (err) {
      // Deletion failure is a privacy concern; surface it (no payload).
      console.error('[capture] failed to delete temp file:', (err as Error).message)
    }
  }
}
