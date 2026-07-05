<script lang="ts">
  import { onMount } from 'svelte'

  let status = $state<string>('not-determined')
  const granted = $derived(status === 'granted')

  onMount(() => {
    window.api.getPermissionStatus().then((s) => (status = s))
    return window.api.onPermissionStatus((s) => (status = s))
  })
</script>

<main class="onboarding">
  <h1>Welcome to Replai</h1>
  <p class="lead">
    Replai needs <b>Screen Recording</b> permission to capture the conversation you select.
  </p>
  <p class="privacy">
    Screenshots never leave your machine except to the AI provider you configure, and
    the image file is deleted immediately after it's sent.
  </p>

  {#if granted}
    <div class="state ok">✓ Permission granted — relaunch to finish setup.</div>
    <button class="btn primary" onclick={() => window.api.relaunch()}>Relaunch Replai</button>
  {:else}
    <ol class="steps">
      <li>Click the button below to open System Settings.</li>
      <li>Enable <b>Replai</b> under Screen&nbsp;&amp;&nbsp;System Audio Recording.</li>
      <li>Return here — this window updates automatically.</li>
    </ol>
    <button class="btn primary" onclick={() => window.api.openScreenRecordingPrefs()}>
      Open Screen Recording settings
    </button>
    <div class="state waiting">
      <span class="dot"></span> Waiting for permission…
    </div>
  {/if}
</main>

<style>
  .onboarding {
    padding: 24px;
    min-height: 100vh;
    background: var(--bg);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  h1 {
    margin: 0;
    font-size: 18px;
  }
  .lead {
    margin: 0;
    font-size: 14px;
    line-height: 1.45;
  }
  .privacy {
    margin: 0;
    padding: 10px 12px;
    font-size: 12px;
    line-height: 1.5;
    color: var(--muted);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
  }
  .steps {
    margin: 4px 0;
    padding-left: 20px;
    font-size: 13px;
    line-height: 1.7;
  }
  .btn {
    align-self: flex-start;
    padding: 9px 16px;
    font-size: 13px;
    font-weight: 600;
    border: none;
    border-radius: 9px;
    cursor: pointer;
  }
  .btn.primary {
    color: white;
    background: var(--accent);
  }
  .state {
    margin-top: 4px;
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .state.ok {
    color: var(--ok);
    font-weight: 500;
  }
  .state.waiting {
    color: var(--muted);
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--accent);
    animation: pulse 1.2s ease-in-out infinite;
  }
  @keyframes pulse {
    0%,
    100% {
      opacity: 0.3;
    }
    50% {
      opacity: 1;
    }
  }
</style>
