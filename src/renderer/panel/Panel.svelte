<script lang="ts">
  import { onMount, tick } from 'svelte'
  import { PRESETS } from '@shared/styles'
  import type { StreamEvent, StreamError, TargetApp, InsertResult } from '@shared/types'

  // Keyboard-only loop (plan §1):
  //   hotkey → drag → (type intent) → Enter (submit) → Enter (copy + dismiss)
  type Phase = 'input' | 'requesting' | 'streaming' | 'done' | 'error'

  let phase = $state<Phase>('input')
  let imageUrl = $state<string | null>(null)
  let intent = $state('')
  let selectedPreset = $state(PRESETS[0].id)
  let reply = $state('')
  let error = $state<StreamError | null>(null)
  // What produced the current `reply`, so we can tell whether the user has
  // changed their mind (and should regenerate) vs. just re-copying it.
  let lastIntent = $state('')
  let lastPreset = $state(PRESETS[0].id)
  // The app to paste back into (frontmost when the hotkey fired), or null.
  let targetApp = $state<TargetApp | null>(null)
  // Set when Insert falls back to a plain copy (e.g. Accessibility not granted).
  let insertNote = $state<string | null>(null)
  let showAccessibilityAction = $state(false)

  let inputEl = $state<HTMLInputElement | null>(null)

  const canCopy = $derived(phase === 'done' && reply.trim().length > 0)
  const isDirty = $derived(
    phase === 'done' && (intent.trim() !== lastIntent || selectedPreset !== lastPreset)
  )
  // The primary action's label: regenerate if the request changed, else insert
  // into the captured app when we have one, else fall back to copy.
  const primaryLabel = $derived(
    isDirty ? 'Regenerate' : targetApp ? `Insert into ${targetApp.name}` : 'Copy'
  )

  function reset(): void {
    phase = 'input'
    imageUrl = null
    intent = ''
    reply = ''
    error = null
    lastIntent = ''
    lastPreset = selectedPreset
    insertNote = null
    showAccessibilityAction = false
  }

  function submit(): void {
    phase = 'requesting'
    reply = ''
    error = null
    lastIntent = intent.trim()
    lastPreset = selectedPreset
    window.api.submit({ intent: lastIntent, presetId: selectedPreset })
  }

  function copyAndDismiss(): void {
    if (reply.trim().length > 0) window.api.copyAndDismiss(reply)
    else window.api.dismiss()
  }

  // Primary action once a reply exists: regenerate if the intent/preset changed
  // since this reply was produced (never act on a stale reply); otherwise paste
  // it into the captured target app, or copy when there's no target. Main hides
  // the panel — unless Insert falls back, which pushes a note via onInsertResult.
  function primaryAction(): void {
    if (isDirty) {
      submit()
    } else if (reply.trim().length === 0) {
      window.api.dismiss()
    } else if (targetApp) {
      window.api.insert(reply)
    } else {
      copyAndDismiss()
    }
  }

  // ⌘C is always a plain copy (regenerates first if the reply is stale).
  function copyShortcut(): void {
    if (isDirty) submit()
    else copyAndDismiss()
  }

  function handleInsertResult(result: InsertResult): void {
    if (result.inserted) return // panel is already hidden
    if (result.reason === 'no_accessibility') {
      insertNote = 'Copied to clipboard. Grant Accessibility to paste in directly.'
      showAccessibilityAction = true
    }
  }

  // Which error kinds are fixed in Settings (bad/missing key, or a model swap).
  const showSettingsAction = $derived(
    phase === 'error' &&
      (error?.kind === 'auth' || error?.kind === 'no_key' || error?.kind === 'model')
  )

  function handleStream(e: StreamEvent): void {
    switch (e.type) {
      case 'start':
        phase = 'streaming'
        break
      case 'token':
        reply += e.text
        break
      case 'done':
        phase = 'done'
        break
      case 'error':
        phase = 'error'
        error = e.error
        break
    }
  }

  function onKeydown(e: KeyboardEvent): void {
    const mod = e.metaKey || e.ctrlKey

    if (e.key === 'Escape') {
      e.preventDefault()
      window.api.dismiss()
      return
    }
    // ⌘1–⌘N select a preset without clashing with typing in the intent field.
    if (mod && e.key >= '1' && e.key <= String(PRESETS.length)) {
      e.preventDefault()
      selectedPreset = PRESETS[Number(e.key) - 1].id
      return
    }
    if (mod && (e.key === 'c' || e.key === 'C')) {
      if (phase === 'done') {
        e.preventDefault()
        copyShortcut()
      }
      return
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault()
      if (phase === 'input') submit()
      else if (phase === 'done') primaryAction()
      else if (phase === 'error') submit() // re-fire (no re-capture)
    }
  }

  onMount(() => {
    const offCapture = window.api.onCaptureReady(async (payload) => {
      reset()
      imageUrl = `data:${payload.mimeType};base64,${payload.imageBase64}`
      selectedPreset = payload.presetId || PRESETS[0].id
      targetApp = payload.targetApp
      await tick()
      inputEl?.focus()
    })
    const offStream = window.api.onStream(handleStream)
    const offReset = window.api.onPanelReset(reset)
    const offInsert = window.api.onInsertResult(handleInsertResult)
    window.addEventListener('keydown', onKeydown)

    return () => {
      offCapture()
      offStream()
      offReset()
      offInsert()
      window.removeEventListener('keydown', onKeydown)
    }
  })
