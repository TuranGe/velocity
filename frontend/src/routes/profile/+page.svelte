<script>
  import { onMount } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  import Modal from '$lib/components/Modal.svelte';
  import ShareCard from '$lib/components/ShareCard.svelte';
  import { auth, fetchMySessions, fetchTeams, API_URL } from '$lib/stores/api';
  import { timer } from '$lib/stores/timer';
  import { tasks } from '$lib/stores/tasks';
  import { toast } from '$lib/stores/toast';
  import { t } from '$lib/stores/i18n';
  import { weeklyGoal } from '$lib/stores/weeklyGoal';

  let user = $auth.user;
  let editing = false;
  let saving = false;
  let showAvatarModal = false;
  let showShareCard = false;
  let bio = user?.bio || '';
  let profileImageUrl = user?.profile_image || '';
  let usernameEdit = user?.username || '';
  let remoteStats = null;
  let recentSessions = [];
  let dailyData = [];
  let teamCount = 0;
  let currentStreak = 0;
  let fileInput;
  let discordActivity = null;
  let discordLoading = false;
  let linkingDiscord = false;

  const DISCORD_CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID || '';
  const DISCORD_REDIRECT = import.meta.env.VITE_DISCORD_REDIRECT || (typeof window !== 'undefined' ? window.location.origin + '/auth/discord' : '');

  $: user = $auth.user;
  $: if (user && !editing && !saving) {
    bio = user.bio || '';
    profileImageUrl = user.profile_image || '';
    usernameEdit = user.username || '';
  }

  onMount(async () => {
    if (!user) { window.location.href = '/'; return; }
    try {
      const [sessionsRes, teamsRes] = await Promise.all([fetchMySessions(), fetchTeams()]);
      remoteStats = sessionsRes.stats;
      recentSessions = (sessionsRes.sessions || []).slice(0, 5);
      dailyData = sessionsRes.daily || [];
      currentStreak = sessionsRes.currentStreak || 0;
      teamCount = (teamsRes.teams || []).filter((team) => team.members?.some((member) => member.id === user.id)).length;
      if (user.discord_id) loadDiscordActivity(user.discord_id);
    } catch {
      remoteStats = null;
      recentSessions = [];
      dailyData = [];
      teamCount = 0;
    }
  });

  async function loadDiscordActivity(discordId) {
    discordLoading = true;
    try {
      let found = false;
      try {
        const res = await fetch(`${API_URL}/api/discord/presence/${discordId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.presence) { discordActivity = data.presence; found = true; }
        }
      } catch {}
      if (!found) {
        const res = await fetch(`https://api.lanyard.rest/v1/users/${discordId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success) discordActivity = data.data;
        }
      }
    } catch { discordActivity = null; }
    finally { discordLoading = false; }
  }

  function linkDiscord() {
    if (!DISCORD_CLIENT_ID) { toast.error($t('profile_discord_not_configured')); return; }
    linkingDiscord = true;
    const redirectUri = encodeURIComponent(DISCORD_REDIRECT);
    const clientId = encodeURIComponent(DISCORD_CLIENT_ID);
    const scope = encodeURIComponent('identify email');
    window.location.href = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=link`;
  }

  function openAvatarModal() { editing = true; showAvatarModal = true; }
  function clearPhoto() { profileImageUrl = ''; }
  function triggerFilePicker() { fileInput?.click(); }

  async function handlePhotoUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error($t('profile_photo_too_large')); return; }
    if (!file.type.startsWith('image/')) { toast.error($t('profile_invalid_image')); return; }
    const reader = new FileReader();
    reader.onload = () => { profileImageUrl = typeof reader.result === 'string' ? reader.result : ''; showAvatarModal = false; };
    reader.readAsDataURL(file);
  }

  async function saveProfile() {
    if (!user) return;
    saving = true;
    try {
      await auth.updateProfile({
        username: usernameEdit.trim() !== user.username ? usernameEdit.trim() : undefined,
        bio: bio.trim(),
        profile_image: profileImageUrl || null,
      });
      toast.success($t('profile_saved'));
      editing = false;
      showAvatarModal = false;
    } catch (error) {
      toast.error(error.message, undefined, error.code);
    } finally { saving = false; }
  }

  function cancelEdit() {
    editing = false;
    showAvatarModal = false;
    bio = user?.bio || '';
    usernameEdit = user?.username || '';
    profileImageUrl = user?.profile_image || '';
  }

  $: totalMinutes = remoteStats
    ? Math.max(Math.floor(remoteStats.total_seconds / 60), Math.floor($timer.totalFocusTime / 60))
    : Math.floor($timer.totalFocusTime / 60);
  $: totalHours = (totalMinutes / 60).toFixed(1);
  $: totalSessions = remoteStats
    ? Math.max(remoteStats.total_sessions, $timer.completedSessions)
    : $timer.completedSessions;

  $: initials = user?.username?.slice(0, 1).toUpperCase() ?? '?';

  // Daily chart — last 7 days
  const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  $: chartDays = (() => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - i));
      const remote = dailyData[i] || { sessions: 0, total_seconds: 0 };
      return {
        label: DAY_LABELS[d.getDay()],
        isToday: i === 6,
        sessions: remote.sessions,
        minutes: Math.round(remote.total_seconds / 60),
      };
    });
  })();
  $: chartMax = Math.max(...(chartDays.map(d => d.minutes)), 1);

  // Weekly goal tracking
  $: weeklyMinutes = chartDays.reduce((sum, d) => sum + (d.minutes || 0), 0);
  $: weeklyGoalPct = Math.min(100, Math.round((weeklyMinutes / $weeklyGoal) * 100));
  $: weeklyGoalHours = ($weeklyGoal / 60);

  let editingGoal = false;
  let goalInputHours = ($weeklyGoal / 60);

  function startEditGoal() {
    goalInputHours = $weeklyGoal / 60;
    editingGoal = true;
  }
  function saveGoal() {
    const mins = Math.max(15, Math.round(parseFloat(goalInputHours) * 60) || 60);
    weeklyGoal.setGoal(mins);
    editingGoal = false;
  }
  function cancelEditGoal() {
    editingGoal = false;
  }

  $: doneTasks  = $tasks.filter(t => t.done).length;
  $: totalTasks = $tasks.length;
  $: taskPct    = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  function statusColor(status) {
    return { online: '#3ba55d', idle: '#faa81a', dnd: '#ed4245' }[status] || '#747f8d';
  }

  function formatDate(ts) {
    return new Date(ts * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatMode(mode) {
    return mode.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
</script>

<svelte:head><title>{user?.username ?? 'Profile'} — Velocity</title></svelte:head>

{#if !user}
  <div class="page">
    <div class="empty-state">{$t('profile_login_required')}</div>
  </div>
{:else}
  <div class="page" transition:fly={{ y: 20, duration: 300 }}>

    <!-- ── Hero Card ───────────────────────────────────── -->
    <div class="hero-card">
      <div class="hero-glow" aria-hidden="true"></div>

      <!-- Left: avatar -->
      <div class="hero-left">
        <button class="avatar-wrap" on:click={openAvatarModal} title={$t('profile_change_photo')}>
          {#if profileImageUrl}
            <img src={profileImageUrl} alt="avatar" class="avatar-img" />
          {:else}
            <span class="avatar-initials">{initials}</span>
          {/if}
          <span class="avatar-overlay">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </span>
        </button>

        {#if profileImageUrl && editing}
          <button class="link-btn" on:click={clearPhoto}>{$t('profile_remove_photo')}</button>
        {/if}
      </div>

      <!-- Center: identity -->
      <div class="hero-center">
        <span class="hero-eyebrow">{$t('profile_label')}</span>
        {#if editing}
          <input
            class="username-input"
            bind:value={usernameEdit}
            maxlength="20"
            placeholder="Kullanıcı adı"
            spellcheck="false"
          />
        {:else}
          <h1 class="hero-username">{user.username}</h1>
        {/if}

        {#if editing}
          <textarea
            class="bio-textarea"
            bind:value={bio}
            maxlength="500"
            placeholder={$t('profile_bio_placeholder')}
          ></textarea>
        {:else if bio}
          <p class="hero-bio">{bio}</p>
        {:else}
          <p class="hero-bio muted">{$t('profile_no_bio')}</p>
        {/if}

        <div class="hero-pills">
          {#if currentStreak > 0}
            <span class="pill pill-streak" class:streak-hot={currentStreak >= 7}>
              <span class="streak-flame">🔥</span>
              {currentStreak} {currentStreak === 1 ? 'gün' : 'gün'} üst üste
            </span>
          {/if}
          <span class="pill">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            {totalSessions} {$t('profile_sessions')}
          </span>
          <span class="pill">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            {totalMinutes} {$t('profile_min_focus')}
          </span>
          <span class="pill">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            {teamCount} {$t('profile_teams')}
          </span>
        </div>
      </div>

      <!-- Right: actions -->
      <div class="hero-right">
        {#if !user.discord_id}
          <button class="btn-discord" on:click={linkDiscord} disabled={linkingDiscord}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
            {linkingDiscord ? $t('profile_discord_linking') : $t('profile_discord_connect')}
          </button>
        {:else}
          <span class="badge-discord">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
            {$t('profile_discord_connected')}
          </span>
        {/if}

        <div class="edit-row">
          {#if editing}
            <button class="btn-cancel" on:click={cancelEdit}>{$t('profile_cancel')}</button>
            <button class="btn-save" on:click={saveProfile} disabled={saving}>
              {saving ? $t('profile_saving') : $t('profile_save')}
            </button>
          {:else}
            <button class="btn-edit" on:click={() => editing = true}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              {$t('profile_edit')}
            </button>
            <button class="btn-share" on:click={() => showShareCard = true}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
              Paylaş
            </button>
          {/if}
        </div>
      </div>
    </div>

    <!-- ── Grid: Stats + Recent ─────────────────────── -->
    <div class="grid-2">

      <!-- Stats panel -->
      <section class="panel">
        <div class="panel-header">
          <span class="panel-eyebrow">{$t('profile_stats_label')}</span>
          <h2 class="panel-title">{$t('profile_focus_summary')}</h2>
        </div>

        <div class="stat-trio">
          <div class="stat-block">
            <span class="stat-num font-mono">{totalSessions}</span>
            <span class="stat-desc">{$t('profile_total_sessions')}</span>
          </div>
          <div class="stat-block stat-accent">
            <span class="stat-num font-mono">{totalMinutes}</span>
            <span class="stat-desc">{$t('profile_dakika_focus')}</span>
          </div>
          <div class="stat-block">
            <span class="stat-num font-mono">{totalHours}</span>
            <span class="stat-desc">{$t('profile_hours')}</span>
          </div>
        </div>

        <!-- Weekly Goal -->
        <div class="weekly-goal">
          <div class="wg-header">
            <span class="wg-label">🎯 Haftalık Hedef</span>
            {#if editingGoal}
              <div class="wg-edit">
                <input
                  type="number"
                  class="wg-input font-mono"
                  bind:value={goalInputHours}
                  min="0.25"
                  max="168"
                  step="0.5"
                  on:keydown={(e) => e.key === 'Enter' && saveGoal()}
                />
                <span class="wg-unit">sa/hafta</span>
                <button class="wg-btn wg-btn-save" on:click={saveGoal}>✓</button>
                <button class="wg-btn wg-btn-cancel" on:click={cancelEditGoal}>✕</button>
              </div>
            {:else}
              <button class="wg-edit-btn" on:click={startEditGoal}>
                {weeklyGoalHours} sa/hafta
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
            {/if}
          </div>
          <div class="wg-bar-track">
            <div class="wg-bar-fill" class:wg-complete={weeklyGoalPct >= 100} style="width: {weeklyGoalPct}%"></div>
          </div>
          <div class="wg-footer">
            <span class="wg-progress font-mono">{Math.floor(weeklyMinutes/60)}sa {weeklyMinutes%60}dk / {weeklyGoalHours}sa</span>
            <span class="wg-pct font-mono" class:wg-complete-text={weeklyGoalPct >= 100}>
              {weeklyGoalPct >= 100 ? '🎉 Tamamlandı!' : `${weeklyGoalPct}%`}
            </span>
          </div>
        </div>

        <div class="daily-chart">
          {#each chartDays as day}
            <div class="chart-col">
              <div class="chart-bar-wrap" title="{day.label}: {day.sessions} seans, {day.minutes}dk">
                <div
                  class="chart-bar"
                  class:chart-bar-today={day.isToday}
                  class:chart-bar-empty={day.minutes === 0}
                  style="height:{Math.max(day.minutes / chartMax * 56, day.minutes > 0 ? 4 : 2)}px"
                ></div>
              </div>
              <span class="chart-label" class:chart-label-today={day.isToday}>{day.label}</span>
            </div>
          {/each}
        </div>

        <div class="stat-footer">
          <span class="stat-footer-label">{$t('profile_team_membership')}</span>
          <span class="stat-footer-val font-mono">{teamCount}</span>
        </div>

        <!-- Tasks completed -->
        {#if totalTasks > 0}
          <div class="task-progress-block">
            <div class="task-progress-header">
              <span class="task-progress-label">Tasks Completed</span>
              <span class="task-progress-count font-mono">{doneTasks}/{totalTasks}</span>
            </div>
            <div class="task-progress-track">
              <div class="task-progress-fill" style="width:{taskPct}%"></div>
            </div>
          </div>
        {/if}
      </section>

      <!-- Recent sessions panel -->
      <section class="panel">
        <div class="panel-header">
          <span class="panel-eyebrow">{$t('profile_recent_label')}</span>
          <h2 class="panel-title">{$t('profile_recent_title')}</h2>
        </div>

        {#if recentSessions.length}
          <div class="session-list">
            {#each recentSessions as session, i}
              <div class="session-row" in:fly={{ x: -12, duration: 200, delay: i * 40 }}>
                <div class="session-icon">
                  {#if session.mode === 'focus'}🎯{:else if session.mode === 'short-break'}☕{:else}🌙{/if}
                </div>
                <div class="session-info">
                  <span class="session-name">{formatMode(session.mode)}</span>
                  <span class="session-date">{formatDate(session.completed_at)}</span>
                </div>
                <span class="session-dur font-mono">{Math.round(session.duration / 60)}m</span>
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

    <!-- ── Discord Activity ─────────────────────────── -->
    {#if user.discord_id}
      <section class="panel panel-discord">
        <div class="panel-header discord-header">
          <div>
            <span class="panel-eyebrow" style="color:#7289da">{$t('profile_discord_label')}</span>
            <h2 class="panel-title">{$t('profile_discord_activity')}</h2>
          </div>
          {#if discordActivity}
            <span class="status-badge" style="--status-color:{statusColor(discordActivity.discord_status)}">
              <span class="status-dot"></span>
              {discordActivity.discord_status ?? 'offline'}
            </span>
          {/if}
        </div>

        {#if discordLoading}
          <p class="muted-text">{$t('profile_discord_loading')}</p>
        {:else if discordActivity}
          {@const spotify = discordActivity.listening_to_spotify ? discordActivity.spotify : null}
          {@const activities = (discordActivity.activities || []).filter(a => a.type !== 2 && a.type !== 4)}
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

  <!-- ── Avatar Modal ─────────────────────────────── -->
  <Modal bind:show={showAvatarModal} on:close={() => (showAvatarModal = false)}>
    <div class="modal-head">
      <div>
        <span class="panel-eyebrow">{$t('profile_avatar_modal_label')}</span>
        <h3 class="modal-title">{$t('profile_avatar_modal_title')}</h3>
      </div>
      <button class="modal-close" on:click={() => (showAvatarModal = false)}>✕</button>
    </div>

    <div class="modal-preview">
      {#if profileImageUrl}
        <img src={profileImageUrl} alt="preview" class="preview-img" />
      {:else}
        <span class="preview-initials">{initials}</span>
      {/if}
    </div>

    <input bind:this={fileInput} type="file" accept="image/*" hidden on:change={handlePhotoUpload} />

    <div class="modal-footer">
      <button class="btn-soft" on:click={triggerFilePicker}>{$t('profile_pick_photo')}</button>
      <button class="btn-ghost" on:click={() => (showAvatarModal = false)}>{$t('profile_close')}</button>
    </div>
  </Modal>

  <!-- ── Share Card Modal ─────────────────────────── -->
  <ShareCard
    bind:show={showShareCard}
    username={user.username}
    initials={initials}
    totalHours={totalHours}
    totalSessions={totalSessions}
    totalTasks={totalTasks}
    doneTasks={doneTasks}
    chartDays={chartDays}
    currentStreak={currentStreak}
  />
{/if}

<style>
  .page {
    max-width: 1060px;
    margin: 0 auto;
    padding: 2.5rem 1.5rem 5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .empty-state {
    text-align: center;
    padding: 6rem 0;
    color: var(--text-secondary);
  }

  /* ── Hero Card ───────────────────────────────────── */
  .hero-card {
    position: relative;
    overflow: hidden;
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: 28px;
    padding: 2rem;
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 2rem;
    align-items: center;
    box-shadow: 0 4px 40px rgba(0,0,0,0.25);
  }

  .hero-glow {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 60% 60% at 0% 0%, color-mix(in srgb, var(--accent) 18%, transparent), transparent),
      radial-gradient(ellipse 40% 50% at 100% 100%, color-mix(in srgb, var(--accent) 8%, transparent), transparent);
    pointer-events: none;
  }

  /* Avatar */
  .hero-left {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.6rem;
  }

  .avatar-wrap {
    position: relative;
    width: 120px;
    height: 120px;
    border-radius: 28px;
    border: 2px solid color-mix(in srgb, var(--accent) 40%, transparent);
    background: linear-gradient(145deg, color-mix(in srgb, var(--accent) 20%, transparent), var(--bg-elevated));
    box-shadow: 0 12px 40px rgba(0,0,0,0.35), 0 0 0 1px var(--border-subtle);
    cursor: pointer;
    overflow: hidden;
    transition: transform 0.2s, box-shadow 0.2s;
    display: grid;
    place-items: center;
  }
  .avatar-wrap:hover { transform: translateY(-2px) scale(1.02); box-shadow: 0 18px 50px rgba(0,0,0,0.4); }

  .avatar-img { width: 100%; height: 100%; object-fit: cover; }

  .avatar-initials {
    font-size: 2.8rem;
    font-weight: 800;
    color: var(--accent);
    line-height: 1;
    letter-spacing: -0.02em;
  }

  .avatar-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,0.55);
    display: grid;
    place-items: center;
    color: white;
    opacity: 0;
    transition: opacity 0.18s;
    border-radius: inherit;
  }
  .avatar-wrap:hover .avatar-overlay { opacity: 1; }

  .link-btn {
    background: transparent;
    border: none;
    color: var(--text-tertiary);
    font-size: 0.72rem;
    cursor: pointer;
    padding: 0;
    text-decoration: underline;
  }
  .link-btn:hover { color: var(--text-secondary); }

  /* Identity */
  .hero-center {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    min-width: 0;
  }

  .hero-eyebrow {
    font-size: 0.62rem;
    font-weight: 800;
    letter-spacing: 0.22em;
    color: var(--accent);
    text-transform: uppercase;
    font-family: var(--font-mono);
  }

  .hero-username {
    font-size: clamp(1.8rem, 4vw, 3rem);
    font-weight: 800;
    letter-spacing: -0.04em;
    color: var(--text-primary);
    line-height: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .hero-bio {
    font-size: 0.88rem;
    color: var(--text-secondary);
    line-height: 1.65;
    max-width: 48ch;
  }
  .hero-bio.muted { color: var(--text-tertiary); font-style: italic; }

  .bio-textarea {
    width: 100%;
    min-height: 72px;
    max-width: 44ch;
    border-radius: 12px;
    border: 1px solid var(--border-base);
    padding: 0.65rem 0.9rem;
    background: var(--bg-elevated);
    color: var(--text-primary);
    font: inherit;
    font-size: 0.88rem;
    resize: vertical;
    outline: none;
    transition: border-color 0.15s;
  }
  .bio-textarea:focus { border-color: var(--accent); }

  .hero-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.25rem;
  }

  .pill {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.35rem 0.75rem;
    border-radius: 999px;
    background: color-mix(in srgb, var(--accent) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent) 20%, transparent);
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: var(--text-secondary);
    text-transform: uppercase;
  }

  .pill-streak {
    background: linear-gradient(135deg, rgba(251,146,60,0.12), rgba(249,115,22,0.06));
    border-color: rgba(249,115,22,0.35);
    color: #fb923c;
  }
  .pill-streak.streak-hot {
    background: linear-gradient(135deg, rgba(251,146,60,0.2), rgba(239,68,68,0.08));
    border-color: rgba(251,146,60,0.5);
    animation: streak-glow 2s ease-in-out infinite;
  }
  .streak-flame {
    display: inline-block;
    animation: streak-flicker 1.6s ease-in-out infinite;
    font-size: 0.85rem;
  }
  @keyframes streak-flicker {
    0%, 100% { transform: scale(1) rotate(0deg); }
    25%      { transform: scale(1.12) rotate(-4deg); }
    50%      { transform: scale(0.95) rotate(3deg); }
    75%      { transform: scale(1.08) rotate(-2deg); }
  }
  @keyframes streak-glow {
    0%, 100% { box-shadow: 0 0 0px rgba(251,146,60,0); }
    50%      { box-shadow: 0 0 14px rgba(251,146,60,0.35); }
  }

  /* Actions */
  .hero-right {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    align-items: flex-end;
    align-self: stretch;
    justify-content: flex-end;
  }

  .btn-discord {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    cursor: pointer;
    transition: all 0.18s;
    background: rgba(88,101,242,0.12);
    border: 1px solid rgba(88,101,242,0.35);
    color: #7289da;
    white-space: nowrap;
  }
  .btn-discord:hover:not(:disabled) { background: rgba(88,101,242,0.22); border-color: #7289da; transform: translateY(-1px); }
  .btn-discord:disabled { opacity: 0.6; cursor: not-allowed; }

  .badge-discord {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.45rem 0.85rem;
    border-radius: 12px;
    font-size: 0.7rem;
    font-weight: 700;
    color: #7289da;
    background: rgba(88,101,242,0.08);
    border: 1px solid rgba(88,101,242,0.22);
  }

  .edit-row { display: flex; gap: 0.5rem; }

  .btn-edit, .btn-cancel, .btn-save {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.55rem 1.1rem;
    border-radius: 12px;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    cursor: pointer;
    transition: all 0.18s;
    white-space: nowrap;
  }
  .btn-edit { background: rgba(255,255,255,0.04); border: 1px solid var(--border-subtle); color: var(--text-primary); }
  .btn-edit:hover { background: rgba(255,255,255,0.08); transform: translateY(-1px); }
  .btn-share {
    background: rgba(255,255,255,0.04); border: 1px solid var(--border-subtle); color: var(--text-primary);
    display: inline-flex; align-items: center; gap: 0.4rem;
  }
  .btn-share:hover { background: var(--accent-subtle); border-color: var(--accent); color: var(--accent); transform: translateY(-1px); }
  .btn-cancel { background: transparent; border: 1px solid var(--border-subtle); color: var(--text-secondary); }
  .btn-cancel:hover { border-color: var(--text-secondary); }
  .btn-save { background: linear-gradient(135deg, var(--accent), var(--accent-hover)); border: 1px solid transparent; color: white; box-shadow: 0 4px 20px color-mix(in srgb, var(--accent) 35%, transparent); }
  .btn-save:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 25px color-mix(in srgb, var(--accent) 45%, transparent); }
  .btn-save:disabled { opacity: 0.6; cursor: not-allowed; }

  /* ── Grid ─────────────────────────────────────────── */
  .grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.25rem;
  }

  /* ── Panel ────────────────────────────────────────── */
  .panel {
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: 22px;
    padding: 1.5rem;
    box-shadow: 0 2px 20px rgba(0,0,0,0.15);
  }

  .panel-header { margin-bottom: 1.25rem; }

  .panel-eyebrow {
    display: block;
    font-size: 0.6rem;
    font-weight: 800;
    letter-spacing: 0.2em;
    color: var(--accent);
    text-transform: uppercase;
    font-family: var(--font-mono);
    margin-bottom: 0.2rem;
  }

  .panel-title {
    font-size: 1.05rem;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.02em;
  }

  /* Stats */
  .stat-trio {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .stat-block {
    border-radius: 16px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    padding: 1rem 0.85rem;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .stat-accent {
    background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 12%, transparent), var(--bg-elevated));
    border-color: color-mix(in srgb, var(--accent) 30%, transparent);
  }

  .stat-num { font-size: 1.65rem; font-weight: 700; color: var(--text-primary); line-height: 1; }
  .stat-desc { font-size: 0.65rem; font-weight: 600; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.08em; }

  .username-input {
    font-size: clamp(1.4rem, 3vw, 2rem);
    font-weight: 800;
    letter-spacing: -0.04em;
    color: var(--text-primary);
    background: var(--bg-elevated);
    border: 1.5px solid var(--accent);
    border-radius: 10px;
    padding: 0.3rem 0.7rem;
    outline: none;
    font-family: inherit;
    width: 100%;
    max-width: 22ch;
  }

  /* ── Weekly Goal ──────────────────────────────────── */
  .weekly-goal {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin: 1.25rem 0;
    padding: 1rem;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
  }
  .wg-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .wg-label {
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--text-primary);
  }
  .wg-edit-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 700;
    color: var(--text-tertiary);
    background: transparent;
    border: 1px solid var(--border-subtle);
    border-radius: 999px;
    padding: 0.2rem 0.6rem;
    cursor: pointer;
    transition: color var(--transition-fast), border-color var(--transition-fast);
  }
  .wg-edit-btn:hover { color: var(--accent); border-color: var(--accent); }
  .wg-edit {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }
  .wg-input {
    width: 56px;
    background: var(--bg-base);
    border: 1px solid var(--border-base);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    font-size: 0.8rem;
    padding: 0.2rem 0.4rem;
    text-align: center;
  }
  .wg-input:focus { outline: none; border-color: var(--accent); }
  .wg-unit { font-size: 0.65rem; color: var(--text-tertiary); }
  .wg-btn {
    width: 22px; height: 22px;
    display: flex; align-items: center; justify-content: center;
    border-radius: 50%;
    border: none;
    cursor: pointer;
    font-size: 0.7rem;
    font-weight: 700;
  }
  .wg-btn-save { background: var(--accent); color: white; }
  .wg-btn-save:hover { background: var(--accent-hover); }
  .wg-btn-cancel { background: var(--bg-base); color: var(--text-tertiary); border: 1px solid var(--border-subtle); }
  .wg-btn-cancel:hover { color: var(--text-primary); }

  .wg-bar-track {
    height: 8px;
    border-radius: 999px;
    background: var(--bg-base);
    overflow: hidden;
    border: 1px solid var(--border-subtle);
  }
  .wg-bar-fill {
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, var(--accent), var(--accent-hover));
    box-shadow: 0 0 8px var(--accent-glow);
    transition: width 0.6s var(--spring);
  }
  .wg-bar-fill.wg-complete {
    background: linear-gradient(90deg, #34d399, #10b981);
    box-shadow: 0 0 12px rgba(52,211,153,0.5);
    animation: wg-pulse 1.6s ease-in-out infinite;
  }
  @keyframes wg-pulse {
    0%, 100% { filter: brightness(1); }
    50%      { filter: brightness(1.25); }
  }

  .wg-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .wg-progress { font-size: 0.68rem; color: var(--text-tertiary); }
  .wg-pct { font-size: 0.7rem; font-weight: 700; color: var(--text-secondary); }
  .wg-pct.wg-complete-text { color: #34d399; }

  /* ── Daily chart ──────────────────────────────────── */
  .daily-chart {
    display: flex;
    align-items: flex-end;
    gap: 6px;
    height: 80px;
    margin: 0.75rem 0 1rem;
    padding-bottom: 20px; /* space for labels */
    position: relative;
  }

  .chart-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100%;
    justify-content: flex-end;
    gap: 4px;
  }

  .chart-bar-wrap {
    flex: 1;
    width: 100%;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }

  .chart-bar {
    width: 100%;
    background: var(--accent);
    border-radius: 4px 4px 0 0;
    opacity: 0.7;
    transition: height 0.4s ease, opacity 0.2s;
    min-height: 2px;
    animation: grow-bar 0.5s ease-out both;
  }
  .chart-bar:hover { opacity: 1; }
  .chart-bar-today { opacity: 1; }
  .chart-bar-empty { background: var(--border-base); opacity: 0.4; }

  .chart-label {
    font-size: 0.6rem;
    font-weight: 700;
    color: var(--text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-family: var(--font-mono);
    white-space: nowrap;
  }
  .chart-label-today { color: var(--accent); }

  @keyframes grow-bar {
    from { transform: scaleY(0); transform-origin: bottom; }
    to   { transform: scaleY(1); transform-origin: bottom; }
  }

  .stat-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 0.85rem;
    border-top: 1px solid var(--border-subtle);
  }
  .stat-footer-label { font-size: 0.82rem; color: var(--text-secondary); }
  .stat-footer-val { color: var(--accent); font-size: 0.9rem; }

  /* Tasks progress */
  .task-progress-block {
    margin-top: 0.85rem;
    padding-top: 0.85rem;
    border-top: 1px solid var(--border-subtle);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .task-progress-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .task-progress-label { font-size: 0.82rem; color: var(--text-secondary); }
  .task-progress-count { font-size: 0.82rem; color: var(--accent); font-weight: 700; }
  .task-progress-track {
    height: 6px;
    background: var(--bg-overlay);
    border-radius: 99px;
    overflow: hidden;
  }
  .task-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--accent), var(--accent-hover));
    border-radius: 99px;
    transition: width 0.6s ease;
    box-shadow: 0 0 8px var(--accent-glow);
  }

  /* Recent sessions */
  .session-list { display: flex; flex-direction: column; gap: 0.6rem; }

  .session-row {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    padding: 0.75rem 0.9rem;
    border-radius: 14px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    transition: border-color 0.15s;
  }
  .session-row:hover { border-color: var(--border-base); }

  .session-icon {
    font-size: 1.15rem;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: var(--bg-overlay);
    display: grid;
    place-items: center;
    flex-shrink: 0;
  }

  .session-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.15rem; }
  .session-name { font-size: 0.88rem; font-weight: 700; color: var(--text-primary); }
  .session-date { font-size: 0.72rem; color: var(--text-tertiary); }
  .session-dur { font-size: 0.8rem; color: var(--accent); font-weight: 700; flex-shrink: 0; }

  .empty-state-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 2rem 0;
    color: var(--text-tertiary);
    font-size: 0.85rem;
  }

  /* Discord */
  .panel-discord { border-color: rgba(88,101,242,0.2); }

  .discord-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.35rem 0.75rem;
    border-radius: 999px;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: capitalize;
    background: color-mix(in srgb, var(--status-color, #747f8d) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--status-color, #747f8d) 30%, transparent);
    color: var(--status-color, #747f8d);
  }
  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--status-color, #747f8d);
  }

  .muted-text { color: var(--text-tertiary); font-size: 0.85rem; line-height: 1.6; }

  .activity-list { display: flex; flex-direction: column; gap: 0.75rem; }

  .activity-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    border-radius: 16px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
  }
  .spotify-card {
    border-color: rgba(30,215,96,0.2);
    background: linear-gradient(135deg, rgba(30,215,96,0.06), var(--bg-elevated));
  }

  .activity-art {
    width: 60px;
    height: 60px;
    border-radius: 12px;
    object-fit: cover;
    flex-shrink: 0;
  }
  .activity-art-fallback {
    display: grid;
    place-items: center;
    font-size: 1.4rem;
    background: var(--bg-overlay);
    border: 1px solid var(--border-subtle);
  }

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

  /* Modal */
  .modal-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
  .modal-title { font-size: 1rem; font-weight: 700; color: var(--text-primary); }
  .modal-close {
    width: 32px; height: 32px; border-radius: 50%;
    background: var(--bg-elevated); border: 1px solid var(--border-subtle);
    color: var(--text-secondary); cursor: pointer; display: grid; place-items: center; font-size: 0.75rem;
  }

  .modal-preview {
    display: grid; place-items: center; padding: 1.5rem;
    border-radius: 20px; background: var(--bg-elevated); border: 1px solid var(--border-subtle);
  }
  .preview-img { width: 100px; height: 100px; border-radius: 22px; object-fit: cover; }
  .preview-initials {
    width: 100px; height: 100px; border-radius: 22px;
    display: grid; place-items: center;
    font-size: 3rem; font-weight: 800; color: var(--accent);
    background: linear-gradient(145deg, color-mix(in srgb, var(--accent) 15%, transparent), var(--bg-overlay));
    border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);
  }

  .modal-footer { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; }

  .btn-soft, .btn-ghost {
    padding: 0.7rem 1rem; border-radius: 12px;
    font-family: var(--font-mono); font-size: 0.72rem; font-weight: 700;
    letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; transition: all 0.15s; text-align: center;
  }
  .btn-soft { background: var(--accent-subtle); border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent); color: var(--accent); }
  .btn-soft:hover { background: color-mix(in srgb, var(--accent) 18%, transparent); }
  .btn-ghost { background: rgba(255,255,255,0.02); border: 1px solid var(--border-subtle); color: var(--text-primary); }
  .btn-ghost:hover { background: rgba(255,255,255,0.06); }

  /* Responsive */
  @media (max-width: 860px) {
    .hero-card { grid-template-columns: auto 1fr; gap: 1.5rem; }
    .hero-right { grid-column: 1 / -1; flex-direction: row; justify-content: flex-start; flex-wrap: wrap; }
    .grid-2 { grid-template-columns: 1fr; }
  }

  @media (max-width: 640px) {
    .page { padding: 1.25rem 1rem 5rem; gap: 1rem; }

    .weekly-goal { padding: 0.75rem; }
    .wg-label { font-size: 0.75rem; }
    .wg-footer { flex-direction: column; align-items: flex-start; gap: 0.2rem; }

    /* Hero card stacks vertically */
    .hero-card { grid-template-columns: 1fr; gap: 1.25rem; text-align: center; padding: 1.5rem 1.25rem; }
    .hero-left { align-items: center; }
    .hero-center { align-items: center; }
    .hero-pills { justify-content: center; }
    .hero-right { justify-content: center; gap: 0.5rem; }
    .hero-username { font-size: 1.8rem; white-space: normal; word-break: break-word; }
    .avatar-wrap { width: 90px; height: 90px; border-radius: 22px; }
    .avatar-initials { font-size: 2.2rem; }
    .hero-bio { font-size: 0.82rem; max-width: 100%; }
    .bio-textarea { max-width: 100%; }

    /* Stats trio */
    .stat-trio { grid-template-columns: 1fr 1fr; }
    .stat-trio .stat-block:last-child { grid-column: 1 / -1; }
    .stat-num { font-size: 1.4rem; }

    /* Buttons */
    .edit-row { flex-wrap: wrap; }
    .btn-edit, .btn-save, .btn-cancel { font-size: 0.68rem; padding: 0.5rem 0.85rem; }
    .btn-discord { font-size: 0.7rem; }

    /* Daily chart */
    .daily-chart { gap: 4px; }
    .chart-label { font-size: 0.52rem; }

    /* Session rows */
    .session-name { font-size: 0.82rem; }
    .session-date { font-size: 0.68rem; }

    /* Discord activity */
    .activity-art { width: 48px; height: 48px; }
    .activity-title { font-size: 0.85rem; }

    /* Panel */
    .panel { padding: 1.25rem 1rem; border-radius: 18px; }
    .panel-title { font-size: 0.95rem; }
  }

  @media (max-width: 400px) {
    .hero-card { padding: 1.25rem 1rem; }
    .stat-trio { grid-template-columns: 1fr; }
    .stat-trio .stat-block:last-child { grid-column: auto; }
    .modal-footer { grid-template-columns: 1fr; }
    .discord-header { flex-direction: column; gap: 0.5rem; }
  }
</style>