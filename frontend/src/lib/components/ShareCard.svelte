<script>
  import Modal from './Modal.svelte';
  import RecapCard from './RecapCard.svelte';
  import { t } from '$lib/stores/i18n';

  export let show = false;
  export let username = 'User';
  export let initials = '?';
  export let profileImage = '';
  export let totalHours = '0.0';
  export let totalMinutes = 0;
  export let totalSessions = 0;
  export let doneTasks = 0;
  export let chartDays = []; // [{ label, minutes, isToday }]
  export let currentStreak = 0;

  let recapCardRef;

  async function handleDownload() {
    if (recapCardRef && recapCardRef.downloadCard) {
      await recapCardRef.downloadCard();
    }
  }

  async function handleNativeShare() {
    if (!recapCardRef) return;
    try {
      const { default: html2canvas } = await import('html2canvas');
      // Get the card element via the exported ref
      const canvas = await recapCardRef.getCanvas?.();
      if (!canvas) { handleDownload(); return; }
      canvas.toBlob(async (blob) => {
        if (!blob) { handleDownload(); return; }
        const file = new File([blob], `velocity-${username}-stats.png`, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Velocity Stats' });
        } else {
          handleDownload();
        }
      }, 'image/png');
    } catch {
      handleDownload();
    }
  }
</script>

<Modal bind:show wide on:close={() => (show = false)}>
  <div class="share-modal-header">
    <h3>{$t('recap_card_title')}</h3>
    <button class="close-btn" on:click={() => (show = false)} aria-label={$t('shortcut_close')}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  </div>

  <RecapCard
    bind:this={recapCardRef}
    {username}
    {initials}
    {profileImage}
    {totalHours}
    {totalMinutes}
    {totalSessions}
    {doneTasks}
    {chartDays}
    {currentStreak}
    filenameSuffix="stats"
    hideButton
  />

  <div class="share-actions">
    <button class="btn-action btn-download" on:click={handleDownload}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      {$t('recap_download_png')}
    </button>
    <button class="btn-action btn-close" on:click={() => (show = false)}>{$t('shortcut_close')}</button>
  </div>
</Modal>

<style>
  .share-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.25rem;
  }
  .share-modal-header h3 { font-size: 1.1rem; font-weight: 800; color: var(--text-primary); margin: 0; }
  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--bg-elevated);
    border: 1px solid var(--border-base);
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 150ms ease;
    flex-shrink: 0;
  }
  .close-btn:hover { background: var(--bg-overlay); color: var(--text-primary); }

  .share-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
    margin-top: 0.5rem;
  }
  .btn-action {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 1.25rem;
    border-radius: var(--radius-md);
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 150ms ease;
    font-family: var(--font-mono);
    letter-spacing: 0.05em;
  }
  .btn-download {
    background: var(--accent);
    color: white;
    border: none;
  }
  .btn-download:hover { background: var(--accent-hover); box-shadow: 0 0 20px var(--accent-glow); }
  .btn-close {
    background: transparent;
    border: 1px solid var(--border-base);
    color: var(--text-secondary);
  }
  .btn-close:hover { border-color: var(--border-strong); color: var(--text-primary); }
</style>