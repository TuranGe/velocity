<script>
  import { onMount, onDestroy } from "svelte";
  import Timer from "$lib/components/Timer.svelte";
  import TaskPanel from "$lib/components/TaskPanel.svelte";
  import ParticleCanvas from "$lib/components/ParticleCanvas.svelte";
  import { initGSAP } from "$lib/utils/gsap";
  import { timer } from "$lib/stores/timer";
  import {
    auth,
    userStats,
    fetchLeaderboard,
    fetchTeams,
    joinTeamByCode,
  } from "$lib/stores/api";
  import { toast } from "$lib/stores/toast";
  import { browser } from "$app/environment";
  import { fly } from "svelte/transition";
  import UserAvatar from "$lib/components/UserAvatar.svelte";

  let taglineEl, gsap, ScrollTrigger;
  let leaderboard = [],
    teams = [];
  let lbPeriod = "week";
  let lbLoading = true,
    teamsLoading = true;

  // Cache leaderboard results per period — switching back is instant
  const lbCache = new Map();
  const LB_CACHE_TTL = 60_000;
  let lbAbort = null;

  $: user = $auth.user;

  const CATEGORY_ICONS = {
    general: "⚡",
    productivity: "🎯",
    study: "📚",
    work: "💼",
    gaming: "🎮",
    social: "🤝",
  };

  onMount(async () => {
    ({ gsap, ScrollTrigger } = await initGSAP());

    if (taglineEl) {
      const text = taglineEl.textContent ?? "";
      taglineEl.textContent = "";
      gsap.to(taglineEl, {
        duration: text.length * 0.04,
        text: { value: text, delimiter: "" },
        ease: "none",
        delay: 0.3,
      });
    }

    gsap.set(".feature-card", { opacity: 0, y: 40, scale: 0.95 });
    document.querySelectorAll(".feature-card").forEach((el, i) => {
      ScrollTrigger.create({
        trigger: el,
        start: "top 88%",
        once: true,
        onEnter: () =>
          gsap.to(el, {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.7,
            ease: "power3.out",
            delay: i * 0.1,
          }),
      });
    });

    await Promise.all([loadLeaderboard(), loadTeams()]);
  });

  async function loadLeaderboard() {
    const cached = lbCache.get(lbPeriod);
    if (cached && Date.now() - cached.ts < LB_CACHE_TTL) {
      leaderboard = cached.data;
      lbLoading = false;
      return;
    }
    lbAbort?.abort();
    lbAbort = new AbortController();
    lbLoading = true;
    try {
      const d = await fetchLeaderboard({ period: lbPeriod, limit: 15, signal: lbAbort.signal });
      leaderboard = d.leaderboard;
      lbCache.set(lbPeriod, { data: leaderboard, ts: Date.now() });
    } catch(e) {
      if (e.name === 'AbortError') return;
      if (leaderboard.length === 0) leaderboard = [];
    } finally {
      lbLoading = false;
    }
  }

  onDestroy(() => lbAbort?.abort());

  async function loadTeams() {
    teamsLoading = true;
    try {
      const d = await fetchTeams({ limit: 10 });
      teams = d.teams;
    } catch {
      teams = [];
    } finally {
      teamsLoading = false;
    }
  }

  async function quickJoin(team) {
    if (!user) {
      toast.warn("Sign in first to join a team");
      return;
    }
    try {
      await joinTeamByCode(team.invite_code);
      toast.success(`Joined "${team.name}"!`);
      await loadTeams();
    } catch (e) {
      toast.error(e.message);
    }
  }

  function copyCode(code) {
    navigator.clipboard
      .writeText(code)
      .then(() => toast.success("Invite code copied!"))
      .catch(() => toast.error("Could not copy"));
  }

  $: {
    lbPeriod;
    if (browser) {
      lbCache.delete(lbPeriod); // bust cache so tab switch always fetches fresh
      loadLeaderboard();
    }
  }

  const features = [
    {
      icon: "⚡",
      title: "Deep Focus",
      desc: "Structured 25-minute sessions help you enter flow state and stay there.",
    },
    {
      icon: "📊",
      title: "Track Progress",
      desc: "Monitor completed sessions and total focus time across all your work.",
    },
    {
      icon: "🎯",
      title: "Task-Linked",
      desc: "Attach tasks to sessions. Check them off as you power through your list.",
    },
    {
      icon: "🌗",
      title: "Adaptive Theme",
      desc: "Dark and light modes that adapt to your environment and preference.",
    },
  ];

  const RANK_ICONS = { 1: "🥇", 2: "🥈", 3: "🥉" };
