<script lang="ts">
  import { onMount } from 'svelte'
  import type { StreamEvent, StreamError } from '@shared/types'

  // Milestone 2: bare streaming window. Auto-submits on capture (no controls yet
  // — the input + preset picker + keyboard loop arrive in Milestone 3).
  type Status = 'idle' | 'requesting' | 'streaming' | 'done' | 'error'

  let status = $state<Status>('idle')
  let imageUrl = $state<string | null>(null)
  let reply = $state('')
  let error = $state<StreamError | null>(null)

  function reset(): void {
    status = 'idle'
    imageUrl = null
    reply = ''
    error = null
  }

  function handleStream(e: StreamEvent): void {
    switch (e.type) {
      case 'start':
        status = 'streaming'
        break
      case 'token':
        reply += e.text
        break
      case 'done':
        status = 'done'
        break
      case 'error':
        status = 'error'
        error = e.error
        break
    }
  }

  onMount(() => {
    const offCapture = window.api.onCaptureReady((payload) => {
      reset()
      imageUrl = `data:${payload.mimeType};base64,${payload.imageBase64}`
      status = 'requesting'
      // Default preset/intent for M2; overridden by the UI in M3.
      window.api.submit({ intent: '', presetId: '' })
    })
    const offStream = window.api.onStream(handleStream)
    const offReset = window.api.onPanelReset(reset)

    const onKey = (ev: KeyboardEvent): void => {
      if (ev.key === 'Escape') window.api.dismiss()
    }
    window.addEventListener('keydown', onKey)

    return () => {
      offCapture()
      offStream()
      offReset()
      window.removeEventListener('keydown', onKey)
    }
  })
</script>

<main class="panel">
  <header class="head">
    <span class="title">Fipsi</span>
    <span class="hint">Esc to dismiss</span>
  </header>

  {#if imageUrl}
    <img class="thumb" src={imageUrl} alt="captured conversation" />
  {/if}

  <section class="answer" class:error={status === 'error'}>
    {#if status === 'requesting'}
      <span class="shimmer">Thinking…</span>
    {:else if status === 'error' && error}
      <span class="err-kind">{error.kind}</span>
      <span>{error.message}</span>
    {:else}
      <span class="reply-text">{reply}</span>{#if status === 'streaming'}<span class="caret"></span>{/if}
    {/if}
  </section>

  <footer class="foot">
    <span class="status">{status}</span>
  </footer>
</main>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: 10px;
    height: 100vh;
    padding: 14px;
    background: color-mix(in srgb, var(--surface) 96%, transparent);
    border: 1px solid var(--border);
    border-radius: 14px;
    overflow: hidden;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  .title {
    font-weight: 600;
    font-size: 13px;
  }
  .hint {
    color: var(--muted);
    font-size: 11px;
  }
  .thumb {
    max-height: 96px;
    width: auto;
    align-self: flex-start;
    border-radius: 8px;
    border: 1px solid var(--border);
    object-fit: contain;
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
  .err-kind {
    display: inline-block;
    margin-right: 6px;
    padding: 1px 6px;
    border-radius: 6px;
    background: color-mix(in srgb, var(--danger) 25%, transparent);
    font-size: 11px;
    text-transform: uppercase;
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
  .foot {
    display: flex;
    justify-content: flex-end;
  }
  .status {
    color: var(--muted);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
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
