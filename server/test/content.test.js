const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { app, request, setup, teardown, createAdmin, loginAgent, PNG, JPEG, PDF, NOT_AN_IMAGE } = require('./helpers');
const Award = require('../src/models/Award');
const Document = require('../src/models/Document');

let agent;
const files = () => mongoose.connection.db.collection('uploads.files');

before(async () => {
  await setup();
  await createAdmin();
  agent = await loginAgent();
});
after(teardown);
beforeEach(async () => {
  await Award.deleteMany({});
  await Document.deleteMany({});
  await files().deleteMany({});
  await mongoose.connection.db.collection('uploads.chunks').deleteMany({});
});

/* ------------------------------ awards ------------------------------ */

test('awards: add, newest first, edit, hide, reorder, delete', async () => {
  const noImage = await agent.post('/api/admin/awards').field('title', 'No picture');
  assert.equal(noImage.status, 400);

  const badYear = await agent.post('/api/admin/awards').field('title', 'X').field('year', '25').attach('image', PNG, 'a.png');
  assert.equal(badYear.status, 400);
  assert.equal(await files().countDocuments(), 0, 'nothing stored for an invalid request');

  const first = await agent.post('/api/admin/awards').field('title', 'Best Installer').field('year', '2024').attach('image', PNG, 'a.png');
  assert.equal(first.status, 201);
  const second = await agent.post('/api/admin/awards').field('title', 'Safety Award').attach('image', JPEG, 'b.jpg');
  assert.equal(second.body.award.year, null);

  let pub = (await request(app).get('/api/awards')).body.awards;
  assert.deepEqual(pub.map((a) => a.title), ['Safety Award', 'Best Installer'], 'newest first');
  assert.match(pub[0].image.card, /^\/api\/files\//);

  const edited = await agent
    .patch(`/api/admin/awards/${first.body.award.id}`)
    .field('title', 'Best Solar Installer')
    .attach('image', JPEG, 'new.jpg');
  assert.equal(edited.body.award.title, 'Best Solar Installer');
  assert.equal(await files().countDocuments(), 2, 'replaced image is removed');

  await agent.patch(`/api/admin/awards/${second.body.award.id}`).send({ published: false });
  pub = (await request(app).get('/api/awards')).body.awards;
  assert.deepEqual(pub.map((a) => a.title), ['Best Solar Installer']);

  await agent.put('/api/admin/awards/order').send({ ids: [first.body.award.id, second.body.award.id] });
  const adminList = (await agent.get('/api/admin/awards')).body.awards;
  assert.deepEqual(adminList.map((a) => a.id), [first.body.award.id, second.body.award.id]);

  assert.equal((await agent.delete(`/api/admin/awards/${second.body.award.id}`)).status, 200);
  assert.equal(await Award.countDocuments(), 1);
  assert.equal(await files().countDocuments(), 1);
});

test('awards: a disguised file is refused', async () => {
  const res = await agent.post('/api/admin/awards').field('title', 'X').attach('image', NOT_AN_IMAGE, 'award.png');
  assert.equal(res.status, 400);
  assert.equal(await Award.countDocuments(), 0);
});

/* ---------------------------- documents ----------------------------- */

function uploadProfile(pages = 2) {
  let req = agent.put('/api/admin/documents/profile').attach('pdf', PDF, 'Ceylon-Energy-Company-Profile.pdf');
  for (let i = 0; i < pages; i++) req = req.attach('pages', JPEG, `page-${i + 1}.jpg`);
  return req;
}

test('documents: profile upload, public listing, and PDF download', async () => {
  const noPages = await agent.put('/api/admin/documents/profile').attach('pdf', PDF, 'p.pdf');
  assert.equal(noPages.status, 400);

  const notPdf = await agent.put('/api/admin/documents/profile').attach('pdf', PNG, 'fake.pdf').attach('pages', JPEG, 'p1.jpg');
  assert.equal(notPdf.status, 400);
  assert.equal(await files().countDocuments(), 0);

  const up = await uploadProfile(3);
  assert.equal(up.status, 201);
  assert.equal(up.body.document.kind, 'profile');
  assert.equal(up.body.document.title, 'Company Profile');
  assert.equal(up.body.document.pageCount, 3);

  const pub = (await request(app).get('/api/documents')).body;
  assert.equal(pub.profile.pageCount, 3);
  assert.equal(pub.attachments.length, 0);
  assert.match(pub.profile.pdf.download, /\?download=1$/);

  const pdf = await request(app).get(pub.profile.pdf.url).buffer(true).parse((res, cb) => {
    const chunks = [];
    res.on('data', (c) => chunks.push(c));
    res.on('end', () => cb(null, Buffer.concat(chunks)));
  });
  assert.equal(pdf.status, 200);
  assert.equal(pdf.headers['content-type'], 'application/pdf');
  assert.match(pdf.headers['content-disposition'], /^inline;/);
  assert.equal(pdf.headers['content-security-policy'], undefined, "no CSP on PDFs (breaks Chrome's viewer)");
  assert.deepEqual(pdf.body, PDF);

  const dl = await request(app).get(pub.profile.pdf.download);
  assert.match(dl.headers['content-disposition'], /^attachment;/);
});

test('documents: byte ranges and conditional requests on stored files', async () => {
  const up = await uploadProfile(1);
  const url = up.body.document.pdf.url;

  const part = await request(app).get(url).set('Range', 'bytes=0-7');
  assert.equal(part.status, 206);
  assert.equal(part.headers['content-range'], `bytes 0-7/${PDF.length}`);
  assert.equal(part.headers['content-length'], '8');

  const tail = await request(app).get(url).set('Range', 'bytes=-6');
  assert.equal(tail.status, 206);
  assert.equal(tail.headers['content-range'], `bytes ${PDF.length - 6}-${PDF.length - 1}/${PDF.length}`);

  const beyond = await request(app).get(url).set('Range', `bytes=${PDF.length + 10}-`);
  assert.equal(beyond.status, 416);

  const first = await request(app).get(url);
  const cached = await request(app).get(url).set('If-None-Match', first.headers.etag);
  assert.equal(cached.status, 304);
});

test('documents: replacing the profile archives the old one; restore swaps back; archive is capped', async () => {
  const v1 = (await uploadProfile(1)).body.document;
  const v2 = (await uploadProfile(2)).body.document;

  let list = (await agent.get('/api/admin/documents')).body;
  assert.equal(list.profile.id, v2.id);
  assert.deepEqual(list.archived.map((d) => d.id), [v1.id]);
  assert.equal((await request(app).get('/api/documents')).body.profile.pageCount, 2);

  const restored = await agent.post(`/api/admin/documents/${v1.id}/restore`);
  assert.equal(restored.status, 200);
  list = (await agent.get('/api/admin/documents')).body;
  assert.equal(list.profile.id, v1.id);
  assert.deepEqual(list.archived.map((d) => d.id), [v2.id]);

  assert.equal((await agent.post(`/api/admin/documents/${v1.id}/restore`)).status, 400, 'only archived versions');

  // Five more replacements: only the newest five archived versions survive.
  for (let i = 0; i < 5; i++) await uploadProfile(1);
  list = (await agent.get('/api/admin/documents')).body;
  assert.equal(list.archived.length, 5);
  assert.ok(!list.archived.some((d) => d.id === v2.id), 'oldest archive trimmed');
  // 1 live + 5 archived documents, each with a PDF and one page.
  assert.equal(await files().countDocuments(), 12, 'trimmed versions take their files with them');
});

test('documents: attachments are additive, editable, hideable and removable', async () => {
  await uploadProfile(1);
  const add = await agent
    .post('/api/admin/documents')
    .field('title', '')
    .attach('pdf', PDF, 'ISO_Certificate-2025.pdf')
    .attach('pages', PNG, 'p1.png');
  assert.equal(add.status, 201);
  assert.equal(add.body.document.title, 'ISO Certificate 2025', 'title falls back to the file name');

  const add2 = await agent.post('/api/admin/documents').field('title', 'Brochure').attach('pdf', PDF, 'b.pdf').attach('pages', JPEG, 'p1.jpg');
  let pub = (await request(app).get('/api/documents')).body;
  assert.deepEqual(pub.attachments.map((d) => d.title), ['Brochure', 'ISO Certificate 2025']);
  assert.ok(pub.profile, 'profile untouched');

  await agent.patch(`/api/admin/documents/${add2.body.document.id}`).send({ title: 'Product Brochure', published: false });
  pub = (await request(app).get('/api/documents')).body;
  assert.deepEqual(pub.attachments.map((d) => d.title), ['ISO Certificate 2025']);

  const before = await files().countDocuments();
  assert.equal((await agent.delete(`/api/admin/documents/${add.body.document.id}`)).status, 200);
  assert.equal(await files().countDocuments(), before - 2, 'PDF and page image removed');
});

/* ------------------------------ stats ------------------------------- */

test('dashboard stats count everything', async () => {
  await agent.post('/api/admin/awards').field('title', 'A').attach('image', PNG, 'a.png');
  await uploadProfile(4);
  const stats = (await agent.get('/api/admin/stats')).body;
  assert.equal(stats.counts.awards, 1);
  assert.equal(stats.counts.profilePages, 4);
  assert.equal(stats.system.storage, 'gridfs');
  assert.equal(stats.system.mongo, 'connected');
});
