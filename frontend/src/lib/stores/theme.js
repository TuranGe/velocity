import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// Briefly blocks all transitions during theme switch so GSAP animations
// and other in-progress transitions don't fight the colour change.
function freezeTransitions() {
  if (!browser) return;
  document.documentElement.classList.add('no-theme-transition');
  // One rAF to let the class apply, then remove it after transitions complete
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.documentElement.classList.remove('no-theme-transition');
    });
  });
}

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
      // Suppress the colour transition on initial page load so the
      // theme is applied instantly rather than fading in from default.
      freezeTransitions();
      document.documentElement.setAttribute('data-theme', theme);
      set(theme);
    }
  };
}

export const theme = createThemeStore();