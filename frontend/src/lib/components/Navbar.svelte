<script>
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import ThemeToggle from './ThemeToggle.svelte';
  import SoundSettings from './SoundSettings.svelte';
  import { magneticHover, initGSAP } from '$lib/utils/gsap';
  import { createAmbientEngine } from '$lib/utils/ambientAudio';
  import { t, lang, toggleLang } from '$lib/stores/i18n';
  import { auth } from '$lib/stores/api';
  import { audio } from '$lib/stores/audio';
  import { toast } from '$lib/stores/toast';
  import { timer } from '$lib/stores/timer';
  import Modal from './Modal.svelte';
  import { fly, fade } from 'svelte/transition';

  let logoEl, navEl, cleanup;

  // Music
  let musicPlaying = false;
  let currentTrack = 'lofi';
  const ambient = createAmbientEngine();

  // Sound settings modal
  let showSoundSettings = false;
  let showMobileMenu = false;

  // Auth modal state
  let showAuthModal = false;
  let authMode = 'login'; // 'login' | 'register'
  let email = '', password = '', username = '', confirmPassword = '';
  let authLoading = false;
  let authError = '';

  // Profile dropdown
  let showProfile = false;

  // OAuth config (these should be environment variables in production)
  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
  const GOOGLE_REDIRECT  = import.meta.env.VITE_GOOGLE_REDIRECT  || (typeof window !== 'undefined' ? window.location.origin + '/auth/google' : 'http://localhost:5173/auth/google');
  const DISCORD_CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID || '';
  const DISCORD_REDIRECT = import.meta.env.VITE_DISCORD_REDIRECT || 'http://localhost:5173/auth/discord';

  $: user = $auth.user;
  $: links = [
    { href: '/',            label: $t('timer')    },
    { href: '/teams',       label: 'Teams'        },
    { href: '/leaderboard', label: 'Leaderboard'  },
    { href: '/stats',       label: $t('stats')    },
  ];

  onMount(async () => {
    const { gsap } = await initGSAP();
    gsap.fromTo(navEl, { y: -60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out', delay: 0.05 });
    cleanup = magneticHover(logoEl, 0.3);
  });

  // Keep engine volume in sync with the audio store
  audio.subscribe(audioState => {
    if (musicPlaying) ambient.setVolume(audioState.volume);
  });

  onDestroy(() => { cleanup?.(); ambient.stop({ immediate: true }); });

  // ── Music ──────────────────────────────────────────────────
  function toggleMusic() {
    if (musicPlaying) {
      musicPlaying = false;
      ambient.stop();
    } else {
      if (!$audio.enabled) return;
      musicPlaying = true;
      ambient.start(currentTrack, $audio.volume);
    }
  }

  function handleTrackChange(trackId) {
    currentTrack = trackId;
    if (musicPlaying) ambient.changeTrack(trackId, $audio.volume);
  }

  // Auto-switch music track based on timer mode
  let lastTimerMode = '';
  const MODE_TRACKS = { 'focus': 'lofi', 'short-break': 'nature', 'long-break': 'nature', 'custom': 'lofi' };
  $: if ($timer.mode !== lastTimerMode) {
    lastTimerMode = $timer.mode;
    const targetTrack = MODE_TRACKS[$timer.mode] || 'lofi';
    if (musicPlaying && currentTrack !== targetTrack) {
      handleTrackChange(targetTrack);
    }
  }

  // ── Auth ───────────────────────────────────────────────────
  function openAuth(mode = 'login') {
    authMode = mode; authError = ''; email = ''; password = ''; username = ''; confirmPassword = '';
    showAuthModal = true; showProfile = false;
  }

  async function handleAuth() {
    authError = '';
    if (authMode === 'register') {
      if (!username.trim() || !email.trim() || !password) { authError = 'All fields required'; return; }
      if (password !== confirmPassword) { authError = 'Passwords do not match'; return; }
    } else {
      if (!email.trim() || !password) { authError = 'Email and password required'; return; }
    }
    authLoading = true;
    try {
      if (authMode === 'register') {
        await auth.register(username.trim(), email.trim(), password);
        toast.success(`Welcome, ${username}! 🎉`);
      } else {
        const u = await auth.login(email.trim(), password);
        toast.success(`Welcome back, ${u.username}!`);
      }
      showAuthModal = false;
    } catch(e) { authError = e.message; }
    finally { authLoading = false; }
  }

  function handleLogout() {
    auth.logout();
    showProfile = false;
    toast.info('Logged out');
  }

  // ── OAuth ───────────────────────────────────────────────────
  function handleGoogleOAuth() {
    if (!GOOGLE_CLIENT_ID) {
      toast.error('Google OAuth not configured');
      return;
    }
    const redirectUri = encodeURIComponent(GOOGLE_REDIRECT);
    const scope = encodeURIComponent('openid email profile');
    const clientId = encodeURIComponent(GOOGLE_CLIENT_ID);
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
  }

  function handleDiscordOAuth() {
    if (!DISCORD_CLIENT_ID) {
      toast.error('Discord OAuth not configured');
      return;
    }
    const redirectUri = encodeURIComponent(DISCORD_REDIRECT);
    const clientId = encodeURIComponent(DISCORD_CLIENT_ID);
    const scope = encodeURIComponent('identify email');
    window.location.href = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
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
<Modal show={showAuthModal} on:close={() => showAuthModal = false}>
  <button class="m-close" on:click={() => showAuthModal = false}>✕</button>

  <div class="auth-tabs">
    <button class="auth-tab" class:active={authMode==='login'}    on:click={() => { authMode='login';    authError=''; }}>Sign In</button>
    <button class="auth-tab" class:active={authMode==='register'} on:click={() => { authMode='register'; authError=''; }}>Register</button>
  </div>

  {#if authMode === 'register'}
    <input class="m-input" bind:value={username} placeholder="Username" maxlength="20"
      on:keydown={e=>e.key==='Enter'&&handleAuth()} />
  {/if}

  <input class="m-input" bind:value={email} type="email" placeholder="Email"
    on:keydown={e=>e.key==='Enter'&&handleAuth()} />
  <input class="m-input" bind:value={password} type="password" placeholder="Password"
    on:keydown={e=>e.key==='Enter'&&handleAuth()} />

  {#if authMode === 'register'}
    <input class="m-input" bind:value={confirmPassword} type="password" placeholder="Confirm password"
      on:keydown={e=>e.key==='Enter'&&handleAuth()} />
  {/if}

  {#if authError}<p class="auth-error">{authError}</p>{/if}

  <button class="m-btn-primary" on:click={handleAuth} disabled={authLoading}>
    {authLoading ? '…' : authMode === 'login' ? 'Sign In' : 'Create Account'}
  </button>

  <div class="oauth-divider"><span>or continue with</span></div>
  <div class="oauth-btns">
    <button class="oauth-btn" on:click={handleGoogleOAuth}>
      <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
      Google
    </button>
    <button class="oauth-btn" on:click={handleDiscordOAuth}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="#5865F2"><path d="M20.317 4.492c-1.53-.69-3.17-1.2-4.885-1.49a.075.075 0 0 0-.079.036c-.21.369-.444.85-.608 1.23a18.566 18.566 0 0 0-5.487 0 12.36 12.36 0 0 0-.617-1.23A.077.077 0 0 0 8.562 3c-1.714.29-3.354.8-4.885 1.491a.07.07 0 0 0-.032.027C.533 9.093-.32 13.555.099 17.961a.08.08 0 0 0 .031.055 20.03 20.03 0 0 0 5.993 2.98.078.078 0 0 0 .084-.026c.462-.62.874-1.275 1.226-1.963.021-.04.001-.088-.041-.104a13.201 13.201 0 0 1-1.872-.878.075.075 0 0 1-.008-.125c.126-.093.252-.19.372-.287a.075.075 0 0 1 .078-.01c3.927 1.764 8.18 1.764 12.061 0a.075.075 0 0 1 .079.009c.12.098.245.195.372.288a.075.075 0 0 1-.006.125c-.598.344-1.22.635-1.873.877a.075.075 0 0 0-.041.105c.36.687.772 1.341 1.225 1.962a.077.077 0 0 0 .084.028 19.963 19.963 0 0 0 6.002-2.981.076.076 0 0 0 .032-.054c.5-5.094-.838-9.52-3.549-13.442a.06.06 0 0 0-.031-.028z"/></svg>
      Discord
    </button>
  </div>
</Modal>

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

  /* Auth modal */
  .m-close {
    position: absolute; top: 1rem; right: 1rem; width: 26px; height: 26px;
    border-radius: 50%; background: transparent; border: 1px solid var(--border-base);
    color: var(--text-tertiary); font-size: 0.7rem; display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: color var(--transition-fast);
  }
  .m-close:hover { color: var(--text-primary); }

  .auth-tabs { display: flex; border-bottom: 1px solid var(--border-subtle); }
  .auth-tab {
    flex: 1; padding: 0.6rem; font-family: var(--font-mono); font-size: 0.7rem;
    font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
    background: transparent; border: none; color: var(--text-tertiary);
    cursor: pointer; transition: color var(--transition-fast);
    border-bottom: 2px solid transparent;
  }
  .auth-tab.active { color: var(--accent); border-bottom-color: var(--accent); }
  .auth-tab:hover:not(.active) { color: var(--text-secondary); }

  .m-input {
    width: 100%; background: var(--bg-elevated); border: 1px solid var(--border-base);
    border-radius: var(--radius-md); padding: 0.7rem 1rem;
    font-size: 0.875rem; color: var(--text-primary); outline: none;
    transition: border-color var(--transition-fast);
  }
  .m-input:focus { border-color: var(--accent); }
  .auth-error { font-size: 0.75rem; color: #ef4444; font-family: var(--font-mono); }
  .m-btn-primary {
    width: 100%; padding: 0.75rem; background: var(--accent); color: white;
    border: none; border-radius: var(--radius-md); font-family: var(--font-mono);
    font-size: 0.75rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
    cursor: pointer; transition: background var(--transition-fast);
  }
  .m-btn-primary:hover:not(:disabled) { background: var(--accent-hover); }
  .m-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

  .oauth-divider { display: flex; align-items: center; gap: 0.75rem; }
  .oauth-divider::before, .oauth-divider::after { content: ''; flex: 1; height: 1px; background: var(--border-subtle); }
  .oauth-divider span { font-size: 0.65rem; color: var(--text-tertiary); white-space: nowrap; }
  .oauth-btns { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
  .oauth-btn {
    display: flex; align-items: center; justify-content: center; gap: 0.5rem;
    padding: 0.6rem; border: 1px solid var(--border-base); border-radius: var(--radius-md);
    background: transparent; color: var(--text-secondary); font-size: 0.78rem;
    cursor: pointer; transition: all var(--transition-fast);
  }
  .oauth-btn:hover { border-color: var(--accent); background: var(--accent-subtle); color: var(--text-primary); }

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