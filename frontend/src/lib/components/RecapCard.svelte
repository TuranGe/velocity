<script>
  import { onMount, onDestroy } from 'svelte';
  import { toast } from '$lib/stores/toast';
  import { auth } from '$lib/stores/api';
  import { getCachedProfilePhoto } from '$lib/utils/profilePhotoCache';
  import { t } from '$lib/stores/i18n';

  // Presentational 600x320 "recap card" — shared by ShareCard (manual
  // share, last-7-days) and WeeklySummaryModal (Monday auto recap,
  // previous calendar week). Renders at a fixed design size and scales
  // to fit its container, and can export itself as a PNG via html2canvas.

  export let username = 'User';
  export let initials = '?';
  export let profileImage = '';
  export let totalHours = '0.0';
  export let totalSessions = 0;
  export let doneTasks = 0;
  export let chartDays = []; // [{ label, minutes, isToday }]
  export let currentStreak = 0;
  export let periodLabel = ''; // e.g. "SON 7 GÜN" or "GEÇEN HAFTA" — defaults via i18n
  export let filenameSuffix = 'stats';

  const CARD_W = 600;
  const CARD_H = 320;

  let cardEl;
  let wrapEl;
  let downloading = false;
  let scale = 1;

  $: resolvedImage = profileImage || $auth.user?.profile_image || getCachedProfilePhoto() || '';
  $: chartMax = Math.max(...(chartDays.map(d => d.minutes)), 1);
  $: resolvedPeriodLabel = periodLabel || $t('recap_last_7_days');

  function updateScale() {
    if (!wrapEl) return;
    const available = wrapEl.clientWidth;
    scale = Math.min(1, available / CARD_W);
  }

  let resizeObserver;
  onMount(() => {
    updateScale();
    resizeObserver = new ResizeObserver(updateScale);
    if (wrapEl) resizeObserver.observe(wrapEl);
  });
  onDestroy(() => resizeObserver?.disconnect());

  export async function downloadCard() {
    if (!cardEl) return;
    downloading = true;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardEl, {
        scale: 2,
        width: CARD_W,
        height: CARD_H,
        backgroundColor: null,
        useCORS: true,
        logging: false,
      });

      canvas.toBlob((blob) => {
        if (!blob) {
          downloading = false;
          toast.warn?.($t('recap_download_failed'));
          return;
        }
        const link = document.createElement('a');
        link.download = `velocity-${username}-${filenameSuffix}.png`;
        link.href = URL.createObjectURL(blob);
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 2000);
        downloading = false;
        toast.success?.($t('recap_downloaded'));
      }, 'image/png');
    } catch (e) {
      downloading = false;
      toast.warn?.($t('recap_download_failed'));
    }
  }
</script>

