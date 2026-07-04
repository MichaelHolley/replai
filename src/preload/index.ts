import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/types'
import type {
  AppConfig,
  CaptureReadyPayload,
  KeyValidationResult,
  SettingsSnapshot,
  StreamEvent,
  SubmitRequest
} from '../shared/types'

/**
 * The single API surface exposed to every renderer (panel / settings /
 * onboarding). The API key never crosses this bridge — only main touches it.
 */
const api = {
  // --- Panel ---
  onCaptureReady(cb: (payload: CaptureReadyPayload) => void): () => void {
    const listener = (_e: unknown, payload: CaptureReadyPayload): void => cb(payload)
    ipcRenderer.on(IPC.CaptureReady, listener)
    return () => ipcRenderer.removeListener(IPC.CaptureReady, listener)
  },
  onStream(cb: (event: StreamEvent) => void): () => void {
    const listener = (_e: unknown, event: StreamEvent): void => cb(event)
    ipcRenderer.on(IPC.Stream, listener)
    return () => ipcRenderer.removeListener(IPC.Stream, listener)
  },
  onPanelReset(cb: () => void): () => void {
    const listener = (): void => cb()
    ipcRenderer.on(IPC.PanelReset, listener)
    return () => ipcRenderer.removeListener(IPC.PanelReset, listener)
  },
  submit(req: SubmitRequest): void {
    ipcRenderer.send(IPC.Submit, req)
  },
  dismiss(): void {
    ipcRenderer.send(IPC.Dismiss)
  },
  copyAndDismiss(text: string): void {
    ipcRenderer.send(IPC.CopyDone, text)
  },

  // --- Settings ---
  getSettings(): Promise<SettingsSnapshot> {
    return ipcRenderer.invoke(IPC.SettingsGet)
  },
  validateKey(key: string): Promise<KeyValidationResult> {
    return ipcRenderer.invoke(IPC.SettingsValidateKey, key)
  },
  saveKey(key: string): Promise<KeyValidationResult> {
    return ipcRenderer.invoke(IPC.SettingsSaveKey, key)
  },
  saveConfig(config: Partial<AppConfig>): Promise<AppConfig> {
    return ipcRenderer.invoke(IPC.SettingsSaveConfig, config)
  },
  openSettings(): void {
    ipcRenderer.send(IPC.SettingsOpen)
  },

  // --- Onboarding ---
  getPermissionStatus(): Promise<string> {
    return ipcRenderer.invoke(IPC.PermissionStatus)
  },
  onPermissionStatus(cb: (status: string) => void): () => void {
    const listener = (_e: unknown, status: string): void => cb(status)
    ipcRenderer.on(IPC.PermissionStatus, listener)
    return () => ipcRenderer.removeListener(IPC.PermissionStatus, listener)
  },
  openScreenRecordingPrefs(): void {
    ipcRenderer.send(IPC.PermissionOpenPrefs)
  },
  relaunch(): void {
    ipcRenderer.send(IPC.PermissionRelaunch)
  }
}

export type FipsiApi = typeof api

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('api', api)
} else {
  // Fallback when contextIsolation is somehow disabled.
  ;(window as unknown as { api: FipsiApi }).api = api
}
