<script>
  import Modal from './Modal.svelte';
  import { audio } from '$lib/stores/audio';
  import { t } from '$lib/stores/i18n';
  import { YOUTUBE_TRACKS, extractVideoId } from '$lib/utils/ambientAudio';
  import {
    notificationsEnabled,
    isNotificationSupported,
    getPermission,
    requestNotificationPermission,
    setNotificationsEnabled,
  } from '$lib/utils/notifications';

  export let show = false;
  export let musicPlaying = false;
  export let toggleMusic = () => {};
  export let currentTrack = 'lofi';
  export let onTrackChange = (t) => {};

  const TRACKS = Object.entries(YOUTUBE_TRACKS).map(([id, t]) => ({ id, label: t.label }));

  let customUrl = '';
  let customError = '';

  function handleCustomPlay() {
    customError = '';
    const videoId = extractVideoId(customUrl);
    if (!videoId) { customError = 'Geçerli bir YouTube linki gir.'; return; }
    onTrackChange(videoId); // video ID'yi doğrudan geçir
    if (!musicPlaying) toggleMusic();
    customUrl = '';
  }

  function handleCustomKey(e) {
    if (e.key === 'Enter') handleCustomPlay();
  }

  let notifSupported = isNotificationSupported();
  let notifPermission = notifSupported ? getPermission() : 'unsupported';

  async function handleNotifToggle() {
    if (!notifSupported) return;
    if (notifPermission === 'granted') {
      setNotificationsEnabled(!$notificationsEnabled);
    } else {
      const result = await requestNotificationPermission();
      notifPermission = result;
    }
  }

  function handleVolumeChange(e) {
    const val = parseFloat(e.target.value);
    audio.setVolume(val);
    e.target.style.setProperty('--fill', (val * 100) + '%');
  }
</script>