</script>

<svelte:head>
  <title>Velocity — Developer Focus Timer</title>
</svelte:head>

<ParticleCanvas />

<div class="page">
  <!-- ── Hero ─────────────────────────────────────────────── -->
  <section class="hero-section">
    <div class="hero-deco" aria-hidden="true">
      <svg
        class="grid-svg"
        viewBox="0 0 600 400"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <pattern
            id="grid"
            width="40"
            height="40"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="var(--accent)"
              stroke-width="0.4"
              opacity="0.25"
            />
          </pattern>
          <radialGradient id="gf" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="white" stop-opacity="0.15" />
            <stop offset="100%" stop-color="white" stop-opacity="0" />
          </radialGradient>
          <mask id="gm"><rect width="600" height="400" fill="url(#gf)" /></mask>
        </defs>
        <rect width="600" height="400" fill="url(#grid)" mask="url(#gm)" />
      </svg>
    </div>

    <div class="hero-header">
      <div class="hero-badge font-mono">v1.0 — FOCUS SYSTEM</div>
      <h1 class="hero-title">
        Build faster.<br /><span class="accent-text"
          >Stay in flow.</span
        >
      </h1>
      <p class="hero-tagline font-mono" bind:this={taglineEl}>
        A minimal focus timer engineered for developers.
      </p>
    </div>

    <div class="app-container">
      <Timer />
      <TaskPanel />
    </div>
  </section>

  <!-- ── Features ──────────────────────────────────────────── -->
  <section class="section">
    <div class="section-header">
      <span class="section-label font-mono">WHY VELOCITY</span>
      <h2 class="section-title">Engineered for deep work</h2>
    </div>
    <div class="features-grid">
      {#each features as f}
        <div class="feature-card">
          <span class="feature-icon">{f.icon}</span>
          <h3 class="feature-title">{f.title}</h3>
          <p class="feature-desc">{f.desc}</p>
        </div>
      {/each}
    </div>
  </section>

  <!-- ── Community Preview ─────────────────────────────────── -->
  <section class="section community-section">
    <div class="community-grid">
      <!-- Leaderboard preview (top 15) -->
      <div class="preview-panel">
        <div class="preview-head">
          <div>
            <span class="section-label font-mono">COMMUNITY</span>
            <h2 class="preview-title">Global Leaderboard</h2>
          </div>
          <a href="/leaderboard" class="see-all-btn font-mono">See all →</a>
        </div>

        <!-- Period tabs -->
        <div class="period-tabs">
          {#each [["week", "This Week"], ["month", "This Month"], ["alltime", "All Time"]] as [val, label]}
            <button
              class="period-tab font-mono"
              class:active={lbPeriod === val}
              on:click={() => (lbPeriod = val)}>{label}</button
            >
          {/each}
        </div>

        <div class="lb-wrap" class:lb-fetching={lbLoading && leaderboard.length > 0}>
          <div class="lb-col-header font-mono">
            <span>#</span><span>User</span><span class="tr">Sessions</span><span
              class="tr">Hours</span
            >
          </div>
          {#if lbLoading && leaderboard.length === 0}
            {#each Array(5) as _}<div class="lb-skel vel-skel"></div>{/each}
          {:else}
            {#each leaderboard as row, i (row.id)}
              <div
                class="lb-row"
                class:gold={row.rank === 1}
                class:is-you={row.id === user?.id}
                in:fly={{ x: -16, duration: 200, delay: i * 25 }}
              >
                <span class="lb-rank font-mono"
                  >{RANK_ICONS[row.rank] || row.rank}</span
                >
                <div class="lb-user">
                  <UserAvatar user={row} size={28} radius="8px" />
                  <span class="lb-name">{row.username}</span>
                  {#if row.id === user?.id}<span class="you-badge font-mono"
                      >you</span
                    >{/if}
                </div>
                <span class="lb-val font-mono tr">{row.sessions}</span>
                <span class="lb-val font-mono tr"
                  >{(row.total_seconds / 3600).toFixed(1)}h</span
                >
              </div>
            {/each}
            {#if !user}
              <div class="lb-row lb-join-row">
                <span class="lb-rank font-mono">–</span>
                <div class="lb-user">
                  <span>👤</span>
                  <a href="/" class="lb-join-link">Join</a>
                </div>
                <span class="lb-val font-mono tr"
                  >{$timer.completedSessions}</span
                >
                <span class="lb-val font-mono tr"
                  >{($timer.totalFocusTime / 3600).toFixed(1)}h</span
                >
              </div>
            {/if}
          {/if}
        </div>
      </div>

      <!-- Teams preview (top 5 by member count) -->
      <div class="preview-panel">
        <div class="preview-head">
          <div>
            <span class="section-label font-mono">TEAMS</span>
            <h2 class="preview-title">Top Teams</h2>
          </div>
          <a href="/teams" class="see-all-btn font-mono">See all →</a>
        </div>

        {#if teamsLoading}
          {#each Array(5) as _}<div class="team-skel vel-skel"></div>{/each}
        {:else}
          <div class="teams-list">
            {#each teams as team, i (team.id)}
              {@const isMember = team.members?.some((m) => m.id === user?.id)}
              <div
                class="team-row"
                style="--tc:{team.color}"
                in:fly={{ x: 16, duration: 200, delay: i * 40 }}
              >
                <div class="team-row-left">
                  <span class="team-rank font-mono">#{i + 1}</span>
                  <span class="team-dot" style="background:{team.color}"></span>
                  <div>
                    <div class="team-row-name">{team.name}</div>
                    <div class="team-row-meta font-mono">
                      {CATEGORY_ICONS[team.category] || "⚡"}
                      {team.category} · {team.member_count} members
                    </div>
                  </div>
                </div>
                <div class="team-row-actions">
                  <button
                    class="code-chip font-mono"
                    on:click={() => copyCode(team.invite_code)}
                    title="Copy invite code">{team.invite_code}</button
                  >
                  {#if isMember}
                    <span class="member-chip font-mono">Joined</span>
                  {:else if user}
                    <button
                      class="join-chip"
                      style="border-color:{team.color};color:{team.color}"
                      on:click={() => quickJoin(team)}>Join</button
                    >
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </section>

  <footer class="site-footer">
    <span class="footer-text font-mono"
      >Built with SvelteKit & GSAP ·
      <a href="https://github.com" target="_blank" rel="noopener">GitHub</a
      ></span
    >
    <span class="footer-session font-mono"
      >Sessions today:
      <span class="text-accent">{user ? $userStats.totalSessions : $timer.completedSessions}</span></span
    >
  </footer>
</div>

<style>
  .page {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }

  /* Hero */
  .hero-section {
    position: relative;
    overflow: hidden;
    padding: 4rem 2rem 5rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3rem;
  }
  .hero-deco {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    opacity: 0.6;
  }
  .grid-svg {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .hero-header {
    position: relative;
    z-index: 1;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }
  .hero-badge {
    display: inline-flex;
    align-items: center;
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.2em;
    color: var(--accent);
    border: 1px solid var(--accent);
    border-radius: 99px;
    padding: 0.3rem 0.875rem;
    background: var(--accent-subtle);
  }
  .hero-title {
    font-size: clamp(2.5rem, 6vw, 4.5rem);
    font-weight: 800;
    line-height: 1.05;
    letter-spacing: -0.03em;
    color: var(--text-primary);
  }
  .accent-text {
    color: var(--accent);
  }
  .hero-tagline {
    font-size: 0.8rem;
    letter-spacing: 0.05em;
    color: var(--text-secondary);
    min-height: 1.5em;
  }
  .app-container {
    position: relative;
    z-index: 1;
    display: flex;
    flex-wrap: nowrap;
    align-items: flex-start;
    justify-content: center;
    gap: 2.5rem;
    width: 100%;
    max-width: 960px;
  }

  /* Sections */
  .section {
    padding: 5rem 2rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3rem;
    border-top: 1px solid var(--border-subtle);
  }
  .section-header {
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .section-label {
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.2em;
    color: var(--accent);
    text-transform: uppercase;
  }
  .section-title {
    font-size: clamp(1.5rem, 3vw, 2.25rem);
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--text-primary);
  }

  /* Features */
  .features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1.25rem;
    width: 100%;
    max-width: 800px;
  }
  .feature-card {
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-xl);
    padding: 1.75rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    transition:
      border-color 0.2s,
      box-shadow 0.2s,
      transform 0.2s;
    will-change: transform, opacity;
  }
  .feature-card:hover {
    border-color: var(--accent);
    box-shadow: var(--shadow-glow);
    transform: translateY(-4px);
  }
  .feature-icon {
    font-size: 1.5rem;
  }
  .feature-title {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-primary);
  }
  .feature-desc {
    font-size: 0.825rem;
    color: var(--text-secondary);
    line-height: 1.6;
  }

  /* Community */
  .community-section {
    background: linear-gradient(
      180deg,
      transparent 0%,
      var(--accent-subtle) 50%,
      transparent 100%
    );
  }
  .community-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
    width: 100%;
    max-width: 960px;
    align-items: stretch;
  }

  .preview-panel {
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-xl);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    align-self: stretch;
  }
  .preview-head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    padding: 1.25rem 1.25rem 0;
    gap: 0.5rem;
  }
  .preview-title {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--text-primary);
    margin-top: 0.2rem;
  }
  .see-all-btn {
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--accent);
    text-decoration: none;
    padding: 0.25rem 0.5rem;
    border-radius: var(--radius-sm);
    transition: background var(--transition-fast);
    white-space: nowrap;
  }
  .see-all-btn:hover {
    background: var(--accent-subtle);
  }

  /* Period tabs */
  .period-tabs {
    display: flex;
    padding: 0.75rem 1.25rem 0;
    gap: 0.25rem;
  }
  .period-tab {
    font-size: 0.6rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 0.3rem 0.6rem;
    border-radius: 99px;
    border: 1px solid transparent;
    color: var(--text-tertiary);
    background: transparent;
    transition: color 200ms ease, background 200ms ease, border-color 200ms ease, box-shadow 200ms ease;
    cursor: pointer;
  }
  .period-tab.active {
    border-color: var(--accent);
    color: var(--accent);
    background: var(--accent-subtle);
    box-shadow: 0 0 8px var(--orange-glow-sm);
  }
  .period-tab:hover:not(.active) {
    color: var(--text-secondary);
    background: var(--bg-elevated);
  }

  /* Leaderboard */
  .lb-wrap {
    padding: 0.75rem 0 0;
    transition: opacity 0.15s ease;
  }
  .lb-wrap.lb-fetching {
    opacity: 0.5;
    pointer-events: none;
  }
  .lb-col-header {
    display: grid;
    grid-template-columns: 36px 1fr 70px 60px;
    padding: 0.4rem 1.25rem;
    font-size: 0.55rem;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--text-tertiary);
    border-bottom: 1px solid var(--border-subtle);
  }
  .lb-row {
    display: grid;
    grid-template-columns: 36px 1fr 70px 60px;
    align-items: center;
    padding: 0.6rem 1.25rem;
    min-height: 46px;
    border-bottom: 1px solid var(--border-subtle);
    transition: background var(--transition-fast);
  }
  .lb-row:last-child {
    border-bottom: none;
  }
  .lb-row:hover {
    background: var(--accent-subtle);
  }
  .lb-row.gold {
    background: rgba(251, 191, 36, 0.05);
  }
  .lb-row.is-you {
    background: var(--accent-subtle);
  }
  .lb-row.lb-join-row {
    border-top: 1px dashed var(--accent);
  }
  .lb-rank {
    font-size: 0.85rem;
    color: var(--text-tertiary);
  }
  .lb-user {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    overflow: hidden;
    font-size: 0.95rem;
  }
  .lb-name {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .lb-val {
    font-size: 0.72rem;
    color: var(--text-secondary);
  }
  .tr {
    text-align: right;
  }
  .you-badge {
    font-size: 0.5rem;
    padding: 1px 4px;
    border-radius: 4px;
    color: var(--accent);
    border: 1px solid var(--accent);
    background: var(--accent-subtle);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .lb-join-link {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    color: var(--accent);
    text-decoration: none;
  }
  .lb-join-link:hover {
    text-decoration: underline;
  }
  .lb-skel {
    height: 46px;
  }
  @keyframes sk { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

  /* Teams list */
  .teams-list {
    display: flex;
    flex-direction: column;
    padding: 0.75rem 0 0;
  }
  .team-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1.25rem;
    border-bottom: 1px solid var(--border-subtle);
    gap: 0.5rem;
    transition: background var(--transition-fast);
  }
  .team-row:last-child {
    border-bottom: none;
  }
  .team-row:hover {
    background: var(--accent-subtle);
  }
  .team-row-left {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    overflow: hidden;
  }
  .team-rank {
    font-size: 0.65rem;
    color: var(--text-tertiary);
    width: 20px;
    flex-shrink: 0;
  }
  .team-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .team-row-name {
    font-size: 0.82rem;
    font-weight: 700;
    color: var(--text-primary);
  }
  .team-row-meta {
    font-size: 0.58rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-tertiary);
    margin-top: 1px;
  }
  .team-row-actions {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-shrink: 0;
  }
  .member-chip {
    font-size: 0.55rem;
    padding: 2px 6px;
    border-radius: 99px;
    color: #22c55e;
    border: 1px solid #22c55e;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .join-chip {
    font-family: var(--font-mono);
    font-size: 0.55rem;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 99px;
    border: 1px solid;
    background: transparent;
    cursor: pointer;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    transition:
      background var(--transition-fast),
      color var(--transition-fast);
  }
  .join-chip:hover {
    background: var(--tc);
    color: white;
    border-color: var(--tc);
  }
  .code-chip {
    font-size: 0.55rem;
    padding: 2px 6px;
    border-radius: 4px;
    background: transparent;
    border: 1px solid var(--border-subtle);
    color: var(--text-tertiary);
    cursor: pointer;
    letter-spacing: 0.1em;
    transition: all var(--transition-fast);
  }
  .code-chip:hover {
    border-color: var(--accent);
    color: var(--accent);
  }
  .team-skel {
    height: 52px;
  }


  /* Footer */
  .site-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.5rem;
    padding: 1.25rem 2rem;
    border-top: 1px solid var(--border-subtle);
    font-size: 0.7rem;
    color: var(--text-tertiary);
  }
  .footer-text a {
    color: var(--accent);
  }
  .text-accent {
    color: var(--accent);
  }

  @media (max-width: 800px) {
    .community-grid {
      grid-template-columns: 1fr;
    }
  }
  @media (max-width: 600px) {
    .hero-section,
    .section {
      padding: 2.5rem 1rem;
    }
    .site-footer {
      flex-direction: column;
      align-items: center;
    }
    .hero-title {
      font-size: clamp(2rem, 10vw, 3rem);
    }
    .app-container {
      flex-direction: column;
      align-items: center;
      gap: 1.5rem;
    }
    .features-grid {
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
    }
    .feature-card {
      padding: 1.25rem 1rem;
    }
    .lb-col-header,
    .lb-row {
      grid-template-columns: 28px 1fr 56px 50px;
      padding: 0.5rem 0.75rem;
    }
    .team-row {
      flex-wrap: wrap;
      padding: 0.75rem;
      gap: 0.5rem;
    }
    .team-row-actions {
      width: 100%;
      justify-content: flex-end;
    }
  }
  @media (max-width: 380px) {
    .features-grid {
      grid-template-columns: 1fr;
    }
    .period-tabs {
      flex-wrap: wrap;
    }
  }
</style>