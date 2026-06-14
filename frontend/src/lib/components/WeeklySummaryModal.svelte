<script>
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import Modal from './Modal.svelte';
  import RecapCard from './RecapCard.svelte';
  import { auth, fetchLastWeekStats } from '$lib/stores/api';
  import { t } from '$lib/stores/i18n';
  import { computeWeeklyStats } from '$lib/utils/weeklyStats';

  const STORAGE_KEY = 'velocity-weekly-summary-seen';

  let show = false;
  let stats = null;
  let username = '';
  let initials = '?';
  let profileImage = '';

  // ISO week id, e.g. "2026-W24" — used so the modal only appears once
  // for the week that just ended (i.e. once per Monday).
  function isoWeekKey(d) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = (date.getUTCDay() + 6) % 7; // Mon=0..Sun=6
    date.setUTCDate(date.getUTCDate() - dayNum + 3);
    const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
    const weekNum = 1 + Math.round(((date - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
    return `${date.getUTCFullYear()}-W${weekNum}`;
  }

  onMount(async () => {
    if (!browser) return;
    const user = $auth.user;
    if (!user) return;

    const now = new Date();
    // Show on Monday only — a recap of the week that just ended
    // (last Mon-Sun). Once per calendar week.
    if (now.getDay() !== 1) return;

    const weekKey = isoWeekKey(now);
    const seenKey = `${STORAGE_KEY}:${user.id}`;
    if (localStorage.getItem(seenKey) === weekKey) return;

    try {
      const data = await fetchLastWeekStats();
      // Don't show an empty recap if the user had zero activity last week.
      if (!data.stats || data.stats.total_sessions === 0) {
        localStorage.setItem(seenKey, weekKey);
        return;
      }
      stats = computeWeeklyStats(data.daily, data.tasksCompleted, data.streak, { isPastWeek: true });
    } catch {
      return; // No remote data — don't show a recap we can't back up
    }

    username = user.username;
    initials = user.username?.slice(0, 1).toUpperCase() ?? '?';
    profileImage = user.profile_image || '';

    show = true;
    localStorage.setItem(seenKey, weekKey);
  });

  function close() {
    show = false;
  }
</script>

{#if stats}
<Modal bind:show wide on:close={close}>
  <div class="ws-head">
    <div>
      <span class="panel-eyebrow">{$t('weekly_summary_label')}</span>
      <h3 class="modal-title">{$t('weekly_summary_title')}</h3>
    </div>
    <button class="modal-close" on:click={close}>✕</button>
  </div>

  <p class="ws-sub">{$t('weekly_summary_sub_monday')}</p>

  <RecapCard
    {username}
    {initials}
    {profileImage}
    totalHours={stats.totalHours}
    totalSessions={stats.totalSessions}
    doneTasks={stats.tasksCompleted}
    chartDays={stats.chartDays}
    currentStreak={stats.currentStreak}
    periodLabel={$t('recap_last_week')}
    filenameSuffix="weekly-recap"
  />
</Modal>
{/if}

<style>
  .ws-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.5rem;
  }
  .panel-eyebrow {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.2em;
    color: var(--accent);
    text-transform: uppercase;
  }
  .modal-title {
    font-size: 1.25rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: var(--text-primary);
    margin-top: 0.35rem;
  }
  .modal-close {
    width: 26px; height: 26px; border-radius: 50%;
    background: transparent; border: 1px solid var(--border-base);
    color: var(--text-tertiary); font-size: 0.7rem;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: color var(--transition-fast); flex-shrink: 0;
  }
  .modal-close:hover { color: var(--text-primary); }

  .ws-sub {
    font-size: 0.85rem;
    color: var(--text-secondary);
    line-height: 1.5;
    margin-bottom: 0.5rem;
  }
</style>