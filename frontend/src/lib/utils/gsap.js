import { browser } from '$app/environment';

let gsapInstance = null;
let ScrollTriggerPlugin = null;

export async function initGSAP() {
  if (!browser) return { gsap: null, ScrollTrigger: null };

  const { gsap } = await import('gsap');
  const { ScrollTrigger } = await import('gsap/ScrollTrigger');
  const { TextPlugin } = await import('gsap/TextPlugin');
  const { CustomEase } = await import('gsap/CustomEase');

  gsap.registerPlugin(ScrollTrigger, TextPlugin, CustomEase);

  CustomEase.create('velBounce', 'M0,0 C0.14,0 0.242,0.438 0.272,0.561 0.313,0.728 0.354,0.963 0.362,1 0.37,1.037 0.414,1.098 0.468,1.098 0.522,1.098 0.606,1.057 0.68,1.008 0.752,0.959 0.8,0.982 0.84,1 0.88,1.018 0.924,1 1,1');
  CustomEase.create('velSwoop', 'M0,0 C0.6,0 0.4,1 1,1');

  gsapInstance = gsap;
  ScrollTriggerPlugin = ScrollTrigger;

  return { gsap, ScrollTrigger };
}

/**
 * @param {string | Element[]} targets
 * @param {{ delay?: number, from?: string }} [options]
 */
export function staggerReveal(targets, options = {}) {
  if (!gsapInstance) return;
  gsapInstance.fromTo(targets,
    { opacity: 0, y: 24 },
    {
      opacity: 1, y: 0,
      duration: 0.6,
      stagger: 0.08,
      delay: options.delay ?? 0,
      ease: 'velSwoop',
    }
  );
}

/**
 * @param {HTMLElement} el
 * @param {number} [strength]
 */
export function magneticHover(el, strength = 0.4) {
  if (!browser || !gsapInstance) return () => {};
  const gsap = gsapInstance;

  const onMove = (e) => {
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) * strength;
    const dy = (e.clientY - cy) * strength;
    gsap.to(el, { x: dx, y: dy, duration: 0.4, ease: 'power2.out' });
  };

  const onLeave = () => {
    gsap.to(el, { x: 0, y: 0, duration: 0.6, ease: 'velBounce' });
  };

  el.addEventListener('mousemove', onMove);
  el.addEventListener('mouseleave', onLeave);

  return () => {
    el.removeEventListener('mousemove', onMove);
    el.removeEventListener('mouseleave', onLeave);
  };
}

/**
 * @param {HTMLElement} el
 * @param {number} [duration]
 */
export function glitchText(el, duration = 0.8) {
  if (!gsapInstance) return;
  const original = el.textContent ?? '';
  const chars = '!@#$%^&*01';
  let tl = gsapInstance.timeline();
  const steps = 8;

  for (let i = 0; i < steps; i++) {
    tl.to(el, {
      duration: duration / steps,
      text: {
        value: original.split('').map(() =>
          Math.random() > 0.5 ? chars[Math.floor(Math.random() * chars.length)] : ' '
        ).join(''),
        delimiter: '',
      },
      ease: 'none',
    });
  }
  tl.to(el, { duration: 0.1, text: { value: original, delimiter: '' }, ease: 'none' });
}

/**
 * @param {HTMLElement} el
 * @param {number} to
 * @param {number} [duration]
 * @param {string} [prefix]
 * @param {string} [suffix]
 */
export function animateCounter(el, to, duration = 1.5, prefix = '', suffix = '') {
  if (!gsapInstance) return;
  gsapInstance.fromTo(
    { val: 0 },
    { val: to },
    {
      duration,
      ease: 'power2.out',
      onUpdate: function() { el.textContent = prefix + Math.round(this.targets()[0].val) + suffix; }
    }
  );
}

export { gsapInstance as gsap, ScrollTriggerPlugin as ScrollTrigger };
