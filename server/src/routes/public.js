/**
 * Everything a website visitor's browser calls. No login needed.
 */
const express = require('express');
const mongoose = require('mongoose');

const Location = require('../models/Location');
const Award = require('../models/Award');
const Document = require('../models/Document');
const Message = require('../models/Message');
const gridfs = require('../services/storage/gridfs');
const { driver } = require('../services/storage');
const { notifyContact, mailMode } = require('../services/mailer');
const { locationOut, awardOut, documentOut } = require('../services/serializers');
const { contactLimiter } = require('../middleware/rateLimit');
const { dbState } = require('../config/db');
const v = require('../utils/validate');
const { notFound } = require('../utils/httpError');
const pkg = require('../../package.json');

const router = express.Router();

/** Browsers and proxies may reuse public reads briefly; the admin panel never caches. */
function shortCache(res) {
  res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
}

/* ------------------------------------------------------------------ */
/* Health                                                              */
/* ------------------------------------------------------------------ */

router.get('/health', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({
    ok: true,
    service: 'ceylon-energy-api',
    version: pkg.version,
    mongo: dbState(),
    storage: driver(),
    mail: mailMode(),
    time: new Date().toISOString(),
  });
});

/* ------------------------------------------------------------------ */
/* Gallery — same paths and shape as the previous gallery API          */
/* ------------------------------------------------------------------ */

const PUBLISHED = { published: { $ne: false } };

router.get('/projects', async (req, res) => {
  const locations = await Location.find(PUBLISHED).sort({ order: 1, name: 1 }).lean();
  const out = locations.map((loc) => locationOut(loc)).filter((loc) => loc.photoCount > 0);
  shortCache(res);
  res.json({ ok: true, count: out.length, locations: out });
});

router.get('/projects/:locSlug', async (req, res) => {
  const loc = await Location.findOne({ slug: String(req.params.locSlug), ...PUBLISHED }).lean();
  if (!loc) throw notFound('Location not found.');
  shortCache(res);
  res.json({ ok: true, location: locationOut(loc) });
});

/* ------------------------------------------------------------------ */
/* Awards and documents                                                */
/* ------------------------------------------------------------------ */

router.get('/awards', async (req, res) => {
  const awards = await Award.find(PUBLISHED).sort({ order: 1, createdAt: -1 }).lean();
  shortCache(res);
  res.json({ ok: true, awards: awards.map((a) => awardOut(a)) });
});

router.get('/documents', async (req, res) => {
  const [profile, attachments] = await Promise.all([
    Document.findOne({ kind: 'profile', ...PUBLISHED }).lean(),
    Document.find({ kind: 'attachment', ...PUBLISHED }).sort({ order: 1, createdAt: -1 }).lean(),
  ]);
  shortCache(res);
  res.json({
    ok: true,
    profile: profile ? documentOut(profile) : null,
    attachments: attachments.filter((d) => d.pages?.length).map((d) => documentOut(d)),
  });
});

/* ------------------------------------------------------------------ */
/* Files stored in GridFS                                              */
/* ------------------------------------------------------------------ */

const SERVABLE = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

/** Parse "bytes=start-end" (single range only). Returns null when unusable. */
function parseRange(header, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header || '');
  if (!match) return null;
  let start = match[1] === '' ? undefined : Number(match[1]);
  let end = match[2] === '' ? undefined : Number(match[2]);
  if (start === undefined && end === undefined) return null;
  if (start === undefined) {
    start = Math.max(0, size - end); // "bytes=-500" = the last 500 bytes
    end = size - 1;
  }
  if (end === undefined || end >= size) end = size - 1;
  if (start > end || start >= size) return 'unsatisfiable';
  return { start, end };
}

router.get('/files/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw notFound('File not found.');
  const file = await gridfs.find(req.params.id);
  const type = file?.metadata?.contentType;
  if (!file || !SERVABLE.has(type)) throw notFound('File not found.');

  const etag = `"${file._id}-${file.length}"`;
  const filename = encodeURIComponent(file.filename || 'file');
  const disposition = req.query.download ? 'attachment' : 'inline';

  res.set({
    'Content-Type': type,
    'Accept-Ranges': 'bytes',
    // A file id never points at different bytes, so it can be cached forever.
    'Cache-Control': 'public, max-age=31536000, immutable',
    ETag: etag,
    'Last-Modified': file.uploadDate.toUTCString(),
    'Content-Disposition': `${disposition}; filename*=UTF-8''${filename}`,
    // Lets a React app on another domain display these images too.
    'Cross-Origin-Resource-Policy': 'cross-origin',
  });
  // The page CSP (object-src 'none') stops Chrome's built-in PDF viewer
  // from rendering the file, and a PDF or image runs no page scripts anyway.
  res.removeHeader('Content-Security-Policy');

  if (req.get('if-none-match') === etag) return res.status(304).end();

  const range = req.get('range') ? parseRange(req.get('range'), file.length) : null;
  if (range === 'unsatisfiable') {
    res.set('Content-Range', `bytes */${file.length}`);
    return res.status(416).end();
  }

  if (range) {
    res.status(206);
    res.set('Content-Range', `bytes ${range.start}-${range.end}/${file.length}`);
    res.set('Content-Length', String(range.end - range.start + 1));
  } else {
    res.set('Content-Length', String(file.length));
  }

  if (req.method === 'HEAD') return res.end();

  const stream = gridfs.openStream(file._id, range || undefined);
  stream.on('error', (err) => {
    console.error(`  GridFS read failed for ${file._id}:`, err.message);
    res.destroy(err);
  });
  req.on('close', () => stream.destroy());
  stream.pipe(res);
});

/* ------------------------------------------------------------------ */
/* Contact form                                                        */
/* ------------------------------------------------------------------ */

router.post('/contact', contactLimiter, async (req, res) => {
  const body = req.body || {};

  // Honeypot: a field hidden from people but filled in by bots. Answer
  // as if it worked, so the bot learns nothing, and store nothing.
  if (body.website) return res.status(201).json({ ok: true });

  const data = {
    name: v.text(body.name, { label: 'Your name', max: 100, required: true }),
    email: v.email(body.email, { label: 'Your e-mail' }),
    phone: v.text(body.phone ?? body.tel, { label: 'Phone', max: 40 }),
    subject: v.text(body.subject, { label: 'Subject', max: 200 }),
    message: v.text(body.message, { label: 'Your message', max: 5000, required: true, multiline: true }),
  };

  const message = await Message.create({
    ...data,
    ip: req.ip || '',
    userAgent: String(req.get('user-agent') || '').slice(0, 400),
  });

  const delivery = await notifyContact(message);
  res.status(201).json({ ok: true, id: String(message._id), emailed: delivery.status === 'sent' });
});

module.exports = router;
module.exports.parseRange = parseRange;
