<script>
  import { onMount } from 'svelte';
  import { auth, fetchTeams, createTeam, joinTeamByCode, leaveTeam, deleteTeam, transferLeadership, kickMember, updateMemberRole } from '$lib/stores/api';
  import { toast } from '$lib/stores/toast';
  import { t } from '$lib/stores/i18n';
  import UserAvatar from '$lib/components/UserAvatar.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import { fly, fade } from 'svelte/transition';

  const CATEGORIES = [
    { id: 'all',          label: 'All',          icon: '🌐' },
    { id: 'general',      label: 'General',       icon: '⚡' },
    { id: 'productivity', label: 'Productivity',  icon: '🎯' },
    { id: 'study',        label: 'Study',         icon: '📚' },
    { id: 'work',         label: 'Work',          icon: '💼' },
    { id: 'gaming',       label: 'Gaming',        icon: '🎮' },
    { id: 'social',       label: 'Social',        icon: '🤝' },
  ];
  const COLORS = ['#f97316','#8b5cf6','#06b6d4','#10b981','#ef4444','#eab308','#ec4899'];

  let teams = [];
  let loading = true;
  let activeCategory = 'all';
  let searchQuery = '';

  // Modals
  let showCreate = false;
  let showJoin   = false;
  let showManage = null; // team object
  let showTransfer = false;
  let leaveConfirmTeam = null; // team for leave confirmation
  let deleteConfirmTeam = null; // team for delete confirmation

  // Create form
  let newName = '', newColor = '#f97316', newCategory = 'general', creating = false;
  // Join form
  let joinCode = '', joining = false;
  // Transfer form
  let transferTo = '';

  $: user = $auth.user;
  $: filtered = teams.filter(t =>
    (activeCategory === 'all' || t.category === activeCategory) &&
    (!searchQuery || t.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  onMount(loadTeams);

  async function loadTeams() {
    loading = true;
    try {
      const data = await fetchTeams();
      teams = data.teams;
    } catch(e) { toast.error('Failed to load teams'); }
    finally { loading = false; }
  }

  function myRole(team) {
    if (!user) return null;
    return team.members?.find(m => m.id === user.id)?.role || null;
  }
  function isMember(team) { return !!myRole(team); }

  async function handleCreate() {
    if (!newName.trim()) return;
    creating = true;
    try {
      const data = await createTeam(newName.trim(), newColor, newCategory);
      toast.success(`Team "${data.team.name}" created! Invite code: ${data.invite_code}`);
      navigator.clipboard.writeText(data.invite_code).catch(()=>{});
      showCreate = false; newName = ''; newColor = '#f97316'; newCategory = 'general';
      await loadTeams();
    } catch(e) { toast.error(e.message, undefined, e.code); }
    finally { creating = false; }
  }

  async function handleJoin() {
    if (!joinCode.trim()) return;
    joining = true;
    try {
      const data = await joinTeamByCode(joinCode.trim().toUpperCase());
      toast.success(`Joined "${data.team.name}"!`);
      showJoin = false; joinCode = '';
      await loadTeams();
    } catch(e) { toast.error(e.message, undefined, e.code); }
    finally { joining = false; }
  }

  async function handleLeave(team) {
    const role = myRole(team);
    if (role === 'leader') {
      const others = team.members?.filter(m => m.id !== user.id);
      if (others?.length > 0) {
        showManage = team; showTransfer = true;
        toast.warn('Transfer leadership before leaving');
        return;
      }
      // Last member — show confirmation modal
      leaveConfirmTeam = team;
      return;
    }
    // Non-leader: proceed with leave
    try {
      await leaveTeam(team.id);
      toast.success(`Left "${team.name}"`);
      await loadTeams();
    } catch(e) { toast.error(e.message); }
  }

  async function confirmLeave() {
    if (!leaveConfirmTeam) return;
    try {
      await leaveTeam(leaveConfirmTeam.id);
      toast.success(`Left "${leaveConfirmTeam.name}"`);
      leaveConfirmTeam = null;
      await loadTeams();
    } catch(e) { toast.error(e.message, undefined, e.code); }
  }

  async function handleDelete(team) {
    deleteConfirmTeam = team;
  }

  async function confirmDelete() {
    if (!deleteConfirmTeam) return;
    try {
      await deleteTeam(deleteConfirmTeam.id);
      toast.success(`Team "${deleteConfirmTeam.name}" deleted`);
      showManage = null;
      deleteConfirmTeam = null;
      await loadTeams();
    } catch(e) { toast.error(e.message, undefined, e.code); }
  }

  async function handleKick(team, member) {
    try {
      await kickMember(team.id, member.id);
      toast.success(`${member.username} removed from team`);
      showManage = { ...showManage, members: showManage.members.filter(m => m.id !== member.id) };
      await loadTeams();
    } catch(e) { toast.error(e.message, undefined, e.code); }
  }

  async function handleRoleChange(team, member, role) {
    try {
      await updateMemberRole(team.id, member.id, role);
      toast.success(`${member.username} is now ${role}`);
      await loadTeams();
      showManage = teams.find(t => t.id === team.id);
    } catch(e) { toast.error(e.message, undefined, e.code); }
  }

  async function handleTransfer(team) {
    if (!transferTo) return;
    try {
      await transferLeadership(team.id, transferTo);
      toast.success('Leadership transferred!');
      showTransfer = false; transferTo = '';
      await loadTeams();
    } catch(e) { toast.error(e.message, undefined, e.code); }
  }

  function copyCode(code) {
    navigator.clipboard.writeText(code)
      .then(() => toast.success('Invite code copied!'))
      .catch(() => toast.error('Could not copy to clipboard'));
  }

  const ROLE_BADGE = { leader: '👑 Leader', moderator: '🛡 Mod', member: '👤 Member' };
  const ROLE_COLOR = { leader: '#f97316', moderator: '#8b5cf6', member: 'var(--text-tertiary)' };
</script>

<svelte:head><title>Teams — Velocity</title></svelte:head>

<div class="page">
  <div class="page-header">
    <div class="header-text">
      <span class="page-label font-mono">TEAMS</span>
      <h1 class="page-title">{$t('find_your_crew')}</h1>
    </div>
    <div class="header-actions">
      {#if user}
        <button class="btn-outline" on:click={() => showJoin = true}>{$t('join_with_code')}</button>
        <button class="btn-accent" on:click={() => showCreate = true}>+ {$t('create_team_btn')}</button>
      {:else}
        <p class="login-hint"><a href="/">Log in</a> to create or join teams</p>
      {/if}
    </div>
  </div>

  <!-- Filters -->
  <div class="filters">
    <div class="search-wrap">
      <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input class="search-input" bind:value={searchQuery} placeholder={$t('search_teams_placeholder')} />
    </div>
    <div class="cat-tabs">
      {#each CATEGORIES as cat}
        <button
          class="cat-tab font-mono"
          class:active={activeCategory === cat.id}
          on:click={() => activeCategory = cat.id}
        >{cat.icon} {$t('teams_' + cat.id) || cat.label}</button>
      {/each}
    </div>
  </div>

  <!-- Team grid -->
  {#if loading}
    <div class="loading-grid">
      {#each Array(6) as _}
        <div class="team-skeleton"></div>
      {/each}
    </div>
  {:else if filtered.length === 0}
    <div class="empty-state">
      <span class="empty-icon">🔍</span>
      <p>{$t('no_teams_found')}{searchQuery ? ` for "${searchQuery}"` : ''}</p>
      {#if user}<button class="btn-accent" on:click={() => showCreate = true}>{$t('create_first_team')}</button>{/if}
    </div>
  {:else}
    <div class="teams-grid">
      {#each filtered as team (team.id)}
        <div class="team-card" style="--tc: {team.color}" transition:fly={{ y: 16, duration: 250 }}>
          <div class="tc-header">
            <div class="tc-name-row">
              <span class="tc-dot" style="background:{team.color}"></span>
              <span class="tc-name">{team.name}</span>
              {#if isMember(team)}
                <span class="my-role-badge font-mono" style="color:{ROLE_COLOR[myRole(team)]}">
                  {ROLE_BADGE[myRole(team)]}
                </span>
              {/if}
            </div>
            <span class="tc-cat font-mono">{CATEGORIES.find(c=>c.id===team.category)?.icon} {team.category}</span>
          </div>

          <!-- Members preview -->
          <div class="tc-members">
            {#each (team.members || []).slice(0,5) as m, i}
              <span class="tc-avatar-wrap" title="{m.username} ({m.role})" style="z-index:{5-i}">
                <UserAvatar user={m} size={26} radius="50%" />
              </span>
            {/each}
            {#if (team.members?.length || 0) > 5}
              <span class="tc-more font-mono">+{team.members.length - 5}</span>
            {/if}
            <span class="tc-count font-mono">{team.member_count} members</span>
          </div>

          <!-- Stats -->
          <div class="tc-stats">
            <span class="tc-stat">
              <span class="tc-stat-val font-mono">{team.members?.reduce((s,m)=>s+m.sessions,0)||0}</span>
              <span class="tc-stat-label">sessions</span>
            </span>
          </div>

          <!-- Actions -->
          <div class="tc-actions">
            <div class="tc-code-section">
              {#if isMember(team)}
                <button class="btn-sm btn-copy" on:click={() => copyCode(team.invite_code)} title="Copy invite code">
                  🔗 {team.invite_code}
                </button>
              {:else}
                <span class="tc-code-display font-mono">{team.invite_code}</span>
              {/if}
            </div>
            <div class="tc-button-section">
              {#if isMember(team)}
                {#if myRole(team) === 'leader' || myRole(team) === 'moderator'}
                  <button class="btn-sm" on:click={() => { showManage = team; showTransfer = false; }}>Manage</button>
                {/if}
                <button class="btn-sm btn-danger" on:click={() => handleLeave(team)}>Leave</button>
              {:else if user}
                <button class="btn-sm btn-primary" on:click={() => { joinCode = team.invite_code; handleJoin(); }}>JOIN</button>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Create Team Modal -->
<Modal show={showCreate} on:close={() => showCreate = false}>
  <button class="modal-close" on:click={() => showCreate = false}>✕</button>
  <h3 class="modal-title font-mono">{$t('create_team_btn')}</h3>

  <input class="modal-input" bind:value={newName} placeholder={$t('team_name_placeholder')} maxlength="40"
    on:keydown={e => e.key === 'Enter' && handleCreate()} />

  <div class="field-group">
    <label class="field-label font-mono">{$t('teams_label')}</label>
    <div class="cat-grid">
      {#each CATEGORIES.filter(c=>c.id!=='all') as cat}
        <button class="cat-option" class:selected={newCategory === cat.id} on:click={() => newCategory = cat.id}>
          <span>{cat.icon}</span><span>{$t('teams_' + cat.id) || cat.label}</span>
        </button>
      {/each}
    </div>
  </div>

  <div class="field-group">
    <label class="field-label font-mono">{$t('team_color_label')}</label>
    <div class="color-swatches">
      {#each COLORS as c}
        <button class="color-swatch" class:selected={newColor===c} style="background:{c}" on:click={() => newColor=c}></button>
      {/each}
    </div>
  </div>

  <div class="preview-bar" style="background:{newColor}20; border-color:{newColor}">
    <span class="preview-dot" style="background:{newColor}"></span>
    <span>{newName || 'Team Name'}</span>
    <span class="font-mono" style="font-size:0.65rem;color:{newColor}">{newCategory}</span>
  </div>

  <div class="modal-actions">
    <button class="btn-outline" on:click={() => showCreate = false}>{$t('cancel')}</button>
    <button class="btn-accent" on:click={handleCreate} disabled={creating || !newName.trim()}>
      {creating ? 'Creating…' : $t('create_team_btn')}
    </button>
  </div>
</Modal>

<!-- Join Modal -->
<Modal show={showJoin} on:close={() => showJoin = false}>
  <button class="modal-close" on:click={() => showJoin = false}>✕</button>
  <h3 class="modal-title font-mono">{$t('join_with_code')}</h3>
  <input class="modal-input" bind:value={joinCode} placeholder={$t('enter_code')}
    style="text-transform:uppercase;letter-spacing:0.15em"
    on:keydown={e => e.key === 'Enter' && handleJoin()} />
  <div class="modal-actions">
    <button class="btn-outline" on:click={() => showJoin = false}>{$t('cancel')}</button>
    <button class="btn-accent" on:click={handleJoin} disabled={joining || !joinCode.trim()}>
      {joining ? 'Joining…' : $t('join_with_code')}
    </button>
  </div>
</Modal>

<!-- Manage Team Modal -->
{#if showManage}
  <Modal show={!!showManage} on:close={() => { showManage = null; showTransfer = false; }}>
    <button class="modal-close" on:click={() => { showManage = null; showTransfer = false; }}>✕</button>

    <div class="manage-header">
      <span class="manage-dot" style="background:{showManage.color}"></span>
      <h3 class="modal-title font-mono">{showManage.name}</h3>
    </div>

    {#if showTransfer}
      <div class="transfer-section">
        <p class="transfer-hint">Select the new team leader:</p>
        <div class="member-list">
          {#each (showManage.members||[]).filter(m=>m.id!==user.id) as m}
            <button
              class="member-row selectable"
              class:selected={transferTo === m.id}
              on:click={() => transferTo = m.id}
            >
              <UserAvatar user={m} size={32} radius="10px" />
              <span class="m-name">{m.username}</span>
              <span class="m-role font-mono" style="color:{ROLE_COLOR[m.role]}">{m.role}</span>
              {#if transferTo === m.id}<span class="check">✓</span>{/if}
            </button>
          {/each}
        </div>
        <div class="modal-actions">
          <button class="btn-outline" on:click={() => showTransfer = false}>Back</button>
          <button class="btn-accent" disabled={!transferTo} on:click={() => handleTransfer(showManage)}>Transfer Leadership</button>
        </div>
      </div>
    {:else}
      <!-- Member list with roles -->
      <div class="member-list">
        {#each (showManage.members||[]) as m}
          <div class="member-row">
            <UserAvatar user={m} size={32} radius="10px" />
            <span class="m-name">{m.username} {m.id === user?.id ? '(you)' : ''}</span>
            <span class="m-role font-mono" style="color:{ROLE_COLOR[m.role]}">{m.role}</span>
            {#if m.id !== user?.id && myRole(showManage) === 'leader'}
              <div class="m-actions">
                {#if m.role === 'member'}
                  <button class="btn-xs" on:click={() => handleRoleChange(showManage,m,'moderator')}>→ Mod</button>
                {:else if m.role === 'moderator'}
                  <button class="btn-xs" on:click={() => handleRoleChange(showManage,m,'member')}>→ Member</button>
                {/if}
                <button class="btn-xs btn-danger" on:click={() => handleKick(showManage,m)}>Kick</button>
              </div>
            {:else if m.id !== user?.id && myRole(showManage) === 'moderator' && m.role === 'member'}
              <button class="btn-xs btn-danger" on:click={() => handleKick(showManage,m)}>Kick</button>
            {/if}
          </div>
        {/each}
      </div>

      <div class="manage-info">
        <span class="font-mono" style="font-size:0.65rem;color:var(--text-tertiary)">Invite Code</span>
        <button class="invite-code-btn font-mono" on:click={() => copyCode(showManage.invite_code)}>
          {showManage.invite_code} 📋
        </button>
      </div>

      {#if myRole(showManage) === 'leader'}
        <div class="danger-zone">
          <button class="btn-outline" on:click={() => showTransfer = true}>Transfer Leadership</button>
          <button class="btn-danger-full" on:click={() => handleDelete(showManage)}>Delete Team</button>
        </div>
      {/if}
    {/if}
  </Modal>
{/if}

<!-- Leave Confirmation Modal -->
<Modal show={!!leaveConfirmTeam} on:close={() => leaveConfirmTeam = null}>
  <div class="confirm-modal">
    <h3 class="modal-title font-mono">Çıkmak istediğinize emin misiniz?</h3>
    <p class="confirm-message">
      You're the only member of <strong>{leaveConfirmTeam?.name}</strong>. Leaving will permanently delete the team.
    </p>
    <div class="modal-actions">
      <button class="btn-outline" on:click={() => leaveConfirmTeam = null}>Cancel</button>
      <button class="btn-danger-full" on:click={confirmLeave}>Leave & Delete Team</button>
    </div>
  </div>
</Modal>

<!-- Delete Confirmation Modal -->
<Modal show={!!deleteConfirmTeam} on:close={() => deleteConfirmTeam = null}>
  <div class="confirm-modal">
    <h3 class="modal-title font-mono">Takımı silmek istediğinize emin misiniz?</h3>
    <p class="confirm-message">
      Delete <strong>{deleteConfirmTeam?.name}</strong>? This is permanent and will remove all team tasks.
    </p>
    <div class="modal-actions">
      <button class="btn-outline" on:click={() => deleteConfirmTeam = null}>Cancel</button>
      <button class="btn-danger-full" on:click={confirmDelete}>Delete Team</button>
    </div>
  </div>
</Modal>

<style>
  .page { max-width: 1100px; margin: 0 auto; padding: 3rem 2rem; display: flex; flex-direction: column; gap: 2rem; }

  .page-header { display: flex; align-items: flex-end; justify-content: space-between; flex-wrap: wrap; gap: 1rem; }
  .page-label { font-size: 0.65rem; font-weight: 700; letter-spacing: 0.2em; color: var(--accent); display: block; margin-bottom: 0.35rem; }
  .page-title { font-size: 2rem; font-weight: 800; letter-spacing: -0.03em; color: var(--text-primary); }
  .header-actions { display: flex; align-items: center; gap: 0.75rem; }
  .login-hint { font-size: 0.8rem; color: var(--text-tertiary); }
  .login-hint a { color: var(--accent); }

  .filters { display: flex; flex-direction: column; gap: 0.75rem; }
  .search-wrap { position: relative; max-width: 300px; }
  .search-icon { position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); color: var(--text-tertiary); pointer-events: none; }
  .search-input { width: 100%; padding: 0.6rem 0.75rem 0.6rem 2.25rem; background: var(--bg-surface); border: 1px solid var(--border-base); border-radius: var(--radius-md); font-size: 0.85rem; color: var(--text-primary); outline: none; transition: border-color var(--transition-fast); }
  .search-input:focus { border-color: var(--accent); }

  .cat-tabs { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .cat-tab { font-size: 0.65rem; font-weight: 700; letter-spacing: 0.08em; padding: 0.35rem 0.75rem; border-radius: 99px; border: 1px solid var(--border-subtle); color: var(--text-tertiary); background: transparent; transition: all var(--transition-fast); text-transform: uppercase; }
  .cat-tab:hover { border-color: var(--border-base); color: var(--text-secondary); }
  .cat-tab.active { border-color: var(--accent); color: var(--accent); background: var(--accent-subtle); }

  .teams-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.25rem; }

  .team-card { background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-xl); padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem; transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s; }
  .team-card:hover { border-color: var(--tc); box-shadow: 0 4px 24px color-mix(in srgb, var(--tc) 15%, transparent); transform: translateY(-2px); }

  .tc-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.5rem; }
  .tc-name-row { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  .tc-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .tc-name { font-weight: 700; font-size: 0.95rem; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 150px; }
  .my-role-badge { font-size: 0.55rem; letter-spacing: 0.08em; text-transform: uppercase; }
  .tc-cat { font-size: 0.6rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-tertiary); white-space: nowrap; }

  .tc-members { display: flex; align-items: center; gap: 0.25rem; }
  .tc-avatar { width: 26px; height: 26px; border-radius: 50%; background: var(--bg-elevated); display: flex; align-items: center; justify-content: center; font-size: 0.8rem; border: 2px solid var(--bg-surface); margin-left: -6px; }
  .tc-avatar:first-child { margin-left: 0; }
  .tc-more { font-size: 0.6rem; color: var(--text-tertiary); margin-left: 4px; }
  .tc-count { font-size: 0.65rem; color: var(--text-tertiary); margin-left: auto; }

  .tc-stats { display: flex; gap: 1rem; }
  .tc-stat { display: flex; align-items: baseline; gap: 0.3rem; }
  .tc-stat-val { font-size: 1.1rem; font-weight: 700; color: var(--accent); }
  .tc-stat-label { font-size: 0.65rem; color: var(--text-tertiary); }

  .tc-actions { display: flex; gap: 0.5rem; align-items: center; justify-content: space-between; }
  .tc-code-section { flex: 1; min-width: 0; }
  .tc-button-section { display: flex; gap: 0.5rem; }
  .tc-code-display { font-size: 0.55rem; color: var(--text-tertiary); word-break: break-all; }
  .btn-sm { font-family: var(--font-mono); font-size: 0.6rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 0.3rem 0.65rem; border-radius: var(--radius-sm); border: 1px solid var(--border-base); color: var(--text-secondary); background: transparent; transition: all var(--transition-fast); white-space: nowrap; }
  .btn-sm:hover { border-color: var(--accent); color: var(--accent); }
  .btn-sm.btn-primary { border-color: var(--tc); color: var(--tc); }
  .btn-sm.btn-primary:hover { background: var(--tc); color: white; }
  .btn-sm.btn-danger { border-color: #ef4444; color: #ef4444; }
  .btn-sm.btn-danger:hover { background: #ef4444; color: white; }
  .btn-sm.btn-copy { border-color: var(--border-subtle); color: var(--text-tertiary); font-size: 0.55rem; }
  .btn-sm.btn-copy:hover { border-color: var(--accent); color: var(--accent); }

  /* Global buttons */
  .btn-accent { font-family: var(--font-mono); font-size: 0.72rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 0.5rem 1.1rem; background: var(--accent); color: white; border-radius: var(--radius-md); border: none; transition: background var(--transition-fast), box-shadow var(--transition-fast); }
  .btn-accent:hover:not(:disabled) { background: var(--accent-hover); box-shadow: 0 0 16px var(--accent-glow); }
  .btn-accent:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-outline { font-family: var(--font-mono); font-size: 0.72rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 0.5rem 1.1rem; border: 1px solid var(--border-base); color: var(--text-secondary); background: transparent; border-radius: var(--radius-md); transition: all var(--transition-fast); }
  .btn-outline:hover { border-color: var(--accent); color: var(--accent); }

  /* Modal internals */
  .modal-close { position: absolute; top: 1rem; right: 1rem; width: 28px; height: 28px; border-radius: 50%; background: transparent; border: 1px solid var(--border-base); color: var(--text-tertiary); font-size: 0.75rem; display: flex; align-items: center; justify-content: center; transition: color var(--transition-fast); }
  .modal-close:hover { color: var(--text-primary); }
  .modal-title { font-size: 0.75rem; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: var(--text-primary); }
  .modal-input { width: 100%; background: var(--bg-elevated); border: 1px solid var(--border-base); border-radius: var(--radius-md); padding: 0.75rem 1rem; font-size: 0.875rem; color: var(--text-primary); outline: none; font-family: var(--font-mono); transition: border-color var(--transition-fast); }
  .modal-input:focus { border-color: var(--accent); }
  .modal-actions { display: flex; gap: 0.75rem; }
  .modal-actions > * { flex: 1; }

  .field-group { display: flex; flex-direction: column; gap: 0.5rem; }
  .field-label { font-size: 0.6rem; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: var(--text-tertiary); }

  .cat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.4rem; }
  .cat-option { display: flex; flex-direction: column; align-items: center; gap: 0.2rem; padding: 0.5rem; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); background: transparent; color: var(--text-secondary); font-size: 0.65rem; transition: all var(--transition-fast); cursor: pointer; }
  .cat-option:hover { border-color: var(--border-base); }
  .cat-option.selected { border-color: var(--accent); background: var(--accent-subtle); color: var(--accent); }
  .cat-option span:first-child { font-size: 1.1rem; }

  .color-swatches { display: flex; gap: 0.5rem; flex-wrap: wrap; }
  .color-swatch { width: 24px; height: 24px; border-radius: 50%; border: 2px solid transparent; transition: transform 0.15s, box-shadow 0.15s; cursor: pointer; }
  .color-swatch:hover { transform: scale(1.15); }
  .color-swatch.selected { box-shadow: 0 0 0 3px var(--bg-surface), 0 0 0 5px currentColor; }

  .preview-bar { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; border-radius: var(--radius-md); border: 1px solid; font-size: 0.85rem; font-weight: 600; color: var(--text-primary); }
  .preview-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }

  /* Manage modal */
  .manage-header { display: flex; align-items: center; gap: 0.5rem; }
  .manage-dot { width: 10px; height: 10px; border-radius: 50%; }
  .member-list { display: flex; flex-direction: column; gap: 0.35rem; max-height: 280px; overflow-y: auto; }
  .member-row { display: flex; align-items: center; gap: 0.6rem; padding: 0.5rem 0.6rem; border-radius: var(--radius-sm); border: 1px solid transparent; transition: background var(--transition-fast); }
  .member-row.selectable { cursor: pointer; }
  .member-row.selectable:hover { background: var(--accent-subtle); border-color: var(--accent); }
  .member-row.selected { background: var(--accent-subtle); border-color: var(--accent); }
  .m-avatar { font-size: 1rem; }
  .m-name { flex: 1; font-size: 0.78rem; color: var(--text-primary); }
  .m-role { font-size: 0.55rem; letter-spacing: 0.1em; text-transform: uppercase; }
  .m-actions { display: flex; gap: 0.35rem; }
  .btn-xs { font-family: var(--font-mono); font-size: 0.55rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; padding: 0.2rem 0.45rem; border-radius: 4px; border: 1px solid var(--border-base); color: var(--text-secondary); background: transparent; transition: all var(--transition-fast); cursor: pointer; }
  .btn-xs:hover { border-color: var(--accent); color: var(--accent); }
  .btn-xs.btn-danger { border-color: #ef444466; color: #ef4444; }
  .btn-xs.btn-danger:hover { background: #ef4444; color: white; border-color: #ef4444; }
  .check { color: var(--accent); font-weight: 700; font-size: 0.85rem; }

  .manage-info { display: flex; align-items: center; justify-content: space-between; padding: 0.6rem 0.75rem; background: var(--bg-elevated); border-radius: var(--radius-sm); }
  .invite-code-btn { font-size: 0.8rem; letter-spacing: 0.15em; color: var(--accent); background: none; border: none; cursor: pointer; }
  .danger-zone { display: flex; gap: 0.75rem; padding-top: 0.5rem; border-top: 1px solid var(--border-subtle); }
  .danger-zone > * { flex: 1; }
  .btn-danger-full { font-family: var(--font-mono); font-size: 0.7rem; font-weight: 700; text-transform: uppercase; padding: 0.5rem; background: transparent; border: 1px solid #ef4444; color: #ef4444; border-radius: var(--radius-md); transition: all var(--transition-fast); cursor: pointer; }
  .btn-danger-full:hover { background: #ef4444; color: white; }

  .transfer-hint { font-size: 0.8rem; color: var(--text-secondary); }
  .transfer-section { display: flex; flex-direction: column; gap: 1rem; }

  /* Loading & empty */
  .loading-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.25rem; }
  .team-skeleton { height: 200px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-xl); animation: pulse 1.5s ease-in-out infinite; }
  @keyframes pulse { 0%,100%{opacity:0.5} 50%{opacity:1} }
  .empty-state { display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 5rem 2rem; color: var(--text-tertiary); }
  .empty-icon { font-size: 3rem; }

  @media (max-width: 600px) {
    .page { padding: 2rem 1rem; }
    .page-header { flex-direction: column; align-items: flex-start; }
    .cat-grid { grid-template-columns: repeat(2,1fr); }
    .teams-grid { grid-template-columns: 1fr; }
    .tc-actions { flex-wrap: wrap; gap: 0.4rem; }
    .tc-button-section { width: 100%; display: flex; gap: 0.4rem; }
    .btn-sm { flex: 1; text-align: center; justify-content: center; }
  }
  @media (max-width: 400px) {
    .cat-grid { grid-template-columns: repeat(2, 1fr); }
  }

  .confirm-modal { display: flex; flex-direction: column; gap: 1rem; }
  .confirm-message { font-size: 0.85rem; color: var(--text-secondary); line-height: 1.5; }
  .confirm-message strong { color: var(--text-primary); font-weight: 600; }
</style>
