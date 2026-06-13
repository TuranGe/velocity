<script>
  import { fade, fly } from 'svelte/transition';
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';

  export let show = false;
  export let wide = false;

  const dispatch = createEventDispatcher();

  // Portal: move the modal node directly under <body>
  // so no parent transform/overflow can clip or misplace it
  let portalTarget;
  let portalNode;

  function portal(node) {
    if (!browser) return {};
    portalTarget = document.body;
    portalTarget.appendChild(node);
    return {
      destroy() { if (node.parentNode) node.parentNode.removeChild(node); }
    };
  }

  function onBackdrop(e) {
    if (e.target === e.currentTarget) dispatch('close');
  }

  function onKey(e) {
    if (e.key === 'Escape' && show) dispatch('close');
  }
</script>

<svelte:window on:keydown={onKey} />

<!-- The portal wrapper stays in place in the DOM tree for Svelte reactivity,
     but the action moves the actual node to <body> -->
{#if show}
  <div use:portal bind:this={portalNode}>
    <div
      class="backdrop"
      on:click={onBackdrop}
      role="dialog"
      aria-modal="true"
      transition:fade={{ duration: 180 }}
    >
      <div class="box" class:wide transition:fly={{ y: 28, duration: 260, opacity: 0 }}>
        <slot />
      </div>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: grid;
    place-items: center;
    padding: 1rem;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    overflow-y: auto;
  }

  .box {
    width: 100%;
    max-width: 420px;
    /* Let the box be vertically centered but also scrollable if content is tall */
    margin: auto;
    background: var(--bg-surface);
    border: 1px solid var(--border-base);
    border-radius: var(--radius-xl);
    padding: 2rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    position: relative;
    box-shadow:
      0 32px 80px rgba(0, 0, 0, 0.6),
      0 0 0 1px rgba(255, 255, 255, 0.05);
  }
  .box.wide {
    max-width: 680px;
  }
</style>