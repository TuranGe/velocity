<script>
  import { onMount, onDestroy } from 'svelte';
  import { tasks } from '$lib/stores/tasks';
  import { auth, fetchRemoteTasks, createRemoteTask, updateRemoteTask, deleteRemoteTask } from '$lib/stores/api';
  import { t } from '$lib/stores/i18n';
  import { initGSAP } from '$lib/utils/gsap';
  import { timer } from '$lib/stores/timer';
  import { frequentTasks } from '$lib/stores/frequentTasks';
  import { notifyTaskComplete } from '$lib/utils/notifications';
  import { flip } from 'svelte/animate';
  import { fly, fade } from 'svelte/transition';

  let newTaskText = '';
  let newTaskMinutes = 25;
  let inputEl;
  let panelEl;
  let gsap;
  let addBtnEl;
  let loading = false;
  let autoCompleteInterval = null;

  // ── Confetti ────────────────────────────────────────────────
  function launchConfetti() {
    const colors = ['#f97316','#fb923c','#fbbf24','#34d399','#60a5fa','#a78bfa','#f472b6'];
    const count = 60;
    const container = document.body;
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.style.cssText = `
        position:fixed;
        pointer-events:none;
        z-index:9999;
        width:${6 + Math.random() * 8}px;
        height:${6 + Math.random() * 8}px;
        background:${colors[Math.floor(Math.random() * colors.length)]};
        border-radius:${Math.random() > 0.5 ? '50%' : '2px'};
        left:${20 + Math.random() * 60}%;
        top:60%;
        opacity:1;
      `;
      container.appendChild(el);
      const tx = (Math.random() - 0.5) * 300;
      const ty = -(100 + Math.random() * 300);
      const rot = (Math.random() - 0.5) * 720;
      el.animate([
        { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
        { transform: `translate(${tx}px,${ty}px) rotate(${rot}deg)`, opacity: 0 }
      ], { duration: 900 + Math.random() * 600, easing: 'cubic-bezier(0,0.9,0.57,1)', fill: 'forwards' })
        .onfinish = () => el.remove();
    }
  }

  // ── Auto-complete tasks by elapsed minutes ──────────────────
  // Tracks the last full minute we processed so we add exactly 1 min at a time
  let lastProcessedMinute = 0;
  let lastTimerStatus = '';

  function startAutoComplete() {
    stopAutoComplete();
    lastProcessedMinute = Math.floor(($timer.elapsed ?? 0) / 60);
    autoCompleteInterval = setInterval(checkAutoComplete, 1000);
  }

  function stopAutoComplete() {
    if (autoCompleteInterval) { clearInterval(autoCompleteInterval); autoCompleteInterval = null; }
  }

  function checkAutoComplete() {
    const elapsed = $timer.elapsed;
    if (!isFinite(elapsed)) return;
    const currentMinute = Math.floor(elapsed / 60);
    if (currentMinute <= lastProcessedMinute) return;

    // Add 1 minute at a time for each new minute that passed
    const minutesToAdd = currentMinute - lastProcessedMinute;
    lastProcessedMinute = currentMinute;

    // Add incremental time to spent
    tasks.addIncrementalTime(minutesToAdd);

    // Check each selected task for completion
    $tasks.forEach(task => {
      if (!task.selected || task.done) return;
      const prev = isFinite(task.spentMinutes) ? task.spentMinutes : 0;
      const spent = prev + minutesToAdd;
      const target = task.durationMinutes ?? task.pomodoros ?? 25;
      if (isFinite(target) && spent >= target) {
        completeTask(task.id);
      }
    });
  }

  async function completeTask(id) {
    const task = $tasks.find(t => t.id === id);
    if (!task || task.done) return;
    tasks.markDone(id);
    launchConfetti();
    notifyTaskComplete(task.text);
    if ($auth.user) {
      try { await updateRemoteTask(id, { done: true }); } catch {}
    }
  }

  // Watch timer running state → start/stop auto-complete interval.
  // Only react to actual status *transitions* — $timer changes every
  // second while running, but re-running startAutoComplete() each tick
  // would keep resetting lastProcessedMinute to the current minute,
  // so checkAutoComplete would never see a new minute pass.
  $: if ($timer.status !== lastTimerStatus) {
    lastTimerStatus = $timer.status;
    if ($timer.status === 'running') {
      startAutoComplete();
    } else {
      stopAutoComplete();
    }
  }

  onMount(async () => {
    ({ gsap } = await initGSAP());
    gsap.fromTo(panelEl,
      { opacity: 0, x: 30 },
      { opacity: 1, x: 0, duration: 0.6, ease: 'power3.out', delay: 0.4 }
    );
    if ($auth.user) await syncTasksFromBackend();
  });

  async function syncTasksFromBackend() {
    try {
      loading = true;
      const data = await fetchRemoteTasks();
      tasks.setFromRemote(data.tasks.map(t => ({
        id: t.id,
        text: t.text,
        done: !!t.done,
        selected: false,
        pomodoros: t.pomodoros,
        spent: t.spent,
        createdAt: t.created_at * 1000,
      })));
    } catch (e) {
      console.warn('Could not sync tasks:', e.message);
    } finally {
      loading = false;
    }
  }

  async function handleAdd() {
    if (!$auth.user) {
      gsap?.to(inputEl, { keyframes: [{ x: -6 }, { x: 6 }, { x: -4 }, { x: 4 }, { x: 0 }], duration: 0.4, ease: 'none' });
      import('$lib/stores/toast').then(m => m.toast.warn('Görev eklemek için giriş yapman gerekiyor'));
      return;
    }
    if (!newTaskText.trim()) {
      gsap?.to(inputEl, { keyframes: [{ x: -6 }, { x: 6 }, { x: -4 }, { x: 4 }, { x: 0 }], duration: 0.4, ease: 'none' });
      return;
    }
    const text = newTaskText.trim();
    const rawMinutes = Number(newTaskMinutes);
    if (!Number.isFinite(rawMinutes) || rawMinutes <= 0) {
      newTaskMinutes = 25;
      gsap?.to(inputEl, { keyframes: [{ x: -6 }, { x: 6 }, { x: -4 }, { x: 4 }, { x: 0 }], duration: 0.4, ease: 'none' });
      return;
    }
    const durationMinutes = Math.max(1, Math.min(480, Math.round(rawMinutes)));
    newTaskText = '';
    newTaskMinutes = 25;
    gsap?.to(addBtnEl, { scale: 0.88, duration: 0.1, yoyo: true, repeat: 1 });

    frequentTasks.record(text, durationMinutes);

    if ($auth.user) {
      try {
        const data = await createRemoteTask(text, durationMinutes);
        tasks.addFromRemote({
          id: data.task.id, text: data.task.text,
          done: false, selected: false,
          durationMinutes: data.task.pomodoros, // backend still uses pomodoros field for now
          spentMinutes: 0,
          createdAt: Date.now(),
        });
      } catch { tasks.add(text, durationMinutes); }
    } else {
      tasks.add(text, durationMinutes);
    }
  }

  async function handleRemove(id, el) {
    gsap?.to(el, {
      opacity: 0, x: 20, height: 0, marginBottom: 0,
      paddingTop: 0, paddingBottom: 0, duration: 0.3, ease: 'power2.in',
      onComplete: async () => {
        tasks.remove(id);
        if ($auth.user) { try { await deleteRemoteTask(id); } catch {} }
      },
    });
  }

  function handleToggleSelected(id, el) {
    // Only allow selection changes when timer is idle or completed
    if ($timer.status === 'running' || $timer.status === 'paused') return;
    gsap?.to(el, { scale: 0.97, duration: 0.1, yoyo: true, repeat: 1 });
    tasks.toggleSelected(id);
  }

  async function handleClear() {
    if ($auth.user) {
      const ids = $tasks.map(t => t.id);
      tasks.clear();
      for (const id of ids) { try { await deleteRemoteTask(id); } catch {} }
    } else {
      tasks.clear();
    }
  }

  function onKeydown(e) { if (e.key === 'Enter') handleAdd(); }

  onDestroy(() => stopAutoComplete());

  $: doneTasks  = $tasks.filter(t => t.done).length;
  $: totalTasks = $tasks.length;
  $: activeTasks = $tasks.filter(t => t.selected && !t.done).length;
  $: progressPct = totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0;

  // Sorted: active (selected) → pending → done
  $: sortedTasks = [...$tasks].sort((a, b) => {
    const rank = t => t.done ? 2 : t.selected ? 0 : 1;
    return rank(a) - rank(b);
  });

  // ── Frequently used task suggestions ────────────────────────
  // Show top frequent tasks not already present (active) in the list,
  // filtered by current input text if any.
  $: quickSuggestions = (() => {
    const activeNorms = new Set($tasks.filter(t => !t.done).map(t => t.text.trim().toLowerCase()));
    const filter = newTaskText.trim().toLowerCase();
    return $frequentTasks
      .filter(f => f.count >= 2 && !activeNorms.has(f.norm))
      .filter(f => !filter || f.norm.includes(filter))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  })();

  async function quickAdd(suggestion) {
    const text = suggestion.text;
    const durationMinutes = Math.max(1, suggestion.durationMinutes || 25);
    gsap?.to(addBtnEl, { scale: 0.88, duration: 0.1, yoyo: true, repeat: 1 });

    frequentTasks.record(text, durationMinutes);

    if ($auth.user) {
      try {
        const data = await createRemoteTask(text, durationMinutes);
        tasks.addFromRemote({
          id: data.task.id, text: data.task.text,
          done: false, selected: false,
          durationMinutes: data.task.pomodoros,
          spentMinutes: 0,
          createdAt: Date.now(),
        });
      } catch { tasks.add(text, durationMinutes); }
    } else {
      tasks.add(text, durationMinutes);
    }
  }
