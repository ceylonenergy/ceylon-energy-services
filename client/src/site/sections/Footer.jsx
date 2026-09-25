import { CONTACT } from '../content.js';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="widget">
          <h3 className="widget-title">Meet Us</h3>
          <ul className="contact-info">
            <li>
              <i className="budicon-pin" />
              <p>
                World Trade Center,
                <br />
                Level 26 &amp; 34 East Tower Echelon Square,
                <br />
                Colombo 00100.
              </p>
            </li>
          </ul>
        </div>
        <div className="widget">
          <h3 className="widget-title">Call Us</h3>
          <ul className="contact-info">
            {CONTACT.phones.map((p) => (
              <li key={p.href}>
                <i className="budicon-telephone" />
                <p>
                  <a href={p.href}>{p.label}</a>
                </p>
              </li>
            ))}
          </ul>
        </div>
        <div className="widget">
          <h3 className="widget-title">Write to Us</h3>
          <ul className="contact-info">
            {CONTACT.emails.map((email) => (
              <li key={email}>
                <i className="budicon-mail" />
                <p>
                  <a href={`mailto:${email}`}>{email}</a>
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="container sub-footer">
        <p>
          © {new Date().getFullYear()} Ceylon Energy Services · All rights reserved. ·{' '}
          {/* A full page load on purpose: the admin panel is a separate bundle with its own styles. */}
          <a href="/admin" rel="nofollow" style={{ opacity: 0.55 }}>
            Admin
          </a>
        </p>
        <ul className="social">
          {CONTACT.socials.map((s) => (
            <li key={s.label}>
              <a href={s.href} aria-label={s.label} target="_blank" rel="noopener noreferrer">
                <i className={`fa ${s.icon}`} />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
