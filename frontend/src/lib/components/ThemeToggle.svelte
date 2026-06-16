<script>
  import { onMount } from 'svelte';
  import { theme } from '$lib/stores/theme';
  import { initGSAP } from '$lib/utils/gsap';
  let btnEl;
  let iconEl;
  let gsap;

  onMount(async () => {
    ({ gsap } = await initGSAP());
  });

  function handleToggle() {
    const doWipe = (typeof window !== 'undefined') ? window.__velocityThemeWipe : null;

    if (doWipe && gsap) {
      doWipe(() => theme.toggle());
    } else if (gsap) {
      gsap.timeline()
        .to(iconEl, {
          rotateY: 90,
          scale: 0.7,
          duration: 0.2,
          ease: 'power2.in',
          onComplete: () => theme.toggle()
        })
        .to(iconEl, {
          rotateY: 0,
          scale: 1,
          duration: 0.35,
          ease: 'velBounce',
        });

      gsap.to(btnEl, {
        scale: 0.9,
        duration: 0.1,
        ease: 'power2.in',
        yoyo: true,
        repeat: 1,
      });
    } else {
      theme.toggle();
    }
  }
</script>

<button
  bind:this={btnEl}
  class="theme-toggle"
  on:click={handleToggle}
  aria-label="toggle theme"
  title={$theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
>
  <span bind:this={iconEl} class="icon-wrap" style="transform-style: preserve-3d;">
    {#if $theme === 'dark'}
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="5"/>
        <line x1="12" y1="1" x2="12" y2="3"/>
        <line x1="12" y1="21" x2="12" y2="23"/>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
        <line x1="1" y1="12" x2="3" y2="12"/>
        <line x1="21" y1="12" x2="23" y2="12"/>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
      </svg>
    {:else}
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
      </svg>
    {/if}
  </span>
</button>

<style>
  .theme-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: var(--radius-md);
    background: var(--bg-elevated);
    border: 1px solid var(--border-base);
    color: var(--text-secondary);
    transition: background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast), box-shadow var(--transition-fast);
    will-change: transform;
  }

  .theme-toggle:hover {
    background: var(--accent-subtle);
    border-color: var(--accent);
    color: var(--accent);
    box-shadow: 0 0 12px var(--accent-glow);
  }

  .icon-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    will-change: transform;
  }
</style>