<Modal {show} on:close>
  <button class="modal-close" on:click={() => show = false}>✕</button>
  <h3 class="modal-title font-mono">{$t('sound_settings_title')}</h3>
  
  <div class="settings-section">
    <!-- svelte-ignore a11y-label-has-associated-control -->
    <label class="setting-label">{$t('sound_volume_label')}</label>
    <div class="volume-control">
      <span class="volume-icon">🔇</span>
      <input 
        type="range" 
        min="0" 
        max="1" 
        step="0.01"
        value={$audio.volume}
        on:change={handleVolumeChange}
        on:input={handleVolumeChange}
        class="volume-slider"
        style="--fill: {$audio.volume * 100}%"
      />
      <span class="volume-icon">🔊</span>
      <span class="volume-value font-mono">{Math.round($audio.volume * 100)}%</span>
    </div>
  </div>

  <div class="settings-section">
    <!-- svelte-ignore a11y-label-has-associated-control -->
    <label class="setting-label">{$t('sound_environment_label')}</label>
    <div class="track-grid">
      {#each TRACKS as track}
        <button
          class="track-btn"
          class:active={currentTrack === track.id}
          on:click={() => onTrackChange(track.id)}
        >
          {track.label}
        </button>
      {/each}
    </div>
  </div>

  <div class="settings-section">
    <!-- svelte-ignore a11y-label-has-associated-control -->
    <label class="setting-label">{$t('sound_youtube_label')}</label>
    <div class="custom-url-row">
      <input
        class="custom-url-input"
        type="text"
        placeholder="{$t('sound_youtube_placeholder')}"
        bind:value={customUrl}
        on:keydown={handleCustomKey}
      />
      <button class="custom-play-btn" on:click={handleCustomPlay}>▶</button>
    </div>
    {#if customError}
      <p class="custom-error">{customError}</p>
    {/if}
  </div>

  <div class="settings-section">
    <div class="music-toggle">
      <button 
        class="music-btn"
        class:playing={musicPlaying}
        on:click={toggleMusic}
        title={musicPlaying ? $t('music_off') : $t('music_on')}
      >
        {#if musicPlaying}
          <span class="music-icon">⏸</span>
          {$t('music_off')}
        {:else}
          <span class="music-icon">▶</span>
          {$t('music_on')}
        {/if}
      </button>
    </div>
  </div>

  <div class="settings-section">
    <!-- svelte-ignore a11y-label-has-associated-control -->
    <label class="setting-label">🔔 {$t('notifications_label')}</label>
    {#if !notifSupported}
      <p class="setting-hint">{$t('sound_notif_unsupported')}</p>
    {:else if notifPermission === 'denied'}
      <p class="setting-hint">{$t('notif_denied')}</p>
    {:else}
      <button
        class="music-btn"
        class:playing={notifPermission === 'granted' && $notificationsEnabled}
        on:click={handleNotifToggle}
      >
        {#if notifPermission === 'granted' && $notificationsEnabled}
          <span class="music-icon">🔔</span>
          {$t('notif_on')}
        {:else}
          <span class="music-icon">🔕</span>
          {$t('notif_off')}
        {/if}
      </button>
      <p class="setting-hint">{$t('sound_notif_hint')}</p>
    {/if}
  </div>

  <div class="modal-actions">
    <button class="btn-accent" on:click={() => show = false}>{$t('shortcut_close')}</button>
  </div>
</Modal>

<style>
  .modal-close {
    position: absolute;
    top: 1rem;
    right: 1rem;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: transparent;
    border: 1px solid var(--border-base);
    color: var(--text-tertiary);
    font-size: 0.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color var(--transition-fast);
  }

  .modal-close:hover {
    color: var(--text-primary);
  }

  .modal-title {
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--text-primary);
    margin-bottom: 1.5rem;
  }

  .settings-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }

  .setting-label {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-primary);
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .music-toggle {
    display: flex;
    gap: 0.75rem;
  }

  .music-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: var(--bg-elevated);
    border: 1px solid var(--border-base);
    border-radius: var(--radius-md);
    color: var(--text-primary);
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .music-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  .music-btn.playing {
    background: var(--accent-subtle);
    border-color: var(--accent);
    color: var(--accent);
  }

  .music-icon {
    font-size: 1rem;
  }

  .volume-control {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .volume-icon {
    font-size: 0.9rem;
    flex-shrink: 0;
  }

  .volume-slider {
    flex: 1;
    height: 6px;
    -webkit-appearance: none;
    appearance: none;
    background: linear-gradient(to right,
      var(--accent) 0%,
      var(--accent) var(--fill, 6%),
      var(--bg-elevated) var(--fill, 6%),
      var(--bg-elevated) 100%
    );
    border-radius: 3px;
    outline: none;
    cursor: pointer;
    vertical-align: middle;
    align-self: center;
  }

  .volume-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--accent);
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    margin-top: -5px;
  }

  .volume-slider::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--accent);
    cursor: pointer;
    border: none;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  .volume-slider::-webkit-slider-runnable-track {
    background: transparent;
    height: 6px;
    border-radius: 3px;
  }

  .volume-slider::-moz-range-track {
    height: 6px;
    border-radius: 3px;
    background: transparent;
  }

  .volume-value {
    font-size: 0.75rem;
    color: var(--text-secondary);
    min-width: 38px;
    text-align: right;
  }

  .setting-hint {
    font-size: 0.75rem;
    color: var(--text-tertiary);
    line-height: 1.4;
    margin-top: 0.25rem;
  }

  .track-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 0.5rem;
  }

  .track-btn {
    padding: 0.55rem 0.4rem;
    border: 1px solid var(--border-base);
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--text-secondary);
    font-size: 0.72rem;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-fast);
    text-align: center;
  }

  .track-btn:hover {
    border-color: var(--accent);
    color: var(--text-primary);
  }

  .track-btn.active {
    background: var(--accent-subtle);
    border-color: var(--accent);
    color: var(--accent);
  }

  .custom-url-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .custom-url-input {
    flex: 1;
    background: var(--bg-elevated);
    border: 1px solid var(--border-base);
    border-radius: var(--radius-md);
    color: var(--text-primary);
    font-family: var(--font-sans);
    font-size: 0.8rem;
    padding: 0.5rem 0.75rem;
    outline: none;
    transition: border-color 150ms ease;
  }
  .custom-url-input::placeholder { color: var(--text-tertiary); }
  .custom-url-input:focus { border-color: var(--accent); }

  .custom-play-btn {
    width: 36px;
    height: 36px;
    border-radius: var(--radius-md);
    background: var(--accent);
    color: white;
    border: none;
    font-size: 0.85rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: background 150ms ease;
  }
  .custom-play-btn:hover { background: var(--accent-hover); }

  .custom-error {
    font-size: 0.72rem;
    color: #f87171;
    margin-top: 0.35rem;
  }

  .modal-actions {
    display: flex;
    gap: 0.75rem;
    margin-top: 1.5rem;
  }

  .btn-accent {
    flex: 1;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 0.5rem 1.1rem;
    background: var(--accent);
    color: white;
    border-radius: var(--radius-md);
    border: none;
    transition: background var(--transition-fast), box-shadow var(--transition-fast);
  }

  .btn-accent:hover {
    background: var(--accent-hover);
    box-shadow: 0 0 16px var(--accent-glow);
  }
</style>