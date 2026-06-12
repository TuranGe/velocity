<script>
  import { onMount, onDestroy } from 'svelte';
  import { timer, progress, timeDisplay, LABELS, DURATIONS } from '$lib/stores/timer';
  import ProgressRing from './ProgressRing.svelte';
  import { initGSAP, magneticHover, glitchText } from '$lib/utils/gsap';
  import { recordSession, auth } from '$lib/stores/api';
  import { tasks } from '$lib/stores/tasks';

  let gsap;
  let timerEl;
  let timeEl;
  let modeEl;
  let startBtnEl;
  let cleanups = [];
  let lastStatus = '';
  let showCustomInput = false;
  let customMinutes = 45;

  const modes = [
    { id: 'focus',       label: 'Focus',  shortcut: 'F' },
    { id: 'short-break', label: 'Short',  shortcut: 'S' },
    { id: 'long-break',  label: 'Long',   shortcut: 'L' },
    { id: 'custom',      label: 'Custom', shortcut: 'C' },
  ];

  function handleModeChange(mode) {
    if (mode === 'custom') {
      showCustomInput = true;
      return;
    }
    showCustomInput = false;
    if ($timer.status === 'running') timer.pause();
    animateModeChange();
    if (modeEl) glitchText(modeEl, 0.6);
    timer.setMode(mode);
  }

  function applyCustomDuration() {
    const mins = Math.max(1, Math.min(180, customMinutes));
    timer.setDuration('custom', mins);
    animateModeChange();
    timer.setMode('custom');
    showCustomInput = false;
  }

  const modes = [
    { id: 'focus',       label: 'Focus',  shortcut: 'F' },
    { id: 'short-break', label: 'Short',  shortcut: 'S' },
    { id: 'long-break',  label: 'Long',   shortcut: 'L' },
  ];

  onMount(async () => {
    ({ gsap } = await initGSAP());

    const tl = gsap.timeline({ delay: 0.2 });
    tl.fromTo('.timer-modes',
      { opacity: 0, y: -16 },
      { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }
    )
    .fromTo('.timer-ring-wrap',
      { opacity: 0, scale: 0.85, rotation: -8 },
      { opacity: 1, scale: 1, rotation: 0, duration: 0.9, ease: 'velBounce' },
      '-=0.2'
    )
    .fromTo('.timer-display',
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' },
      '-=0.4'
    )
    .fromTo('.timer-actions',
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' },
      '-=0.3'
    );

    if (startBtnEl) {
      cleanups.push(magneticHover(startBtnEl, 0.5));
    }

    const onKey = (e) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.code === 'Space') { e.preventDefault(); handleStartPause(); }
      if (e.key === 'r' || e.key === 'R') timer.reset();
      if (e.key === 'f' || e.key === 'F') timer.setMode('focus');
      if (e.key === 's' || e.key === 'S') timer.setMode('short-break');
      if (e.key === 'l' || e.key === 'L') timer.setMode('long-break');
    };
    window.addEventListener('keydown', onKey);
    cleanups.push(() => window.removeEventListener('keydown', onKey));
  });

  onDestroy(() => {
    // Don't stop the timer on unmount - keep it running during navigation
    cleanups.forEach(fn => fn());
  });

  $: if ($timer.lastCompleted) {
    const { mode, duration } = $timer.lastCompleted;
    timer.clearLastCompleted();
    // Record session for all modes
    if ($auth.user) {
      recordSession(mode, duration).catch(() => {});
    }
    // Add elapsed time to all selected tasks — any mode counts
    tasks.addTime(duration);
  }

  $: if (gsap && $timer.status !== lastStatus) {
    const s = $timer.status;
    lastStatus = s;

    if (s === 'running') {
      gsap.fromTo('.time-digit',
        { scale: 1.06 },
        { scale: 1, duration: 0.4, ease: 'power3.out', stagger: 0.04 }
      );
    }

    if (s === 'completed') {
      completionBurst();
    }

    if (s === 'idle') {
      gsap.fromTo('.timer-ring-wrap',
        { scale: 0.97 },
        { scale: 1, duration: 0.5, ease: 'velBounce' }
      );
    }
  }

  function completionBurst() {
    if (!gsap) return;
    const tl = gsap.timeline();
    tl.to('.timer-ring-wrap', { scale: 1.06, duration: 0.25, ease: 'power2.out' })
      .to('.timer-ring-wrap', { scale: 1, duration: 0.5, ease: 'velBounce' })
      .to('.timer-display', { color: 'var(--accent)', duration: 0.3, ease: 'none' }, 0)
      .to('.completion-flash', { opacity: 0.15, duration: 0.15, yoyo: true, repeat: 3 }, 0);

    if (modeEl) glitchText(modeEl, 0.6);
  }

  function handleStartPause() {
    if (!gsap) return;
    gsap.to(startBtnEl, { scale: 0.93, duration: 0.08, yoyo: true, repeat: 1, ease: 'power2.inOut' });

    if ($timer.status === 'running') {
      timer.pause();
    } else {
      timer.start();
    }
  }

  function animateModeChange() {
    if (!gsap) return;
    gsap.timeline()
      .to('.timer-ring-wrap', { scale: 0.94, rotation: 5, duration: 0.2, ease: 'power2.in' })
      .to('.timer-ring-wrap', { scale: 1, rotation: 0, duration: 0.5, ease: 'velBounce' });
    gsap.fromTo('.timer-display', { opacity: 0.3 }, { opacity: 1, duration: 0.4 });
  }

  $: timeChars = $timeDisplay.split('');
