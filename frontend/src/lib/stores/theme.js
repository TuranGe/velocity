import { writable } from 'svelte/store';
import { browser } from '$app/environment';

function createThemeStore() {
  const getInitialTheme = () => {
    if (!browser) return 'dark';
    const saved = localStorage.getItem('velocity-theme');
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };

  const { subscribe, set, update } = writable(getInitialTheme());

  return {
    subscribe,
    toggle: () => update(current => {
      const next = current === 'dark' ? 'light' : 'dark';
      if (browser) {
        localStorage.setItem('velocity-theme', next);
        document.documentElement.setAttribute('data-theme', next);
      }
      return next;
    }),
    set: (theme) => {
      if (browser) {
        localStorage.setItem('velocity-theme', theme);
        document.documentElement.setAttribute('data-theme', theme);
      }
      set(theme);
    },
    init: () => {
      if (!browser) return;
      const theme = getInitialTheme();
      document.documentElement.setAttribute('data-theme', theme);
      set(theme);
    }
  };
}

export const theme = createThemeStore();
