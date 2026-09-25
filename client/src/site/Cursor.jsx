import { useEffect, useRef } from 'react';
import { gsap, isTouchDevice } from './motion.js';

const INTERACTIVE = 'a, button, [role="button"], [data-tilt]';

/**
 * The ring that follows the mouse and grows over anything clickable.
 * Uses event delegation, so gallery cards that load later are covered
 * too (the original only saw elements present at page load).
 */
export default function Cursor() {
  const ref = useRef(null);

  useEffect(() => {
    const cursor = ref.current;
    if (!cursor || isTouchDevice()) return undefined;
    const setX = gsap.quickTo(cursor, 'x', { duration: 0.35, ease: 'power3' });
    const setY = gsap.quickTo(cursor, 'y', { duration: 0.35, ease: 'power3' });

    const move = (e) => {
      cursor.classList.add('is-visible');
      setX(e.clientX);
      setY(e.clientY);
    };
    const over = (e) => cursor.classList.toggle('is-active', Boolean(e.target.closest?.(INTERACTIVE)));
    const leave = () => cursor.classList.remove('is-visible');

    window.addEventListener('mousemove', move);
    document.addEventListener('mouseover', over);
    document.documentElement.addEventListener('mouseleave', leave);
    return () => {
      window.removeEventListener('mousemove', move);
      document.removeEventListener('mouseover', over);
      document.documentElement.removeEventListener('mouseleave', leave);
    };
  }, []);

  return <div className="energy-cursor" id="cursor" ref={ref} aria-hidden="true" />;
}
