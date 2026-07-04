# Implementation Plan — AI Reply Assistant (macOS Menu Bar App)

**Version:** v1 (MVP)
**Date:** 2026-07-04
**Status:** Spec locked, implementation not started

---

## 1. Product Summary

A macOS background app. The user hits a global hotkey mid-conversation (iMessage,
Slack, dating apps, etc.), selects a screen area containing a chat, optionally types
their intent, picks a style preset, and receives **one** AI-generated reply suggestion,
streamed token-by-token, ready to copy.

**Core loop (keyboard-only):**
hotkey → drag selection → *(optional: type intent)* → Enter (submit) → Enter (copy + dismiss)

**v1 answer strategy:**
- Description field **filled** → intent is known → generate **one** polished phrasing of that intent in the selected style.
- Description field **empty** → AI infers intent from the screenshot → still one suggestion in v1 (multi-suggestion mode deferred).

---

## 2. Decision Record (locked)

| Area | Decision | Rationale / Rejected alternatives |
|---|---|---|
| Framework | **Electron** (TypeScript) | Developer is a TS dev. Tauri rejected for v1 (Rust glue for tray/hotkey/capture not worth 20x size win yet). |
| App type | Menu bar app, no dock icon (LSUIElement-style) | Background utility; dock presence is noise. |
| Area capture | Spawn **`screencapture -i <tmpfile>`** | Native selection UX, multi-monitor + Retina for free, zero overlay code. Cost: macOS-only, no selection coordinates, no custom UI. Accepted. |
| Cancel detection | Missing output file + process exit code | `screencapture -i` exits without a file on Escape. |
| Panel placement | **Center screen** | No selection rect available from `screencapture`. Accepted tradeoff for v1. |
| Screenshot handling | Temp dir → base64 encode → **delete synchronously** → never log payload | Private-conversation images. **No history feature — explicitly out of scope (privacy liability).** |
| Suggestions | **One** streamed answer | Intent-given mode makes 3 variants redundant. Streaming drops perceived latency to ~500ms to first token. |
| Copy UX | Copy button disabled until stream completes; Enter / Cmd+C = copy + dismiss | Keeps the keyboard loop intact. |
| AI provider | **BYOK via OpenRouter** | Vendor-agnostic, single key. |
| Key storage | Electron **`safeStorage`** (Keychain-backed) | Plaintext config/localStorage explicitly rejected. |
| Key validation | Cheap test call on save | Fail at settings time, not at first real use. |
| Model selection | **Curated shortlist of 3–4 vision-capable models** + one default | Free-text model field rejected: not all OpenRouter models support images; avoids "model doesn't accept images" errors. |
| Error handling | Keep image + description in memory; **Retry re-fires request only** (no re-capture) | User never loses typed work. |
| Window strategy | **Single reusable hidden window**; clear screenshot data + description from state on hide | Fast show; memory hygiene for private data. |
| OCR | **Skipped entirely** — image goes straight to vision model | OCR destroys layout (sender attribution via bubble sides, reactions). Image ≈ 1,000–1,600 tokens; not worth optimizing in v1. |
| Style presets | Predefined set (e.g., professional / casual / flirty); custom presets deferred | |
| Typing into focused element | **Deferred** — v1 is copy-to-clipboard only | Accessibility-API automation is a v2 feature. |

**Deferred / parked (sticky-note items):**
- Code signing + notarization (`notarytool`) — **hard blocker before distributing to any non-developer.** v1 distribution = clone repo + build locally (audience: developers, which matches BYOK anyway).
- Kill criterion / success metric — define before month 3. Suggested: "I personally use it unprompted 5×/day."
- Multi-suggestion mode when description is empty.
- Auto-type into focused text field.
- Custom user-defined style presets.
- Windows/Linux ports (blocked by `screencapture` choice — would need capture abstraction layer).

---

## 3. Architecture Overview

```
┌────────────────────────── Electron Main Process ──────────────────────────┐
│                                                                            │
│  Tray (menu bar icon)          Global hotkey (globalShortcut)              │
│        │                              │                                    │
│        │                              ▼                                    │
│        │                    CaptureService                                 │
│        │                    spawn `screencapture -i /tmp/<uuid>.png`       │
│        │                    ├─ file exists → read → base64 → delete file   │
│        │                    └─ no file / bad exit → cancel, do nothing     │
│        │                              │                                    │
│        ▼                              ▼                                    │
│  Settings window            Panel window (frameless, always-on-top,        │
│  (key, model, presets)      centered, hidden ↔ shown, state cleared        │
│                             on hide)                                       │
│                                       │ IPC                                │
└───────────────────────────────────────┼────────────────────────────────────┘
                                        ▼
                          Renderer (panel UI)
                          description input · style preset picker ·
                          streamed answer view · copy button
                                        │
                                        ▼
                          OpenRouter /chat/completions (stream: true)
                          [image (base64) + intent + style] → SSE tokens
```

**Process responsibilities**
- **Main:** tray, hotkey registration, spawning `screencapture`, temp-file lifecycle, `safeStorage` key access, permission checks, window lifecycle.
- **Renderer (panel):** input UI, streaming display, clipboard write, keyboard shortcuts.
- **IPC contract:** main → renderer: `capture:ready {imageBase64}`; renderer → main: `request:submit`, `panel:dismiss`; main handles the HTTPS stream OR renderer calls OpenRouter directly — pick **main-process fetch** so the API key never enters the renderer.

