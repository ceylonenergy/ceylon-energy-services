import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import HeroCanvas from './HeroCanvas.jsx';
import { HERO_SLIDES, HERO_STATS } from '../content.js';
import { gsap, prefersReducedMotion } from '../motion.js';

export default function Hero() {
  const [slide, setSlide] = useState(0);
  const rootRef = useRef(null);

  // Cross-fade the background photos every 6 seconds.
  useEffect(() => {
    if (HERO_SLIDES.length < 2 || prefersReducedMotion()) return undefined;
    const timer = setInterval(() => setSlide((s) => (s + 1) % HERO_SLIDES.length), 6000);
    return () => clearInterval(timer);
  }, []);

  // Entrance: headline lines slide up, then the rest fades in.
  useLayoutEffect(() => {
    if (prefersReducedMotion()) return undefined;
    const ctx = gsap.context(() => {
      const lines = gsap.utils.toArray('#heroHeading .line span');
      gsap.set(lines, { yPercent: 110 });
      gsap
        .timeline({ delay: 0.2 })
        .to(lines, { yPercent: 0, duration: 1, ease: 'power4.out', stagger: 0.12 })
        .from('.hero .eyebrow', { opacity: 0, y: -10, duration: 0.6 }, 0)
        .from('.hero-sub, .hero-cta, .hero-stats', { opacity: 0, y: 18, duration: 0.8, stagger: 0.08 }, '-=0.5');
    }, rootRef);
    return () => ctx.revert();
  }, []);

  return (
    <section className="hero" id="home" ref={rootRef}>
      <div className="hero-bg">
        {HERO_SLIDES.map((s, i) => (
          <img key={s.src} className={`hero-bg-img${i === slide ? ' is-active' : ''}`} src={s.src} alt={s.alt} />
        ))}
      </div>
      <HeroCanvas />
      <div className="hero-scrim" />
      <div className="hero-content">
        <div className="hero-panel">
          <p className="eyebrow gold">Solar · Electrical · Security · Structural</p>
          <h1 id="heroHeading">
            <span className="line">
              <span>
                Ceylon <em className="accent">Energy &amp;</em>
              </span>
            </span>
            <span className="line">
              <span>Engineering Services</span>
            </span>
          </h1>
          <p className="hero-sub">
            Powering and protecting Sri Lankan homes and businesses with solar, security, lightning protection, and structural
            solutions.
          </p>
          <div className="hero-cta">
            <a href="#contact" className="btn">
              <span>Get a Quote</span>
            </a>
            <a href="#our-projects" className="btn btn-ghost">
              <span>See Our Work</span>
            </a>
          </div>
          <div className="hero-stats">
            {HERO_STATS.map((s) => (
              <div className="stat" key={s.label}>
                <b>{s.value}</b>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="scroll-cue">
        <div className="wire">
          <i />
        </div>
        Scroll
      </div>
    </section>
  );
}
