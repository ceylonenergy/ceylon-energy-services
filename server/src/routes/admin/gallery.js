/**
 * Gallery management: locations -> projects -> photos.
 *
 * Addressed by MongoDB id rather than slug, so renaming something never
 * breaks the next request. Slugs are fixed when an item is created and
 * kept on rename, so public links stay stable.
 */
const express = require('express');

const Location = require('../../models/Location');
const storage = require('../../services/storage');
const { locationOut } = require('../../services/serializers');
const { acceptFiles, checkImages, LIMITS } = require('../../middleware/upload');
const { uniqueSlug } = require('../../utils/slugify');
const v = require('../../utils/validate');
const { badRequest, notFound } = require('../../utils/httpError');

const router = express.Router();

async function loadLocation(id) {
  const loc = await Location.findById(v.objectId(id, 'Location'));
  if (!loc) throw notFound('Location not found — it may have been removed.');
  return loc;
}

function findProject(loc, id) {
  const proj = loc.projects.id(v.objectId(id, 'Project'));
  if (!proj) throw notFound('Project not found — it may have been removed.');
  return proj;
}

function findPhoto(proj, id) {
  const photo = proj.photos.id(v.objectId(id, 'Photo'));
  if (!photo) throw notFound('Photo not found — it may have been removed.');
  return photo;
}

/** Put items in the order given by `ids`, which must list every item exactly once. */
function applyOrder(items, ids, what) {
  const current = items.map((item) => String(item._id)).sort();
  const wanted = [...ids].sort();
  if (current.length !== wanted.length || current.some((id, i) => id !== wanted[i])) {
    throw badRequest(`The new order must list every ${what} exactly once. Reload the page and try again.`);
  }
  const position = new Map(ids.map((id, i) => [id, i]));
  for (const item of items) item.order = position.get(String(item._id));
}

const tree = (loc) => locationOut(loc.toObject ? loc.toObject() : loc, { admin: true });

/* ------------------------------------------------------------------ */
/* Read                                                                */
/* ------------------------------------------------------------------ */

router.get('/', async (req, res) => {
  const locations = await Location.find().sort({ order: 1, name: 1 }).lean();
  res.json({ ok: true, locations: locations.map((loc) => locationOut(loc, { admin: true })) });
});

/* ------------------------------------------------------------------ */
/* Locations                                                           */
/* ------------------------------------------------------------------ */

router.post('/locations', async (req, res) => {
  const name = v.text(req.body?.name, { label: 'Location name', max: 80, required: true });

  const existing = await Location.find({}, { slug: 1, name: 1, order: 1 }).lean();
  if (existing.some((l) => l.name.toLowerCase() === name.toLowerCase())) {
    throw badRequest(`There is already a location called "${name}".`);
  }

  const loc = await Location.create({
    slug: uniqueSlug('loc-', name, existing.map((l) => l.slug)),
    name,
    order: existing.reduce((max, l) => Math.max(max, (l.order ?? 0) + 1), 0),
    projects: [],
  });
  res.status(201).json({ ok: true, location: tree(loc) });
});

router.put('/locations/order', async (req, res) => {
  const ids = v.idList(req.body?.ids, 'location ids');
  const locations = await Location.find({}, { _id: 1, order: 1 });
  applyOrder(locations, ids, 'location');
  await Location.bulkWrite(
    locations.map((l) => ({ updateOne: { filter: { _id: l._id }, update: { $set: { order: l.order } } } }))
  );
  res.json({ ok: true });
});

router.patch('/locations/:locId', async (req, res) => {
  const loc = await loadLocation(req.params.locId);
  const body = req.body || {};

  if (body.name !== undefined) {
    const name = v.text(body.name, { label: 'Location name', max: 80, required: true });
    const clash = await Location.exists({
      _id: { $ne: loc._id },
      name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
    });
    if (clash) throw badRequest(`There is already a location called "${name}".`);
    loc.name = name;
  }
  if (body.published !== undefined) loc.published = v.bool(body.published);

  await loc.save();
  res.json({ ok: true, location: tree(loc) });
});

router.delete('/locations/:locId', async (req, res) => {
  const loc = await loadLocation(req.params.locId);
  const assets = loc.projects.flatMap((p) => p.photos.map((ph) => ph.toObject()));
  await loc.deleteOne();
  // Storage is cleaned after the database: if it fails, the site is
  // already correct and the leftover is an orphaned file, not a broken image.
  await storage.removeAll(assets);
  res.json({ ok: true, removedPhotos: assets.length });
});

/* ------------------------------------------------------------------ */
/* Projects                                                            */
/* ------------------------------------------------------------------ */

