import { browser } from '$app/environment';
import { writable, get } from 'svelte/store';

const STORAGE_KEY = 'velocity-notifications-enabled';

function loadPref() {
  if (!browser) return false;
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

export const notificationsEnabled = writable(loadPref());

export function isNotificationSupported() {
  return browser && 'Notification' in window;
}

export function getPermission() {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

export async function requestNotificationPermission() {
  if (!isNotificationSupported()) return 'unsupported';
  if (Notification.permission === 'granted') {
    notificationsEnabled.set(true);
    if (browser) localStorage.setItem(STORAGE_KEY, 'true');
    return 'granted';
  }
  const result = await Notification.requestPermission();
  const enabled = result === 'granted';
  notificationsEnabled.set(enabled);
  if (browser) localStorage.setItem(STORAGE_KEY, String(enabled));
  return result;
}

export function setNotificationsEnabled(enabled) {
  notificationsEnabled.set(enabled);
  if (browser) localStorage.setItem(STORAGE_KEY, String(enabled));
}

const MODE_MESSAGES = {
  'focus':       { title: '🎯 Focus session complete!', body: 'Great work! Time for a short break.' },
  'short-break': { title: '☕ Break over',              body: 'Refreshed? Head back to your focus session.' },
  'long-break':  { title: '🌿 Long break over',         body: 'Start a new focus session whenever you\'re ready.' },
  'custom':      { title: '⏱ Session complete!',        body: 'Your session has ended.' },
};

// Show a notification when a timer session completes.
// Only fires if permission granted AND the tab is hidden (background)
// — when tab is visible, the in-app animation is enough.
export function notifyTimerComplete(mode) {
  if (!isNotificationSupported()) return;
  if (Notification.permission !== 'granted') return;
  // Respect the in-app toggle — browser permission being "granted"
  // doesn't mean the user wants notifications right now; they may have
  // turned the in-app setting back off.
  if (!get(notificationsEnabled)) return;
  if (document.visibilityState === 'visible') return;

  const msg = MODE_MESSAGES[mode] || MODE_MESSAGES['custom'];
  try {
    const n = new Notification(msg.title, {
      body: msg.body,
      icon: '/favicon.png',
      badge: '/favicon.png',
      tag: 'velocity-timer',
      requireInteraction: false,
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
    setTimeout(() => n.close(), 8000);
  } catch {}
}

// Notify when a task is auto-completed during a session
export function notifyTaskComplete(taskText) {
  if (!isNotificationSupported()) return;
  if (Notification.permission !== 'granted') return;
  if (!get(notificationsEnabled)) return;
  if (document.visibilityState === 'visible') return;

  try {
    const n = new Notification('✅ Task complete!', {
      body: taskText,
      icon: '/favicon.png',
      tag: 'velocity-task',
    });
    n.onclick = () => { window.focus(); n.close(); };
    setTimeout(() => n.close(), 6000);
  } catch {}
}

// Notify after 4 completed focus sessions — classic Pomodoro cue to
// take a longer break.
export function notifyLongBreakSuggestion() {
  if (!isNotificationSupported()) return;
  if (Notification.permission !== 'granted') return;
  if (!get(notificationsEnabled)) return;
  if (document.visibilityState === 'visible') return;

  try {
    const n = new Notification('🎉 4 sessions complete!', {
      body: 'Time to take a long break.',
      icon: '/favicon.png',
      tag: 'velocity-long-break',
    });
    n.onclick = () => { window.focus(); n.close(); };
    setTimeout(() => n.close(), 8000);
  } catch {}
}