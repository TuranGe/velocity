<script>
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/api';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { toast } from '$lib/stores/toast';
  import { t } from '$lib/stores/i18n';

  let loading = true;
  let error = '';

  onMount(async () => {
    try {
      const code  = $page.url.searchParams.get('code');
      const state = $page.url.searchParams.get('state');

      if (!code) {
        error = 'No authorization code received';
        loading = false;
        return;
      }

      const response = await fetch('/api/auth/oauth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Google authentication failed');
      }

      const data = await response.json();

      if (state === 'link' && $auth.user) {
        await auth.linkProvider('google', data.provider_id, data.email);
        toast.success('Google hesabı bağlandı! 🎉');
        goto('/profile');
      } else {
        await auth.oauth('google', data.provider_id, data.email, data.username, data.profile_image);
        toast.success(`${$t('profile_welcome')}, ${data.username}! 🎉`);
        goto('/');
      }
    } catch (e) {
      error = e.message || 'Authentication failed';
      loading = false;
    }
  });
</script>

<div class="auth-callback">
  {#if loading}
    <div class="loading">
      <div class="spinner"></div>
      <span>Google ile bağlanıyor...</span>
    </div>
  {:else if error}
    <div class="error-card">
      <div class="error-icon">⚠️</div>
      <h2>Bağlantı başarısız</h2>
      <p>{error}</p>
      <a href="/">← Ana sayfaya dön</a>
    </div>
  {/if}
</div>

<style>
  .auth-callback {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    padding: 2rem;
  }
  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    color: var(--text-secondary);
    font-size: 0.9rem;
  }
  .spinner {
    width: 32px;
    height: 32px;
    border: 2px solid var(--border-base);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .error-card {
    max-width: 420px;
    background: var(--bg-surface);
    border: 1px solid var(--border-base);
    border-radius: 20px;
    padding: 2rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    text-align: center;
  }
  .error-icon { font-size: 2rem; }
  .error-card h2 { color: var(--text-primary); font-size: 1.1rem; }
  .error-card p { color: var(--text-secondary); line-height: 1.6; font-size: 0.88rem; }
  .error-card a {
    color: var(--accent);
    text-decoration: none;
    font-size: 0.82rem;
    margin-top: 0.25rem;
  }
</style>
