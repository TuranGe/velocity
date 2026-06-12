import { writable } from 'svelte/store';

const { subscribe, update } = writable([]);

export const toast = {
  subscribe,
  show(message, type = 'info', duration = 3500, code = null) {
    const id = Math.random().toString(36).slice(2);
    update(t => [...t, { id, message, type, code }]);
    setTimeout(() => update(t => t.filter(x => x.id !== id)), duration);
    return id;
  },
  success(msg, duration) { return this.show(msg, 'success', duration); },
  error(msg, duration, code = null)   { return this.show(msg, 'error',   duration || 5000, code); },
  info(msg, duration)    { return this.show(msg, 'info',    duration); },
  warn(msg, duration)    { return this.show(msg, 'warn',    duration); },
  dismiss(id)            { update(t => t.filter(x => x.id !== id)); },
};
