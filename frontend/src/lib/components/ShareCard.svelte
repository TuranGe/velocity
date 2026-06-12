<script>
  import Modal from './Modal.svelte';
  import { toast } from '$lib/stores/toast';

  export let show = false;
  export let username = 'User';
  export let initials = '?';
  export let totalHours = '0.0';
  export let totalSessions = 0;
  export let totalTasks = 0;
  export let doneTasks = 0;
  export let chartDays = []; // [{ label, minutes, isToday }]
  export let currentStreak = 0;

  let svgEl;
  let downloading = false;

  $: chartMax = Math.max(...(chartDays.map(d => d.minutes)), 1);

  async function downloadCard() {
    if (!svgEl) return;
    downloading = true;
    try {
      const svgData = new XMLSerializer().serializeToString(svgEl);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      const img = new Image();
      img.crossOrigin = 'anonymous';

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = url;
      });

      const scale = 2; // retina-ish export
      const canvas = document.createElement('canvas');
      canvas.width = 600 * scale;
      canvas.height = 320 * scale;
      const ctx = canvas.getContext('2d');
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, 600, 320);
      URL.revokeObjectURL(url);

      canvas.toBlob((blob) => {
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

<Modal bind:show on:close={() => (show = false)}>
  <div class="share-modal-header">
    <h3>📊 İstatistik Kartı</h3>
  </div>
  <div class="share-card-wrap">
    <svg
      bind:this={svgEl}
      class="share-svg"
      width="600" height="320" viewBox="0 0 600 320"
      xmlns="http://www.w3.org/2000/svg"
    >
      <!-- Background -->
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#1a1a1a"/>
          <stop offset="100%" stop-color="#0d0d0d"/>
        </linearGradient>
        <linearGradient id="accentGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#f97316"/>
          <stop offset="100%" stop-color="#fb923c"/>
        </linearGradient>
      </defs>
      <rect width="600" height="320" rx="20" fill="url(#bg)"/>
      <rect x="1" y="1" width="598" height="318" rx="19" fill="none" stroke="#2a2a2a" stroke-width="1"/>

      <!-- Header -->
      <circle cx="48" cy="48" r="22" fill="url(#accentGrad)"/>
      <text x="48" y="56" font-family="monospace" font-size="20" font-weight="800" fill="#0d0d0d" text-anchor="middle">{initials}</text>

      <text x="84" y="44" font-family="system-ui, sans-serif" font-size="22" font-weight="800" fill="#ffffff">{username}</text>
      <text x="84" y="64" font-family="monospace" font-size="11" font-weight="700" letter-spacing="2" fill="#f97316">VELOCITY · WEEKLY RECAP</text>

      {#if currentStreak > 0}
        <g transform="translate(370, 22)">
          <rect x="0" y="0" width="120" height="30" rx="15" fill="#2a1a0d" stroke="#f97316" stroke-width="1"/>
          <text x="12" y="21" font-size="15">🔥</text>
          <text x="35" y="21" font-family="monospace" font-size="12" font-weight="800" fill="#fb923c">{currentStreak} GÜN STREAK</text>
        </g>
      {/if}

      <!-- Logo mark -->
      <g transform="translate(540, 32)">
        <circle cx="14" cy="14" r="12" stroke="#444" stroke-width="1.5" fill="none" opacity="0.5"/>
        <circle cx="14" cy="14" r="12" stroke="#f97316" stroke-width="1.5" fill="none"
          stroke-dasharray="75.4" stroke-dashoffset="18.85" stroke-linecap="round" transform="rotate(-90 14 14)"/>
        <path d="M11 9.5L18.5 14L11 18.5V9.5Z" fill="#f97316"/>
      </g>

      <!-- Stats row -->
      <g transform="translate(48, 110)">
        <text x="0" y="0" font-family="monospace" font-size="40" font-weight="800" fill="#f97316">{totalHours}</text>
        <text x="0" y="22" font-family="system-ui, sans-serif" font-size="12" fill="#999">SAAT FOCUS</text>
      </g>
      <g transform="translate(220, 110)">
        <text x="0" y="0" font-family="monospace" font-size="40" font-weight="800" fill="#ffffff">{totalSessions}</text>
        <text x="0" y="22" font-family="system-ui, sans-serif" font-size="12" fill="#999">OTURUM</text>
      </g>
      <g transform="translate(390, 110)">
        <text x="0" y="0" font-family="monospace" font-size="40" font-weight="800" fill="#ffffff">{doneTasks}/{totalTasks}</text>
        <text x="0" y="22" font-family="system-ui, sans-serif" font-size="12" fill="#999">GÖREV</text>
      </g>

      <!-- Divider -->
      <line x1="48" y1="160" x2="552" y2="160" stroke="#2a2a2a" stroke-width="1"/>

      <!-- Weekly chart -->
      <text x="48" y="190" font-family="system-ui, sans-serif" font-size="12" font-weight="700" fill="#999" letter-spacing="1">SON 7 GÜN</text>

      {#each chartDays as day, i}
        {@const barH = Math.max(4, (day.minutes / chartMax) * 70)}
        {@const x = 48 + i * 72}
        <rect
          x={x} y={250 - barH} width="36" height={barH} rx="4"
          fill={day.isToday ? 'url(#accentGrad)' : '#3a3a3a'}
        />
        <text x={x + 18} y={272} font-family="monospace" font-size="11" fill="#999" text-anchor="middle">{day.label}</text>
      {/each}

      <!-- Footer -->
      <text x="48" y="305" font-family="monospace" font-size="10" fill="#666" letter-spacing="1">velocity-timer.app</text>
    </svg>
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
    overflow-x: auto;
  }
  .share-modal-header { margin-bottom: 0.75rem; }
  .share-modal-header h3 { font-size: 1.1rem; font-weight: 800; color: var(--text-primary); margin: 0; }
  .share-svg {
    width: 100%;
    max-width: 600px;
    height: auto;
    border-radius: 20px;
    display: block;
  }
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