<script lang="ts">
  import { onMount } from 'svelte'
  import type { SettingsSnapshot } from '@shared/types'

  let snapshot = $state<SettingsSnapshot | null>(null)

  let modelId = $state('')
  let presetId = $state('')

  let keyInput = $state('')
  let keyStatus = $state<'idle' | 'saving' | 'ok' | 'error'>('idle')
  let keyMessage = $state('')

  onMount(async () => {
    const s = await window.api.getSettings()
    snapshot = s
    modelId = s.config.modelId
    presetId = s.config.presetId
  })

  async function saveModel(id: string): Promise<void> {
    modelId = id
    await window.api.saveConfig({ modelId: id })
  }

  async function savePreset(id: string): Promise<void> {
    presetId = id
    await window.api.saveConfig({ presetId: id })
  }

  async function saveKey(): Promise<void> {
    if (!keyInput.trim()) return
    keyStatus = 'saving'
    keyMessage = 'Validating…'
    const result = await window.api.saveKey(keyInput.trim())
    keyStatus = result.ok ? 'ok' : 'error'
    keyMessage = result.message
    if (result.ok) {
      keyInput = ''
      if (snapshot) snapshot = { ...snapshot, hasKey: true }
    }
  }
</script>

<main class="settings">
  {#if !snapshot}
    <p class="muted">Loading…</p>
  {:else}
    <h1>Replai Settings</h1>

    <section class="card">
      <h2>OpenRouter API key</h2>
      <p class="muted">
        Stored securely in your macOS Keychain. It never leaves your machine except
        to OpenRouter when generating a reply.
      </p>
      <div class="row">
        <input
          bind:value={keyInput}
          type="password"
          class="field"
          placeholder={snapshot.hasKey ? '•••••••••  (a key is saved)' : 'sk-or-…'}
          spellcheck="false"
          autocomplete="off"
          onkeydown={(e) => e.key === 'Enter' && saveKey()}
        />
        <button
          class="btn"
          disabled={keyStatus === 'saving' || !keyInput.trim()}
          onclick={saveKey}
        >
          {keyStatus === 'saving' ? 'Validating…' : 'Validate & Save'}
        </button>
      </div>
      {#if keyMessage}
        <p class="status" class:ok={keyStatus === 'ok'} class:err={keyStatus === 'error'}>
          {keyMessage}
        </p>
      {:else if snapshot.hasKey}
        <p class="status ok">A validated key is saved.</p>
      {:else}
        <p class="status err">No key yet — add one to start generating replies.</p>
      {/if}
    </section>

    <section class="card">
      <h2>Model</h2>
      <div class="options">
        {#each snapshot.models as model (model.id)}
          <button
            class="option"
            class:active={modelId === model.id}
            onclick={() => saveModel(model.id)}
          >
            <span class="opt-label">{model.label}</span>
            <span class="opt-note">{model.note}</span>
          </button>
        {/each}
      </div>
    </section>

    <section class="card">
      <h2>Default reply style</h2>
      <div class="options">
        {#each snapshot.presets as preset (preset.id)}
          <button
            class="option"
            class:active={presetId === preset.id}
            onclick={() => savePreset(preset.id)}
          >
            <span class="opt-label">{preset.label}</span>
            <span class="opt-note">{preset.instruction}</span>
          </button>
        {/each}
      </div>
      <p class="muted">You can still switch style per reply in the panel (⌘1–⌘{snapshot.presets.length}).</p>
    </section>

    <section class="card compact">
      <h2>Capture hotkey</h2>
      <div class="row spread">
        <span class="muted">Trigger a capture from anywhere</span>
        <kbd>{snapshot.hotkeyLabel}</kbd>
      </div>
    </section>
  {/if}
</main>

<style>
  .settings {
    padding: 20px;
    min-height: 100vh;
    background: var(--bg);
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  h1 {
    margin: 0;
    font-size: 18px;
  }
  h2 {
    margin: 0 0 8px;
    font-size: 13px;
    font-weight: 600;
  }
  .muted {
    color: var(--muted);
    font-size: 12px;
    margin: 6px 0 0;
    line-height: 1.4;
  }
  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 14px;
  }
  .card.compact {
    padding: 12px 14px;
  }
  .row {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .row.spread {
    justify-content: space-between;
  }
  .field {
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
  .field:focus {
    border-color: var(--accent);
  }
  .btn {
    padding: 8px 14px;
    font-size: 12px;
    font-weight: 600;
    color: white;
    background: var(--accent);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    white-space: nowrap;
  }
  .btn:disabled {
    background: var(--border);
    color: var(--muted);
    cursor: default;
  }
  .status {
    margin: 10px 0 0;
    font-size: 12px;
  }
  .status.ok {
    color: var(--ok);
  }
  .status.err {
    color: var(--danger);
  }
  .options {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .option {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 9px 11px;
    text-align: left;
    color: var(--text);
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 9px;
    cursor: pointer;
  }
  .option.active {
    border-color: var(--accent);
    box-shadow: inset 0 0 0 1px var(--accent);
  }
  .opt-label {
    font-size: 13px;
    font-weight: 500;
  }
  .opt-note {
    font-size: 11px;
    color: var(--muted);
  }
  kbd {
    padding: 3px 8px;
    font-family: inherit;
    font-size: 12px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
  }
</style>
