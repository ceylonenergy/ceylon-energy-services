const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { app, request, setup, teardown, createAdmin, loginAgent, PNG, JPEG, NOT_AN_IMAGE } = require('./helpers');
const Location = require('../src/models/Location');

let agent;

before(async () => {
  await setup();
  await createAdmin();
  agent = await loginAgent();
});
after(teardown);
beforeEach(async () => {
  await Location.deleteMany({});
  await mongoose.connection.db.collection('uploads.files').deleteMany({});
  await mongoose.connection.db.collection('uploads.chunks').deleteMany({});
});

const filesInGridFs = () => mongoose.connection.db.collection('uploads.files').countDocuments();

async function makeProject(locName = 'Colombo', projName = 'Project 01') {
  const loc = (await agent.post('/api/admin/gallery/locations').send({ name: locName })).body.location;
  const withProj = (await agent.post(`/api/admin/gallery/locations/${loc.id}/projects`).send({ name: projName })).body.location;
  return { loc: withProj, proj: withProj.projects[0] };
}

test('reads data written by the previous gallery API unchanged', async () => {
  // Exactly the shape the old server/scripts/migrate-to-cloudinary.js stored: no provider field.
  await Location.collection.insertOne({
    slug: 'loc-rathnapura',
    name: 'Rathnapura',
    order: 0,
    published: true,
    projects: [
      {
        _id: new mongoose.Types.ObjectId(),
        slug: 'proj-belihuloya-project-01',
        name: 'Belihuloya project 01',
        order: 0,
        photos: [
          {
            _id: new mongoose.Types.ObjectId(),
            publicId: 'ceylon-energy/completed-projects/loc-rathnapura/proj-x/abc',
            url: 'https://res.cloudinary.com/demo/image/upload/v1712/ceylon-energy/completed-projects/loc-rathnapura/proj-x/abc.png',
            caption: 'Rathnapura — Belihuloya project 01',
            order: 0,
          },
        ],
      },
    ],
  });

  const res = await request(app).get('/api/projects');
  assert.equal(res.status, 200);
  assert.equal(res.body.count, 1);
  const photo = res.body.locations[0].projects[0].photos[0];
  assert.equal(
    photo.thumb,
    'https://res.cloudinary.com/demo/image/upload/c_fill,f_auto,q_auto,w_400,h_300/v1712/ceylon-energy/completed-projects/loc-rathnapura/proj-x/abc.png'
  );
  assert.match(photo.large, /\/upload\/c_limit,f_auto,q_auto,w_1600\//);
  assert.equal(res.body.locations[0].cover.id, photo.id);

  const one = await request(app).get('/api/projects/loc-rathnapura');
  assert.equal(one.body.location.name, 'Rathnapura');
});

test('create location and project with prefixed, unique slugs', async () => {
  const a = await agent.post('/api/admin/gallery/locations').send({ name: '  Kaluthara   North ' });
  assert.equal(a.status, 201);
  assert.equal(a.body.location.name, 'Kaluthara North');
  assert.equal(a.body.location.slug, 'loc-kaluthara-north');

  const dup = await agent.post('/api/admin/gallery/locations').send({ name: 'kaluthara north' });
  assert.equal(dup.status, 400);

  const blank = await agent.post('/api/admin/gallery/locations').send({ name: '   ' });
  assert.equal(blank.status, 400);

  const id = a.body.location.id;
  const p1 = await agent.post(`/api/admin/gallery/locations/${id}/projects`).send({ name: 'Site #1', description: 'Rooftop' });
  assert.equal(p1.status, 201);
  assert.equal(p1.body.location.projects[0].slug, 'proj-site-1');
  assert.equal(p1.body.location.projects[0].description, 'Rooftop');
});

test('empty locations and hidden items stay off the public site', async () => {
  const { loc, proj } = await makeProject();
  assert.equal((await request(app).get('/api/projects')).body.count, 0, 'no photos yet -> not shown');

  await agent.post(`/api/admin/gallery/locations/${loc.id}/projects/${proj.id}/photos`).attach('photos', PNG, 'a.png');
  assert.equal((await request(app).get('/api/projects')).body.count, 1);

  await agent.patch(`/api/admin/gallery/locations/${loc.id}/projects/${proj.id}`).send({ published: false });
  assert.equal((await request(app).get('/api/projects')).body.count, 0, 'hidden project');

  await agent.patch(`/api/admin/gallery/locations/${loc.id}/projects/${proj.id}`).send({ published: true });
  await agent.patch(`/api/admin/gallery/locations/${loc.id}`).send({ published: false });
  assert.equal((await request(app).get('/api/projects')).body.count, 0, 'hidden location');
  assert.equal((await request(app).get(`/api/projects/${loc.slug}`)).status, 404);

  const adminView = await agent.get('/api/admin/gallery');
  assert.equal(adminView.body.locations[0].published, false, 'admin still sees it');
});

test('upload photos to GridFS, serve them, caption, reorder, delete', async () => {
  const { loc, proj } = await makeProject();
  const base = `/api/admin/gallery/locations/${loc.id}/projects/${proj.id}/photos`;

  const up = await agent.post(base).attach('photos', PNG, 'one.png').attach('photos', JPEG, 'two.jpg');
  assert.equal(up.status, 201);
  assert.equal(up.body.added, 2);
  const photos = up.body.location.projects[0].photos;
  assert.equal(photos.length, 2);
  assert.match(photos[0].thumb, /^\/api\/files\/[0-9a-f]{24}$/);
  assert.equal(photos[1].width, 2);
  assert.equal(photos[1].height, 3);
  assert.equal(await filesInGridFs(), 2);

  const file = await request(app).get(photos[1].large);
  assert.equal(file.status, 200);
  assert.equal(file.headers['content-type'], 'image/jpeg');
  assert.match(file.headers['cache-control'], /immutable/);
  assert.deepEqual(Buffer.from(file.body), JPEG);

  const cap = await agent.patch(`${base}/${photos[0].id}`).send({ caption: 'Front view' });
  assert.equal(cap.body.location.projects[0].photos[0].caption, 'Front view');

  const order = await agent.put(`${base}/order`).send({ ids: [photos[1].id, photos[0].id] });
  assert.deepEqual(order.body.location.projects[0].photos.map((p) => p.id), [photos[1].id, photos[0].id]);

  const partial = await agent.put(`${base}/order`).send({ ids: [photos[1].id] });
  assert.equal(partial.status, 400, 'an order must list every photo');

  const del = await agent.delete(`${base}/${photos[0].id}`);
  assert.equal(del.status, 200);
  assert.equal(del.body.location.projects[0].photos.length, 1);
  assert.equal(await filesInGridFs(), 1, 'stored file removed too');
  assert.equal((await request(app).get(photos[0].thumb)).status, 404);
});

test('an upload with one non-image stores nothing', async () => {
  const { loc, proj } = await makeProject();
  const res = await agent
    .post(`/api/admin/gallery/locations/${loc.id}/projects/${proj.id}/photos`)
    .attach('photos', PNG, 'fine.png')
    .attach('photos', NOT_AN_IMAGE, 'evil.jpg');
  assert.equal(res.status, 400);
  assert.match(res.body.error, /evil\.jpg/);
  assert.equal(await filesInGridFs(), 0);
  const stored = await Location.findById(loc.id);
  assert.equal(stored.projects[0].photos.length, 0);
});

test('too many photos in one request is refused', async () => {
  const { loc, proj } = await makeProject();
  let req = agent.post(`/api/admin/gallery/locations/${loc.id}/projects/${proj.id}/photos`);
  for (let i = 0; i < 21; i++) req = req.attach('photos', PNG, `p${i}.png`);
  const res = await req;
  assert.equal(res.status, 413);
  assert.equal(await filesInGridFs(), 0);
});

test('reorder locations and projects; rename keeps the slug', async () => {
  const a = (await agent.post('/api/admin/gallery/locations').send({ name: 'A' })).body.location;
  const b = (await agent.post('/api/admin/gallery/locations').send({ name: 'B' })).body.location;

  assert.equal((await agent.put('/api/admin/gallery/locations/order').send({ ids: [b.id, a.id] })).status, 200);
  assert.deepEqual((await agent.get('/api/admin/gallery')).body.locations.map((l) => l.name), ['B', 'A']);

  const renamed = await agent.patch(`/api/admin/gallery/locations/${a.id}`).send({ name: 'Alpha' });
  assert.equal(renamed.body.location.name, 'Alpha');
  assert.equal(renamed.body.location.slug, 'loc-a');

  const clash = await agent.patch(`/api/admin/gallery/locations/${a.id}`).send({ name: 'b' });
  assert.equal(clash.status, 400);

  await agent.post(`/api/admin/gallery/locations/${a.id}/projects`).send({ name: 'P1' });
  const two = (await agent.post(`/api/admin/gallery/locations/${a.id}/projects`).send({ name: 'P2' })).body.location;
  const [p1, p2] = two.projects;
  const reordered = await agent.put(`/api/admin/gallery/locations/${a.id}/projects/order`).send({ ids: [p2.id, p1.id] });
  assert.deepEqual(reordered.body.location.projects.map((p) => p.name), ['P2', 'P1']);
});

test('deleting a project or location removes its stored photos', async () => {
  const { loc, proj } = await makeProject();
  await agent.post(`/api/admin/gallery/locations/${loc.id}/projects/${proj.id}/photos`).attach('photos', PNG, 'x.png');
  const second = (await agent.post(`/api/admin/gallery/locations/${loc.id}/projects`).send({ name: 'Two' })).body.location;
  const proj2 = second.projects.find((p) => p.name === 'Two');
  await agent.post(`/api/admin/gallery/locations/${loc.id}/projects/${proj2.id}/photos`).attach('photos', JPEG, 'y.jpg');
  assert.equal(await filesInGridFs(), 2);

  const delProj = await agent.delete(`/api/admin/gallery/locations/${loc.id}/projects/${proj.id}`);
  assert.equal(delProj.body.removedPhotos, 1);
  assert.equal(await filesInGridFs(), 1);

  const delLoc = await agent.delete(`/api/admin/gallery/locations/${loc.id}`);
  assert.equal(delLoc.body.removedPhotos, 1);
  assert.equal(await filesInGridFs(), 0);
  assert.equal(await Location.countDocuments(), 0);
});

test('bad and unknown ids answer 404, not 500', async () => {
  assert.equal((await agent.patch('/api/admin/gallery/locations/not-an-id').send({ name: 'x' })).status, 404);
  assert.equal((await agent.delete(`/api/admin/gallery/locations/${new mongoose.Types.ObjectId()}`)).status, 404);
  assert.equal((await request(app).get('/api/files/not-an-id')).status, 404);
  assert.equal((await request(app).get(`/api/files/${new mongoose.Types.ObjectId()}`)).status, 404);
});
