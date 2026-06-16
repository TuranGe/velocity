import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// When should the "Your week in focus" recap modal be eligible to show?
// Stored as a set of JS Date.getDay() values (0=Sun .. 6=Sat).
const STORAGE_KEY = 'velocity-recap-days';

export const RECAP_PRESETS = {
  weekend:     { label: 'Weekend (Sat–Sun)',       days: [6, 0] },
  sunday:      { label: 'Sunday only',              days: [0] },
  fri_weekend: { label: 'Friday evening onward',   days: [5, 6, 0] },
};

function load() {
  if (!browser) return 'weekend';
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v && RECAP_PRESETS[v] ? v : 'weekend';
  } catch { return 'weekend'; }
}

function createRecapStore() {
  const { subscribe, set } = writable(load());
  return {
    subscribe,
    setPreset(key) {
      if (!RECAP_PRESETS[key]) return;
      if (browser) localStorage.setItem(STORAGE_KEY, key);
      set(key);
    },
  };
}

export const weeklyRecapPreset = createRecapStore();

export function isRecapDay(date, presetKey) {
  const preset = RECAP_PRESETS[presetKey] || RECAP_PRESETS.weekend;
  return preset.days.includes(date.getDay());
}