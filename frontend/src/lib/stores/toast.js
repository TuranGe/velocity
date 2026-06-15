import { writable } from 'svelte/store';

const { subscribe, update } = writable([]);

export const toast = {
  subscribe,
  show(message, type = 'info', duration = 3500, code = null, action = null) {
    const id = Math.random().toString(36).slice(2);
    update(t => [...t, { id, message, type, code, action }]);
    if (duration > 0) {
      setTimeout(() => update(t => t.filter(x => x.id !== id)), duration);
    }
    return id;
  },
  success(msg, duration) { return this.show(msg, 'success', duration); },
  error(msg, duration, code = null) { return this.show(msg, 'error', duration || 5000, code); },
  info(msg, duration) { return this.show(msg, 'info', duration); },
  warn(msg, duration) { return this.show(msg, 'warn', duration); },
  // action: { label, onClick } — shows an extra button on the toast.
  // Pass duration = 0 to keep it until the user interacts with it.
  withAction(msg, action, type = 'info', duration = 0) {
    return this.show(msg, type, duration, null, action);
  },
  dismiss(id) { update(t => t.filter(x => x.id !== id)); },
};