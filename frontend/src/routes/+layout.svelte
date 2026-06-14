<script>
  import '../app.css';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { theme } from '$lib/stores/theme';
  import { browser } from '$app/environment';
  import Navbar from '$lib/components/Navbar.svelte';
  import Toaster from '$lib/components/Toaster.svelte';
  import WeeklySummaryModal from '$lib/components/WeeklySummaryModal.svelte';
  import { initGSAP } from '$lib/utils/gsap';
  import { lang } from '$lib/stores/i18n';
  import { auth, userStats } from '$lib/stores/api';

  let gsap;
  let wipeEl;
  let isWiping = false;

  const tabs = [
    { href: '/',           icon: '⏱', label: 'Timer' },
    { href: '/stats',      icon: '📊', label: 'Stats' },
    { href: '/leaderboard',icon: '🏆', label: 'Board' },
    { href: '/teams',      icon: '🤝', label: 'Teams' },
    { href: '/profile',    icon: '👤', label: 'Profile' },
  ];

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
    if (browser) {
      const savedLang = localStorage.getItem('velocity-lang');
      if (savedLang) lang.set(savedLang);
      // Validate any session restored from localStorage — if the token
      // is invalid/expired or the account no longer exists, this logs
      // the user out so the UI doesn't show a "logged in" state that
      // the backend will reject on the first real request.
      await auth.refresh();
      userStats.refresh();
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

  <!-- Bottom Tab Bar (mobile only) -->
  <nav class="bottom-tab-bar" aria-label="Mobile navigation">
    {#each tabs as tab}
      <a
        href={tab.href}
        class="tab-item"
        class:active={$page.url.pathname === tab.href}
        aria-label={tab.label}
      >
        <span class="tab-icon">{tab.icon}</span>
        <span class="tab-label">{tab.label}</span>
        {#if $page.url.pathname === tab.href}
          <span class="tab-dot"></span>
        {/if}
      </a>
    {/each}
  </nav>
</div>

<Toaster />
<WeeklySummaryModal />

<style>
  .layout-root { min-height: 100vh; display: flex; flex-direction: column; background: var(--bg-base); }
  .layout-content { flex: 1; display: flex; flex-direction: column; will-change: transform, opacity; }
  .theme-wipe {
    position: fixed; inset: 0; background: var(--accent); z-index: 9999;
    display: none; pointer-events: none; transform-origin: left center; will-change: transform;
  }

  /* Bottom Tab Bar */
  .bottom-tab-bar {
    display: none;
  }

  @media (max-width: 768px) {
    .bottom-tab-bar {
      display: flex;
      position: fixed;
      bottom: 0; left: 0; right: 0;
      background: var(--bg-surface);
      border-top: 1px solid var(--border-subtle);
      backdrop-filter: blur(20px);
      z-index: 200;
      padding-bottom: env(safe-area-inset-bottom, 0px);
    }

    /* Push content above the tab bar */
    .layout-content {
      padding-bottom: 64px;
    }
  }

  .tab-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    padding: 10px 4px 8px;
    text-decoration: none;
    color: var(--text-tertiary);
    transition: color 0.15s;
    position: relative;
    min-height: 56px;
  }
  .tab-item.active { color: var(--accent); }
  .tab-icon { font-size: 1.2rem; line-height: 1; }
  .tab-label {
    font-family: var(--font-mono);
    font-size: 0.55rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .tab-dot {
    position: absolute;
    top: 6px;
    width: 4px; height: 4px;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 6px var(--accent-glow);
  }
</style>