router.post('/locations/:locId/projects', async (req, res) => {
  const loc = await loadLocation(req.params.locId);
  const name = v.text(req.body?.name, { label: 'Project name', max: 120, required: true });
  const description = v.text(req.body?.description, { label: 'Description', max: 2000, multiline: true });

  if (loc.projects.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
    throw badRequest(`"${loc.name}" already has a project called "${name}".`);
  }

  loc.projects.push({
    slug: uniqueSlug('proj-', name, loc.projects.map((p) => p.slug)),
    name,
    description,
    order: loc.projects.reduce((max, p) => Math.max(max, (p.order ?? 0) + 1), 0),
    photos: [],
  });
  await loc.save();
  res.status(201).json({ ok: true, location: tree(loc) });
});

router.put('/locations/:locId/projects/order', async (req, res) => {
  const loc = await loadLocation(req.params.locId);
  applyOrder(loc.projects, v.idList(req.body?.ids, 'project ids'), 'project');
  await loc.save();
  res.json({ ok: true, location: tree(loc) });
});

router.patch('/locations/:locId/projects/:projId', async (req, res) => {
  const loc = await loadLocation(req.params.locId);
  const proj = findProject(loc, req.params.projId);
  const body = req.body || {};

  if (body.name !== undefined) {
    const name = v.text(body.name, { label: 'Project name', max: 120, required: true });
    if (loc.projects.some((p) => !p._id.equals(proj._id) && p.name.toLowerCase() === name.toLowerCase())) {
      throw badRequest(`"${loc.name}" already has a project called "${name}".`);
    }
    proj.name = name;
  }
  if (body.description !== undefined) {
    proj.description = v.text(body.description, { label: 'Description', max: 2000, multiline: true });
  }
  if (body.published !== undefined) proj.published = v.bool(body.published);

  await loc.save();
  res.json({ ok: true, location: tree(loc) });
});

router.delete('/locations/:locId/projects/:projId', async (req, res) => {
  const loc = await loadLocation(req.params.locId);
  const proj = findProject(loc, req.params.projId);
  const assets = proj.photos.map((ph) => ph.toObject());
  proj.deleteOne();
  await loc.save();
  await storage.removeAll(assets);
  res.json({ ok: true, removedPhotos: assets.length, location: tree(loc) });
});

/* ------------------------------------------------------------------ */
/* Photos                                                              */
/* ------------------------------------------------------------------ */

router.post(
  '/locations/:locId/projects/:projId/photos',
  acceptFiles([{ name: 'photos', maxCount: LIMITS.photosPerUpload }]),
  async (req, res) => {
    const files = req.files?.photos || [];
    if (!files.length) throw badRequest('Choose at least one photo (JPG, PNG or WebP).');

    // Validate everything before uploading anything.
    const images = await checkImages(files, { label: 'photo' });
    const loc = await loadLocation(req.params.locId);
    const proj = findProject(loc, req.params.projId);

    const folder = `completed-projects/${loc.slug}/${proj.slug}`;
    const saved = await storage.saveImages(images.map((img) => ({ ...img, folder })));

    let order = proj.photos.reduce((max, p) => Math.max(max, (p.order ?? 0) + 1), 0);
    for (const asset of saved) {
      proj.photos.push({ ...asset, caption: '', order: order++ });
    }

    try {
      await loc.save();
    } catch (err) {
      await storage.removeAll(saved); // do not leave files nothing points at
      throw err;
    }
    res.status(201).json({ ok: true, added: saved.length, location: tree(loc) });
  }
);

router.put('/locations/:locId/projects/:projId/photos/order', async (req, res) => {
  const loc = await loadLocation(req.params.locId);
  const proj = findProject(loc, req.params.projId);
  applyOrder(proj.photos, v.idList(req.body?.ids, 'photo ids'), 'photo');
  await loc.save();
  res.json({ ok: true, location: tree(loc) });
});

router.patch('/locations/:locId/projects/:projId/photos/:photoId', async (req, res) => {
  const loc = await loadLocation(req.params.locId);
  const photo = findPhoto(findProject(loc, req.params.projId), req.params.photoId);
  photo.caption = v.text(req.body?.caption, { label: 'Caption', max: 200 });
  await loc.save();
  res.json({ ok: true, location: tree(loc) });
});

router.delete('/locations/:locId/projects/:projId/photos/:photoId', async (req, res) => {
  const loc = await loadLocation(req.params.locId);
  const photo = findPhoto(findProject(loc, req.params.projId), req.params.photoId);
  const asset = photo.toObject();
  photo.deleteOne();
  await loc.save();
  await storage.remove(asset);
  res.json({ ok: true, location: tree(loc) });
});

module.exports = router;
