<script>
  import { onMount, onDestroy } from 'svelte';
  import Modal from './Modal.svelte';
  import { toast } from '$lib/stores/toast';
  import { auth } from '$lib/stores/api';
  import { getCachedProfilePhoto } from '$lib/utils/profilePhotoCache';

  export let show = false;
  export let username = 'User';
  export let initials = '?';
  export let profileImage = '';
  export let totalHours = '0.0';
  export let totalSessions = 0;
  export let doneTasks = 0;
  export let chartDays = []; // [{ label, minutes, isToday }]
  export let currentStreak = 0;

  const CARD_W = 600;
  const CARD_H = 320;

  let cardEl;
  let wrapEl;
  let downloading = false;
  let scale = 1;

  // Belt-and-suspenders: prefer the explicit prop, then the logged-in
  // user object (covers localStorage-restored sessions), then the
  // local photo cache (covers the case where the backend save hasn't
  // gone through yet) — so the photo shows up "no matter what".
  $: resolvedImage = profileImage || $auth.user?.profile_image || getCachedProfilePhoto() || '';

  $: chartMax = Math.max(...(chartDays.map(d => d.minutes)), 1);

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

  async function downloadCard() {
    if (!cardEl) return;
    downloading = true;
    try {
      const html2canvas = (await import('html2canvas')).default;
      // Render the un-scaled 600x320 card regardless of on-screen size
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
          toast.warn?.('Kart oluşturulamadı, tekrar dene');
          return;
        }
        const link = document.createElement('a');
        link.download = `velocity-${username}-stats.png`;
        link.href = URL.createObjectURL(blob);
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 2000);
        downloading = false;
        toast.success?.('Kart indirildi! 🎉');
      }, 'image/png');
    } catch (e) {
      downloading = false;
      toast.warn?.('Kart oluşturulamadı, tekrar dene');
    }
  }
</script>

