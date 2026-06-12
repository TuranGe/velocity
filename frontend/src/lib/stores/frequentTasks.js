import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const STORAGE_KEY = 'velocity-frequent-tasks';

function load() {
  if (!browser) return [];
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}

function persist(items) {
  if (browser) localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function createFrequentTasksStore() {
  const { subscribe, update } = writable(load());

  return {
    subscribe,

    // Record a usage of a task text (case-insensitive dedup, keep original casing of first use)
    record(text, durationMinutes) {
      const norm = text.trim().toLowerCase();
      if (!norm) return;
      update(items => {
        const existing = items.find(i => i.norm === norm);
        let next;
        if (existing) {
          next = items.map(i => i.norm === norm
            ? { ...i, count: i.count + 1, lastUsed: Date.now(), durationMinutes: durationMinutes ?? i.durationMinutes }
            : i);
        } else {
          next = [...items, {
            norm,
            text: text.trim(),
            count: 1,
            lastUsed: Date.now(),
            durationMinutes: durationMinutes ?? 25,
          }];
        }
        // Keep top 30 to avoid unbounded growth
        next = next.sort((a, b) => b.count - a.count).slice(0, 30);
        persist(next);
        return next;
      });
    },

    remove(norm) {
      update(items => {
        const next = items.filter(i => i.norm !== norm);
        persist(next);
        return next;
      });
    },

    clear() {
      update(() => { persist([]); return []; });
    },
  };
}

export const frequentTasks = createFrequentTasksStore();