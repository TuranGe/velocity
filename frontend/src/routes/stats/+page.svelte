<script>
  import { onMount } from 'svelte';
  import { tasks } from '$lib/stores/tasks';
  import { auth, userStats } from '$lib/stores/api';
  import { t } from '$lib/stores/i18n';
  import { initGSAP, animateCounter } from '$lib/utils/gsap';

  let gsap, ScrollTrigger;

  onMount(async () => {
    ({ gsap, ScrollTrigger } = await initGSAP());

    gsap.fromTo('.stats-page',
      { opacity: 0, y: 24 },
      { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }
    );

    document.querySelectorAll('[data-counter]').forEach((el) => {
      const target = parseFloat(el.getAttribute('data-counter') ?? '0');
      const suffix = el.getAttribute('data-suffix') ?? '';
      ScrollTrigger.create({
        trigger: el, start: 'top 80%', once: true,
        onEnter: () => animateCounter(el, target, 1.5, '', suffix),
      });
    });

    ScrollTrigger.batch('.stat-bar-fill', {
      onEnter: (els) => {
        els.forEach(el => {
          const pct = el.getAttribute('data-pct') ?? '0';
          gsap.fromTo(el, { width: '0%' }, { width: pct + '%', duration: 1.2, ease: 'power3.out' });
        });
      },
      start: 'top 85%',
    });

    gsap.fromTo('.stat-card',
      { opacity: 0, scale: 0.94, y: 20 },
      { opacity: 1, scale: 1, y: 0, duration: 0.6, stagger: 0.1, ease: 'power3.out', delay: 0.2 }
    );

    if ($auth.user) userStats.refresh();
  });

  // All numbers come from the database via userStats — never from
  // localStorage, which a user could edit to inflate their stats.
  $: totalMinutes = $userStats.totalMinutes;
  $: totalHours = (totalMinutes / 60).toFixed(1);
  $: totalSessions = $userStats.totalSessions;
  $: doneTasks = $tasks.filter(t => t.done).length;
  $: totalTasks = $tasks.length;
  $: completionPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
</script>

<svelte:head>
  <title>Stats — Velocity Timer</title>
</svelte:head>

