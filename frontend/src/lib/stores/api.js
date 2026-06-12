import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

export const API_URL = 'http://localhost:3717';

// ─── Auth store ──────────────────────────────────────────────
function createAuthStore() {
  const storedUser  = browser ? localStorage.getItem('velocity-user')  : null;
  const storedToken = browser ? localStorage.getItem('velocity-token') : null;
  const { subscribe, set, update } = writable({
    user:  storedUser  ? JSON.parse(storedUser)  : null,
    token: storedToken || null,
  });

  function persist(user, token) {
    if (!browser) return;
    if (user)  localStorage.setItem('velocity-user',  JSON.stringify(user));
    else       localStorage.removeItem('velocity-user');
    if (token) localStorage.setItem('velocity-token', token);
    else       localStorage.removeItem('velocity-token');
  }

  return {
    subscribe,
    async register(username, email, password) {
      const data = await apiFetch('/api/auth/register', { method:'POST', body: JSON.stringify({username,email,password}) });
      persist(data.user, data.token);
      set({ user: data.user, token: data.token });
      return data.user;
    },
    async login(email, password) {
      const data = await apiFetch('/api/auth/login', { method:'POST', body: JSON.stringify({email,password}) });
      persist(data.user, data.token);
      set({ user: data.user, token: data.token });
      return data.user;
    },
    async oauth(provider, provider_id, email, username, profile_image) {
      const data = await apiFetch('/api/auth/oauth', { method:'POST', body: JSON.stringify({provider,provider_id,email,username,profile_image}) });
      persist(data.user, data.token);
      set({ user: data.user, token: data.token });
      return data.user;
    },
    async updateProfile(updates) {
      const token = get({ subscribe }).token;
      const data = await apiFetch('/api/auth/me', { method:'PATCH', body: JSON.stringify(updates), token });
      persist(data.user, data.token);
      set({ user: data.user, token: data.token });
      return data.user;
    },
    async linkProvider(provider, provider_id, discord_id) {
      const token = get({ subscribe }).token;
      const data = await apiFetch('/api/auth/link', { method:'POST', body: JSON.stringify({ provider, provider_id, discord_id }), token });
      persist(data.user, data.token);
      set({ user: data.user, token: data.token });
      return data.user;
    },
    async refresh() {
      const token = get({ subscribe }).token;
      if (!token) return;
      try {
        const data = await apiFetch('/api/auth/me', { token });
        if (!data.user) { this.logout(); return; }
        persist(data.user, token);
        update(s => ({ ...s, user: data.user }));
      } catch {
        // Token invalid, expired, or user no longer exists (e.g. stale
        // localStorage pointing at a deleted account) — log out cleanly
        // so the UI doesn't claim the user is signed in.
        this.logout();
      }
    },
    logout() {
      persist(null, null);
      set({ user: null, token: null });
    },
  };
}
export const auth = createAuthStore();

// Convenience derived
export const currentUser = { subscribe: (fn) => auth.subscribe(s => fn(s.user)) };

// ─── API fetch helper ─────────────────────────────────────────
export async function apiFetch(path, opts = {}) {
  const { token, ...fetchOpts } = opts;
  const headers = { 'Content-Type': 'application/json', ...(fetchOpts.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, { ...fetchOpts, headers });

  let data = null;
  try { data = await res.json(); } catch { /* empty or non-JSON body */ }

  if (!res.ok) {
    // Stale/invalid token (e.g. leftover localStorage from a deleted account) —
    // clear local auth state so the UI stops thinking we're logged in.
    if (res.status === 401 && token) auth.logout();
    const error = new Error(data?.error || `API error ${res.status}`);
    error.code = data?.code || `ERR_${res.status}`;
    throw error;
  }
  return data ?? {};
}

// Helper to get current token
export function getToken() {
  if (!browser) return null;
  return localStorage.getItem('velocity-token');
}

export function authedFetch(path, opts = {}) {
  return apiFetch(path, { ...opts, token: getToken() });
}

// ─── Leaderboard ─────────────────────────────────────────────
export async function fetchLeaderboard({ period = 'week', limit = 15, search = '', offset = 0 } = {}) {
  let url = `/api/leaderboard?period=${period}&limit=${limit}&offset=${offset}`;
  if (search) url += `&search=${encodeURIComponent(search)}`;
  return apiFetch(url, { token: getToken() });
}

// ─── Sessions ────────────────────────────────────────────────
export async function recordSession(mode = 'focus', duration = 1500) {
  return authedFetch('/api/sessions', { method:'POST', body: JSON.stringify({mode,duration}) });
}
export async function fetchMySessions() {
  return authedFetch('/api/sessions/me');
}

// ─── Tasks ───────────────────────────────────────────────────
export async function fetchRemoteTasks(type) {
  let url = '/api/tasks';
  if (type) url += `?type=${type}`;
  return authedFetch(url);
}
export async function createRemoteTask(text, pomodoros, team_id, type = 'personal') {
  return authedFetch('/api/tasks', { method:'POST', body: JSON.stringify({text,pomodoros,team_id,type}) });
}
export async function updateRemoteTask(id, updates) {
  return authedFetch(`/api/tasks/${id}`, { method:'PATCH', body: JSON.stringify(updates) });
}
export async function deleteRemoteTask(id) {
  return authedFetch(`/api/tasks/${id}`, { method:'DELETE' });
}

// ─── Teams ───────────────────────────────────────────────────
export async function fetchTeams({ category, limit } = {}) {
  let url = '/api/teams';
  const p = new URLSearchParams();
  if (category) p.set('category', category);
  if (limit)    p.set('limit', limit);
  if ([...p].length) url += '?' + p.toString();
  return apiFetch(url, { token: getToken() });
}
export async function fetchTeam(teamId) {
  return apiFetch(`/api/teams/${teamId}`, { token: getToken() });
}
export async function createTeam(name, color, category) {
  return authedFetch('/api/teams', { method:'POST', body: JSON.stringify({name,color,category}) });
}
export async function joinTeamByCode(invite_code) {
  return authedFetch('/api/teams/join', { method:'POST', body: JSON.stringify({invite_code}) });
}
export async function leaveTeam(teamId) {
  return authedFetch(`/api/teams/${teamId}/leave`, { method:'DELETE' });
}
export async function deleteTeam(teamId) {
  return authedFetch(`/api/teams/${teamId}`, { method:'DELETE' });
}
export async function transferLeadership(teamId, new_leader_id) {
  return authedFetch(`/api/teams/${teamId}/transfer`, { method:'POST', body: JSON.stringify({new_leader_id}) });
}
export async function updateMemberRole(teamId, userId, role) {
  return authedFetch(`/api/teams/${teamId}/members/${userId}/role`, { method:'PATCH', body: JSON.stringify({role}) });
}
export async function kickMember(teamId, userId) {
  return authedFetch(`/api/teams/${teamId}/members/${userId}`, { method:'DELETE' });
}
export async function fetchTeamTasks(teamId) {
  return authedFetch(`/api/teams/${teamId}/tasks`);
}
