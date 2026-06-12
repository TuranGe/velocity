<script>
  import '../app.css';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { theme } from '$lib/stores/theme';
  import { browser } from '$app/environment';
  import Navbar from '$lib/components/Navbar.svelte';
  import Toaster from '$lib/components/Toaster.svelte';
  import { initGSAP } from '$lib/utils/gsap';
  import { lang } from '$lib/stores/i18n';

  let gsap;
  let wipeEl;
  let isWiping = false;

  function doThemeWipe(callback) {
    if (!wipeEl || isWiping) { callback(); return; }
    isWiping = true;
    wipeEl.style.display = 'block';
    gsap.fromTo(wipeEl,
      { scaleX: 0, transformOrigin: 'left center' },
      { scaleX: 1, duration: 0.35, ease: 'power3.in',
        onComplete: () => {
          callback();
          gsap.fromTo(wipeEl,
            { scaleX: 1, transformOrigin: 'right center' },
            { scaleX: 0, duration: 0.35, ease: 'power3.out',
              onComplete: () => { wipeEl.style.display = 'none'; isWiping = false; }
            });
        }
      });
  }

  onMount(async () => {
    theme.init();
    // Restore saved language preference
    if (browser) {
      const savedLang = localStorage.getItem('velocity-lang');
      if (savedLang) lang.set(savedLang);
    }
    ({ gsap } = await initGSAP());
    gsap.fromTo('.layout-content',
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out', delay: 0.1 });
    if (browser) window.__velocityThemeWipe = doThemeWipe;
  });
</script>

<div class="theme-wipe" bind:this={wipeEl} aria-hidden="true"></div>

<div class="layout-root">
  <Navbar />
  <main class="layout-content">
    <slot />
  </main>
</div>

<Toaster />

<style>
  .layout-root { min-height: 100vh; display: flex; flex-direction: column; background: var(--bg-base); }
  .layout-content { flex: 1; display: flex; flex-direction: column; will-change: transform, opacity; }
  .theme-wipe {
    position: fixed; inset: 0; background: var(--accent); z-index: 9999;
    display: none; pointer-events: none; transform-origin: left center; will-change: transform;
  }
</style>
