import { useEffect, useState } from 'react';
import { EXTERNAL_LINKS, NAV_LINKS } from '../content.js';

/**
 * Which section is on screen. A section that is not laid out at all
 * (display:none) reports offsetTop 0 and would "match" at every scroll
 * position, so those are skipped — the bug that once kept "Awards"
 * underlined while you were reading Products.
 */
function useActiveSection() {
  const [active, setActive] = useState('home');
  useEffect(() => {
    const update = () => {
      const pos = window.scrollY + window.innerHeight * 0.35;
      let current = 'home';
      for (const { id } of NAV_LINKS) {
        const el = document.getElementById(id);
        if (!el || !el.getClientRects().length) continue;
        if (pos >= el.offsetTop) current = id;
      }
      setActive(current);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);
  return active;
}

export default function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const active = useActiveSection();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className={`nav${scrolled ? ' is-scrolled' : ''}`} id="siteNav">
      <div className="nav-inner">
        <a href="#home" className="brand">
          <img src="/assets/images/logo@2x.ico" alt="Ceylon Energy & Engineering Services" className="brand-full-logo" />
        </a>
        <div className="nav-right">
          <ul className={`nav-links${open ? ' is-open' : ''}`} id="navLinks">
            {NAV_LINKS.map((link) => (
              <li key={link.id}>
                <a href={`#${link.id}`} className={active === link.id ? 'active' : undefined} onClick={() => setOpen(false)}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          {EXTERNAL_LINKS.map((link) => (
            <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer" className="nav-crm-btn">
              <span className="crm-label">{link.label}</span> <span className="crm-arrow">&#8594;</span>
            </a>
          ))}
          <button
            className={`nav-toggle${open ? ' is-open' : ''}`}
            id="navToggle"
            aria-label="Toggle menu"
            aria-expanded={open}
            aria-controls="navLinks"
            onClick={() => setOpen((o) => !o)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>
    </nav>
  );
}
