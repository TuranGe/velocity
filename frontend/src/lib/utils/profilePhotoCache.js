// Lightweight localStorage cache for the user's profile photo.
//
// Why this exists: ShareCard needs to show the profile photo "no
// matter what" — even if the backend save hasn't gone through yet,
// failed, or the user object hasn't refreshed. We cache the data URL
// locally the moment the user picks a photo, independent of any
// network round-trip, and ShareCard can read it as a guaranteed
// fallback.
import { browser } from '$app/environment';

const KEY = 'velocity-profile-photo';

export function getCachedProfilePhoto() {
  if (!browser) return '';
  try {
    return localStorage.getItem(KEY) || '';
  } catch {
    return '';
  }
}

export function setCachedProfilePhoto(dataUrl) {
  if (!browser) return;
  try {
    if (dataUrl) localStorage.setItem(KEY, dataUrl);
    else localStorage.removeItem(KEY);
  } catch {
    // localStorage full or unavailable — silently ignore, this is a
    // best-effort fallback, not the source of truth.
  }
}