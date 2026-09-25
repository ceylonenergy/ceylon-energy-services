/**
 * Scroll animations shared by the site sections. Same choreography as
 * the original main.js (GSAP + ScrollTrigger), with two additions:
 * people who ask their OS for reduced motion get content shown
 * immediately, and every animation is cleaned up when React re-renders.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export { gsap, ScrollTrigger };

const media = (q) => typeof window !== 'undefined' && window.matchMedia?.(q).matches;
export const prefersReducedMotion = () => media('(prefers-reduced-motion: reduce)');
export const isTouchDevice = () => media('(hover: none), (pointer: coarse)');

/**
 * Animate `targets` in as each scrolls into view. Returns a cleanup
 * function for useEffect.
 */
export function revealOnScroll(
  targets,
  { from = { opacity: 0, y: 28 }, duration = 0.9, start = 'top 88%', delay = () => 0, ease = 'power3.out' } = {}
) {
  const els = gsap.utils.toArray(targets);
  if (!els.length) return () => {};
  if (prefersReducedMotion()) {
    gsap.set(els, { opacity: 1 });
    return () => {};
  }
  const ctx = gsap.context(() => {
    els.forEach((el, i) => {
      gsap.fromTo(el, from, {
        opacity: 1,
        y: 0,
        scale: 1,
        duration,
        ease,
        delay: delay(i),
        scrollTrigger: { trigger: el, start },
      });
    });
  });
  return () => ctx.revert();
}

/** Content above changed height: recompute trigger positions. */
export function refreshScroll() {
  ScrollTrigger.refresh();
  window.dispatchEvent(new Event('scroll'));
}
