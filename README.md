# Replai

Too lazy to write a reply? Let Replai do it. Screenshot the chat and get an AI-cleaned-up, ready-to-send answer in your style — no typing required.

A macOS menu-bar app: hit a hotkey, select the conversation, copy the suggestion.

The loop is keyboard-only:

> hotkey → drag a selection over the chat → *(optionally type your intent)* → **Enter** to generate → **Enter** to insert the reply straight back into the app you were in (or copy)

Replies stream in token-by-token, in a style you pick (Professional, Casual, Flirty, Concise). Bring your own [OpenRouter](https://openrouter.ai) key, or use your local [Claude Code](https://claude.com/claude-code) login.

## Requirements

- **macOS** (uses the native `screencapture` tool)
- **Node ≥ 20** and **pnpm**
- One of:
  - an **OpenRouter API key**, or
  - **Claude Code** installed and signed in (`claude` → `/login`)

## Setup

```bash
pnpm install
pnpm dev
```

On first launch, grant **Screen Recording** permission when prompted, then open the menu-bar icon → **Settings** and pick a provider: paste your OpenRouter key, or choose **Claude Code login**.

> Prefer to skip the Settings step while developing? Set `OPENROUTER_API_KEY` in your environment before `pnpm dev` — it's used as a fallback in dev only.

## Usage

1. Press **⌘⇧R** (or menu-bar icon → **Capture**).
2. Drag a selection over the conversation.
3. Optionally type what you want to say and pick a style (**⌘1–⌘4**).
4. **Enter** to generate, then **Enter** to **insert** the reply directly into the app you triggered from (the chat input you were in). Prefer the clipboard? **⌘C** copies and closes. **Esc** cancels.

> Inserting pastes into the previously focused app, so it needs **Accessibility** permission (macOS → System Settings → Privacy & Security → Accessibility). Until it's granted, Insert falls back to copying the reply and shows a one-tap link to the settings pane. Capture-only usage (copy) never needs it.

## Claude Code provider

The Claude Code provider runs replies through the [Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk/overview) using the `claude` install and account already on your Mac (subscription or API key) — no extra key in Replai. It runs as a plain one-turn chat: no tools, none of your Claude Code settings, and no session saved to disk.

Replai looks for `claude` in `~/.local/bin`, `~/.claude/local`, `/opt/homebrew/bin`, `/usr/local/bin`, then your login shell's `PATH`. Packaged builds don't bundle Claude Code; in `pnpm dev` the SDK's bundled copy is used as a fallback.

> Anthropic doesn't allow third-party products to offer claude.ai login without approval. This provider is meant for your own, locally built copy of Replai — don't ship it to others with subscription login enabled.

## Build a packaged app

```bash
pnpm run pack   # unpacked .app in dist/mac-arm64/
pnpm run dist   # distributable build
```

The app ships unsigned (developer, build-locally audience); code signing + notarization are required before distributing to non-developers.

## Privacy

Screenshots are held in memory only, deleted immediately after encoding, and never written to disk or logs. Image data goes only to the provider you pick: OpenRouter, or Anthropic via your local Claude Code. Your OpenRouter API key is stored encrypted via the macOS Keychain (`safeStorage`) and never touches the UI process. There is no screenshot history.

Inserting a reply briefly places it on the clipboard to issue a paste, then restores your previous clipboard text a moment later (text only — a prior image/file on the clipboard isn't preserved). Choose **⌘C** instead if you'd rather it just stay on the clipboard.

## Tech

Electron · TypeScript · Svelte 5 · Vite · OpenRouter · Claude Agent SDK.

Handy scripts: `pnpm dev`, `pnpm build`, `pnpm typecheck`, `pnpm run pack`.
