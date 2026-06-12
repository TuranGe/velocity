<script>
  import { onMount } from 'svelte';
  import { initGSAP } from '$lib/utils/gsap';

  export let progress = 0;
  export let size = 280;
  export let strokeWidth = 3;
  export let status = 'idle';

  $: radius = (size - strokeWidth * 2) / 2;
  $: circumference = 2 * Math.PI * radius;
  $: offset = circumference * (1 - progress);

  let ringEl;
  let pulseEl;
  let gsap;
  let pulseAnim;

  onMount(async () => {
    ({ gsap } = await initGSAP());
    startPulse();
  });

  function startPulse() {
    if (!gsap || !pulseEl) return;
    pulseAnim?.kill();
    if (status === 'running') {
      pulseAnim = gsap.to(pulseEl, {
        opacity: 0,
        scale: 1.08,
        transformOrigin: 'center center',
        duration: 1.8,
        ease: 'power1.inOut',
        repeat: -1,
        yoyo: true,
      });
    }
  }

  $: if (gsap && status) {
    pulseAnim?.kill();
    if (status === 'running') {
      startPulse();
    } else if (pulseEl) {
      gsap.to(pulseEl, { opacity: 0, scale: 1, duration: 0.3 });
    }
  }

  $: if (gsap && ringEl) {
    gsap.to(ringEl, {
      strokeDashoffset: offset,
      duration: 0.8,
      ease: 'power2.out',
    });
  }

  $: if (gsap && status === 'completed' && ringEl) {
    gsap.timeline()
      .to(ringEl, { strokeDashoffset: 0, duration: 0.6, ease: 'power3.out' })
      .to(ringEl, { scale: 1.05, transformOrigin: 'center', duration: 0.2, yoyo: true, repeat: 3, ease: 'power2.inOut' });
  }
</script>

<svg
  class="progress-ring"
  width={size}
  height={size}
  viewBox="0 0 {size} {size}"
  role="img"
  aria-label="Timer progress"
>
  {#each Array(60) as _, i}
    {@const angle = (i / 60) * 360}
    {@const isHour = i % 5 === 0}
    {@const r1 = radius + strokeWidth + (isHour ? 6 : 3)}
    {@const r2 = radius + strokeWidth + (isHour ? 12 : 6)}
    {@const rad = (angle - 90) * Math.PI / 180}
    {@const x1 = size/2 + r1 * Math.cos(rad)}
    {@const y1 = size/2 + r1 * Math.sin(rad)}
    {@const x2 = size/2 + r2 * Math.cos(rad)}
    {@const y2 = size/2 + r2 * Math.sin(rad)}
    <line
      x1={x1} y1={y1} x2={x2} y2={y2}
      stroke={isHour ? 'var(--border-strong)' : 'var(--border-subtle)'}
      stroke-width={isHour ? 1.5 : 0.75}
      stroke-linecap="round"
    />
  {/each}

  <circle
    bind:this={pulseEl}
    cx={size/2}
    cy={size/2}
    r={radius}
    fill="none"
    stroke="var(--accent)"
    stroke-width={strokeWidth + 1}
    opacity="0"
  />

  <circle
    cx={size/2}
    cy={size/2}
    r={radius}
    fill="none"
    stroke="var(--border-subtle)"
    stroke-width={strokeWidth}
  />

  <circle
    bind:this={ringEl}
    cx={size/2}
    cy={size/2}
    r={radius}
    fill="none"
    stroke="var(--accent)"
    stroke-width={strokeWidth}
    stroke-linecap="round"
    stroke-dasharray={circumference}
    stroke-dashoffset={offset}
    transform="rotate(-90 {size/2} {size/2})"
    style="filter: drop-shadow(0 0 6px var(--accent-glow));"
  />

  <circle
    cx={size/2}
    cy={size/2}
    r="3"
    fill="var(--accent)"
    opacity={progress > 0 ? 1 : 0.3}
  />
</svg>

<style>
  .progress-ring {
    flex-shrink: 0;
    will-change: transform;
    overflow: visible;
  }
</style>