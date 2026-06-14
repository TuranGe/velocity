import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

// Default durations — mutable, user can override
export const DURATIONS = {
  'focus':       25 * 60,
  'short-break':  5 * 60,
  'long-break':  15 * 60,
  'custom':      25 * 60,
};

export const LABELS = {
  'focus':       'FOCUS',
  'short-break': 'SHORT BREAK',
  'long-break':  'LONG BREAK',
  'custom':      'CUSTOM',
};

function loadStats() {
  if (!browser) return {};
  try { return JSON.parse(localStorage.getItem('velocity-timer-stats') || '{}'); } catch { return {}; }
}

function createTimerStore() {
  const saved = loadStats();
  const { subscribe, set, update } = writable({
    mode: 'focus', status: 'idle',
    remaining: DURATIONS['focus'], elapsed: 0, session: saved.session ?? 1,
    totalFocusTime: saved.totalFocusTime ?? 0,
    completedSessions: saved.completedSessions ?? 0,
    lastCompleted: null, // { mode, duration } — set on natural completion
    suggestLongBreak: false, // true right after the 4th focus session completes
  });
  let interval = null;
  // Wall-clock anchor for the current run — lets us correct for any
  // drift caused by browsers throttling setInterval in background tabs.
  let lastTickAt = null;

  function saveStats(s) {
    if (!browser) return;
    // Only persist the pomodoro cycle counter (1–4) — session counts and
    // focus time are the DB's source of truth via userStats store.
    localStorage.setItem('velocity-timer-stats', JSON.stringify({
      session: s.session,
    }));
  }

  function clearTick() { if (interval) { clearInterval(interval); interval = null; } lastTickAt = null; }

  // Apply `n` whole seconds of elapsed time in one go. Used both by the
  // regular 1s ticker and by the visibility-resync catch-up.
  function applySeconds(n) {
    if (n <= 0) return;
    update(s => {
      if (s.status !== 'running') return s;

      let remaining = s.remaining - n;
      let elapsed = s.elapsed + n;
      let totalFocusTime = s.totalFocusTime + n;

      if (remaining <= 0) {
        // Clamp elapsed/focus time so a long background gap doesn't
        // over-count past the session's actual duration.
        const overshoot = -remaining;
        elapsed -= overshoot;
        totalFocusTime -= overshoot;
        clearTick();
        const completedSessions = s.completedSessions + 1;

        // Classic Pomodoro cycle: after every 4th completed focus
        // session, suggest a long break and reset the cycle counter.
        let session = s.session;
        let suggestLongBreak = false;
        if (s.mode === 'focus') {
          if (session >= 4) {
            session = 1;
            suggestLongBreak = true;
          } else {
            session += 1;
          }
        }

        const next = {
          ...s, remaining: 0, elapsed, status: 'completed',
          totalFocusTime, completedSessions, session, suggestLongBreak,
          lastCompleted: { mode: s.mode, duration: elapsed },
        };
        saveStats(next);
        return next;
      }

      const next = { ...s, remaining, elapsed, totalFocusTime };
      saveStats(next);
      return next;
    });
  }

  function tick() {
    const now = Date.now();
    const elapsedMs = lastTickAt ? now - lastTickAt : 1000;
    // Normally this is ~1 (one second per tick). If the tab was
    // throttled/suspended, elapsedMs can be much larger — catch up by
    // applying however many whole seconds actually passed.
    const wholeSeconds = Math.max(1, Math.round(elapsedMs / 1000));
    lastTickAt = now;
    applySeconds(wholeSeconds);
  }

  // Resync immediately when the tab regains visibility, so the
  // countdown doesn't visibly "jump" only on the next tick.
  if (browser) {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && interval && lastTickAt) {
        tick();
      }
    });
  }

  return {
    subscribe, DURATIONS, LABELS,
    start()  { clearTick(); update(s => ({ ...s, status: 'running' })); lastTickAt = Date.now(); interval = setInterval(tick, 1000); },
    pause()  { clearTick(); update(s => { const next = { ...s, status: 'paused' }; saveStats(next); return next; }); },
    reset()  { clearTick(); update(s => { const next = { ...s, status: 'idle', remaining: DURATIONS[s.mode], elapsed: 0 }; saveStats(next); return next; }); },
    setMode(mode) {
      clearTick();
      update(s => {
        const next = { ...s, mode, status: 'idle', remaining: DURATIONS[mode], elapsed: 0 };
        saveStats(next); return next;
      });
    },
    // Set a custom duration in minutes for any mode
    setDuration(mode, minutes) {
      const secs = Math.max(1, minutes) * 60;
      DURATIONS[mode] = secs;
      update(s => s.mode === mode ? { ...s, remaining: secs, elapsed: 0, status: 'idle' } : s);
    },
    clearLastCompleted() { update(s => ({ ...s, lastCompleted: null })); },
    clearLongBreakSuggestion() { update(s => ({ ...s, suggestLongBreak: false })); },
    destroy() { clearTick(); },
  };
}

export const timer = createTimerStore();
export const progress = derived(timer, $t => $t.elapsed / (DURATIONS[$t.mode] || 1));
export const timeDisplay = derived(timer, $t => {
  const m = Math.floor($t.remaining / 60).toString().padStart(2, '0');
  const s = ($t.remaining % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
});