<div class="recap-card-wrap" bind:this={wrapEl}>
  <div class="recap-card-scaler" style="width: {CARD_W * scale}px; height: {CARD_H * scale}px;">
    <div
      class="recap-card"
      bind:this={cardEl}
      style="width: {CARD_W}px; height: {CARD_H}px; transform: scale({scale});"
    >
      <!-- Header -->
      <div class="rc-header">
        <div class="rc-avatar">
          {#if resolvedImage}
            <img
              src={resolvedImage}
              alt={username}
              class="rc-avatar-img"
              crossorigin={resolvedImage.startsWith('data:') ? undefined : 'anonymous'}
            />
          {:else}
            <div class="rc-avatar-fallback">{initials}</div>
          {/if}
        </div>
        <div class="rc-identity">
          <div class="rc-username">{username}</div>
          <div class="rc-tagline">VELOCITY · {$t('recap_tagline')}</div>
        </div>

        <div class="rc-header-right">
          {#if currentStreak > 0}
            <div class="rc-streak" class:hot={currentStreak >= 7}>🔥 <span>{currentStreak} {$t('recap_day_streak')}</span></div>
          {/if}
          <div class="rc-logo">
            <svg viewBox="0 0 28 28" width="28" height="28" xmlns="http://www.w3.org/2000/svg">
              <circle cx="14" cy="14" r="12" stroke="#444" stroke-width="1.5" fill="none" opacity="0.5"/>
              <circle cx="14" cy="14" r="12" stroke="#f97316" stroke-width="1.5" fill="none"
                stroke-dasharray="75.4" stroke-dashoffset="18.85" stroke-linecap="round" transform="rotate(-90 14 14)"/>
              <path d="M11 9.5L18.5 14L11 18.5V9.5Z" fill="#f97316"/>
            </svg>
          </div>
        </div>
      </div>

      <!-- Stats row -->
      <div class="rc-stats">
        <div class="rc-stat">
          <div class="rc-stat-value accent">{totalHours}</div>
          <div class="rc-stat-label">{$t('recap_hours_focus')}</div>
        </div>
        <div class="rc-stat">
          <div class="rc-stat-value">{totalSessions}</div>
          <div class="rc-stat-label">{$t('recap_sessions')}</div>
        </div>
        <div class="rc-stat">
          <div class="rc-stat-value">{doneTasks}</div>
          <div class="rc-stat-label">{$t('recap_tasks_done')}</div>
        </div>
      </div>

      <div class="rc-divider"></div>

      <!-- Chart -->
      <div class="rc-chart-label">{resolvedPeriodLabel}</div>
      <div class="rc-chart">
        {#each chartDays as day}
          {@const pct = Math.max(6, (day.minutes / chartMax) * 100)}
          <div class="rc-bar-col">
            <div class="rc-bar-track">
              <div class="rc-bar" class:today={day.isToday} style="height: {pct}%"></div>
            </div>
            <div class="rc-bar-label">{day.label}</div>
          </div>
        {/each}
      </div>

      <!-- Footer -->
      <div class="rc-footer">velocity-timer.app</div>
    </div>
  </div>
</div>

<div class="recap-actions">
  <button class="btn-download" on:click={downloadCard} disabled={downloading}>
    {downloading ? $t('recap_preparing') : $t('recap_download_png')}
  </button>
</div>

<style>
  .recap-card-wrap {
    width: 100%;
    display: flex;
    justify-content: center;
    padding: 0.5rem;
  }

  /* Outer box reserves the *scaled* footprint so the modal doesn't
     leave a giant empty gap below the shrunk card. */
  .recap-card-scaler {
    position: relative;
    overflow: hidden;
    border-radius: 20px;
  }

  /* Fixed 600x320 "design canvas" — always laid out at full size,
     then visually scaled down to fit the container via transform.
     This keeps every font-size/spacing proportionally correct at
     any screen width, instead of text overlapping when the
     container shrinks. */
  .recap-card {
    position: absolute;
    top: 0; left: 0;
    transform-origin: top left;
    border-radius: 20px;
    padding: 26px 26px 22px;
    background: linear-gradient(135deg, #1a1a1a 0%, #0d0d0d 100%);
    border: 1px solid #2a2a2a;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    font-family: system-ui, -apple-system, sans-serif;
    color: #fff;
  }

  /* Header */
  .rc-header { display: flex; align-items: center; gap: 14px; }
  .rc-avatar {
    width: 44px; height: 44px; flex-shrink: 0;
    border-radius: 50%;
    border: 1.5px solid #f97316;
    overflow: hidden;
    display: flex; align-items: center; justify-content: center;
  }
  .rc-avatar-img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .rc-avatar-fallback {
    width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    background: linear-gradient(90deg, #f97316, #fb923c);
    color: #0d0d0d;
    font-family: var(--font-mono, monospace);
    font-size: 20px; font-weight: 800;
  }
  .rc-identity { display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1 1 auto; overflow: hidden; }
  .rc-username { font-size: 22px; font-weight: 800; line-height: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rc-tagline { font-family: var(--font-mono, monospace); font-size: 11px; font-weight: 700; letter-spacing: 2px; color: #f97316; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .rc-header-right {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 12px;
    margin-left: auto;
  }
  .rc-streak {
    flex-shrink: 0;
    display: flex; align-items: center; gap: 6px;
    padding: 6px 14px;
    border-radius: 15px;
    background: #2a1a0d;
    border: 1px solid #f97316;
    font-family: var(--font-mono, monospace);
    font-size: 12px; font-weight: 800;
    color: #fb923c;
    white-space: nowrap;
  }
  .rc-streak.hot {
    background: linear-gradient(135deg, rgba(251,146,60,0.25), rgba(239,68,68,0.12));
    border-color: #fb923c;
    box-shadow: 0 0 14px rgba(251,146,60,0.35);
  }
  .rc-logo { flex-shrink: 0; display: flex; }

  /* Stats */
  .rc-stats { display: flex; gap: 32px; margin-top: 20px; }
  .rc-stat-value { font-family: var(--font-mono, monospace); font-size: 36px; font-weight: 800; line-height: 1; color: #fff; }
  .rc-stat-value.accent { color: #f97316; }
  .rc-stat-label { margin-top: 6px; font-size: 11px; color: #999; }

  /* Divider */
  .rc-divider { height: 1px; background: #2a2a2a; margin: 16px 0 14px; }

  /* Chart */
  .rc-chart-label { font-size: 12px; font-weight: 700; letter-spacing: 1px; color: #999; margin-bottom: 10px; }
  .rc-chart { display: flex; gap: 10px; height: 64px; align-items: flex-end; margin-bottom: 10px; }
  .rc-bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; height: 100%; }
  .rc-bar-track { width: 100%; height: 50px; display: flex; align-items: flex-end; }
  .rc-bar { width: 100%; border-radius: 3px; background: #3a3a3a; min-height: 3px; }
  .rc-bar.today { background: linear-gradient(90deg, #f97316, #fb923c); }
  .rc-bar-label { font-family: var(--font-mono, monospace); font-size: 10px; color: #999; }

  /* Footer */
  .rc-footer { font-family: var(--font-mono, monospace); font-size: 10px; letter-spacing: 1px; color: #666; }

  .recap-actions {
    display: flex;
    justify-content: center;
    margin-top: 1.25rem;
  }
  .btn-download {
    padding: 0.75rem 1.75rem;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    cursor: pointer;
    transition: background var(--transition-fast), box-shadow var(--transition-fast);
  }
  .btn-download:hover:not(:disabled) {
    background: var(--accent-hover);
    box-shadow: 0 0 20px var(--accent-glow);
  }
  .btn-download:disabled { opacity: 0.6; cursor: wait; }

  @media (max-width: 480px) {
    .btn-download { width: 100%; }
  }
</style>