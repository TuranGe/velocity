// ── YouTube Ambient Player ────────────────────────────────────
// YouTube IFrame API üzerinden telifsiz müzik çalar.
// Üç hazır track + kullanıcının yapıştırdığı herhangi bir YouTube URL'i.

export const YOUTUBE_TRACKS = {
  lofi: {
    id: '60z2wqa-Rdk',
    label: '☕ Focus',
  },
  nature: {
    id: '8MUlk3qjByY',
    label: '💻 Chillstep',
  },
  deepwork: {
    id: 'k5rEQ2wFPUw',
    label: '🧠 Night Studies',
  },
};

// youtube.com/watch?v=ID  |  youtu.be/ID  |  youtube.com/embed/ID
export function extractVideoId(input) {
  if (!input) return null;
  input = input.trim();
  // Zaten sadece ID (11 karakter)
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;
  try {
    const url = new URL(input.startsWith('http') ? input : 'https://' + input);
    if (url.hostname.includes('youtu.be')) return url.pathname.slice(1).split('/')[0];
    if (url.hostname.includes('youtube.com')) {
      if (url.pathname.includes('/embed/')) return url.pathname.split('/embed/')[1].split('/')[0];
      return url.searchParams.get('v');
    }
  } catch {}
  return null;
}

export function createAmbientEngine() {
  let player = null;
  let playing = false;
  let currentTrack = 'lofi';
  let targetVolume = 0.06;
  let containerId = 'yt-ambient-player';
  let apiReady = false;
  let pendingPlay = false;

  // YouTube IFrame API'yi bir kez yükle
  function loadAPI() {
    if (window.YT && window.YT.Player) { apiReady = true; return Promise.resolve(); }
    return new Promise(resolve => {
      const existing = document.getElementById('yt-api-script');
      if (existing) {
        // Script zaten yükleniyor, callback'i bekle
        const prev = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => { prev?.(); apiReady = true; resolve(); };
        return;
      }
      window.onYouTubeIframeAPIReady = () => { apiReady = true; resolve(); };
      const script = document.createElement('script');
      script.id = 'yt-api-script';
      script.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(script);
    });
  }

  function ensureContainer() {
    let el = document.getElementById(containerId);
    if (!el) {
      el = document.createElement('div');
      el.id = containerId;
      el.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;top:-9999px;left:-9999px';
      document.body.appendChild(el);
    }
    return el;
  }

  function destroyPlayer() {
    if (player) {
      try { player.destroy(); } catch {}
      player = null;
    }
  }

  function createPlayer(videoId, volume, autoplay) {
    destroyPlayer();
    ensureContainer();
    if (!videoId) return;

    const vol = Math.round(volume * 100);

    player = new window.YT.Player(containerId, {
      videoId,
      playerVars: {
        autoplay: autoplay ? 1 : 0,
        loop: 1,
        playlist: videoId,
        controls: 0,
        disablekb: 1,
        fs: 0,
        modestbranding: 1,
        iv_load_policy: 3,
        rel: 0,
      },
      events: {
        onReady(e) {
          e.target.setVolume(vol);
          if (autoplay) e.target.playVideo();
        },
        onStateChange(e) {
          if (e.data === window.YT.PlayerState.ENDED) {
            e.target.playVideo();
          }
        },
      },
    });
  }

  function resolveVideoId(trackIdOrCustomId) {
    // Önce hazır track listesine bak, yoksa doğrudan video ID olarak kullan
    return YOUTUBE_TRACKS[trackIdOrCustomId]?.id ?? trackIdOrCustomId;
  }

  async function start(track, volume) {
    if (playing) stop({ immediate: true });
    currentTrack = track;
    targetVolume = volume;
    playing = true;

    await loadAPI();
    createPlayer(resolveVideoId(track), volume, true);
  }

  function stop({ immediate = false } = {}) {
    playing = false;
    if (player) {
      try {
        if (!immediate) {
          let vol = Math.round(targetVolume * 100);
          const fade = setInterval(() => {
            vol = Math.max(0, vol - 10);
            try { player.setVolume(vol); } catch {}
            if (vol <= 0) { clearInterval(fade); destroyPlayer(); }
          }, 80);
        } else {
          destroyPlayer();
        }
      } catch {
        destroyPlayer();
      }
    }
  }

  function setVolume(volume) {
    targetVolume = volume;
    if (player && playing) {
      try { player.setVolume(Math.round(volume * 100)); } catch {}
    }
  }

  function changeTrack(trackId, volume) {
    if (!playing) { currentTrack = trackId; return; }
    currentTrack = trackId;
    targetVolume = volume;
    const videoId = resolveVideoId(trackId);
    if (player) {
      try {
        player.loadVideoById({ videoId, suggestedQuality: 'small' });
        player.setVolume(Math.round(volume * 100));
      } catch {
        createPlayer(videoId, volume, true);
      }
    } else {
      createPlayer(videoId, volume, true);
    }
  }

  function isPlaying() { return playing; }
  function getTrack() { return currentTrack; }

  return { start, stop, setVolume, changeTrack, isPlaying, getTrack };
}