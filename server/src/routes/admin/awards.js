/**
 * Awards & recognitions. Replaces admin/awards.php + award-actions.php,
 * which wrote a JSON file and dropped images into the web folder.
 */
const express = require('express');

const Award = require('../../models/Award');
const storage = require('../../services/storage');
const { awardOut } = require('../../services/serializers');
const { acceptFiles, checkImages } = require('../../middleware/upload');
const v = require('../../utils/validate');
const { badRequest, notFound } = require('../../utils/httpError');

const router = express.Router();
const imageUpload = acceptFiles([{ name: 'image', maxCount: 1 }]);

async function loadAward(id) {
  const award = await Award.findById(v.objectId(id, 'Award'));
  if (!award) throw notFound('Award not found — it may have been removed.');
  return award;
}

router.get('/', async (req, res) => {
  const awards = await Award.find().sort({ order: 1, createdAt: -1 }).lean();
  res.json({ ok: true, awards: awards.map((a) => awardOut(a, { admin: true })) });
});

router.post('/', imageUpload, async (req, res) => {
  const title = v.text(req.body?.title, { label: 'Title', max: 120, required: true });
  const year = v.year(req.body?.year);
  const file = req.files?.image?.[0];
  if (!file) throw badRequest('Choose an image of the award (JPG, PNG or WebP).');

  const [image] = await checkImages([file], { label: 'image' });
  const asset = await storage.saveImage(image.path, { ...image, folder: 'awards' });

  // Newest first: take a number lower than every existing award.
  const first = await Award.findOne().sort({ order: 1 }).lean();
  try {
    const award = await Award.create({ title, year, image: asset, order: first ? first.order - 1 : 0 });
    res.status(201).json({ ok: true, award: awardOut(award.toObject(), { admin: true }) });
  } catch (err) {
    await storage.remove(asset);
    throw err;
  }
});

router.put('/order', async (req, res) => {
  const ids = v.idList(req.body?.ids, 'award ids');
  const awards = await Award.find({}, { _id: 1 }).lean();
  const known = new Set(awards.map((a) => String(a._id)));
  if (ids.length !== known.size || ids.some((id) => !known.has(id))) {
    throw badRequest('The new order must list every award exactly once. Reload the page and try again.');
  }
  await Award.bulkWrite(ids.map((id, i) => ({ updateOne: { filter: { _id: id }, update: { $set: { order: i } } } })));
  res.json({ ok: true });
});

router.patch('/:id', imageUpload, async (req, res) => {
  const award = await loadAward(req.params.id);
  const body = req.body || {};

  if (body.title !== undefined) award.title = v.text(body.title, { label: 'Title', max: 120, required: true });
  if (body.year !== undefined) award.year = v.year(body.year);
  if (body.published !== undefined) award.published = v.bool(body.published);

  let replaced = null;
  let added = null;
  const file = req.files?.image?.[0];
  if (file) {
    const [image] = await checkImages([file], { label: 'image' });
    replaced = award.image.toObject();
    added = await storage.saveImage(image.path, { ...image, folder: 'awards' });
    award.image = added;
  }

  try {
    await award.save();
  } catch (err) {
    if (added) await storage.remove(added);
    throw err;
  }
  if (replaced) await storage.remove(replaced);
  res.json({ ok: true, award: awardOut(award.toObject(), { admin: true }) });
});

router.delete('/:id', async (req, res) => {
  const award = await loadAward(req.params.id);
  const image = award.image.toObject();
  await award.deleteOne();
  await storage.remove(image);
  res.json({ ok: true });
});

module.exports = router;