<div class="stats-page">
  <div class="stats-container">
    <header class="stats-header">
      <span class="stats-label font-mono">{$t('your_velocity')}</span>
      <h1 class="stats-title">{$t('focus_stats')}</h1>
      <p class="stats-sub">
        {$t('all_time_data')}
        {#if $auth.user}
          · <span class="user-tag">{$auth.user.username}</span>
        {/if}
      </p>
    </header>

    {#if !$auth.user}
      <div class="auth-wall">
        <div class="auth-wall-icon">🔒</div>
        <h2 class="auth-wall-title">{$t('stats_locked')}</h2>
        <p class="auth-wall-desc">{$t('stats_locked_desc')}</p>
        <a href="/profile" class="auth-wall-btn font-mono">{$t('stats_sign_in')}</a>
      </div>
    {:else}

    <div class="big-stats">
      <div class="stat-card primary">
        <div class="stat-num font-mono" data-counter={totalSessions} data-suffix="">0</div>
        <div class="stat-label">{$t('completed_sessions')}</div>
      </div>
      <div class="stat-card">
        <div class="stat-num font-mono" data-counter={totalMinutes} data-suffix="">0</div>
        <div class="stat-label">{$t('minutes_focused')}</div>
      </div>
      <div class="stat-card">
        <div class="stat-num font-mono" data-counter={parseFloat(totalHours)} data-suffix="">0</div>
        <div class="stat-label">{$t('hours_label')}</div>
      </div>
    </div>

    <div class="progress-section">
      <div class="progress-header">
        <span class="progress-label font-mono">{$t('task_completion')}</span>
        <span class="progress-pct font-mono text-accent">{completionPct}%</span>
      </div>
      <div class="progress-track">
        <div class="stat-bar-fill" data-pct={completionPct} style="width: 0%"
          role="progressbar" aria-valuenow={completionPct} aria-valuemin="0" aria-valuemax="100"></div>
      </div>
      <div class="progress-footer">
        <span>{doneTasks} {$t('done_label')}</span>
        <span>{totalTasks - doneTasks} {$t('remaining_label')}</span>
      </div>
    </div>

    <div class="breakdown-section">
      <h2 class="section-heading font-mono">{$t('session_breakdown')}</h2>
      <div class="breakdown-bars">
        {#each [
          { label: $t('completed_sessions'), value: totalSessions, max: Math.max(totalSessions, 10) },
          { label: $t('tasks_completed_stat'), value: doneTasks, max: Math.max(totalTasks, 10) },
        ] as item}
          <div class="breakdown-row">
            <span class="breakdown-label">{item.label}</span>
            <div class="breakdown-track">
              <div class="stat-bar-fill" data-pct={item.max > 0 ? (item.value / item.max) * 100 : 0} style="width: 0%"></div>
            </div>
            <span class="breakdown-val font-mono">{item.value}</span>
          </div>
        {/each}
      </div>
    </div>

    <div class="quote-block">
      <blockquote class="quote-text">"The secret of getting ahead is getting started."</blockquote>
      <cite class="quote-cite font-mono">— Mark Twain</cite>
    </div>

    <a href="/" class="btn-back">{$t('back_to_timer')}</a>
    {/if}
  </div>
</div>

<style>
  .stats-page { padding: 3rem 2rem; min-height: calc(100vh - 60px); will-change: transform, opacity; }
  .stats-container { max-width: 700px; margin: 0 auto; display: flex; flex-direction: column; gap: 3rem; }
  .stats-header { text-align: center; }
  .stats-label { font-size: 0.65rem; font-weight: 700; letter-spacing: 0.2em; color: var(--accent); text-transform: uppercase; }
  .stats-title { font-size: 2.25rem; font-weight: 800; letter-spacing: -0.03em; margin-top: 0.5rem; color: var(--text-primary); }
  .stats-sub { font-size: 0.875rem; color: var(--text-secondary); margin-top: 0.5rem; }
  .user-tag { color: var(--accent); }
  .big-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1rem; }
  .stat-card { background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-xl); padding: 1.75rem 1.5rem; display: flex; flex-direction: column; gap: 0.5rem; text-align: center; will-change: transform, opacity; transition: border-color var(--transition-base), box-shadow var(--transition-base); }
  .stat-card:hover { border-color: var(--border-base); box-shadow: var(--shadow-md); }
  .stat-card.primary { border-color: var(--accent); box-shadow: var(--shadow-glow); }
  .stat-num { font-size: 3rem; font-weight: 700; color: var(--accent); line-height: 1; }
  .stat-label { font-size: 0.72rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.08em; }
  .progress-section { background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-xl); padding: 1.75rem; display: flex; flex-direction: column; gap: 1rem; }
  .progress-header { display: flex; justify-content: space-between; align-items: center; font-size: 0.7rem; letter-spacing: 0.12em; color: var(--text-secondary); }
  .progress-track { height: 6px; background: var(--bg-overlay); border-radius: 99px; overflow: hidden; }
  .stat-bar-fill { height: 100%; background: linear-gradient(90deg, var(--accent) 0%, var(--accent-hover) 100%); border-radius: 99px; box-shadow: 0 0 8px var(--accent-glow); will-change: width; }
  .progress-footer { display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--text-tertiary); }
  .breakdown-section { display: flex; flex-direction: column; gap: 1.25rem; }
  .section-heading { font-size: 0.7rem; font-weight: 700; letter-spacing: 0.15em; color: var(--text-secondary); text-transform: uppercase; }
  .breakdown-bars { display: flex; flex-direction: column; gap: 1rem; }
  .breakdown-row { display: grid; grid-template-columns: 180px 1fr 48px; align-items: center; gap: 1rem; }
  .breakdown-label { font-size: 0.8rem; color: var(--text-secondary); }
  .breakdown-val { font-size: 0.875rem; color: var(--accent); text-align: right; }
  .breakdown-track { height: 4px; background: var(--bg-overlay); border-radius: 99px; overflow: hidden; }
  .quote-block { border-left: 2px solid var(--accent); padding: 1rem 1.5rem; display: flex; flex-direction: column; gap: 0.5rem; }
  .quote-text { font-size: 1rem; font-style: italic; color: var(--text-secondary); line-height: 1.6; }
  .quote-cite { font-size: 0.7rem; letter-spacing: 0.1em; color: var(--accent); text-transform: uppercase; }
  .btn-back { display: inline-flex; align-items: center; gap: 0.5rem; font-family: var(--font-mono); font-size: 0.75rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-secondary); padding: 0.625rem 1.25rem; border: 1px solid var(--border-base); border-radius: var(--radius-md); align-self: center; transition: color var(--transition-fast), border-color var(--transition-fast), background var(--transition-fast); }
  .btn-back:hover { color: var(--accent); border-color: var(--accent); background: var(--accent-subtle); }
  .text-accent { color: var(--accent); }
  .auth-wall {
    display: flex; flex-direction: column; align-items: center; gap: 1rem;
    padding: 4rem 2rem; background: var(--bg-surface); border: 1px solid var(--border-subtle);
    border-radius: var(--radius-xl); text-align: center;
  }
  .auth-wall-icon { font-size: 2.5rem; }
  .auth-wall-title { font-size: 1.4rem; font-weight: 800; color: var(--text-primary); letter-spacing: -0.02em; }
  .auth-wall-desc { font-size: 0.875rem; color: var(--text-secondary); line-height: 1.6; max-width: 340px; }
  .auth-wall-btn {
    margin-top: 0.5rem; padding: 0.65rem 1.5rem; background: var(--accent); color: white;
    border-radius: var(--radius-md); font-size: 0.75rem; font-weight: 700; letter-spacing: 0.1em;
    text-transform: uppercase; text-decoration: none;
    transition: background var(--transition-fast), box-shadow var(--transition-fast);
  }
  .auth-wall-btn:hover { background: var(--accent-hover); box-shadow: 0 0 20px var(--accent-glow); }
  @media (max-width: 600px) {
    .stats-page { padding: 2rem 1rem; }
    .stat-num { font-size: 2.2rem; }
    .breakdown-row { grid-template-columns: 1fr 1fr 36px; gap: 0.5rem; }
  }
</style>