---

## 4. Milestones (risk-first order)

### Milestone 1 — Native integration spike *(riskiest first — prove it day one)*
- [ ] Electron scaffold: tray icon, no dock icon (`app.dock.hide()` / `LSUIElement`)
- [ ] Register global hotkey (default: `Cmd+Shift+R`); **handle registration failure visibly** (tray icon state + notification), since `globalShortcut` fails silently on conflicts
- [ ] Hotkey → spawn `screencapture -i /tmp/<uuid>.png`
- [ ] Cancel detection: exit code + file-existence check
- [ ] Success path: read file → base64 → **delete file synchronously** → log *only* "captured N bytes" (never the payload)
- [ ] Test on multi-monitor + Retina setup

**Exit criterion:** hotkey reliably produces base64 in memory or a clean cancel, packaged app included.

### Milestone 2 — AI pipeline with hardcoded inputs
- [ ] OpenRouter streaming call (`stream: true`, SSE parsing) from the **main process**
- [ ] Vision message format: image block (base64) + text block (system prompt with style + intent)
- [ ] Hardcoded test image + hardcoded key → tokens stream into a bare window
- [ ] Pick default model + curate the 3–4 model shortlist (vision-capable, fast, cheap); verify each actually accepts images
- [ ] First-token latency measured; target < 1.5s

**Exit criterion:** hardcoded screenshot in → streamed reply out.

### Milestone 3 — Panel UI + keyboard loop
- [ ] Frameless always-on-top window, centered, single reusable instance (hide/show)
- [ ] Description input (optional) + style preset segmented control
- [ ] Streamed answer view with pre-first-token shimmer
- [ ] Copy button: disabled during stream → enabled on completion
- [ ] Keyboard: `Enter` submits → `Enter` copies + dismisses; `Esc` dismisses; `Cmd+C` copies
- [ ] **On hide: clear screenshot base64 + description from all state**

**Exit criterion:** full loop works end-to-end with a real capture, mouse never required.

### Milestone 4 — Settings
- [ ] Settings window reachable from tray menu
- [ ] API key field → validate with cheap test call on save → store via `safeStorage`
- [ ] Model picker (curated shortlist, default preselected)
- [ ] Style preset definitions (predefined set; readonly in v1)
- [ ] Hotkey display (rebinding can slip to v1.1 if time-boxed out — but failure messaging cannot)

**Exit criterion:** fresh machine → paste key → validated → captured reply works.

### Milestone 5 — Error states + permission onboarding
- [ ] **Permission gate at launch, before hotkey registration:**
  - `systemPreferences.getMediaAccessStatus('screen')`
  - If not `granted`: onboarding window with (1) one-sentence privacy statement — "screenshots never leave your machine except to the AI provider you configured", (2) deep link `x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture` via `shell.openExternal`, (3) **Relaunch button** (`app.relaunch(); app.exit(0)`)
  - Poll permission status every ~2s while onboarding is open; flip UI to "Permission granted — relaunch to finish" on change
  - ⚠️ Test on the **packaged** app: in dev, TCC permission attaches to Electron/terminal, not your bundle — dev and prod behavior differ
- [ ] Stream failure handling (rate limit / invalid key / model down / offline): image + description stay in memory, **Retry re-fires the request without re-capture**
- [ ] Distinct error messages: bad key → link to settings; no network → retry; model error → suggest switching model

**Exit criterion:** fresh macOS user account goes from first launch to first reply without support.

---

## 5. Privacy Rules (non-negotiable, enforce in code review)

1. Screenshot file deleted synchronously immediately after encoding.
2. Base64 payload never written to logs, disk, or crash reports.
3. No screenshot history feature — do not build it.
4. Panel state (image + description) cleared on every hide.
5. API key only via `safeStorage`; never in plaintext config, never in the renderer process.
6. The only network destination for image data is the user-configured OpenRouter endpoint.

---

## 6. Prompt Design (v1 sketch)

```
System:
You are a reply assistant. The image shows a chat conversation.
Messages on the right are from the user; messages on the left are from
the other person. Write ONE reply the user can send, in the style: {preset}.
{if intent}: The user wants to convey: "{intent}". Express exactly this
intent — do not add commitments or claims the user didn't state.
{else}: Infer the most natural helpful reply to the latest message.
Reply with the message text only — no quotes, no preamble, no options.
```

Open items to tune during Milestone 2: bubble-side attribution reliability per model,
handling screenshots that aren't chats (graceful "this doesn't look like a
conversation" response), and max output length per style.

---

## 7. Known Risks

| Risk | Impact | Mitigation |
|---|---|---|
| `screencapture` behavior changes across macOS versions | Capture breaks | Version-check on launch; spike covers current + previous macOS |
| Hotkey conflict with other apps | Silent no-op | Explicit failure UI (Milestone 1) |
| Chosen model misattributes bubble sides | Wrong-perspective replies | Prompt hardening + model shortlist testing (Milestone 2) |
| TCC permission confusion | "App is broken" reports | Permission gate + relaunch flow (Milestone 5) |
| Unsigned app distribution | Gatekeeper blocks non-dev users | Parked; required before any public distribution |
