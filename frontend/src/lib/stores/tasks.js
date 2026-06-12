import { writable } from 'svelte/store';
import { browser } from '$app/environment';

function createTasksStore() {
  const load = () => {
    if (!browser) return [];
    try { return JSON.parse(localStorage.getItem('velocity-tasks') || '[]'); }
    catch { return []; }
  };

  const { subscribe, set, update } = writable(load());

  function persist(tasks) {
    if (browser) localStorage.setItem('velocity-tasks', JSON.stringify(tasks));
  }

  return {
    subscribe,

    // durationMinutes: how many total minutes the task requires
    // pomodoros: how many timer completions needed (auto-calculated or manual)
    add(text, durationMinutes = 25) {
      update(tasks => {
        const next = [...tasks, {
          id: crypto.randomUUID(),
          text,
          done: false,
          selected: false,
          durationMinutes,       // total target minutes
          spentMinutes: 0,       // minutes accumulated so far
          createdAt: Date.now(),
        }];
        persist(next); return next;
      });
    },

    addFromRemote(task) {
      update(tasks => {
        if (tasks.find(t => t.id === task.id)) return tasks;
        const next = [{ ...task, selected: task.selected ?? false }, ...tasks];
        persist(next); return next;
      });
    },

    setFromRemote(remoteTasks) {
      update(local => {
        const selectedIds = new Set(local.filter(t => t.selected).map(t => t.id));
        const merged = remoteTasks.map(t => ({ ...t, selected: selectedIds.has(t.id) }));
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

    // Called when any timer session completes — add elapsed seconds to selected tasks
    addTime(elapsedSeconds) {
      update(tasks => {
        const elapsedMinutes = elapsedSeconds / 60;
        const next = tasks.map(t => {
          if (!t.selected || t.done) return t;
          const spentMinutes = t.spentMinutes + elapsedMinutes;
          const done = spentMinutes >= t.durationMinutes;
          return { ...t, spentMinutes, done, selected: done ? false : t.selected };
        });
        persist(next); return next;
      });
    },

    remove(id) {
      update(tasks => { const next = tasks.filter(t => t.id !== id); persist(next); return next; });
    },

    clear() { set([]); if (browser) localStorage.removeItem('velocity-tasks'); },
  };
}

export const tasks = createTasksStore();
