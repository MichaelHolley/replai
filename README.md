# Replai

Too lazy to write a reply? Let Replai do it. Screenshot the chat and get an AI-cleaned-up, ready-to-send answer in your style — no typing required.

A macOS menu-bar app: hit a hotkey, select the conversation, copy the suggestion.

The loop is keyboard-only:

> hotkey → drag a selection over the chat → *(optionally type your intent)* → **Enter** to generate → **Enter** to insert the reply straight back into the app you were in (or copy)

Replies stream in token-by-token, in a style you pick (Professional, Casual, Flirty, Concise). Bring your own [OpenRouter](https://openrouter.ai) key.

## Requirements

- **macOS** (uses the native `screencapture` tool)
- **Node ≥ 20** and **pnpm**
- An **OpenRouter API key**

## Setup

```bash
pnpm install
pnpm dev
```

On first launch, grant **Screen Recording** permission when prompted, then open the menu-bar icon → **Settings** and paste your OpenRouter key.

> Prefer to skip the Settings step while developing? Set `OPENROUTER_API_KEY` in your environment before `pnpm dev` — it's used as a fallback in dev only.

## Usage

1. Press **⌘⇧R** (or menu-bar icon → **Capture**).
2. Drag a selection over the conversation.
3. Optionally type what you want to say and pick a style (**⌘1–⌘4**).
4. **Enter** to generate, then **Enter** to **insert** the reply directly into the app you triggered from (the chat input you were in). Prefer the clipboard? **⌘C** copies and closes. **Esc** cancels.

> Inserting pastes into the previously focused app, so it needs **Accessibility** permission (macOS → System Settings → Privacy & Security → Accessibility). Until it's granted, Insert falls back to copying the reply and shows a one-tap link to the settings pane. Capture-only usage (copy) never needs it.

## Build a packaged app

```bash
pnpm run pack   # unpacked .app in dist/mac-arm64/
pnpm run dist   # distributable build
```

The app ships unsigned (developer, build-locally audience); code signing + notarization are required before distributing to non-developers.

## Privacy

Screenshots are held in memory only, deleted immediately after encoding, and never written to disk or logs. Image data goes only to the OpenRouter endpoint you configure. Your API key is stored encrypted via the macOS Keychain (`safeStorage`) and never touches the UI process. There is no screenshot history.

Inserting a reply briefly places it on the clipboard to issue a paste, then restores your previous clipboard text a moment later (text only — a prior image/file on the clipboard isn't preserved). Choose **⌘C** instead if you'd rather it just stay on the clipboard.

## Tech

Electron · TypeScript · Svelte 5 · Vite · OpenRouter.

Handy scripts: `pnpm dev`, `pnpm build`, `pnpm typecheck`, `pnpm run pack`.
