<script>
  import { toast } from '$lib/stores/toast';
  import { fly, fade } from 'svelte/transition';
  import { flip } from 'svelte/animate';

  const ICONS = {
    success: '✓',
    error:   '✕',
    warn:    '⚠',
    info:    'ℹ',
  };
</script>

<div class="toaster" aria-live="polite">
  {#each $toast as t (t.id)}
    <div
      class="toast toast--{t.type}"
      animate:flip={{ duration: 200 }}
      in:fly={{ y: 24, duration: 280 }}
      out:fade={{ duration: 200 }}
      role="alert"
    >
      <span class="toast-icon">{ICONS[t.type] || 'ℹ'}</span>
      <div class="toast-content">
        <span class="toast-msg">{t.message}</span>
        {#if t.code}
          <span class="toast-code">[{t.code}]</span>
        {/if}
      </div>
      <button class="toast-close" on:click={() => toast.dismiss(t.id)} aria-label="Dismiss">✕</button>
    </div>
  {/each}
</div>

<style>
  .toaster {
    position: fixed;
    bottom: 1.5rem;
    right: 1.5rem;
    z-index: 99999;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    pointer-events: none;
    max-width: 360px;
    width: calc(100vw - 2rem);
  }

  .toast {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    border-radius: var(--radius-md);
    border: 1px solid transparent;
    font-size: 0.82rem;
    font-family: var(--font-sans);
    line-height: 1.4;
    pointer-events: all;
    box-shadow: 0 8px 24px rgba(0,0,0,0.25);
    background: var(--bg-surface);
  }

  .toast--success { border-color: #22c55e; background: color-mix(in srgb, #22c55e 8%, var(--bg-surface)); }
  .toast--error   { border-color: #ef4444; background: color-mix(in srgb, #ef4444 8%, var(--bg-surface)); }
  .toast--warn    { border-color: #f59e0b; background: color-mix(in srgb, #f59e0b 8%, var(--bg-surface)); }
  .toast--info    { border-color: var(--accent); background: var(--accent-subtle); }

  .toast-icon {
    font-size: 0.9rem;
    font-weight: 700;
    flex-shrink: 0;
    width: 18px;
    text-align: center;
  }
  .toast--success .toast-icon { color: #22c55e; }
  .toast--error   .toast-icon { color: #ef4444; }
  .toast--warn    .toast-icon { color: #f59e0b; }
  .toast--info    .toast-icon { color: var(--accent); }

  .toast-msg { flex: 1; color: var(--text-primary); }

  .toast-content { flex: 1; display: flex; flex-direction: column; gap: 0.2rem; }

  .toast-code { font-size: 0.65rem; color: var(--text-tertiary); font-family: var(--font-mono); }

  .toast-close {
    background: none; border: none; color: var(--text-tertiary);
    font-size: 0.7rem; cursor: pointer; flex-shrink: 0;
    padding: 0 2px; line-height: 1;
    transition: color var(--transition-fast);
  }
  .toast-close:hover { color: var(--text-primary); }
</style>
