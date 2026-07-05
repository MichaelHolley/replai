# Replai

macOS menu-bar app that turns a screenshot of any chat into an AI-suggested reply — hit a hotkey, select the conversation, get a ready-to-send message.

The loop is keyboard-only:

> hotkey → drag a selection over the chat → *(optionally type your intent)* → **Enter** to generate → **Enter** to copy & dismiss

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
4. **Enter** to generate, **Enter** (or **⌘C**) to copy and close. **Esc** cancels.

## Build a packaged app

```bash
pnpm run pack   # unpacked .app in dist/mac-arm64/
pnpm run dist   # distributable build
```

The app ships unsigned (developer, build-locally audience); code signing + notarization are required before distributing to non-developers.

## Privacy

Screenshots are held in memory only, deleted immediately after encoding, and never written to disk or logs. Image data goes only to the OpenRouter endpoint you configure. Your API key is stored encrypted via the macOS Keychain (`safeStorage`) and never touches the UI process. There is no screenshot history.

## Tech

Electron · TypeScript · Svelte 5 · Vite · OpenRouter.

Handy scripts: `pnpm dev`, `pnpm build`, `pnpm typecheck`, `pnpm run pack`.
