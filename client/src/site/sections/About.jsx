import { useEffect, useRef } from 'react';
import Icon from '../Icon.jsx';
import { ABOUT_FACTS, SOLAR_TYPES } from '../content.js';
import { gsap, isTouchDevice } from '../motion.js';

/** The photo tilts gently toward the pointer. */
function useTilt(ref) {
  useEffect(() => {
    const el = ref.current;
    if (!el || isTouchDevice()) return undefined;
    const rotX = gsap.quickTo(el, 'rotateX', { duration: 0.5, ease: 'power3' });
    const rotY = gsap.quickTo(el, 'rotateY', { duration: 0.5, ease: 'power3' });
    el.style.transformStyle = 'preserve-3d';
    const move = (e) => {
      const r = el.getBoundingClientRect();
      rotY(((e.clientX - r.left) / r.width - 0.5) * 10);
      rotX(((e.clientY - r.top) / r.height - 0.5) * -10);
    };
    const leave = () => {
      rotX(0);
      rotY(0);
    };
    el.addEventListener('mousemove', move);
    el.addEventListener('mouseleave', leave);
    return () => {
      el.removeEventListener('mousemove', move);
      el.removeEventListener('mouseleave', leave);
    };
  }, [ref]);
}

export default function About() {
  const frameRef = useRef(null);
  useTilt(frameRef);

  return (
    <section id="about" className="wrap-dark pad">
      <div className="container about-grid">
        <div className="about-media reveal">
          <div className="frame" data-tilt ref={frameRef}>
            <img src="/assets/images/about.jpg" alt="Ceylon Energy Services team at work" />
          </div>
          <span className="about-tag">Since incorporation · PVT LTD</span>
        </div>
        <div className="about-copy">
          <p className="eyebrow">Who We Are</p>
          <h3 className="reveal">Sustainable energy, engineered with care</h3>
          <p className="reveal">
            <span className="dropcap">C</span>eylon Energy &amp; Engineer Services PVT Ltd serves the gap between Sri Lanka's
            growing appetite for sustainable energy and the reliable, expert delivery it deserves. Our work spans lightning
            protection, security systems, roller doors and structural engineering — carried out by a team built on knowledge,
            experience and attitude.
          </p>
          <p className="reveal">
            Incorporated under the Companies Act and guided by the Sustainable Energy Authority, our mandate is simple: build a
            green Ceylon in complete harmony with the environment and nature.
          </p>
          <p className="reveal">
            In solar PV, we're recognised for reliability, flexibility and credibility — a team that treats customer satisfaction
            as the true measure of success, not just the bottom line.
          </p>
          <div className="about-facts reveal">
            {ABOUT_FACTS.map((f) => (
              <div key={f.title}>
                <b>{f.title}</b>
                {f.text}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="container solar-types">
        <div className="section-head center">
          <p className="eyebrow gold center">Choose Your Setup</p>
          <h3 className="solar-types-title reveal">On-Grid, Off-Grid &amp; Hybrid Solar</h3>
          <p className="lede reveal">
            Not every roof needs the same system. Here's a quick look at the three setups we design and install.
          </p>
        </div>
        <div className="solar-types-grid">
          {SOLAR_TYPES.map((t) => (
            <div className="solar-type-card reveal" key={t.title}>
              <div className="st-icon-wrap">
                <Icon name={t.icon} />
              </div>
              <h4>{t.title}</h4>
              <p>{t.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
