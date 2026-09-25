import { useEffect, useRef } from 'react';

/**
 * The interactive "energy grid" behind the hero: drifting nodes, links
 * between near neighbours, pulses running along the shortest links, and
 * nodes that move out of the way of the cursor.
 *
 * Ported from the original main.js. Three.js is loaded on demand so the
 * rest of the page does not wait for it, and everything (renderer,
 * listeners, animation loop) is released when the component unmounts.
 */
export default function HeroCanvas() {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    let disposed = false;
    let cleanup = () => {};

    import('./heroGrid.js').then(({ startGrid }) => {
      if (disposed || !mount) return;
      cleanup = startGrid(mount);
    });

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  return <div className="hero-canvas" id="heroCanvas" ref={mountRef} />;
}
