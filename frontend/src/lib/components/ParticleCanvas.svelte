<script>
  import { onMount, onDestroy } from 'svelte';
  import { timer } from '$lib/stores/timer';
  import { browser } from '$app/environment';

  let canvas;
  let ctx;
  let animFrame;
  let isRunning = false;
  let w = 0;
  let h = 0;
  let t = 0;

  const blobs = [
    { x: 0.20, y: 0.35, vx:  0.00010, vy:  0.00007, rx: 0.50, ry: 0.32, hue: 22 },
    { x: 0.72, y: 0.60, vx: -0.00008, vy:  0.00010, rx: 0.42, ry: 0.28, hue: 14 },
    { x: 0.50, y: 0.08, vx:  0.00006, vy:  0.00013, rx: 0.38, ry: 0.25, hue: 32 },
    { x: 0.88, y: 0.25, vx: -0.00011, vy: -0.00006, rx: 0.33, ry: 0.22, hue:  8 },
    { x: 0.10, y: 0.80, vx:  0.00009, vy: -0.00009, rx: 0.36, ry: 0.24, hue: 28 },
  ];

  function resize() {
    if (!canvas || !browser) return;
    w = canvas.width  = canvas.offsetWidth;
    h = canvas.height = canvas.offsetHeight;
  }

  function draw() {
    if (!ctx || !browser) return;
    t++;

    ctx.clearRect(0, 0, w, h);

    const baseAlpha = isRunning ? 0.22 : 0.14;
    const speed     = isRunning ? 1.5  : 1.0;

    for (const b of blobs) {
      b.x += b.vx * speed;
      b.y += b.vy * speed;
      if (b.x < 0.05 || b.x > 0.95) b.vx *= -1;
      if (b.y < 0.05 || b.y > 0.95) b.vy *= -1;

      const cx = b.x * w;
      const cy = b.y * h;
      const rx = b.rx * Math.min(w, h);
      const ry = b.ry * Math.min(w, h);

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.sin(t * 0.002 + b.hue) * 0.3);
      ctx.scale(1, ry / rx);

      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      grad.addColorStop(0.0,  `hsla(${b.hue},     100%, 58%, ${baseAlpha})`);
      grad.addColorStop(0.45, `hsla(${b.hue + 8},  95%, 48%, ${baseAlpha * 0.55})`);
      grad.addColorStop(1.0,  `hsla(${b.hue},      90%, 38%, 0)`);

      ctx.beginPath();
      ctx.arc(0, 0, rx, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();
    }

    animFrame = document.visibilityState !== 'hidden'
      ? requestAnimationFrame(draw)
      : null;
  }

  // Only react to timer store in browser
  $: if (browser) isRunning = $timer.status === 'running';

  function handleVisibility() {
    if (document.visibilityState === 'visible') {
      // Resume: kick off a fresh frame if we don't already have one running
      if (!animFrame) draw();
    } else {
      // Pause: cancel the pending frame; draw() won't reschedule itself
      if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
    }
  }

  onMount(() => {
    if (!browser) return;
    ctx = canvas.getContext('2d');
    resize();
    draw();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', handleVisibility);
    canvas.style.transition = 'opacity 2s ease';
    requestAnimationFrame(() => { canvas.style.opacity = '1'; });
  });

  onDestroy(() => {
    if (!browser) return;
    if (animFrame) cancelAnimationFrame(animFrame);
    window.removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', handleVisibility);
  });
</script>

<canvas bind:this={canvas} class="aurora-canvas" aria-hidden="true" />

<style>
  .aurora-canvas {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 0;
    opacity: 0;
  }
</style>