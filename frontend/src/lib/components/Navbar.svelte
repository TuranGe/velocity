<script>
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import ThemeToggle from './ThemeToggle.svelte';
  import SoundSettings from './SoundSettings.svelte';
  import NavAuthModal from './NavAuthModal.svelte';
  import { magneticHover, initGSAP } from '$lib/utils/gsap';
  import { createAmbientEngine } from '$lib/utils/ambientAudio';
  import { t, toggleLang } from '$lib/stores/i18n';
  import { auth } from '$lib/stores/api';
  import { audio } from '$lib/stores/audio';
  import { toast } from '$lib/stores/toast';
  import { timer } from '$lib/stores/timer';
  import { fly } from 'svelte/transition';

  let logoEl, navEl, cleanup;

  // Music
  let musicPlaying = false;
  let currentTrack = 'lofi';
  const ambient = createAmbientEngine();

  let showSoundSettings = false;
  let showMobileMenu = false;
  let showAuthModal = false;
  let authMode = 'login';
  let showProfile = false;

  $: user = $auth.user;
  $: links = [
    { href: '/',            label: $t('timer')   },
    { href: '/teams',       label: 'Teams'       },
    { href: '/leaderboard', label: 'Leaderboard' },
    { href: '/stats',       label: $t('stats')   },
  ];

  onMount(async () => {
    const { gsap } = await initGSAP();
    gsap.fromTo(navEl, { y: -60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out', delay: 0.05 });
    cleanup = magneticHover(logoEl, 0.3);
  });

  audio.subscribe(audioState => {
    if (musicPlaying) ambient.setVolume(audioState.volume);
  });

  onDestroy(() => { cleanup?.(); ambient.stop({ immediate: true }); });

  // ── Music ──────────────────────────────────────────────────
  function toggleMusic() {
    if (musicPlaying) { musicPlaying = false; ambient.stop(); }
    else { if (!$audio.enabled) return; musicPlaying = true; ambient.start(currentTrack, $audio.volume); }
  }

  function handleTrackChange(trackId) {
    currentTrack = trackId;
    if (musicPlaying) ambient.changeTrack(trackId, $audio.volume);
  }

  let lastTimerMode = '';
  const MODE_TRACKS = { 'focus': 'lofi', 'short-break': 'nature', 'long-break': 'nature', 'custom': 'lofi' };
  $: if ($timer.mode !== lastTimerMode) {
    lastTimerMode = $timer.mode;
    const targetTrack = MODE_TRACKS[$timer.mode] || 'lofi';
    if (musicPlaying && currentTrack !== targetTrack) handleTrackChange(targetTrack);
  }

  // ── Auth ───────────────────────────────────────────────────
  function openAuth(mode = 'login') {
    authMode = mode;
    showAuthModal = true;
    showProfile = false;
  }

  function handleLogout() {
    auth.logout();
    showProfile = false;
    toast.info('Logged out');
  }
</script>

<div class="navbar-wrapper">
<nav bind:this={navEl} class="navbar">
  <a href="/" class="logo" bind:this={logoEl} aria-label="Velocity">
    <svg class="logo-mark" width="28" height="28" viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="12" stroke="currentColor" stroke-width="1.5" opacity="0.3"/>
      <circle cx="14" cy="14" r="12" stroke="var(--accent)" stroke-width="1.5"
        stroke-dasharray="75.4" stroke-dashoffset="18.85" stroke-linecap="round" transform="rotate(-90 14 14)"/>
      <path d="M11 9.5L18.5 14L11 18.5V9.5Z" fill="var(--accent)"/>
    </svg>
    <span class="logo-text font-mono">VELOCITY</span>
  </a>

  <div class="nav-links">
    {#each links as link}
      <a href={link.href} class="nav-link" class:active={$page.url.pathname === link.href}>
        {link.label}
      </a>
    {/each}
  </div>

  <!-- Hamburger (mobile only) -->
  <button class="hamburger-btn" on:click={() => showMobileMenu = !showMobileMenu} aria-label="Menu">
    <span class="ham-line" class:open={showMobileMenu}></span>
    <span class="ham-line" class:open={showMobileMenu}></span>
    <span class="ham-line" class:open={showMobileMenu}></span>
  </button>

  {#if showMobileMenu}
    <div class="mobile-menu" on:click={() => showMobileMenu = false}>
      {#each links as link}
        <a href={link.href} class="mobile-nav-link" class:active={$page.url.pathname === link.href}>
          {link.label}
        </a>
      {/each}
    </div>
  {/if}

  <div class="nav-controls">
    <!-- Sound Settings -->
    <button class="icon-btn settings-btn" class:playing={musicPlaying} on:click={() => showSoundSettings = true}
      title="Sound settings" aria-label="Sound settings">
      🔊
      {#if musicPlaying}<span class="playing-dot"></span>{/if}
    </button>

    <!-- Language -->
    <button class="icon-btn lang-btn font-mono" on:click={toggleLang} title="Switch language">
      {$t('lang_toggle')}
    </button>

    <ThemeToggle />

    <!-- User / Auth -->
    {#if user}
      <div class="user-menu" class:open={showProfile}>
        <button class="user-btn" on:click={() => showProfile = !showProfile}>
          <span class="user-name">{user.username}</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
            style="transition:transform 0.2s;transform:rotate({showProfile?180:0}deg)">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
        {#if showProfile}
          <div class="dropdown" transition:fly={{ y: -8, duration: 150 }}>
            <a href="/stats" class="dropdown-item" on:click={() => showProfile = false}>📊 Stats</a>
            <a href="/profile" class="dropdown-item" on:click={() => showProfile = false}>👤 Profil</a>
            <div class="dropdown-divider"></div>
            <button class="dropdown-item danger" on:click={handleLogout}>Sign Out</button>
          </div>
        {/if}
      </div>
    {:else}
      <button class="auth-btn font-mono" on:click={() => openAuth('login')}>Sign In</button>
    {/if}
  </div>
</nav>

<!-- Sound Settings Modal -->
<SoundSettings bind:show={showSoundSettings} {musicPlaying} {toggleMusic} {currentTrack} onTrackChange={handleTrackChange} />

<!-- Auth Modal -->
<NavAuthModal bind:show={showAuthModal} initialMode={authMode} on:close={() => showAuthModal = false} />

</div><!-- /navbar-wrapper -->

<style>
  .navbar-wrapper {
    position: sticky;
    top: 0;
    z-index: 100;
  }
  .navbar {
    position: relative; z-index: 1;
    display: flex; align-items: center; gap: 1.5rem;
    padding: 0.875rem 2rem;
    border-bottom: 1px solid var(--border-subtle);
    background: var(--bg-base);
    backdrop-filter: blur(20px);
    flex-wrap: wrap;
  }

  .logo { display: flex; align-items: center; gap: 0.75rem; text-decoration: none; color: var(--text-primary); }
  .logo-mark { transition: transform 0.4s var(--spring); flex-shrink: 0; }
  .logo:hover .logo-mark { transform: rotate(15deg) scale(1.1); }
  .logo-text { font-size: 0.875rem; font-weight: 700; letter-spacing: 0.15em; }

  .nav-links { display: flex; gap: 0.15rem; margin-left: auto; }
  .nav-link {
    font-family: var(--font-mono); font-size: 0.72rem; letter-spacing: 0.08em;
    text-transform: uppercase; padding: 0.4rem 0.75rem; border-radius: var(--radius-sm);
    color: var(--text-secondary); text-decoration: none;
    transition: color var(--transition-fast), background var(--transition-fast);
    position: relative;
  }
  .nav-link::after {
    content: ''; position: absolute; bottom: 0; left: 50%;
    transform: translateX(-50%) scaleX(0); width: 60%; height: 1px;
    background: var(--accent); transition: transform 0.3s var(--spring);
  }
  .nav-link:hover { color: var(--text-primary); background: var(--accent-subtle); }
  .nav-link:hover::after, .nav-link.active::after { transform: translateX(-50%) scaleX(1); }
  .nav-link.active { color: var(--accent); }

  .nav-controls { display: flex; align-items: center; gap: 0.4rem; }

  .icon-btn {
    display: flex; align-items: center; gap: 0.4rem; padding: 0 0.55rem; height: 34px;
    border-radius: var(--radius-md); background: transparent;
    border: 1px solid var(--border-base); color: var(--text-secondary);
    transition: all var(--transition-fast); cursor: pointer;
  }
  .icon-btn:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-subtle); }
  .lang-btn { font-size: 0.65rem; font-weight: 700; letter-spacing: 0.1em; }

  .settings-btn { position: relative; }
  .playing-dot {
    position: absolute;
    top: 4px; right: 4px;
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 6px var(--accent-glow);
    animation: pulse-dot 2s ease-in-out infinite;
  }
  @keyframes pulse-dot {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.8); }
  }

  /* User menu */
  .user-menu { position: relative; }
  .user-btn {
    display: flex; align-items: center; gap: 0.45rem;
    padding: 0.3rem 0.65rem; height: 34px;
    border-radius: var(--radius-md); background: var(--accent-subtle);
    border: 1px solid var(--accent); color: var(--text-primary);
    font-size: 0.75rem; font-weight: 600; cursor: pointer;
    transition: background var(--transition-fast), box-shadow var(--transition-fast);
  }
  .user-btn:hover { background: var(--accent); color: white; }
  .user-name { max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--font-mono); font-size: 0.7rem; }

  .dropdown {
    position: absolute; top: calc(100% + 6px); right: 0;
    background: var(--bg-surface); border: 1px solid var(--border-base);
    border-radius: var(--radius-md); min-width: 160px;
    box-shadow: 0 12px 32px rgba(0,0,0,0.2); z-index: 200;
    overflow: hidden;
  }
  .dropdown-item {
    display: block; width: 100%; padding: 0.65rem 1rem;
    font-size: 0.78rem; color: var(--text-secondary); text-align: left;
    background: transparent; border: none; text-decoration: none;
    transition: background var(--transition-fast), color var(--transition-fast); cursor: pointer;
  }
  .dropdown-item:hover { background: var(--accent-subtle); color: var(--text-primary); }
  .dropdown-item.danger:hover { background: rgba(239,68,68,0.1); color: #ef4444; }
  .dropdown-divider { height: 1px; background: var(--border-subtle); margin: 2px 0; }

  .auth-btn {
    height: 34px; padding: 0 0.9rem;
    background: var(--accent); color: white; border: none;
    border-radius: var(--radius-md); font-size: 0.7rem; font-weight: 700;
    letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer;
    transition: background var(--transition-fast), box-shadow var(--transition-fast);
  }
  .auth-btn:hover { background: var(--accent-hover); box-shadow: 0 0 12px var(--accent-glow); }

  @media (max-width: 768px) {
    .navbar { padding: 0.875rem 1rem; gap: 0.75rem; }
    .logo-text { display: none; }
    .nav-links { display: none; }
    .nav-link { font-size: 0.65rem; padding: 0.35rem 0.5rem; }
    .user-name { display: none; }
    .hamburger-btn { display: flex; }
  }

  /* Hamburger button */
  .hamburger-btn {
    display: none;
    flex-direction: column;
    gap: 4px;
    padding: 6px;
    background: none;
    border: none;
    cursor: pointer;
    margin-left: auto;
  }
  .ham-line {
    display: block;
    width: 20px;
    height: 2px;
    background: var(--text-secondary);
    border-radius: 2px;
    transition: transform 0.25s, opacity 0.25s;
  }
  .ham-line.open:nth-child(1) { transform: translateY(6px) rotate(45deg); }
  .ham-line.open:nth-child(2) { opacity: 0; }
  .ham-line.open:nth-child(3) { transform: translateY(-6px) rotate(-45deg); }

  /* Mobile menu dropdown */
  .mobile-menu {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: var(--bg-surface);
    border-bottom: 1px solid var(--border-subtle);
    display: flex;
    flex-direction: column;
    padding: 0.5rem 1.5rem 1rem;
    gap: 0.25rem;
    z-index: 99;
    box-shadow: 0 8px 24px rgba(0,0,0,0.15);
    backdrop-filter: blur(20px);
  }
  .mobile-nav-link {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-secondary);
    padding: 0.75rem 0.5rem;
    border-bottom: 1px solid var(--border-subtle);
    text-decoration: none;
    transition: color var(--transition-fast);
  }
  .mobile-nav-link:last-child { border-bottom: none; }
  .mobile-nav-link:hover, .mobile-nav-link.active { color: var(--accent); }
</style>