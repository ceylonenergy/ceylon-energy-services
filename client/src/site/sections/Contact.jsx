import { useState } from 'react';
import { CONTACT } from '../content.js';
import { api } from '../../lib/api.js';

const EMPTY = { name: '', email: '', subject: '', tel: '', message: '', website: '' };

/**
 * The enquiry form. Posts to /api/contact, which saves the message in
 * MongoDB and emails the team. Unlike the old PHP form, the visitor is
 * told the truth: "thank you" only when the server confirms it.
 */
export default function Contact() {
  const [form, setForm] = useState(EMPTY);
  const [status, setStatus] = useState({ state: 'idle', text: '' });

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setStatus({ state: 'err', text: 'Please fill in your name, e-mail and message.' });
      return;
    }
    setStatus({ state: 'sending', text: 'Sending…' });
    try {
      await api('/api/contact', { method: 'POST', body: form });
      setStatus({ state: 'ok', text: "Thank you — we'll be in touch shortly." });
      setForm(EMPTY);
    } catch (err) {
      setStatus({
        state: 'err',
        text:
          err.status === 400 || err.status === 429
            ? err.message
            : `Couldn't send automatically — please email ${CONTACT.emails[0]} directly.`,
      });
    }
  }

  return (
    <section id="contact" className="wrap-dark pad">
      <div className="container contact-grid">
        <div>
          <p className="eyebrow gold">Get In Touch</p>
          <h2 className="section-title reveal">Let's plan your build</h2>
          <p className="reveal">
            Tell us what you're working on — solar, security, structural, or all three — and we'll come back with a scoped plan.
          </p>
          <ul className="contact-info-list reveal">
            <li>
              <i className="budicon-pin" />
              <p>
                {CONTACT.addressLines[0]}
                <br />
                {CONTACT.addressLines[1]}
              </p>
            </li>
            <li>
              <i className="budicon-telephone" />
              <p>
                {CONTACT.phones.map((p, i) => (
                  <span key={p.href}>
                    {i > 0 && <> &nbsp;·&nbsp; </>}
                    <a href={p.href}>{p.label}</a>
                  </span>
                ))}
              </p>
            </li>
            <li>
              <i className="budicon-mail" />
              <p>
                <a href={`mailto:${CONTACT.emails[0]}`}>{CONTACT.emails[0]}</a>
              </p>
            </li>
          </ul>
        </div>
        <div className="reveal">
          <form className="vanilla vanilla-form" id="contactForm" noValidate onSubmit={submit}>
            <div className="field-row">
              <div className="field">
                <label htmlFor="f-name">Your name*</label>
                <input id="f-name" type="text" name="name" required maxLength={100} autoComplete="name" value={form.name} onChange={set('name')} />
              </div>
              <div className="field">
                <label htmlFor="f-email">Your e-mail*</label>
                <input id="f-email" type="email" name="email" required maxLength={200} autoComplete="email" value={form.email} onChange={set('email')} />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label htmlFor="f-subject">Subject</label>
                <input id="f-subject" type="text" name="subject" maxLength={200} value={form.subject} onChange={set('subject')} />
              </div>
              <div className="field">
                <label htmlFor="f-tel">Your phone</label>
                <input id="f-tel" type="tel" name="tel" maxLength={40} autoComplete="tel" value={form.tel} onChange={set('tel')} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="f-message">Your message*</label>
              <textarea id="f-message" name="message" required maxLength={5000} value={form.message} onChange={set('message')} />
            </div>
            {/* Spam trap: hidden from people, filled in by bots. */}
            <div className="hp-field" aria-hidden="true">
              <label htmlFor="f-website">Leave this empty</label>
              <input id="f-website" type="text" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} />
            </div>
            <button type="submit" className="btn" id="submitBtn" disabled={status.state === 'sending'}>
              <span>{status.state === 'sending' ? 'Sending…' : 'Send Message'}</span>
            </button>
            <div className={`form-note${status.state === 'ok' ? ' ok' : status.state === 'err' ? ' err' : ''}`} id="formNote" role="status" aria-live="polite">
              {status.state !== 'sending' && status.text}
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
