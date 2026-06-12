<script>
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import Modal from './Modal.svelte';
  import { auth, fetchMySessions } from '$lib/stores/api';
  import { tasks } from '$lib/stores/tasks';
  import { t } from '$lib/stores/i18n';

  const STORAGE_KEY = 'velocity-weekly-summary-seen';

  let show = false;
  let loading = true;
  let totalMinutes = 0;
  let totalSessions = 0;
  let activeDays = 0;
  let tasksCompleted = 0;
  let streak = 0;
  let bestDayMinutes = 0;

  // ISO week id, e.g. "2026-W24" — used so the modal only appears
  // once per calendar week, on Saturday or Sunday.
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
    const isWeekend = now.getDay() === 0 || now.getDay() === 6; // Sun or Sat
    if (!isWeekend) return;

    const weekKey = isoWeekKey(now);
    const seenKey = `${STORAGE_KEY}:${user.id}`;
    if (localStorage.getItem(seenKey) === weekKey) return;

    try {
      const data = await fetchMySessions();
      const daily = data.daily || [];
      streak = data.currentStreak || 0;

      totalMinutes = Math.round(daily.reduce((sum, d) => sum + (d.total_seconds || 0), 0) / 60);
      totalSessions = daily.reduce((sum, d) => sum + (d.sessions || 0), 0);
      activeDays = daily.filter(d => d.sessions > 0).length;
      bestDayMinutes = Math.round(Math.max(0, ...daily.map(d => d.total_seconds || 0)) / 60);
    } catch {
      // No remote data available — still show a lightweight local summary
    }

    // Tasks completed in the last 7 days (from local task store)
    const weekAgo = Date.now() - 7 * 86400000;
    tasksCompleted = $tasks.filter(tk => tk.done && (tk.doneAt ?? tk.createdAt ?? 0) >= weekAgo).length;

    loading = false;
    show = true;
    localStorage.setItem(seenKey, weekKey);
  });

  function close() {
    show = false;
  }
</script>

<Modal bind:show on:close={close}>
  <div class="ws-head">
    <div>
      <span class="panel-eyebrow">{$t('weekly_summary_label')}</span>
      <h3 class="modal-title">{$t('weekly_summary_title')}</h3>
    </div>
    <button class="modal-close" on:click={close}>✕</button>
  </div>

  <p class="ws-sub">{$t('weekly_summary_sub')}</p>

  <div class="ws-grid">
    <div class="ws-stat">
      <span class="ws-num font-mono">{totalSessions}</span>
      <span class="ws-label">{$t('weekly_summary_sessions')}</span>
    </div>
    <div class="ws-stat">
      <span class="ws-num font-mono">{totalMinutes}</span>
      <span class="ws-label">{$t('weekly_summary_minutes')}</span>
    </div>
    <div class="ws-stat">
      <span class="ws-num font-mono">{activeDays}/7</span>
      <span class="ws-label">{$t('weekly_summary_active_days')}</span>
    </div>
    <div class="ws-stat">
      <span class="ws-num font-mono">{tasksCompleted}</span>
      <span class="ws-label">{$t('weekly_summary_tasks')}</span>
    </div>
  </div>

  {#if streak > 0}
    <div class="ws-streak">
      🔥 <strong>{streak}</strong> {$t('weekly_summary_streak')}
    </div>
  {/if}

  {#if bestDayMinutes > 0}
    <div class="ws-best">
      ⭐ {$t('weekly_summary_best_day')} <strong>{bestDayMinutes} {$t('minutes_focused').toLowerCase()}</strong>
    </div>
  {/if}

  <button class="btn-soft ws-close" on:click={close}>{$t('profile_close')}</button>
</Modal>

<style>
  .ws-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
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
  }

  .ws-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
  }
  .ws-stat {
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    padding: 0.9rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    text-align: center;
  }
  .ws-num { font-size: 1.75rem; font-weight: 700; color: var(--accent); line-height: 1; }
  .ws-label { font-size: 0.65rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.08em; }

  .ws-streak, .ws-best {
    font-size: 0.8rem;
    color: var(--text-secondary);
    background: var(--accent-subtle);
    border-radius: var(--radius-md);
    padding: 0.6rem 0.9rem;
  }
  .ws-streak strong, .ws-best strong { color: var(--text-primary); }

  .btn-soft {
    width: 100%;
    padding: 0.75rem;
    background: var(--bg-elevated);
    border: 1px solid var(--border-base);
    border-radius: var(--radius-md);
    color: var(--text-primary);
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    cursor: pointer;
    transition: border-color var(--transition-fast), background var(--transition-fast);
  }
  .btn-soft:hover { border-color: var(--accent); background: var(--accent-subtle); }
</style>
