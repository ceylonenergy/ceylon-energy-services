import { useEffect, useLayoutEffect, useRef } from 'react';
import '../styles/main.css';
import '../styles/site.css';
import Cursor from './Cursor.jsx';
import Nav from './sections/Nav.jsx';
import Hero from './sections/Hero.jsx';
import About from './sections/About.jsx';
import Products from './sections/Products.jsx';
import Packages from './sections/Packages.jsx';
import ProjectsGallery from './sections/ProjectsGallery.jsx';
import Awards from './sections/Awards.jsx';
import Documents from './sections/Documents.jsx';
import Contact from './sections/Contact.jsx';
import Footer from './sections/Footer.jsx';
import { revealOnScroll } from './motion.js';

/** The public one-page website. */
export default function SitePage() {
  const rootRef = useRef(null);

  // Scroll reveals for the fixed sections. Sections that load data
  // (gallery, awards, documents) animate their own cards once loaded.
  useLayoutEffect(() => {
    const root = rootRef.current;
    const staticReveals = [...root.querySelectorAll('.reveal')].filter(
      (el) => !el.closest('.album-grid, .proj-grid, .cp-grid')
    );
    const cleanups = [
      revealOnScroll(staticReveals.filter((el) => !el.classList.contains('pkg-card'))),
      revealOnScroll(root.querySelectorAll('.pkg-card'), {
        from: { opacity: 0, y: 36 },
        duration: 0.7,
        start: 'top 92%',
        delay: (i) => i * 0.08,
      }),
    ];
    return () => cleanups.forEach((fn) => fn());
  }, []);

  // A reload with no #section in the URL should start at the top, not
  // wherever the browser last was (which made the nav look "wrong").
  useEffect(() => {
    document.title = 'Ceylon Energy Services — Power, Protection & Structure';
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    if (window.location.hash) {
      document.getElementById(window.location.hash.slice(1))?.scrollIntoView();
    } else {
      window.scrollTo(0, 0);
    }
  }, []);

  return (
    <div ref={rootRef}>
      <div className="grain" />
      <Cursor />
      <Nav />
      <main>
        <Hero />
        <About />
        <Products />
        <Packages />
        <ProjectsGallery />
        <Awards />
        <Documents />
        <Contact />
      </main>
      <Footer />
    </div>
  );
}
