/**
 * Email for contact-form enquiries, via any SMTP server (cPanel mail,
 * Gmail with an app password, Zoho, Brevo, SendGrid, ...).
 *
 * Email is a notification, not the record: the enquiry is already saved
 * in MongoDB before this runs, and a delivery failure is stored on the
 * message and shown in the admin inbox rather than lost.
 */
const nodemailer = require('nodemailer');
const { env } = require('../config/env');

let transporter = null;

function mailMode() {
  return env.mail.transport; // smtp | console | json | disabled
}

function getTransporter() {
  if (transporter) return transporter;
  const mode = mailMode();
  if (mode === 'smtp') {
    transporter = nodemailer.createTransport({
      host: env.mail.host,
      port: env.mail.port,
      secure: env.mail.secure,
      auth: env.mail.user ? { user: env.mail.user, pass: env.mail.pass } : undefined,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
    });
  } else if (mode === 'console' || mode === 'json') {
    transporter = nodemailer.createTransport({ jsonTransport: true });
  }
  return transporter;
}

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Build the notification email for one saved message. */
function buildContactEmail(msg) {
  const rows = [
    ['Name', msg.name],
    ['Email', msg.email],
    ['Phone', msg.phone || '—'],
    ['Subject', msg.subject || '—'],
  ];

  const text =
    "You've received a new message from the Ceylon Energy Services website.\n\n" +
    rows.map(([k, v]) => `${k}: ${v}`).join('\n') +
    `\n\nMessage:\n${msg.message}\n`;

  const html =
    '<p>You\'ve received a new message from the Ceylon Energy Services website.</p>' +
    '<table cellpadding="6" style="border-collapse:collapse">' +
    rows
      .map(([k, v]) => `<tr><td style="color:#4c7089"><b>${k}</b></td><td>${escapeHtml(v)}</td></tr>`)
      .join('') +
    '</table>' +
    `<p style="white-space:pre-wrap;border-left:3px solid #1e93d8;padding-left:12px">${escapeHtml(msg.message)}</p>`;

  return {
    from: env.mail.from ? `"Ceylon Energy Website" <${env.mail.from}>` : undefined,
    to: env.mail.to.join(', '),
    replyTo: `"${msg.name.replace(/"/g, '')}" <${msg.email}>`,
    // Names can contain anything; strip line breaks so they cannot inject headers.
    subject: `Ceylon Energy Services — New message from ${msg.name}`.replace(/[\r\n]+/g, ' '),
    text,
    html,
  };
}

/**
 * Send the notification for a saved message and record the outcome on
 * it. Resolves either way; never throws.
 */
async function notifyContact(msg) {
  const transport = getTransporter();
  if (!transport || !env.mail.to.length) {
    msg.delivery = { status: 'skipped', error: 'Email is not configured (SMTP_HOST).', at: new Date() };
    await msg.save();
    return msg.delivery;
  }

  try {
    const info = await transport.sendMail(buildContactEmail(msg));
    if (mailMode() === 'console') {
      console.log('\n  [MAIL_TRANSPORT=console] Email that would be sent:\n', JSON.parse(info.message), '\n');
    }
    msg.delivery = { status: 'sent', error: '', at: new Date() };
  } catch (err) {
    console.error('  Contact email failed:', err.message);
    msg.delivery = { status: 'failed', error: err.message.slice(0, 300), at: new Date() };
  }
  await msg.save();
  return msg.delivery;
}

/** For `npm run check`: can we log in to the SMTP server? */
async function verifyMail() {
  const transport = getTransporter();
  if (!transport) return { ok: false, detail: 'not configured' };
  if (mailMode() !== 'smtp') return { ok: true, detail: mailMode() };
  await transport.verify();
  return { ok: true, detail: `${env.mail.host}:${env.mail.port}` };
}

module.exports = { notifyContact, verifyMail, buildContactEmail, mailMode };
