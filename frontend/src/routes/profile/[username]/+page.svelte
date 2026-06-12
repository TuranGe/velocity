<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { fly } from 'svelte/transition';
  import { API_URL } from '$lib/stores/api';
  import { t } from '$lib/stores/i18n';

  let profile = null;
  let loading = true;
  let error = null;
  let discordActivity = null;
  let discordLoading = false;

  $: username = $page.params.username;

  onMount(async () => { await loadProfile(); });

  async function loadProfile() {
    loading = true;
    error = null;
    try {
      const res = await fetch(`${API_URL}/api/users/${username}/profile`);
      if (!res.ok) {
        error = res.status === 404 ? 'Kullanıcı bulunamadı.' : 'Profil yüklenemedi.';
        return;
      }
      profile = await res.json();
      if (profile.user.discord_id) loadDiscordActivity(profile.user.discord_id);
    } catch {
      error = 'Profil yüklenemedi.';
    } finally {
      loading = false;
    }
  }

  async function loadDiscordActivity(discordId) {
    discordLoading = true;
    try {
      const res = await fetch(`https://api.lanyard.rest/v1/users/${discordId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) discordActivity = data.data;
      }
    } catch { discordActivity = null; }
    finally { discordLoading = false; }
  }

  function fmtHours(seconds) { return (seconds / 3600).toFixed(1); }
  function fmtDate(ts) { return new Date(ts * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
  function formatMode(mode) { return mode.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }
  function statusColor(status) { return { online: '#3ba55d', idle: '#faa81a', dnd: '#ed4245' }[status] || '#747f8d'; }

  $: initials = profile?.user?.username?.slice(0, 1).toUpperCase() ?? '?';
  $: spotify = discordActivity?.listening_to_spotify ? discordActivity.spotify : null;
  $: activities = discordActivity?.activities?.filter(a => a.type !== 2 && a.type !== 4) || [];
  $: discordStatus = discordActivity?.discord_status || 'offline';
</script>

<svelte:head><title>{username} — Velocity</title></svelte:head>

<div class="page">
  {#if loading}
    <div class="loading-state">
      <div class="skeleton skeleton-hero"></div>
      <div class="skeleton-row">
        <div class="skeleton skeleton-panel"></div>
        <div class="skeleton skeleton-panel"></div>
      </div>
    </div>

  {:else if error}
    <div class="error-state" transition:fly={{ y: 16, duration: 260 }}>
      <span class="error-icon">👻</span>
      <p>{error}</p>
      <a href="/" class="btn-ghost">Ana sayfaya dön</a>
    </div>

  {:else if profile}
    <div class="profile-shell" transition:fly={{ y: 16, duration: 260 }}>

      <!-- ── Hero ──────────────────────────────────── -->
      <div class="hero-card">
        <div class="hero-glow" aria-hidden="true"></div>

        <!-- Avatar -->
        <div class="hero-left">
          <div class="avatar-wrap">
            {#if profile.user.profile_image}
              <img src={profile.user.profile_image} alt="avatar" class="avatar-img" />
            {:else}
              <span class="avatar-initials">{initials}</span>
            {/if}
          </div>

          {#if profile.user.discord_id}
            <span class="badge-discord" title="Discord bağlı">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
              Discord
            </span>
          {/if}
        </div>

        <!-- Identity -->
        <div class="hero-center">
          <span class="hero-eyebrow">{$t('profile_label')}</span>
          <h1 class="hero-username">{profile.user.username}</h1>

          {#if profile.user.bio}
            <p class="hero-bio">{profile.user.bio}</p>
          {:else}
            <p class="hero-bio muted">{$t('profile_no_bio')}</p>
          {/if}

          <div class="hero-pills">
            <span class="pill">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              {profile.stats?.total_sessions ?? 0} {$t('profile_sessions')}
            </span>
            <span class="pill">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              {fmtHours(profile.stats?.total_seconds ?? 0)}h {$t('profile_min_focus')}
            </span>
            {#if profile.teams?.length}
              <span class="pill">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                {profile.teams.length} {$t('profile_teams')}
              </span>
            {/if}
          </div>
        </div>
      </div>

      <!-- ── Grid ───────────────────────────────────── -->
      <div class="grid-2">

        <!-- Stats -->
        <section class="panel">
          <div class="panel-header">
            <span class="panel-eyebrow">{$t('profile_stats_label')}</span>
            <h2 class="panel-title">{$t('profile_focus_summary')}</h2>
          </div>

          <div class="stat-trio">
            <div class="stat-block">
              <span class="stat-num font-mono">{profile.stats?.total_sessions ?? 0}</span>
              <span class="stat-desc">{$t('profile_total_sessions')}</span>
            </div>
            <div class="stat-block stat-accent">
              <span class="stat-num font-mono">{Math.floor((profile.stats?.total_seconds ?? 0) / 60)}</span>
              <span class="stat-desc">{$t('profile_dakika_focus')}</span>
            </div>
            <div class="stat-block">
              <span class="stat-num font-mono">{fmtHours(profile.stats?.total_seconds ?? 0)}</span>
              <span class="stat-desc">{$t('profile_hours')}</span>
            </div>
          </div>

          <div class="mini-bars" aria-hidden="true">
            {#each [0.3, 0.7, 0.5, 0.9, 0.4, 0.6, 0.8] as h, i}
              <div class="mini-bar" style="height:{h * 48}px; opacity:{0.35 + h * 0.65}; animation-delay:{i * 60}ms"></div>
            {/each}
          </div>

          {#if profile.teams?.length}
            <div class="stat-footer">
              <span class="stat-footer-label">{$t('profile_team_membership')}</span>
              <span class="stat-footer-val font-mono">{profile.teams.length}</span>
            </div>
          {/if}
        </section>

        <!-- Recent Sessions -->
        <section class="panel">
          <div class="panel-header">
            <span class="panel-eyebrow">{$t('profile_recent_label')}</span>
            <h2 class="panel-title">{$t('profile_recent_title')}</h2>
          </div>

          {#if profile.recentSessions?.length}
            <div class="session-list">
              {#each profile.recentSessions as s, i}
                <div class="session-row" in:fly={{ x: -12, duration: 200, delay: i * 40 }}>
                  <div class="session-icon">
                    {#if s.mode === 'focus'}🎯{:else if s.mode === 'short-break'}☕{:else}🌙{/if}
                  </div>
                  <div class="session-info">
                    <span class="session-name">{formatMode(s.mode)}</span>
                    <span class="session-date">{fmtDate(s.completed_at)}</span>
                  </div>
                  <span class="session-dur font-mono">{Math.round(s.duration / 60)}m</span>
                </div>
              {/each}
            </div>
          {:else}
            <div class="empty-state-inner">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <p>{$t('profile_no_sessions')}</p>
            </div>
          {/if}
        </section>
      </div>

      <!-- ── Discord Activity ───────────────────────── -->
      {#if profile.user.discord_id}
        <section class="panel panel-discord">
          <div class="panel-header discord-header">
            <div>
              <span class="panel-eyebrow" style="color:#7289da">{$t('profile_discord_label')}</span>
              <h2 class="panel-title">{$t('profile_discord_activity')}</h2>
            </div>
            {#if discordActivity}
              <span class="status-badge" style="--status-color:{statusColor(discordStatus)}">
                <span class="status-dot"></span>
                {discordStatus}
              </span>
            {/if}
          </div>

          {#if discordLoading}
            <p class="muted-text">{$t('profile_discord_loading')}</p>
          {:else if discordActivity}
            <div class="activity-list">
              {#if spotify}
                <div class="activity-card spotify-card">
                  <img src={spotify.album_art_url} alt={spotify.album} class="activity-art" />
                  <div class="activity-body">
                    <span class="activity-label">{$t('profile_listening')}</span>
                    <span class="activity-title">{spotify.song}</span>
                    <span class="activity-sub">by {spotify.artist} · {spotify.album}</span>
                  </div>
                  <div class="spotify-bars" aria-hidden="true">
                    <span></span><span></span><span></span>
                  </div>
                </div>
              {/if}
              {#each activities as act}
                <div class="activity-card">
                  {#if act.assets?.large_image}
                    <img
                      src={act.assets.large_image.startsWith('mp:external')
                        ? `https://media.discordapp.net/external/${act.assets.large_image.split('mp:external/')[1]}`
                        : `https://cdn.discordapp.com/app-assets/${act.application_id}/${act.assets.large_image}.png`}
                      alt={act.name}
                      class="activity-art"
                    />
                  {:else}
                    <div class="activity-art activity-art-fallback">💻</div>
                  {/if}
                  <div class="activity-body">
                    <span class="activity-label">{$t('profile_playing')}</span>
                    <span class="activity-title">{act.name}</span>
                    {#if act.details}<span class="activity-sub">{act.details}</span>{/if}
                    {#if act.state}<span class="activity-sub">{act.state}</span>{/if}
                  </div>
                </div>
              {/each}
              {#if !spotify && activities.length === 0}
                <p class="muted-text">{$t('profile_discord_no_activity')}</p>
              {/if}
            </div>
          {:else}
            <p class="muted-text">{$t('profile_discord_unavailable')}</p>
          {/if}
        </section>
      {/if}

    </div>
  {/if}
</div>

<style>
  .page {
    max-width: 1060px;
    margin: 0 auto;
    padding: 2.5rem 1.5rem 5rem;
  }

  .profile-shell { display: flex; flex-direction: column; gap: 1.25rem; }

  /* Hero */
  .hero-card {
    position: relative;
    overflow: hidden;
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: 28px;
    padding: 2rem;
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 2rem;
    align-items: center;
    box-shadow: 0 4px 40px rgba(0,0,0,0.25);
  }

  .hero-glow {
    position: absolute; inset: 0;
    background:
      radial-gradient(ellipse 60% 60% at 0% 0%, color-mix(in srgb, var(--accent) 18%, transparent), transparent),
      radial-gradient(ellipse 40% 50% at 100% 100%, color-mix(in srgb, var(--accent) 8%, transparent), transparent);
    pointer-events: none;
  }

  .hero-left {
    position: relative; z-index: 1;
    display: flex; flex-direction: column; align-items: center; gap: 0.6rem;
  }

  .avatar-wrap {
    width: 120px; height: 120px; border-radius: 28px;
    border: 2px solid color-mix(in srgb, var(--accent) 40%, transparent);
    background: linear-gradient(145deg, color-mix(in srgb, var(--accent) 20%, transparent), var(--bg-elevated));
    box-shadow: 0 12px 40px rgba(0,0,0,0.35), 0 0 0 1px var(--border-subtle);
    overflow: hidden; display: grid; place-items: center;
  }

  .avatar-img { width: 100%; height: 100%; object-fit: cover; }

  .avatar-initials {
    font-size: 2.8rem; font-weight: 800;
    color: var(--accent); line-height: 1; letter-spacing: -0.02em;
  }

  .badge-discord {
    display: inline-flex; align-items: center; gap: 0.35rem;
    padding: 0.3rem 0.65rem; border-radius: 999px;
    font-size: 0.65rem; font-weight: 700; letter-spacing: 0.08em;
    color: #7289da; border: 1px solid rgba(114,137,218,0.4); background: rgba(114,137,218,0.08);
  }

  .hero-center {
    position: relative; z-index: 1;
    display: flex; flex-direction: column; gap: 0.6rem; min-width: 0;
  }

  .hero-eyebrow {
    font-size: 0.62rem; font-weight: 800; letter-spacing: 0.22em;
    color: var(--accent); text-transform: uppercase; font-family: var(--font-mono);
  }

  .hero-username {
    font-size: clamp(1.8rem, 4vw, 3rem); font-weight: 800;
    letter-spacing: -0.04em; color: var(--text-primary);
    line-height: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }

  .hero-bio { font-size: 0.88rem; color: var(--text-secondary); line-height: 1.65; max-width: 48ch; }
  .hero-bio.muted { color: var(--text-tertiary); font-style: italic; }

  .hero-pills { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.25rem; }

  .pill {
    display: inline-flex; align-items: center; gap: 0.35rem;
    padding: 0.35rem 0.75rem; border-radius: 999px;
    background: color-mix(in srgb, var(--accent) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent) 20%, transparent);
    font-size: 0.7rem; font-weight: 700; letter-spacing: 0.05em;
    color: var(--text-secondary); text-transform: uppercase;
  }

  /* Grid */
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; }

  /* Panel */
  .panel {
    background: var(--bg-surface); border: 1px solid var(--border-subtle);
    border-radius: 22px; padding: 1.5rem; box-shadow: 0 2px 20px rgba(0,0,0,0.15);
  }

  .panel-header { margin-bottom: 1.25rem; }

  .panel-eyebrow {
    display: block; font-size: 0.6rem; font-weight: 800;
    letter-spacing: 0.2em; color: var(--accent); text-transform: uppercase;
    font-family: var(--font-mono); margin-bottom: 0.2rem;
  }

  .panel-title { font-size: 1.05rem; font-weight: 700; color: var(--text-primary); letter-spacing: -0.02em; }

  /* Stats */
  .stat-trio { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; margin-bottom: 1rem; }

  .stat-block {
    border-radius: 16px; background: var(--bg-elevated);
    border: 1px solid var(--border-subtle); padding: 1rem 0.85rem;
    display: flex; flex-direction: column; gap: 0.3rem;
  }
  .stat-accent {
    background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 12%, transparent), var(--bg-elevated));
    border-color: color-mix(in srgb, var(--accent) 30%, transparent);
  }

  .stat-num { font-size: 1.65rem; font-weight: 700; color: var(--text-primary); line-height: 1; }
  .stat-desc { font-size: 0.65rem; font-weight: 600; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.08em; }

  .mini-bars { display: flex; align-items: flex-end; gap: 4px; height: 48px; margin: 0.5rem 0 1rem; }
  .mini-bar { flex: 1; background: var(--accent); border-radius: 4px 4px 0 0; animation: grow-bar 0.5s ease-out both; }
  @keyframes grow-bar { from { transform: scaleY(0); transform-origin: bottom; } to { transform: scaleY(1); transform-origin: bottom; } }

  .stat-footer { display: flex; align-items: center; justify-content: space-between; padding-top: 0.85rem; border-top: 1px solid var(--border-subtle); }
  .stat-footer-label { font-size: 0.82rem; color: var(--text-secondary); }
  .stat-footer-val { color: var(--accent); font-size: 0.9rem; }

  /* Sessions */
  .session-list { display: flex; flex-direction: column; gap: 0.6rem; }

  .session-row {
    display: flex; align-items: center; gap: 0.85rem;
    padding: 0.75rem 0.9rem; border-radius: 14px;
    background: var(--bg-elevated); border: 1px solid var(--border-subtle); transition: border-color 0.15s;
  }
  .session-row:hover { border-color: var(--border-base); }

  .session-icon { font-size: 1.15rem; width: 36px; height: 36px; border-radius: 10px; background: var(--bg-overlay); display: grid; place-items: center; flex-shrink: 0; }
  .session-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.15rem; }
  .session-name { font-size: 0.88rem; font-weight: 700; color: var(--text-primary); }
  .session-date { font-size: 0.72rem; color: var(--text-tertiary); }
  .session-dur { font-size: 0.8rem; color: var(--accent); font-weight: 700; flex-shrink: 0; }

  .empty-state-inner { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; padding: 2rem 0; color: var(--text-tertiary); font-size: 0.85rem; }

  /* Discord */
  .panel-discord { border-color: rgba(88,101,242,0.2); }
  .discord-header { display: flex; align-items: flex-start; justify-content: space-between; }

  .status-badge {
    display: inline-flex; align-items: center; gap: 0.4rem;
    padding: 0.35rem 0.75rem; border-radius: 999px;
    font-size: 0.7rem; font-weight: 700; text-transform: capitalize;
    background: color-mix(in srgb, var(--status-color, #747f8d) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--status-color, #747f8d) 30%, transparent);
    color: var(--status-color, #747f8d);
  }
  .status-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--status-color, #747f8d); }

  .muted-text { color: var(--text-tertiary); font-size: 0.85rem; line-height: 1.6; }
  .activity-list { display: flex; flex-direction: column; gap: 0.75rem; }

  .activity-card { display: flex; align-items: center; gap: 1rem; padding: 1rem; border-radius: 16px; background: var(--bg-elevated); border: 1px solid var(--border-subtle); }
  .spotify-card { border-color: rgba(30,215,96,0.2); background: linear-gradient(135deg, rgba(30,215,96,0.06), var(--bg-elevated)); }

  .activity-art { width: 60px; height: 60px; border-radius: 12px; object-fit: cover; flex-shrink: 0; }
  .activity-art-fallback { display: grid; place-items: center; font-size: 1.4rem; background: var(--bg-overlay); border: 1px solid var(--border-subtle); }

  .activity-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.2rem; }
  .activity-label { font-size: 0.6rem; font-weight: 800; letter-spacing: 0.15em; color: var(--accent); font-family: var(--font-mono); }
  .activity-title { font-size: 0.95rem; font-weight: 700; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .activity-sub { font-size: 0.78rem; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .spotify-bars { display: flex; align-items: flex-end; gap: 3px; height: 20px; flex-shrink: 0; }
  .spotify-bars span { display: block; width: 3px; background: #1ed760; border-radius: 2px; animation: bar-bounce 1s ease-in-out infinite; }
  .spotify-bars span:nth-child(1) { animation-delay: 0s; }
  .spotify-bars span:nth-child(2) { animation-delay: 0.2s; }
  .spotify-bars span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes bar-bounce { 0%, 100% { height: 5px; } 50% { height: 18px; } }

  /* Loading */
  .loading-state { display: flex; flex-direction: column; gap: 1.25rem; }
  .skeleton-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; }
  .skeleton {
    border-radius: 22px;
    background: linear-gradient(90deg, var(--bg-surface) 25%, var(--bg-elevated) 50%, var(--bg-surface) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }
  .skeleton-hero { height: 220px; }
  .skeleton-panel { height: 240px; }
  @keyframes shimmer { to { background-position: -200% 0; } }

  /* Error */
  .error-state { display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 5rem 0; color: var(--text-secondary); }
  .error-icon { font-size: 3rem; }
  .btn-ghost {
    border: 1px solid var(--border-subtle); border-radius: 14px;
    padding: 0.75rem 1.25rem; font-family: var(--font-mono);
    font-size: 0.72rem; font-weight: 700; letter-spacing: 0.08em;
    text-transform: uppercase; cursor: pointer;
    color: var(--text-primary); background: rgba(255,255,255,0.02); text-decoration: none;
  }

  /* Responsive */
  @media (max-width: 860px) {
    .hero-card { grid-template-columns: 1fr; gap: 1.25rem; }
    .hero-left { align-items: center; }
    .grid-2 { grid-template-columns: 1fr; }
  }

  @media (max-width: 540px) {
    .page { padding: 1.5rem 1rem 4rem; }
    .hero-username { font-size: 1.8rem; }
    .avatar-wrap { width: 100px; height: 100px; }
    .stat-trio { grid-template-columns: 1fr 1fr; }
    .stat-trio .stat-block:last-child { grid-column: 1 / -1; }
  }
</style>