</script>

<section bind:this={timerEl} class="timer-section">
  <div class="completion-flash" aria-hidden="true"></div>

  <div class="timer-modes" role="tablist" aria-label="Timer mode">
    {#each modes as mode}
      <button
        role="tab"
        aria-selected={$timer.mode === mode.id}
        class="mode-btn"
        class:active={$timer.mode === mode.id}
        on:click={() => handleModeChange(mode.id)}
        title="Shortcut: {mode.shortcut}"
      >
        {mode.label}
        <span class="mode-shortcut">{mode.shortcut}</span>
      </button>
    {/each}
  </div>

  {#if showCustomInput}
    <div class="custom-input-row">
      <input
        class="custom-min-input"
        type="number"
        bind:value={customMinutes}
        min="1"
        max="180"
        placeholder="Dakika"
        on:keydown={e => e.key === 'Enter' && applyCustomDuration()}
        autofocus
      />
      <span class="custom-unit">dk</span>
      <button class="custom-apply" on:click={applyCustomDuration}>Başlat</button>
      <button class="custom-cancel" on:click={() => showCustomInput = false}>✕</button>
    </div>
  {/if}

  <div class="timer-ring-wrap">
    <ProgressRing
      progress={$progress}
      size={280}
      strokeWidth={3}
      status={$timer.status}
    />

    <div class="timer-display" aria-live="polite" aria-atomic="true">
      <div class="time-digits" aria-label={$timeDisplay}>
        {#each timeChars as char, i}
          {#if char === ':'}
            <span class="time-colon font-mono">:</span>
          {:else}
            <span class="time-digit font-mono">{char}</span>
          {/if}
        {/each}
      </div>

      <div class="timer-mode-label" bind:this={modeEl}>
        {LABELS[$timer.mode]}
      </div>

      <div class="session-indicator" aria-label="Session {$timer.session}">
        {#each Array(4) as _, i}
          <span
            class="session-dot"
            class:filled={i < ($timer.session - 1) % 4 + ($timer.status === 'completed' && $timer.mode === 'focus' ? 1 : 0)}
          ></span>
        {/each}
      </div>
    </div>
  </div>

  <div class="timer-actions">
    <button
      class="btn-reset"
      on:click={() => timer.reset()}
      aria-label="Reset timer"
      title="Reset (R)"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <polyline points="1 4 1 10 7 10"/>
        <path d="M3.51 15a9 9 0 1 0 .49-3.51"/>
      </svg>
    </button>

    <button
      bind:this={startBtnEl}
      class="btn-start"
      class:running={$timer.status === 'running'}
      on:click={handleStartPause}
      aria-label={$timer.status === 'running' ? 'Pause timer' : 'Start timer'}
      title="Start/Pause (Space)"
    >
      {#if $timer.status === 'running'}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="4" width="4" height="16" rx="1"/>
          <rect x="14" y="4" width="4" height="16" rx="1"/>
        </svg>
      {:else}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
      {/if}
    </button>

    <button
      class="btn-skip"
      on:click={() => {
        const modeList = ['focus', 'short-break', 'long-break'];
        const idx = modeList.indexOf($timer.mode);
        timer.setMode(modeList[(idx + 1) % modeList.length]);
      }}
      aria-label="Skip to next mode"
      title="Skip"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <polygon points="5 4 15 12 5 20 5 4"/>
        <line x1="19" y1="5" x2="19" y2="19"/>
      </svg>
    </button>
  </div>

  <div class="timer-stats">
    <div class="stat-item">
      <span class="stat-value font-mono">{$timer.completedSessions}</span>
      <span class="stat-label">Sessions</span>
    </div>
    <div class="stat-divider"></div>
    <div class="stat-item">
      <span class="stat-value font-mono">{Math.floor($timer.totalFocusTime / 60)}</span>
      <span class="stat-label">Minutes focused</span>
    </div>
  </div>

  <p class="keyboard-hint">
    <kbd>Space</kbd> start/pause &nbsp;·&nbsp;
    <kbd>R</kbd> reset &nbsp;·&nbsp;
    <kbd>F</kbd> / <kbd>S</kbd> / <kbd>L</kbd> modes
  </p>
</section>

<style>
  .timer-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2rem;
    padding: 3rem 1rem;
    position: relative;
  }

  .completion-flash {
    position: fixed;
    inset: 0;
    background: var(--accent);
    pointer-events: none;
    opacity: 0;
    z-index: 50;
  }

  .timer-modes {
    display: flex;
    gap: 0.25rem;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    padding: 4px;
  }

  .mode-btn {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 0.5rem 1.25rem;
    border-radius: 10px;
    background: transparent;
    color: var(--text-tertiary);
    transition: background var(--transition-fast), color var(--transition-fast), box-shadow var(--transition-fast);
    position: relative;
  }

  .mode-btn:hover { color: var(--text-secondary); }

  .mode-btn.active {
    background: var(--accent);
    color: white;
    box-shadow: 0 0 16px var(--accent-glow);
  }

  .mode-shortcut {
    font-size: 0.6rem;
    opacity: 0.5;
    margin-left: 0.3em;
    vertical-align: super;
  }

  .custom-input-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 0.75rem;
    background: var(--bg-elevated);
    border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
    border-radius: 12px;
    animation: slideDown 0.18s ease;
  }
  @keyframes slideDown { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }

  .custom-min-input {
    width: 64px;
    background: transparent;
    border: none;
    outline: none;
    color: var(--text-primary);
    font-family: var(--font-mono);
    font-size: 1.1rem;
    font-weight: 700;
    text-align: center;
    -moz-appearance: textfield;
  }
  .custom-min-input::-webkit-outer-spin-button,
  .custom-min-input::-webkit-inner-spin-button { -webkit-appearance: none; }

  .custom-unit {
    font-size: 0.72rem;
    color: var(--text-tertiary);
    font-family: var(--font-mono);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .custom-apply {
    flex: 1;
    padding: 0.35rem 0.75rem;
    background: var(--accent);
    color: white;
    border-radius: 8px;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    transition: background 0.15s;
  }
  .custom-apply:hover { background: var(--accent-hover); }

  .custom-cancel {
    width: 24px; height: 24px;
    display: grid; place-items: center;
    border-radius: 6px;
    background: transparent;
    color: var(--text-tertiary);
    font-size: 0.75rem;
    transition: color 0.15s, background 0.15s;
  }
  .custom-cancel:hover { background: rgba(239,68,68,0.12); color: #ef4444; }

  .timer-ring-wrap {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    will-change: transform;
  }

  .timer-display {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    will-change: opacity;
  }

  .time-digits {
    display: flex;
    align-items: baseline;
    gap: 0.05em;
  }

  .time-digit {
    font-size: 3.5rem;
    font-weight: 700;
    line-height: 1;
    color: var(--text-primary);
    will-change: transform, opacity;
    display: inline-block;
  }

  .time-colon {
    font-size: 3rem;
    font-weight: 700;
    line-height: 1;
    color: var(--accent);
    opacity: 0.8;
    animation: blink 1s step-end infinite;
  }

  @keyframes blink {
    0%, 100% { opacity: 0.8; }
    50% { opacity: 0.2; }
  }

  .timer-mode-label {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.2em;
    color: var(--accent);
    text-transform: uppercase;
  }

  .session-indicator {
    display: flex;
    gap: 6px;
  }

  .session-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--border-base);
    transition: background var(--transition-base), box-shadow var(--transition-base);
  }

  .session-dot.filled {
    background: var(--accent);
    box-shadow: 0 0 6px var(--accent-glow);
  }

  .timer-actions {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .btn-start {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: var(--accent);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background var(--transition-fast), box-shadow var(--transition-fast), transform var(--transition-fast);
    box-shadow: 0 0 0 0 var(--accent-glow);
    will-change: transform;
  }

  .btn-start:hover {
    background: var(--accent-hover);
    box-shadow: 0 0 24px var(--accent-glow), 0 0 48px var(--orange-glow-sm);
    transform: scale(1.05);
  }

  .btn-start.running {
    box-shadow: 0 0 0 4px var(--accent-subtle), 0 0 20px var(--accent-glow);
    animation: runningPulse 2s ease-in-out infinite;
  }

  @keyframes runningPulse {
    0%, 100% { box-shadow: 0 0 0 4px var(--accent-subtle), 0 0 20px var(--accent-glow); }
    50% { box-shadow: 0 0 0 8px transparent, 0 0 40px var(--accent-glow); }
  }

  .btn-reset, .btn-skip {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: var(--bg-elevated);
    border: 1px solid var(--border-base);
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast);
  }

  .btn-reset:hover, .btn-skip:hover {
    background: var(--accent-subtle);
    border-color: var(--accent);
    color: var(--accent);
  }

  .timer-stats {
    display: flex;
    align-items: center;
    gap: 2rem;
    padding: 1rem 2rem;
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--accent);
    line-height: 1;
  }

  .stat-label {
    font-size: 0.7rem;
    color: var(--text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .stat-divider {
    width: 1px;
    height: 32px;
    background: var(--border-base);
  }

  .keyboard-hint {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    color: var(--text-tertiary);
    letter-spacing: 0.05em;
  }

  kbd {
    display: inline-block;
    padding: 1px 5px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-base);
    border-radius: 3px;
    font-family: var(--font-mono);
    font-size: 0.65rem;
    color: var(--text-secondary);
  }

  @media (max-width: 480px) {
    .timer-section { gap: 1.25rem; padding: 1.75rem 0.75rem; }
    .time-digit { font-size: 2.6rem; }
    .time-colon { font-size: 2.2rem; }
    .timer-ring-wrap :global(svg) { width: 230px; height: 230px; }
    .keyboard-hint { display: none; }
    .timer-stats { padding: 0.75rem 1.25rem; gap: 1.25rem; }
    .stat-value { font-size: 1.2rem; }
    .mode-btn { padding: 0.4rem 0.85rem; font-size: 0.65rem; }
  }
  @media (max-width: 360px) {
    .time-digit { font-size: 2.2rem; }
    .timer-ring-wrap :global(svg) { width: 200px; height: 200px; }
    .mode-btn { padding: 0.35rem 0.6rem; letter-spacing: 0.05em; }
    .mode-shortcut { display: none; }
  }
</style>
