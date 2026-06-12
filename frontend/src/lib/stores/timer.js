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
    remaining: DURATIONS['focus'], elapsed: 0, session: 1,
    totalFocusTime: saved.totalFocusTime ?? 0,
    completedSessions: saved.completedSessions ?? 0,
    lastCompleted: null, // { mode, duration } — set on natural completion
  });
  let interval = null;

  function saveStats(s) {
    if (!browser) return;
    localStorage.setItem('velocity-timer-stats', JSON.stringify({
      totalFocusTime: s.totalFocusTime,
      completedSessions: s.completedSessions,
    }));
  }

  function clearTick() { if (interval) { clearInterval(interval); interval = null; } }

  function tick() {
    update(s => {
      if (s.status !== 'running') { clearTick(); return s; }
      const remaining = s.remaining - 1;
      const elapsed   = s.elapsed + 1;
      // ALL modes count as focused time
      const totalFocusTime = s.totalFocusTime + 1;

      if (remaining <= 0) {
        clearTick();
        const completedSessions = s.completedSessions + 1;
        const next = {
          ...s, remaining: 0, elapsed, status: 'completed',
          totalFocusTime, completedSessions,
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

  return {
    subscribe, DURATIONS, LABELS,
    start()  { clearTick(); update(s => ({ ...s, status: 'running' })); interval = setInterval(tick, 1000); },
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
