<script>
  // Auth modal used by Navbar — extracted to keep Navbar focused on
  // navigation concerns rather than auth form logic.
  import Modal from './Modal.svelte';
  import { auth } from '$lib/stores/api';
  import { toast } from '$lib/stores/toast';
  import { createEventDispatcher } from 'svelte';

  export let show = false;
  export let initialMode = 'login'; // 'login' | 'register'

  const dispatch = createEventDispatcher();

  const DISCORD_CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID || '';
  const DISCORD_REDIRECT  = import.meta.env.VITE_DISCORD_REDIRECT  || 'http://localhost:5173/auth/discord';

  let authMode = initialMode;
  let email = '', password = '', username = '', confirmPassword = '';
  let authLoading = false;
  let authError = '';

  $: if (show) { authMode = initialMode; authError = ''; }

  function close() { show = false; dispatch('close'); }

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
      close();
    } catch(e) { authError = e.message; }
    finally { authLoading = false; }
  }

  function handleDiscordOAuth() {
    if (!DISCORD_CLIENT_ID) { toast.error('Discord OAuth not configured'); return; }
    const redirectUri  = encodeURIComponent(DISCORD_REDIRECT);
    const clientId = encodeURIComponent(DISCORD_CLIENT_ID);
    const scope    = encodeURIComponent('identify email');
    window.location.href = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
  }
</script>

<Modal {show} on:close={close}>
  <button class="m-close" on:click={close}>✕</button>

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
    <button class="oauth-btn" on:click={handleDiscordOAuth}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="#5865F2"><path d="M20.317 4.492c-1.53-.69-3.17-1.2-4.885-1.49a.075.075 0 0 0-.079.036c-.21.369-.444.85-.608 1.23a18.566 18.566 0 0 0-5.487 0 12.36 12.36 0 0 0-.617-1.23A.077.077 0 0 0 8.562 3c-1.714.29-3.354.8-4.885 1.491a.07.07 0 0 0-.032.027C.533 9.093-.32 13.555.099 17.961a.08.08 0 0 0 .031.055 20.03 20.03 0 0 0 5.993 2.98.078.078 0 0 0 .084-.026c.462-.62.874-1.275 1.226-1.963.021-.04.001-.088-.041-.104a13.201 13.201 0 0 1-1.872-.878.075.075 0 0 1-.008-.125c.126-.093.252-.19.372-.287a.075.075 0 0 1 .078-.01c3.927 1.764 8.18 1.764 12.061 0a.075.075 0 0 1 .079.009c.12.098.245.195.372.288a.075.075 0 0 1-.006.125c-.598.344-1.22.635-1.873.877a.075.075 0 0 0-.041.105c.36.687.772 1.341 1.225 1.962a.077.077 0 0 0 .084.028 19.963 19.963 0 0 0 6.002-2.981.076.076 0 0 0 .032-.054c.5-5.094-.838-9.52-3.549-13.442a.06.06 0 0 0-.031-.028z"/></svg>
      Discord
    </button>
  </div>
</Modal>

<style>
  .m-close { position: absolute; top: 1rem; right: 1rem; background: none; border: none; color: var(--text-tertiary); font-size: 1rem; cursor: pointer; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 50%; transition: color var(--transition-fast); }
  .m-close:hover { color: var(--text-primary); }

  .auth-tabs { display: flex; gap: 0; border-bottom: 1px solid var(--border-subtle); margin-bottom: 0.25rem; }
  .auth-tab { flex: 1; padding: 0.6rem; background: none; border: none; border-bottom: 2px solid transparent; font-size: 0.8rem; font-weight: 600; color: var(--text-tertiary); cursor: pointer; transition: all var(--transition-fast); margin-bottom: -1px; }
  .auth-tab.active { color: var(--accent); border-bottom-color: var(--accent); }
  .auth-tab:hover:not(.active) { color: var(--text-secondary); }

  .m-input { width: 100%; padding: 0.65rem 0.9rem; background: var(--bg-elevated); border: 1px solid var(--border-base); border-radius: var(--radius-md); color: var(--text-primary); font-size: 0.85rem; transition: border-color var(--transition-fast); box-sizing: border-box; }
  .m-input:focus { border-color: var(--accent); outline: none; }

  .auth-error { font-size: 0.8rem; color: #ef4444; background: rgba(239,68,68,0.08); padding: 0.5rem 0.75rem; border-radius: var(--radius-sm); border: 1px solid rgba(239,68,68,0.2); }

  .m-btn-primary { width: 100%; padding: 0.75rem; background: var(--accent); color: white; border: none; border-radius: var(--radius-md); font-weight: 700; font-family: var(--font-mono); font-size: 0.8rem; letter-spacing: 0.05em; text-transform: uppercase; cursor: pointer; transition: background var(--transition-fast), box-shadow var(--transition-fast); }
  .m-btn-primary:hover:not(:disabled) { background: var(--accent-hover); box-shadow: 0 0 20px var(--accent-glow); }
  .m-btn-primary:disabled { opacity: 0.6; cursor: wait; }

  .oauth-divider { display: flex; align-items: center; gap: 0.75rem; color: var(--text-tertiary); font-size: 0.75rem; }
  .oauth-divider::before, .oauth-divider::after { content: ''; flex: 1; height: 1px; background: var(--border-subtle); }
  .oauth-btns { display: grid; grid-template-columns: 1fr; gap: 0.5rem; }
  .oauth-btn { display: flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 0.65rem; background: var(--bg-elevated); border: 1px solid var(--border-base); border-radius: var(--radius-md); color: var(--text-primary); font-size: 0.82rem; font-weight: 600; cursor: pointer; transition: border-color var(--transition-fast), background var(--transition-fast); }
  .oauth-btn:hover { border-color: var(--accent); background: var(--accent-subtle); }
</style>