</script>

<main class="panel">
  <header class="head">
    {#if imageUrl}
      <img class="thumb" src={imageUrl} alt="captured conversation" />
    {/if}
    <input
      bind:this={inputEl}
      bind:value={intent}
      class="intent"
      type="text"
      placeholder="What do you want to say? (optional)"
      spellcheck="false"
      autocomplete="off"
      disabled={phase === 'requesting' || phase === 'streaming'}
    />
  </header>

  <div class="presets" role="radiogroup" aria-label="Reply style">
    {#each PRESETS as preset, i (preset.id)}
      <button
        type="button"
        role="radio"
        aria-checked={selectedPreset === preset.id}
        class="preset"
        class:active={selectedPreset === preset.id}
        onclick={() => (selectedPreset = preset.id)}
      >
        {preset.label}<span class="kbd">⌘{i + 1}</span>
      </button>
    {/each}
  </div>

  <section class="answer" class:error={phase === 'error'} aria-live="polite">
    {#if phase === 'requesting'}
      <span class="shimmer">Thinking…</span>
    {:else if phase === 'error' && error}
      <div class="err-msg">
        <span class="err-kind">{error.kind}</span><span>{error.message}</span>
      </div>
      <div class="err-actions">
        <button type="button" class="mini primary" onclick={submit}>Retry</button>
        {#if showSettingsAction}
          <button type="button" class="mini" onclick={() => window.api.openSettings()}>
            Open Settings
          </button>
        {/if}
      </div>
    {:else if reply}
      <span class="reply-text">{reply}</span>{#if phase === 'streaming'}<span class="caret"></span>{/if}
    {:else if phase === 'input'}
      <span class="placeholder">Press <b>Enter</b> to generate a reply.</span>
    {/if}
  </section>

  {#if insertNote}
    <div class="note" role="status">
      <span>{insertNote}</span>
      {#if showAccessibilityAction}
        <button type="button" class="mini" onclick={() => window.api.openAccessibilityPrefs()}>
          Open Settings
        </button>
      {/if}
    </div>
  {/if}

  <footer class="foot">
    <span class="hint">
      {#if phase === 'input'}Enter to generate · Esc to cancel
      {:else if phase === 'streaming' || phase === 'requesting'}Streaming… · Esc to cancel
      {:else if phase === 'done'}{isDirty
          ? 'Enter to regenerate · Esc to cancel'
          : targetApp
            ? 'Enter to insert · ⌘C to copy'
            : 'Enter or ⌘C to copy & close'}
      {:else if phase === 'error'}Enter to retry · Esc to cancel{/if}
    </span>
    <div class="actions">
      {#if canCopy && targetApp && !isDirty}
        <button type="button" class="copy secondary" onclick={copyAndDismiss}>Copy</button>
      {/if}
      <button type="button" class="copy" disabled={!canCopy} onclick={primaryAction}>
        {primaryLabel}
      </button>
    </div>
  </footer>
</main>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: 10px;
    height: 100vh;
    padding: 14px;
    background: color-mix(in srgb, var(--surface) 97%, transparent);
    border: 1px solid var(--border);
    border-radius: 14px;
    overflow: hidden;
  }
  .head {
    display: flex;
    gap: 10px;
    align-items: stretch;
  }
  .thumb {
    max-height: 44px;
    max-width: 88px;
    border-radius: 7px;
    border: 1px solid var(--border);
    object-fit: cover;
  }
  .intent {
    flex: 1;
    min-width: 0;
    padding: 8px 10px;
    font-size: 13px;
    color: var(--text);
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    outline: none;
  }
  .intent:focus {
    border-color: var(--accent);
  }
  .intent:disabled {
    opacity: 0.55;
  }
  .presets {
    display: flex;
    gap: 6px;
  }
  .preset {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 5px 9px;
    font-size: 12px;
    color: var(--text);
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 999px;
    cursor: pointer;
  }
  .preset.active {
    background: var(--accent);
    border-color: var(--accent);
    color: white;
  }
  .kbd {
    font-size: 10px;
    opacity: 0.6;
  }
  .answer {
    flex: 1;
    overflow-y: auto;
    font-size: 14px;
    line-height: 1.45;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .answer.error {
    color: var(--danger);
  }
  .placeholder {
    color: var(--muted);
    font-size: 13px;
  }
  .err-kind {
    display: inline-block;
    margin-right: 6px;
    padding: 1px 6px;
    border-radius: 6px;
    background: color-mix(in srgb, var(--danger) 25%, transparent);
    font-size: 11px;
    text-transform: uppercase;
  }
  .err-actions {
    display: flex;
    gap: 8px;
    margin-top: 10px;
  }
  .mini {
    padding: 4px 12px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text);
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 7px;
    cursor: pointer;
  }
  .mini.primary {
    color: white;
    background: var(--accent);
    border-color: var(--accent);
  }
  .shimmer {
    color: var(--muted);
    animation: pulse 1.2s ease-in-out infinite;
  }
  .caret {
    display: inline-block;
    width: 7px;
    height: 15px;
    margin-left: 2px;
    vertical-align: text-bottom;
    background: var(--accent);
    animation: blink 1s step-end infinite;
  }
  .note {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 10px;
    font-size: 11px;
    color: var(--text);
    background: color-mix(in srgb, var(--accent) 14%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
    border-radius: 8px;
  }
  .foot {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
  }
  .hint {
    color: var(--muted);
    font-size: 11px;
  }
  .actions {
    display: flex;
    gap: 6px;
    flex-shrink: 0;
  }
  .copy {
    padding: 5px 14px;
    font-size: 12px;
    font-weight: 600;
    color: white;
    background: var(--accent);
    border: none;
    border-radius: 7px;
    cursor: pointer;
    white-space: nowrap;
  }
  .copy.secondary {
    color: var(--text);
    background: var(--bg);
    border: 1px solid var(--border);
  }
  .copy:disabled {
    background: var(--border);
    color: var(--muted);
    cursor: default;
  }
  @keyframes pulse {
    0%,
    100% {
      opacity: 0.4;
    }
    50% {
      opacity: 1;
    }
  }
  @keyframes blink {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0;
    }
  }
</style>