</script>

<aside bind:this={panelEl} class="task-panel">
  <header class="panel-header">
    <div class="header-left">
      <h2 class="panel-title">
        <span class="title-dot" class:active={activeTasks > 0}></span>
        {$t('tasks')}
      </h2>
      {#if totalTasks > 0}
        <span class="task-count font-mono">{doneTasks}/{totalTasks}</span>
      {/if}
    </div>
    {#if $tasks.length > 0}
      <button class="btn-clear" on:click={handleClear} title={$t('clear')}>
        {$t('clear')}
      </button>
    {/if}
  </header>

  {#if totalTasks > 0}
    <div class="progress-track" title="{doneTasks}/{totalTasks} tamamlandı">
      <div class="progress-fill" style="width:{progressPct}%"></div>
      <span class="progress-label font-mono">{doneTasks}/{totalTasks}</span>
    </div>
  {/if}

  <div class="task-form">
    {#if !$auth.user}
      <div class="auth-gate">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        <span>Görev eklemek için</span>
        <a href="/profile" class="auth-gate-link">giriş yap →</a>
      </div>
    {/if}
    <input
      bind:this={inputEl}
      bind:value={newTaskText}
      on:keydown={onKeydown}
      type="text"
      class="task-input"
      placeholder={$auth.user ? $t('task_placeholder') : 'Giriş yapman gerekiyor...'}
      maxlength="80"
      disabled={!$auth.user}
    />
    <div class="form-row">
      <div class="duration-picker" title="Görevin kaç dakika süreceğini gir">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <button class="pomo-btn" on:click={() => newTaskMinutes = Math.max(1, newTaskMinutes - 5)}>−</button>
        <input
          class="duration-input font-mono"
          type="number"
          bind:value={newTaskMinutes}
          min="1"
          max="480"
          on:focus={e => e.target.select()}
          on:blur={() => {
            const v = Number(newTaskMinutes);
            newTaskMinutes = Number.isFinite(v) && v > 0 ? Math.max(1, Math.min(480, Math.round(v))) : 25;
          }}
        />
        <span class="duration-unit">{$t('minute')}</span>
        <button class="pomo-btn" on:click={() => newTaskMinutes = Math.min(480, newTaskMinutes + 5)}>+</button>
      </div>
      <button bind:this={addBtnEl} class="btn-add" on:click={handleAdd} aria-label="Ekle" disabled={!$auth.user}>
        + {$t('add')}
      </button>
    </div>
  </div>

  <!-- Frequently used task suggestions -->
  {#if $auth.user && quickSuggestions.length > 0}
    <div class="quick-suggestions" transition:fade={{ duration: 150 }}>
      {#each quickSuggestions as sugg (sugg.norm)}
        <button class="quick-chip" on:click={() => quickAdd(sugg)} title="Hızlı ekle: {sugg.text} ({sugg.durationMinutes}{$t('minute')})">
          <span class="quick-chip-icon">⚡</span>
          <span class="quick-chip-text">{sugg.text}</span>
          <span class="quick-chip-dur font-mono">{sugg.durationMinutes}{$t('minute')}</span>
        </button>
      {/each}
    </div>
  {/if}

  <!-- Helper text when tasks exist -->
  {#if $tasks.filter(t => !t.done).length > 0}
    <p class="hint-text">
      {#if activeTasks > 0 && $timer.status === 'running'}
        <span class="hint-active">⏱ {activeTasks} görev izleniyor</span>
      {:else if activeTasks > 0}
        <span class="hint-active">✓ {activeTasks} görev seçili — timer'ı başlat!</span>
      {:else}
        Yapmak istediğin görevi seç, sonra timer'ı başlat
      {/if}
    </p>
  {/if}

  <div class="task-list-wrap" class:loading>
    {#if loading}
      <div class="loading-state">
        <span class="loading-dot"></span>
        <span class="loading-dot"></span>
        <span class="loading-dot"></span>
      </div>
    {:else}
      <ul class="task-list" role="list">
        {#if $tasks.length === 0}
          <li class="empty-state" transition:fade={{ duration: 200 }}>
            <svg class="empty-illustration" width="120" height="90" viewBox="0 0 120 90" fill="none">
              <!-- Floating clipboard -->
              <g class="empty-clipboard">
                <rect x="35" y="14" width="50" height="62" rx="6" fill="var(--bg-elevated)" stroke="var(--border-base)" stroke-width="1.5"/>
                <rect x="48" y="8" width="24" height="10" rx="3" fill="var(--border-base)"/>
                <line x1="44" y1="32" x2="76" y2="32" stroke="var(--border-base)" stroke-width="2" stroke-linecap="round" class="empty-line e1"/>
                <line x1="44" y1="44" x2="68" y2="44" stroke="var(--border-base)" stroke-width="2" stroke-linecap="round" class="empty-line e2"/>
                <line x1="44" y1="56" x2="72" y2="56" stroke="var(--border-base)" stroke-width="2" stroke-linecap="round" class="empty-line e3"/>
              </g>
              <!-- Floating dots -->
              <circle class="empty-dot d1" cx="18" cy="20" r="3" fill="var(--accent)" opacity="0.5"/>
              <circle class="empty-dot d2" cx="104" cy="60" r="2.5" fill="var(--accent)" opacity="0.4"/>
              <circle class="empty-dot d3" cx="100" cy="18" r="2" fill="var(--accent)" opacity="0.35"/>
              <!-- Pencil -->
              <g class="empty-pencil">
                <path d="M88 50l8-8 6 6-8 8-6-6z" fill="var(--accent)" opacity="0.85"/>
                <path d="M86 56l-3 6 6-3-3-3z" fill="var(--text-tertiary)" opacity="0.6"/>
              </g>
            </svg>
            <span>{$t('no_tasks')}</span>
            <span class="empty-hint">{$t('no_tasks_hint')}</span>
          </li>
        {/if}

        {#each sortedTasks as task (task.id)}
          <li
            class="task-item"
            class:done={task.done}
            class:is-active={task.selected && !task.done}
            animate:flip={{ duration: 250 }}
            transition:fly={{ y: -12, duration: 250 }}
          >
            <!-- Checkbox = "working on this" -->
            <button
              class="task-check"
              class:checked={task.selected && !task.done}
              class:completed={task.done}
              class:timer-locked={!task.done && ($timer.status === 'running' || $timer.status === 'paused')}
              on:click={(e) => !task.done && handleToggleSelected(task.id, e.currentTarget.closest('.task-item'))}
              aria-label={task.done ? 'Tamamlandı' : task.selected ? 'Seçimi kaldır' : 'Bunu yapıyorum'}
              aria-pressed={task.selected}
              disabled={task.done || $timer.status === 'running' || $timer.status === 'paused'}
              title={task.done ? 'Tamamlandı ✓' : ($timer.status === 'running' || $timer.status === 'paused') ? 'Timer çalışırken değiştiremezsin' : task.selected ? 'Seçimi kaldır' : 'Üzerinde çalışmak için seç'}
            >
              {#if task.done}
                <!-- Done: solid checkmark -->
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              {:else if task.selected}
                <!-- Active: play indicator -->
                <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5,3 19,12 5,21"/>
                </svg>
              {/if}
            </button>

            <div class="task-body">
              <span class="task-text">{task.text}</span>
              <div class="task-meta-row">
                {#if true}
                  {@const spentMin = Math.floor(task.spentMinutes ?? 0)}
                  {@const totalMin = task.durationMinutes ?? task.pomodoros ?? 25}
                  {@const pct = Math.min(100, Math.round((spentMin / totalMin) * 100))}
                  <span class="task-progress font-mono">
                    <span class="spent" class:accent={spentMin > 0}>{spentMin}</span>
                    <span class="sep">/</span>
                    <span class="total">{totalMin}</span>
                    <span class="pomo-icon-sm">{$t('minute')}</span>
                  </span>
                  <!-- Mini progress bar -->
                  <div class="task-mini-bar" title="{pct}%">
                    <div class="task-mini-fill" style="width:{pct}%"></div>
                  </div>
                {/if}
              </div>
            </div>

            <button
              class="task-delete"
              on:click={(e) => handleRemove(task.id, e.currentTarget.closest('.task-item'))}
              aria-label="Sil"
              title="Sil"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</aside>

<style>
  .task-panel {
    display: flex; flex-direction: column; gap: 0.85rem;
    background: var(--bg-surface); border: 1px solid var(--border-subtle);
    border-radius: var(--radius-xl); padding: 1.5rem;
    width: 300px; height: 520px; will-change: transform, opacity;
  }

  .panel-header { display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
  .header-left { display: flex; align-items: center; gap: 0.6rem; }

  .panel-title {
    font-family: var(--font-mono); font-size: 0.75rem; font-weight: 700;
    letter-spacing: 0.15em; text-transform: uppercase; color: var(--text-secondary);
    display: flex; align-items: center; gap: 0.5rem;
  }

  .title-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--border-base); transition: background 0.3s, box-shadow 0.3s;
  }
  .title-dot.active {
    background: var(--accent); box-shadow: 0 0 6px var(--accent-glow);
    animation: dot-pulse 2s ease-in-out infinite;
  }
  @keyframes dot-pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }

  .task-count {
    font-size: 0.65rem; color: var(--text-tertiary);
    background: var(--bg-elevated); border: 1px solid var(--border-base);
    border-radius: 99px; padding: 0.1rem 0.5rem;
  }

  .btn-clear {
    font-family: var(--font-mono); font-size: 0.65rem; color: var(--text-tertiary);
    background: none; text-transform: uppercase; letter-spacing: 0.1em;
    transition: color var(--transition-fast); padding: 0.25rem 0.5rem;
  }
  .btn-clear:hover { color: #ef4444; }

  /* Progress */
  .progress-track {
    height: 4px; background: var(--bg-elevated); border-radius: 99px;
    position: relative; overflow: visible; flex-shrink: 0;
  }
  .progress-fill {
    height: 100%; background: var(--accent); border-radius: 99px;
    transition: width 0.5s ease; box-shadow: 0 0 8px var(--accent-glow);
  }
  .progress-label {
    position: absolute; right: 0; top: -18px;
    font-size: 0.6rem; color: var(--accent);
  }

  /* Hint */
  .hint-text {
    font-size: 0.7rem; color: var(--text-tertiary);
    text-align: center; flex-shrink: 0; line-height: 1.4;
  }
  .hint-active { color: var(--accent); font-weight: 600; }

  /* Form */
  .task-form { display: flex; flex-direction: column; gap: 0.6rem; flex-shrink: 0; }

  .task-input {
    width: 100%; background: var(--bg-elevated); border: 1px solid var(--border-base);
    border-radius: var(--radius-md); padding: 0.7rem 1rem;
    font-family: var(--font-sans); font-size: 0.875rem; color: var(--text-primary);
    transition: border-color var(--transition-fast), box-shadow var(--transition-fast); outline: none;
  }
  .task-input::placeholder { color: var(--text-tertiary); }
  .task-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-subtle); }

  .form-row { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; }

  .duration-picker {
    display: flex; align-items: center; gap: 0.3rem;
    background: var(--bg-elevated); border: 1px solid var(--border-base);
    border-radius: var(--radius-md); padding: 0.3rem 0.6rem;
    color: var(--text-secondary);
  }
  .duration-input {
    width: 38px; background: transparent; border: none; outline: none;
    color: var(--text-primary); font-size: 0.88rem; font-weight: 700;
    text-align: center;
    -moz-appearance: textfield;
  }
  .duration-input::-webkit-outer-spin-button,
  .duration-input::-webkit-inner-spin-button { -webkit-appearance: none; }
  .duration-unit { font-size: 0.65rem; color: var(--text-tertiary); font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.05em; }
  .pomo-btn { width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; background: none; color: var(--text-secondary); font-size: 1rem; transition: color var(--transition-fast); }
  .pomo-btn:hover { color: var(--accent); }

  .task-mini-bar {
    flex: 1; height: 3px; background: var(--border-subtle);
    border-radius: 99px; overflow: hidden; min-width: 32px;
  }
  .task-mini-fill {
    height: 100%; background: var(--accent);
    border-radius: 99px; transition: width 0.4s ease;
  }

  .btn-add {
    flex: 1; padding: 0.5rem 1rem; background: var(--accent); color: white;
    border-radius: var(--radius-md); font-family: var(--font-mono); font-size: 0.75rem;
    font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
    transition: background var(--transition-fast), box-shadow var(--transition-fast);
  }
  .btn-add:hover { background: var(--accent-hover); box-shadow: 0 0 16px var(--accent-glow); }

  /* List */
  .task-list-wrap {
    flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden;
    border-radius: var(--radius-md); scrollbar-width: thin;
    scrollbar-color: var(--border-base) transparent; position: relative;
  }
  .task-list-wrap::-webkit-scrollbar { width: 4px; }
  .task-list-wrap::-webkit-scrollbar-track { background: transparent; }
  .task-list-wrap::-webkit-scrollbar-thumb { background: var(--border-base); border-radius: 99px; }
  .task-list-wrap::after {
    content: ''; position: sticky; bottom: 0; left: 0; right: 0; display: block;
    height: 24px; background: linear-gradient(to top, var(--bg-surface), transparent); pointer-events: none;
  }

  .loading-state { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 2rem; }
  .loading-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); animation: pulse 1s ease-in-out infinite; }
  .loading-dot:nth-child(2) { animation-delay: 0.2s; }
  .loading-dot:nth-child(3) { animation-delay: 0.4s; }
  @keyframes pulse { 0%,100%{opacity:0.3;transform:scale(0.8)} 50%{opacity:1;transform:scale(1)} }

  .task-list { list-style: none; display: flex; flex-direction: column; gap: 0.5rem; padding: 2px 2px 24px; }

  .empty-state { display: flex; flex-direction: column; align-items: center; gap: 0.4rem; padding: 1.5rem 1rem; color: var(--text-tertiary); font-size: 0.8rem; text-align: center; }
  .empty-hint { font-size: 0.7rem; color: var(--text-tertiary); opacity: 0.6; }

  .empty-illustration { margin-bottom: 0.25rem; }

  .empty-clipboard {
    animation: empty-float 3.5s ease-in-out infinite;
    transform-origin: center;
  }
  @keyframes empty-float {
    0%, 100% { transform: translateY(0) rotate(-1deg); }
    50%      { transform: translateY(-6px) rotate(1deg); }
  }

  .empty-line {
    stroke-dasharray: 40;
    animation: empty-draw 2.4s ease-in-out infinite;
  }
  .empty-line.e1 { animation-delay: 0s; }
  .empty-line.e2 { animation-delay: 0.3s; }
  .empty-line.e3 { animation-delay: 0.6s; }
  @keyframes empty-draw {
    0%, 100% { opacity: 0.35; stroke-dashoffset: 0; }
    50%      { opacity: 0.9; }
  }

  .empty-dot {
    animation: empty-drift 4s ease-in-out infinite;
  }
  .d1 { animation-delay: 0s; }
  .d2 { animation-delay: 1.2s; }
  .d3 { animation-delay: 2.1s; }
  @keyframes empty-drift {
    0%, 100% { transform: translate(0, 0); opacity: 0.3; }
    50%      { transform: translate(3px, -8px); opacity: 0.7; }
  }

  .empty-pencil {
    animation: empty-wiggle 2.8s ease-in-out infinite;
    transform-origin: 92px 54px;
  }
  @keyframes empty-wiggle {
    0%, 100% { transform: rotate(0deg); }
    25%      { transform: rotate(-8deg); }
    75%      { transform: rotate(6deg); }
  }

  /* Task item */
  .task-item {
    display: flex; align-items: flex-start; gap: 0.75rem;
    padding: 0.75rem; background: var(--bg-elevated);
    border: 1px solid var(--border-subtle); border-radius: var(--radius-md);
    transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
    will-change: transform, opacity; overflow: hidden;
  }
  .task-item:hover { border-color: var(--border-base); }
  .task-item.is-active {
    border-color: color-mix(in srgb, var(--accent) 40%, transparent);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 15%, transparent);
    background: color-mix(in srgb, var(--accent) 4%, var(--bg-elevated));
  }
  .task-item.done { opacity: 0.55; }
  .task-item.done .task-text { text-decoration: line-through; color: var(--text-tertiary); }

  /* Checkbox */
  .task-check {
    width: 18px; height: 18px; border-radius: 4px;
    border: 1.5px solid var(--border-strong); background: transparent;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; margin-top: 1px; color: white;
    transition: background var(--transition-fast), border-color var(--transition-fast), transform 0.15s;
    cursor: pointer;
  }
  .task-check:hover:not(:disabled) { border-color: var(--accent); transform: scale(1.1); }
  .task-check.checked {
    background: color-mix(in srgb, var(--accent) 20%, transparent);
    border-color: var(--accent); color: var(--accent);
  }
  .task-check.completed {
    background: var(--accent); border-color: var(--accent); cursor: default;
    color: white;
  }
  .task-check:disabled { cursor: default; }
  .task-check.timer-locked { cursor: not-allowed; opacity: 0.5; }

  /* Body */
  .task-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.35rem; }
  .task-text { font-size: 0.8rem; color: var(--text-primary); line-height: 1.4; word-break: break-word; }

  .task-meta-row { display: flex; align-items: center; gap: 0.5rem; }

  .task-progress { display: flex; align-items: center; gap: 2px; font-size: 0.62rem; color: var(--text-tertiary); white-space: nowrap; }
  .task-progress .spent { font-weight: 700; }
  .task-progress .spent.accent { color: var(--accent); }
  .task-progress .sep, .task-progress .total { color: var(--text-tertiary); }
  .pomo-icon-sm { font-size: 0.62rem; margin-left: 2px; color: var(--text-tertiary); }

  .task-delete {
    width: 22px; height: 22px; border-radius: var(--radius-sm); background: transparent;
    color: var(--text-tertiary); display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; transition: background var(--transition-fast), color var(--transition-fast);
  }
  /* Auth gate */
  .auth-gate {
    display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;
    font-size: 0.72rem; color: var(--text-tertiary);
    background: var(--bg-elevated); border: 1px dashed var(--border-base);
    border-radius: var(--radius-md); padding: 0.5rem 0.75rem;
  }
  .auth-gate svg { flex-shrink: 0; opacity: 0.6; }

  .quick-suggestions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: -0.15rem;
  }
  .quick-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.3rem 0.6rem;
    border-radius: 999px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    color: var(--text-secondary);
    font-size: 0.7rem;
    font-weight: 600;
    cursor: pointer;
    transition: border-color var(--transition-fast), color var(--transition-fast), background var(--transition-fast), transform var(--transition-fast);
    max-width: 100%;
  }
  .quick-chip:hover {
    border-color: var(--accent);
    color: var(--accent);
    background: var(--accent-subtle);
    transform: translateY(-1px);
  }
  .quick-chip-icon { font-size: 0.7rem; opacity: 0.7; flex-shrink: 0; }
  .quick-chip-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 140px;
  }
  .quick-chip-dur {
    font-size: 0.62rem;
    opacity: 0.6;
    flex-shrink: 0;
  }
  .auth-gate-link {
    color: var(--accent); font-weight: 700; text-decoration: none;
    font-family: var(--font-mono); font-size: 0.68rem; letter-spacing: 0.05em;
  }
  .auth-gate-link:hover { text-decoration: underline; }
  .task-input:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-add:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn-add:disabled:hover { background: var(--accent); box-shadow: none; }

  @media (max-width: 600px) {
    .task-panel { width: 100%; max-width: 100%; height: auto; min-height: 420px; max-height: 70vh; }
    .quick-chip-text { max-width: 100px; }
  }
</style>