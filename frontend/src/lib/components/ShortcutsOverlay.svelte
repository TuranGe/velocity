<script>
  import { fade, scale } from 'svelte/transition';
  import { browser } from '$app/environment';

  export let show = false;

  function portal(node) {
    if (!browser) return {};
    document.body.appendChild(node);
    return {
      destroy() { if (node.parentNode) node.parentNode.removeChild(node); }
    };
  }

  const SHORTCUT_GROUPS = [
    {
      title: 'Timer',
      items: [
        { keys: ['Space'], desc: 'Başlat / Duraklat' },
        { keys: ['R'], desc: 'Sıfırla' },
      ],
    },
    {
      title: 'Mod Değiştir',
      items: [
        { keys: ['F'], desc: 'Focus' },
        { keys: ['S'], desc: 'Kısa mola' },
        { keys: ['L'], desc: 'Uzun mola' },
        { keys: ['C'], desc: 'Özel süre' },
      ],
    },
    {
      title: 'Genel',
      items: [
        { keys: ['?'], desc: 'Bu rehberi göster/gizle' },
        { keys: ['Esc'], desc: 'Kapat' },
      ],
    },
  ];

  function handleKeydown(e) {
    if (e.key === 'Escape' && show) show = false;
  }

  function handleBackdropClick(e) {
    if (e.target === e.currentTarget) show = false;
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if show}
  <div use:portal class="shortcuts-backdrop" on:click={handleBackdropClick} transition:fade={{ duration: 150 }}>
    <div class="shortcuts-modal" transition:scale={{ duration: 200, start: 0.95, opacity: 0 }}>
      <div class="shortcuts-header">
        <h2>⌨️ Klavye Kısayolları</h2>
        <button class="shortcuts-close" on:click={() => show = false} aria-label="Kapat">✕</button>
      </div>

      <div class="shortcuts-body">
        {#each SHORTCUT_GROUPS as group}
          <div class="shortcuts-group">
            <h3>{group.title}</h3>
            {#each group.items as item}
              <div class="shortcut-row">
                <span class="shortcut-desc">{item.desc}</span>
                <span class="shortcut-keys">
                  {#each item.keys as key, i}
                    {#if i > 0}<span class="key-sep">+</span>{/if}
                    <kbd>{key}</kbd>
                  {/each}
                </span>
              </div>
            {/each}
          </div>
        {/each}
      </div>

      <p class="shortcuts-footer">
        Bu rehberi tekrar açmak için <kbd>?</kbd> tuşuna basabilirsin
      </p>
    </div>
  </div>
{/if}

<style>
  .shortcuts-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .shortcuts-modal {
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-xl);
    max-width: 420px;
    width: 100%;
    max-height: 85vh;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0,0,0,0.4);
  }

  .shortcuts-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--border-subtle);
  }
  .shortcuts-header h2 {
    font-size: 1.1rem;
    font-weight: 800;
    color: var(--text-primary);
    margin: 0;
  }
  .shortcuts-close {
    width: 28px; height: 28px;
    display: flex; align-items: center; justify-content: center;
    border-radius: 50%;
    border: none;
    background: var(--bg-elevated);
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 0.85rem;
    transition: background var(--transition-fast), color var(--transition-fast);
  }
  .shortcuts-close:hover { background: var(--accent-subtle); color: var(--accent); }

  .shortcuts-body {
    padding: 1rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .shortcuts-group h3 {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--accent);
    margin: 0 0 0.6rem 0;
  }

  .shortcut-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.4rem 0;
    border-bottom: 1px solid var(--border-subtle);
  }
  .shortcut-row:last-child { border-bottom: none; }

  .shortcut-desc {
    font-size: 0.82rem;
    color: var(--text-secondary);
  }

  .shortcut-keys {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  .key-sep {
    font-size: 0.7rem;
    color: var(--text-tertiary);
  }

  kbd {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 28px;
    padding: 0.25rem 0.5rem;
    background: var(--bg-elevated);
    border: 1px solid var(--border-base);
    border-radius: var(--radius-sm);
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 700;
    color: var(--text-primary);
    box-shadow: 0 1px 0 var(--border-strong);
  }

  .shortcuts-footer {
    text-align: center;
    font-size: 0.72rem;
    color: var(--text-tertiary);
    padding: 0.75rem 1.5rem 1.25rem;
    margin: 0;
  }
  .shortcuts-footer kbd {
    min-width: 22px;
    padding: 0.15rem 0.4rem;
    font-size: 0.65rem;
  }

  @media (max-width: 480px) {
    .shortcuts-modal { max-width: 100%; }
    .shortcuts-header { padding: 1rem 1.25rem; }
    .shortcuts-body { padding: 0.75rem 1.25rem; gap: 1rem; }
  }
</style>