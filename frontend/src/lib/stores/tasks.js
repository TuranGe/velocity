import { writable } from 'svelte/store';
import { browser } from '$app/environment';

function createTasksStore() {
  const load = () => {
    if (!browser) return [];
    try {
      const raw = JSON.parse(localStorage.getItem('velocity-tasks') || '[]');
      // Sanitize on load — fix any NaN/undefined that crept in previously
      return raw.map(t => ({
        ...t,
        spentMinutes:   isFinite(t.spentMinutes)   ? t.spentMinutes   : 0,
        durationMinutes: isFinite(t.durationMinutes) ? t.durationMinutes
                        : isFinite(t.pomodoros)      ? t.pomodoros
                        : 25,
      }));
    } catch { return []; }
  };

  const { subscribe, set, update } = writable(load());

  function persist(tasks) {
    if (browser) localStorage.setItem('velocity-tasks', JSON.stringify(tasks));
  }

  function safeDuration(t) {
    const d = t.durationMinutes ?? t.pomodoros;
    return isFinite(d) && d > 0 ? d : 25;
  }

  return {
    subscribe,

    add(text, durationMinutes = 25) {
      update(tasks => {
        const next = [...tasks, {
          id: crypto.randomUUID(),
          text,
          done: false,
          selected: false,
          durationMinutes: Math.max(1, durationMinutes),
          spentMinutes: 0,
          createdAt: Date.now(),
        }];
        persist(next); return next;
      });
    },

    addFromRemote(task) {
      update(tasks => {
        if (tasks.find(t => t.id === task.id)) return tasks;
        const dur = task.durationMinutes ?? task.pomodoros;
        const next = [{
          ...task,
          selected: false,
          durationMinutes: isFinite(dur) && dur > 0 ? dur : 25,
          spentMinutes: isFinite(task.spentMinutes) ? task.spentMinutes : 0,
        }, ...tasks];
        persist(next); return next;
      });
    },

    setFromRemote(remoteTasks) {
      update(local => {
        const selectedIds = new Set(local.filter(t => t.selected).map(t => t.id));
        const merged = remoteTasks.map(t => {
          const dur = t.durationMinutes ?? t.pomodoros;
          return {
            ...t,
            selected: selectedIds.has(t.id),
            durationMinutes: isFinite(dur) && dur > 0 ? dur : 25,
            spentMinutes: isFinite(t.spentMinutes) ? t.spentMinutes : 0,
          };
        });
        persist(merged);
        return merged;
      });
    },

    toggleSelected(id) {
      update(tasks => {
        const next = tasks.map(t => t.id === id ? { ...t, selected: !t.selected } : t);
        persist(next); return next;
      });
    },

    // Called on session completion — add elapsed seconds to selected tasks
    // This only marks done if interval-based auto-complete hasn't already done so
    addTime(elapsedSeconds) {
      const secs = isFinite(elapsedSeconds) && elapsedSeconds > 0 ? elapsedSeconds : 0;
      if (secs === 0) return;
      const elapsedMinutes = secs / 60;
      update(tasks => {
        const next = tasks.map(t => {
          if (!t.selected || t.done) return t;
          const prev = isFinite(t.spentMinutes) ? t.spentMinutes : 0;
          const spentMinutes = prev + elapsedMinutes;
          const target = safeDuration(t);
          const done = spentMinutes >= target;
          return { ...t, spentMinutes, done, selected: done ? false : t.selected };
        });
        persist(next); return next;
      });
    },

    // Add incremental time (called every minute while timer runs)
    addIncrementalTime(minutes) {
      const mins = isFinite(minutes) && minutes > 0 ? minutes : 0;
      if (mins === 0) return;
      update(tasks => {
        const next = tasks.map(t => {
          if (!t.selected || t.done) return t;
          const prev = isFinite(t.spentMinutes) ? t.spentMinutes : 0;
          const spentMinutes = prev + mins;
          return { ...t, spentMinutes };
        });
        persist(next); return next;
      });
    },

    remove(id) {
      update(tasks => { const next = tasks.filter(t => t.id !== id); persist(next); return next; });
    },

    markDone(id) {
      update(tasks => {
        const next = tasks.map(t => t.id === id ? { ...t, done: true, selected: false } : t);
        persist(next); return next;
      });
    },

    clear() { set([]); if (browser) localStorage.removeItem('velocity-tasks'); },
  };
}

export const tasks = createTasksStore();