/**
 * The Company Profile and additional documents. Replaces
 * admin/attachments.php, upload.php, add-attachment.php and delete.php.
 *
 * Each upload is one PDF plus its pages as images, which the admin
 * panel renders from the PDF in the browser with pdf.js (exactly as the
 * PHP panel did), so the server needs no PDF tooling.
 */
const express = require('express');

const Document = require('../../models/Document');
const storage = require('../../services/storage');
const { documentOut } = require('../../services/serializers');
const { acceptFiles, checkImages, checkPdf, LIMITS } = require('../../middleware/upload');
const v = require('../../utils/validate');
const { badRequest, notFound, tooLarge } = require('../../utils/httpError');

const router = express.Router();

// How many previous Company Profiles to keep for one-click restore
// (the PHP panel kept 5 backup folders).
const ARCHIVE_KEEP = 5;

const documentUpload = acceptFiles(
  [
    { name: 'pdf', maxCount: 1 },
    { name: 'pages', maxCount: LIMITS.pagesPerDocument },
  ],
  { maxFileSize: LIMITS.pdfBytes }
);

const out = (doc) => documentOut(doc.toObject ? doc.toObject({ virtuals: true }) : doc, { admin: true });

async function loadDocument(id) {
  const doc = await Document.findById(v.objectId(id, 'Document'));
  if (!doc) throw notFound('Document not found — it may have been removed.');
  return doc;
}

const assetsOf = (doc) => [doc.pdf, ...doc.pages].filter(Boolean).map((a) => (a.toObject ? a.toObject() : a));

async function destroyDocument(doc) {
  const assets = assetsOf(doc);
  await doc.deleteOne();
  await storage.removeAll(assets);
}

/**
 * Validate and store the PDF + page images from a request. Everything is
 * validated before anything is stored; if storing fails part-way, what
 * was stored is removed again.
 */
async function storeUpload(req, folder) {
  const pdfFile = req.files?.pdf?.[0];
  const pageFiles = req.files?.pages || [];

  const pdf = await checkPdf(pdfFile);
  if (!pageFiles.length) {
    throw badRequest('No page images were received. Wait for the pages to finish generating, then save again.');
  }
  if (pdfFile.size > LIMITS.pdfBytes) throw tooLarge('That PDF is larger than the 60MB limit.');
  const pages = await checkImages(pageFiles, { label: 'page image' });

  const pdfAsset = await storage.savePdf(pdf.path, { originalName: pdf.originalName, folder });
  let pageAssets;
  try {
    pageAssets = await storage.saveImages(pages.map((p) => ({ ...p, folder })));
  } catch (err) {
    await storage.remove(pdfAsset);
    throw err;
  }
  return { pdfAsset, pageAssets, originalName: pdf.originalName };
}

const titleFrom = (body, originalName, fallback) =>
  v.text(body?.title, { label: 'Title', max: 120 }) ||
  originalName.replace(/\.pdf$/i, '').replace(/[-_]+/g, ' ').trim().slice(0, 120) ||
  fallback;

/** Delete archived profiles beyond the newest ARCHIVE_KEEP, files included. */
async function trimArchive() {
  const old = await Document.find({ kind: 'archived' }).sort({ archivedAt: -1 }).skip(ARCHIVE_KEEP);
  for (const doc of old) await destroyDocument(doc);
}

/* ------------------------------------------------------------------ */

router.get('/', async (req, res) => {
  const [profile, attachments, archived] = await Promise.all([
    Document.findOne({ kind: 'profile' }).lean(),
    Document.find({ kind: 'attachment' }).sort({ order: 1, createdAt: -1 }).lean(),
    Document.find({ kind: 'archived' }).sort({ archivedAt: -1 }).lean(),
  ]);
  res.json({
    ok: true,
    profile: profile ? out(profile) : null,
    attachments: attachments.map(out),
    archived: archived.map(out),
  });
});

/** Replace the Company Profile. The previous one is archived, not deleted. */
router.put('/profile', documentUpload, async (req, res) => {
  const { pdfAsset, pageAssets, originalName } = await storeUpload(req, 'documents/company-profile');

  let created;
  try {
    created = await Document.create({
      title: titleFrom(req.body, '', 'Company Profile'),
      kind: 'profile',
      pdf: pdfAsset,
      pages: pageAssets,
      originalName,
    });
  } catch (err) {
    await storage.removeAll([pdfAsset, ...pageAssets]);
    throw err;
  }

  await Document.updateMany(
    { kind: 'profile', _id: { $ne: created._id } },
    { $set: { kind: 'archived', archivedAt: new Date() } }
  );
  await trimArchive();

  res.status(201).json({ ok: true, document: out(created) });
});

/** Add an additional document. Never touches anything already published. */
router.post('/', documentUpload, async (req, res) => {
  const { pdfAsset, pageAssets, originalName } = await storeUpload(req, 'documents/attachments');

  const first = await Document.findOne({ kind: 'attachment' }).sort({ order: 1 }).lean();
  try {
    const doc = await Document.create({
      title: titleFrom(req.body, originalName, 'Document'),
      kind: 'attachment',
      pdf: pdfAsset,
      pages: pageAssets,
      originalName,
      order: first ? first.order - 1 : 0,
    });
    res.status(201).json({ ok: true, document: out(doc) });
  } catch (err) {
    await storage.removeAll([pdfAsset, ...pageAssets]);
    throw err;
  }
});

router.put('/order', async (req, res) => {
  const ids = v.idList(req.body?.ids, 'document ids');
  const docs = await Document.find({ kind: 'attachment' }, { _id: 1 }).lean();
  const known = new Set(docs.map((d) => String(d._id)));
  if (ids.length !== known.size || ids.some((id) => !known.has(id))) {
    throw badRequest('The new order must list every document exactly once. Reload the page and try again.');
  }
  await Document.bulkWrite(ids.map((id, i) => ({ updateOne: { filter: { _id: id }, update: { $set: { order: i } } } })));
  res.json({ ok: true });
});

router.patch('/:id', async (req, res) => {
  const doc = await loadDocument(req.params.id);
  const body = req.body || {};
  if (body.title !== undefined) doc.title = v.text(body.title, { label: 'Title', max: 120, required: true });
  if (body.published !== undefined) doc.published = v.bool(body.published);
  await doc.save();
  res.json({ ok: true, document: out(doc) });
});

/** Make an archived Company Profile live again; the current one is archived in its place. */
router.post('/:id/restore', async (req, res) => {
  const doc = await loadDocument(req.params.id);
  if (doc.kind !== 'archived') throw badRequest('Only an archived version can be restored.');

  await Document.updateMany({ kind: 'profile' }, { $set: { kind: 'archived', archivedAt: new Date() } });
  doc.kind = 'profile';
  doc.archivedAt = null;
  doc.published = true;
  await doc.save();
  await trimArchive();

  res.json({ ok: true, document: out(doc) });
});

router.delete('/:id', async (req, res) => {
  const doc = await loadDocument(req.params.id);
  await destroyDocument(doc);
  res.json({ ok: true });
});

module.exports = router;