<Modal bind:show wide on:close={() => (show = false)}>
  <div class="share-modal-header">
    <h3>📊 İstatistik Kartı</h3>
  </div>

  <div class="share-card-wrap" bind:this={wrapEl}>
    <div class="share-card-scaler" style="width: {CARD_W * scale}px; height: {CARD_H * scale}px;">
      <div
        class="share-card"
        bind:this={cardEl}
        style="width: {CARD_W}px; height: {CARD_H}px; transform: scale({scale});"
      >
        <!-- Header -->
        <div class="sc-header">
          <div class="sc-avatar">
            {#if resolvedImage}
              <img
                src={resolvedImage}
                alt={username}
                class="sc-avatar-img"
                crossorigin={resolvedImage.startsWith('data:') ? undefined : 'anonymous'}
              />
            {:else}
              <div class="sc-avatar-fallback">{initials}</div>
            {/if}
          </div>
          <div class="sc-identity">
            <div class="sc-username">{username}</div>
            <div class="sc-tagline">VELOCITY · WEEKLY RECAP</div>
          </div>

          <div class="sc-header-right">
            {#if currentStreak > 0}
              <div class="sc-streak" class:hot={currentStreak >= 7}>🔥 <span>{currentStreak} GÜN STREAK</span></div>
            {/if}
            <div class="sc-logo">
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
        <div class="sc-stats">
          <div class="sc-stat">
            <div class="sc-stat-value accent">{totalHours}</div>
            <div class="sc-stat-label">SAAT FOCUS</div>
          </div>
          <div class="sc-stat">
            <div class="sc-stat-value">{totalSessions}</div>
            <div class="sc-stat-label">OTURUM</div>
          </div>
          <div class="sc-stat">
            <div class="sc-stat-value">{doneTasks}</div>
            <div class="sc-stat-label">TAMAMLANAN GÖREV</div>
          </div>
        </div>

        <div class="sc-divider"></div>

        <!-- Weekly chart -->
        <div class="sc-chart-label">SON 7 GÜN</div>
        <div class="sc-chart">
          {#each chartDays as day}
            {@const pct = Math.max(6, (day.minutes / chartMax) * 100)}
            <div class="sc-bar-col">
              <div class="sc-bar-track">
                <div class="sc-bar" class:today={day.isToday} style="height: {pct}%"></div>
              </div>
              <div class="sc-bar-label">{day.label}</div>
            </div>
          {/each}
        </div>

        <!-- Footer -->
        <div class="sc-footer">velocity-timer.app</div>
      </div>
    </div>
  </div>

  <div class="share-actions">
    <button class="btn-download" on:click={downloadCard} disabled={downloading}>
      {downloading ? 'Hazırlanıyor...' : '⬇ PNG Olarak İndir'}
    </button>
  </div>
</Modal>

<style>
  .share-card-wrap {
    width: 100%;
    display: flex;
    justify-content: center;
    padding: 0.5rem;
  }
  .share-modal-header { margin-bottom: 0.75rem; }
  .share-modal-header h3 { font-size: 1.1rem; font-weight: 800; color: var(--text-primary); margin: 0; }

  /* Outer box reserves the *scaled* footprint so the modal doesn't
     leave a giant empty gap below the shrunk card. */
  .share-card-scaler {
    position: relative;
    overflow: hidden;
    border-radius: 20px;
  }

  /* Fixed 600x320 "design canvas" — always laid out at full size,
     then visually scaled down to fit the modal via transform.
     This keeps every font-size/spacing proportionally correct at
     any screen width, instead of text overlapping when the
     container shrinks. */
  .share-card {
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
  .sc-header { display: flex; align-items: center; gap: 14px; }
  .sc-avatar {
    width: 44px; height: 44px; flex-shrink: 0;
    border-radius: 50%;
    border: 1.5px solid #f97316;
    overflow: hidden;
    display: flex; align-items: center; justify-content: center;
  }
  .sc-avatar-img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .sc-avatar-fallback {
    width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    background: linear-gradient(90deg, #f97316, #fb923c);
    color: #0d0d0d;
    font-family: var(--font-mono, monospace);
    font-size: 20px; font-weight: 800;
  }
  .sc-identity { display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1 1 auto; overflow: hidden; }
  .sc-username { font-size: 22px; font-weight: 800; line-height: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sc-tagline { font-family: var(--font-mono, monospace); font-size: 11px; font-weight: 700; letter-spacing: 2px; color: #f97316; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .sc-header-right {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 12px;
    margin-left: auto;
  }
  .sc-streak {
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
  .sc-streak.hot {
    background: linear-gradient(135deg, rgba(251,146,60,0.25), rgba(239,68,68,0.12));
    border-color: #fb923c;
    box-shadow: 0 0 14px rgba(251,146,60,0.35);
  }
  .sc-logo { flex-shrink: 0; display: flex; }

  /* Stats */
  .sc-stats { display: flex; gap: 40px; margin-top: 30px; }
  .sc-stat-value { font-family: var(--font-mono, monospace); font-size: 40px; font-weight: 800; line-height: 1; color: #fff; }
  .sc-stat-value.accent { color: #f97316; }
  .sc-stat-label { margin-top: 8px; font-size: 12px; color: #999; }

  /* Divider */
  .sc-divider { height: 1px; background: #2a2a2a; margin: 22px 0 18px; }

  /* Chart */
  .sc-chart-label { font-size: 12px; font-weight: 700; letter-spacing: 1px; color: #999; margin-bottom: 14px; }
  .sc-chart { display: flex; gap: 12px; flex: 1; align-items: flex-end; }
  .sc-bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8px; height: 100%; }
  .sc-bar-track { width: 100%; flex: 1; display: flex; align-items: flex-end; }
  .sc-bar { width: 100%; border-radius: 4px; background: #3a3a3a; min-height: 4px; }
  .sc-bar.today { background: linear-gradient(90deg, #f97316, #fb923c); }
  .sc-bar-label { font-family: var(--font-mono, monospace); font-size: 11px; color: #999; }

  /* Footer */
  .sc-footer { font-family: var(--font-mono, monospace); font-size: 10px; letter-spacing: 1px; color: #666; margin-top: 14px; }

  .share-actions {
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