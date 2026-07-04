/**
 * Shared IPC contract + domain types between main and renderer.
 * No runtime dependencies on Electron here — safe to import from either side.
 */

/** Curated, vision-capable OpenRouter models offered in Settings. */
export interface ModelOption {
  /** OpenRouter model id, e.g. "openai/gpt-4o-mini". */
  id: string
  /** Human label shown in the picker. */
  label: string
  /** Short note (speed/cost/quality) shown under the label. */
  note: string
}

/** A writing-style preset the reply is generated in. */
export interface StylePreset {
  id: string
  label: string
  /** Instruction fragment injected into the system prompt. */
  instruction: string
}

/** Persisted, non-secret configuration (secret key lives in safeStorage). */
export interface AppConfig {
  modelId: string
  presetId: string
}

/** A captured, encoded screenshot held in main-process memory. */
export interface CapturedImage {
  imageBase64: string
  /** MIME type of the encoded image, e.g. "image/png". */
  mimeType: string
}

/** Payload sent main → renderer when a capture is ready to be worked on. */
export interface CaptureReadyPayload extends CapturedImage {
  /** The user's configured default preset, used as the panel's initial choice. */
  presetId: string
}

/** Payload sent renderer → main to run (or re-run) a generation request. */
export interface SubmitRequest {
  /** Optional user intent; empty string means "infer from screenshot". */
  intent: string
  presetId: string
}

/** Streaming events main → renderer during a generation. */
export type StreamEvent =
  | { type: 'start'; requestId: string }
  | { type: 'token'; requestId: string; text: string }
  | { type: 'done'; requestId: string; fullText: string }
  | { type: 'error'; requestId: string; error: StreamError }

/** Classified stream failure, so the UI can show a targeted message + action. */
export interface StreamError {
  kind: 'auth' | 'network' | 'rate_limit' | 'model' | 'no_key' | 'unknown'
  message: string
}

/** Result of validating an API key against OpenRouter. */
export interface KeyValidationResult {
  ok: boolean
  message: string
}

/** Snapshot of settings shown in the Settings window. */
export interface SettingsSnapshot {
  hasKey: boolean
  config: AppConfig
  models: ModelOption[]
  presets: StylePreset[]
  hotkeyLabel: string
}

/** IPC channel names, centralized to avoid string drift. */
export const IPC = {
  // main → renderer (panel)
  CaptureReady: 'capture:ready',
  Stream: 'request:stream',
  PanelReset: 'panel:reset',
  // renderer (panel) → main
  Submit: 'request:submit',
  Dismiss: 'panel:dismiss',
  CopyDone: 'panel:copy-done',
  // settings (renderer → main, invoke/handle)
  SettingsGet: 'settings:get',
  SettingsSaveKey: 'settings:save-key',
  SettingsSaveConfig: 'settings:save-config',
  SettingsValidateKey: 'settings:validate-key',
  SettingsOpen: 'settings:open',
  // onboarding
  PermissionStatus: 'permission:status',
  PermissionOpenPrefs: 'permission:open-prefs',
  PermissionRelaunch: 'permission:relaunch'
} as const
