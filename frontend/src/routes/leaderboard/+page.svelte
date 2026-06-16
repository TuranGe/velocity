<script>
  import { onMount, onDestroy } from 'svelte';
  import { fetchLeaderboard } from '$lib/stores/api';
  import { auth } from '$lib/stores/api';
  import UserAvatar from '$lib/components/UserAvatar.svelte';
  import { fly } from 'svelte/transition';

  let rows = [];
  let contextRows = [];
  let loading = false;
  let period = 'week';
  let search = '';
  let searchTimer;

  // Cache: stores results per period key so switching back is instant
  const cache = new Map();
  const CACHE_TTL = 60_000; // 1 minute

  // AbortController: cancels in-flight requests when period/search changes fast
  let abortController = null;

  const PERIODS = [
    { id: 'week',    label: 'This Week' },
    { id: 'month',   label: 'This Month' },
    { id: 'alltime', label: 'All Time' },
  ];

  const RANK_ICONS = { 1:'🥇', 2:'🥈', 3:'🥉' };

  onMount(() => load());
  onDestroy(() => abortController?.abort());

  async function load() {
    const cacheKey = `${period}:${search}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      rows = cached.rows;
      contextRows = cached.contextRows;
      return;
    }

    // Cancel any in-flight request
    abortController?.abort();
    abortController = new AbortController();

    loading = true;
    try {
      const data = await fetchLeaderboard({ period, limit: 15, search, signal: abortController.signal });
      rows = data.leaderboard;
      contextRows = data.context || [];
      cache.set(cacheKey, { rows, contextRows, ts: Date.now() });
    } catch(e) {
      if (e.name === 'AbortError') return; // request was intentionally cancelled
      if (rows.length === 0) { rows = []; contextRows = []; }
    }
    finally { loading = false; }
  }

  function onPeriodChange(p) {
    period = p;
    cache.delete(`${period}:${search}`); // bust cache for fresh data on explicit change
    load();
  }

  function onSearchInput() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      cache.delete(`${period}:${search}`);
      load();
    }, 350);
  }

  $: user = $auth.user;
  $: myRank = rows.findIndex(r => r.id === user?.id);

  // When the user doesn't appear in the top-15, fetch their own numbers
  // for the current period so the footer "you" row shows accurate data
  // instead of hardcoded zeros.
  let myStats = { sessions: 0, total_seconds: 0 };

  async function loadMyStats() {
    if (!user || myRank !== -1) return;
    try {
      const data = await fetchLeaderboard({ period, limit: 1, search: user.username });
      const me = (data.leaderboard || []).find(r => r.id === user.id);
      if (me) myStats = { sessions: me.sessions, total_seconds: me.total_seconds };
      else myStats = { sessions: 0, total_seconds: 0 };
    } catch { myStats = { sessions: 0, total_seconds: 0 }; }
  }

  $: if (user && myRank === -1 && !loading) loadMyStats();
</script>

<svelte:head><title>Leaderboard — Velocity</title></svelte:head>

<div class="page">
  <div class="page-header">
    <div>
      <span class="page-label font-mono">COMMUNITY</span>
      <h1 class="page-title">Global Leaderboard</h1>
      <p class="page-sub">This week's most focused developers</p>
    </div>
  </div>

  <!-- Controls -->
  <div class="controls">
    <div class="period-tabs">
      {#each PERIODS as p}
        <button class="period-tab font-mono" class:active={period===p.id}
          on:click={() => onPeriodChange(p.id)}>{p.label}</button>
      {/each}
    </div>

    <div class="search-wrap">
      <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input class="search-input" bind:value={search} on:input={onSearchInput} placeholder="Search users..." />
      {#if search}
        <button class="search-clear" on:click={() => { search=''; load(); }}>✕</button>
      {/if}
    </div>
  </div>

  <!-- Leaderboard table -->
  <div class="lb-card" class:lb-fetching={loading && rows.length > 0}>
    <div class="lb-header font-mono">
      <span>#</span>
      <span>User</span>
      <span class="text-right">Sessions</span>
      <span class="text-right">Hours</span>
    </div>

    {#if loading && rows.length === 0}
      {#each Array(8) as _}
        <div class="lb-skeleton vel-skel"></div>
      {/each}
    {:else if search && contextRows.length > 0}
      <!-- Contextual view when searching -->
      {#each contextRows as row (row.id)}
        <div class="lb-row"
          class:is-you={row.id === user?.id}
          class:is-match={row.isMatch}
          class:gold={row.rank===1} class:silver={row.rank===2} class:bronze={row.rank===3}
          in:fly={{ x: -16, duration: 250 }}>
          <span class="lb-rank font-mono">
            {RANK_ICONS[row.rank] || row.rank}
          </span>
          <div class="lb-user">
            <UserAvatar user={row} size={30} radius="8px" />
            <a class="lb-name" href={row.id === user?.id ? "/profile" : `/profile/${row.username}`}>{row.username}</a>
            {#if row.id === user?.id}<span class="you-tag font-mono">You</span>{/if}
            {#if row.isMatch}<span class="match-tag font-mono">👈</span>{/if}
          </div>
          <span class="lb-val font-mono text-right">{row.sessions}</span>
          <span class="lb-val font-mono text-right">{(row.total_seconds/3600).toFixed(1)}h</span>
        </div>
      {/each}
    {:else if rows.length === 0}
      <div class="lb-empty">
        {search ? `No users found for "${search}"` : 'No data yet'}
      </div>
    {:else}
      {#each rows as row, i (row.id)}
        <div class="lb-row"
          class:is-you={row.id === user?.id}
          class:gold={row.rank===1} class:silver={row.rank===2} class:bronze={row.rank===3}
          in:fly={{ x: -16, duration: 250, delay: i*30 }}>
          <span class="lb-rank font-mono">
            {RANK_ICONS[row.rank] || row.rank}
          </span>
          <div class="lb-user">
            <UserAvatar user={row} size={30} radius="8px" />
            <a class="lb-name" href={row.id === user?.id ? "/profile" : `/profile/${row.username}`}>{row.username}</a>
            {#if row.id === user?.id}<span class="you-tag font-mono">You</span>{/if}
          </div>
          <span class="lb-val font-mono text-right">{row.sessions}</span>
          <span class="lb-val font-mono text-right">{(row.total_seconds/3600).toFixed(1)}h</span>
        </div>
      {/each}

      <!-- Current user if not in top 15 -->
      {#if user && myRank === -1}
        <div class="lb-row is-you you-footer">
          <span class="lb-rank font-mono">–</span>
          <div class="lb-user">
            <UserAvatar user={user} size={30} radius="8px" />
            <a class="lb-name" href="/profile">{user.username}</a>
            <span class="you-tag font-mono">You</span>
          </div>
          <span class="lb-val font-mono text-right">{myStats.sessions}</span>
          <span class="lb-val font-mono text-right">{(myStats.total_seconds/3600).toFixed(1)}h</span>
        </div>
      {/if}
    {/if}
  </div>

  {#if !user}
    <div class="cta-bar">
      <p>Join the leaderboard — <a href="/">log in</a> and start focusing!</p>
    </div>
  {/if}
</div>

<style>
  .page { max-width: 720px; margin: 0 auto; padding: 3rem 2rem; display: flex; flex-direction: column; gap: 2rem; }

  .page-label { font-size: 0.65rem; font-weight: 700; letter-spacing: 0.2em; color: var(--accent); display: block; margin-bottom: 0.35rem; }
  .page-title { font-size: 2rem; font-weight: 800; letter-spacing: -0.03em; color: var(--text-primary); }
  .page-sub { font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.35rem; }

  .controls { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem; }

  .period-tabs { display: flex; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); overflow: hidden; }
  .period-tab { font-size: 0.65rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 0.4rem 0.9rem; border: none; background: transparent; color: var(--text-tertiary); transition: color 200ms ease, background 200ms ease, box-shadow 200ms ease; cursor: pointer; }
  .period-tab.active { background: var(--accent); color: white; box-shadow: inset 0 0 12px rgba(255,255,255,0.08); }
  .period-tab:hover:not(.active) { color: var(--text-secondary); background: var(--bg-elevated); }

  .search-wrap { position: relative; }
  .search-icon { position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); color: var(--text-tertiary); pointer-events: none; }
  .search-input { padding: 0.5rem 2rem 0.5rem 2.25rem; background: var(--bg-surface); border: 1px solid var(--border-base); border-radius: var(--radius-md); font-size: 0.82rem; color: var(--text-primary); outline: none; min-width: 220px; transition: border-color var(--transition-fast); }
  .search-input:focus { border-color: var(--accent); }
  .search-clear { position: absolute; right: 0.6rem; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--text-tertiary); font-size: 0.7rem; cursor: pointer; }
  .search-clear:hover { color: var(--text-primary); }

  .lb-card { background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-xl); overflow: hidden; transition: opacity 0.15s ease; }
  .lb-card.lb-fetching { opacity: 0.5; pointer-events: none; }

  .lb-header { display: grid; grid-template-columns: 48px 1fr 80px 80px; padding: 0.65rem 1.25rem; font-size: 0.6rem; letter-spacing: 0.15em; text-transform: uppercase; color: var(--text-tertiary); border-bottom: 1px solid var(--border-subtle); }

  .lb-row { display: grid; grid-template-columns: 48px 1fr 80px 80px; align-items: center; padding: 0.85rem 1.25rem; min-height: 56px; border-bottom: 1px solid var(--border-subtle); transition: background var(--transition-fast); }
  .lb-row:last-child { border-bottom: none; }
  .lb-row:hover { background: var(--accent-subtle); }
  .lb-row.gold { background: rgba(251,191,36,0.06); }
  .lb-row.is-you { background: var(--accent-subtle); }
  .lb-row.is-match { background: color-mix(in srgb, var(--accent) 12%, var(--bg-surface)); outline: 1px solid var(--accent); }
  .lb-row.you-footer { border-top: 1px dashed var(--accent); }

  .lb-rank { font-size: 0.9rem; color: var(--text-tertiary); }
  .lb-user { display: flex; align-items: center; gap: 0.5rem; overflow: hidden; }
  .lb-name { font-size: 0.82rem; font-weight: 600; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-decoration: none; }
  .lb-name:hover { color: var(--accent); }
  .lb-val { font-size: 0.78rem; color: var(--text-secondary); }
  .text-right { text-align: right; }

  .you-tag { font-size: 0.5rem; padding: 1px 5px; border-radius: 4px; color: var(--accent); border: 1px solid var(--accent); background: var(--accent-subtle); letter-spacing: 0.1em; text-transform: uppercase; flex-shrink: 0; }
  .match-tag { font-size: 0.5rem; padding: 1px 5px; border-radius: 4px; color: #22c55e; border: 1px solid #22c55e; letter-spacing: 0.1em; text-transform: uppercase; flex-shrink: 0; }

  .lb-skeleton { height: 56px; }
  /* vel-shimmer keyframe is defined globally in app.css */

  .lb-empty { padding: 3rem; text-align: center; color: var(--text-tertiary); font-size: 0.85rem; }

  .cta-bar { text-align: center; padding: 1.25rem; background: var(--accent-subtle); border: 1px solid var(--accent); border-radius: var(--radius-md); font-size: 0.85rem; color: var(--text-secondary); }
  .cta-bar a { color: var(--accent); font-weight: 600; }

  @media (max-width: 520px) {
    .page { padding: 2rem 1rem; }
    .controls { flex-direction: column; align-items: stretch; }
    .search-input { width: 100%; min-width: unset; }
    .lb-header, .lb-row { grid-template-columns: 40px 1fr 60px 60px; padding: 0.75rem 1rem; }
  }
</style>