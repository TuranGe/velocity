import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const stored = (browser && localStorage.getItem('velocity-audio')) 
  ? JSON.parse(localStorage.getItem('velocity-audio'))
  : { volume: 0.06, enabled: true };

const { subscribe, set, update } = writable(stored);

export const audio = {
  subscribe,
  setVolume(vol) {
    update(s => {
      const newState = { ...s, volume: Math.max(0, Math.min(1, vol)) };
      if (browser) localStorage.setItem('velocity-audio', JSON.stringify(newState));
      return newState;
    });
  },
  setEnabled(enabled) {
    update(s => {
      const newState = { ...s, enabled };
      if (browser) localStorage.setItem('velocity-audio', JSON.stringify(newState));
      return newState;
    });
  },
};
