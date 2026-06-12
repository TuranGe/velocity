import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const STORAGE_KEY = 'velocity-weekly-goal';
const DEFAULT_GOAL_MINUTES = 300; // 5 hours/week default

function load() {
  if (!browser) return DEFAULT_GOAL_MINUTES;
  try {
    const v = parseInt(localStorage.getItem(STORAGE_KEY), 10);
    return isFinite(v) && v > 0 ? v : DEFAULT_GOAL_MINUTES;
  } catch { return DEFAULT_GOAL_MINUTES; }
}

function createWeeklyGoalStore() {
  const { subscribe, set } = writable(load());

  return {
    subscribe,
    setGoal(minutes) {
      const val = Math.max(15, Math.min(10080, Math.round(minutes)));
      if (browser) localStorage.setItem(STORAGE_KEY, String(val));
      set(val);
    },
  };
}

export const weeklyGoal = createWeeklyGoalStore();