const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { app, request, setup, teardown, createAdmin, loginAgent, ADMIN } = require('./helpers');
const Admin = require('../src/models/Admin');

const H = ['X-Requested-With', 'ceylon-admin'];

before(setup);
after(teardown);
beforeEach(() => Admin.deleteMany({}));

test('setup-status reports a fresh install', async () => {
  const res = await request(app).get('/api/auth/setup-status');
  assert.equal(res.status, 200);
  assert.equal(res.body.needsSetup, true);
  assert.equal(res.body.setupEnabled, true);
});

test('web setup requires the setup token and only works once', async () => {
  const body = { email: 'first@example.com', password: 'a-long-password', name: 'First' };

  const wrong = await request(app).post('/api/auth/setup').set(...H).send({ ...body, setupToken: 'nope' });
  assert.equal(wrong.status, 401);
  assert.equal(await Admin.countDocuments(), 0);

  const agent = request.agent(app);
  const ok = await agent.post('/api/auth/setup').set(...H).send({ ...body, setupToken: 'test-setup-token' });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.admin.email, 'first@example.com');
  assert.ok(!('passwordHash' in ok.body.admin), 'hash must never be sent');

  // Setup logs you straight in.
  const me = await agent.get('/api/auth/me');
  assert.equal(me.body.admin.email, 'first@example.com');

  const again = await request(app)
    .post('/api/auth/setup')
    .set(...H)
    .send({ ...body, email: 'intruder@example.com', setupToken: 'test-setup-token' });
  assert.equal(again.status, 403);
  assert.equal(await Admin.countDocuments(), 1);
});

test('setup rejects short passwords', async () => {
  const res = await request(app)
    .post('/api/auth/setup')
    .set(...H)
    .send({ email: 'a@example.com', password: 'short', setupToken: 'test-setup-token' });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /at least 8/);
});

test('login sets an httpOnly cookie, me and logout work', async () => {
  await createAdmin();
  const agent = request.agent(app);

  const res = await agent.post('/api/auth/login').set(...H).send({ email: 'OWNER@example.com ', password: ADMIN.password });
  assert.equal(res.status, 200, 'email is case/space-insensitive');
  const cookie = res.headers['set-cookie'].join(';');
  assert.match(cookie, /ce_admin=/);
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Lax/i);

  assert.equal((await agent.get('/api/auth/me')).body.admin.email, ADMIN.email);
  assert.equal((await agent.post('/api/auth/logout').set(...H)).status, 200);
  const after = await agent.get('/api/auth/me');
  assert.equal(after.status, 200);
  assert.equal(after.body.admin, null, 'nobody is logged in');
});

test('wrong password and unknown email give the same answer', async () => {
  await createAdmin();
  const a = await request(app).post('/api/auth/login').set(...H).send({ email: ADMIN.email, password: 'wrong-password' });
  const b = await request(app).post('/api/auth/login').set(...H).send({ email: 'nobody@example.com', password: 'wrong-password' });
  assert.equal(a.status, 401);
  assert.equal(b.status, 401);
  assert.equal(a.body.error, b.body.error);
});

test('six wrong passwords lock the account, even for the right password', async () => {
  await createAdmin();
  for (let i = 0; i < 5; i++) {
    const r = await request(app).post('/api/auth/login').set(...H).send({ email: ADMIN.email, password: 'wrong' });
    assert.equal(r.status, 401);
  }
  const sixth = await request(app).post('/api/auth/login').set(...H).send({ email: ADMIN.email, password: 'wrong' });
  assert.equal(sixth.status, 423);

  const right = await request(app).post('/api/auth/login').set(...H).send(ADMIN);
  assert.equal(right.status, 423);
  assert.match(right.body.error, /Try again in \d+ minute/);

  // Once the lock expires, the right password works again.
  await Admin.updateOne({ email: ADMIN.email }, { $set: { lockUntil: new Date(Date.now() - 1000) } });
  assert.equal((await request(app).post('/api/auth/login').set(...H).send(ADMIN)).status, 200);
});

test('admin routes need a session, and writes need the admin header', async () => {
  await createAdmin();
  assert.equal((await request(app).get('/api/admin/stats')).status, 401);

  const agent = await loginAgent();
  assert.equal((await agent.get('/api/admin/stats')).status, 200);

  // Same logged-in cookie, but without the header: a forged cross-site request.
  const forged = await agent.raw.post('/api/admin/gallery/locations').send({ name: 'Forged' });
  assert.equal(forged.status, 403);
});

test('a tampered or foreign-signed cookie is rejected', async () => {
  await createAdmin();
  const jwt = require('jsonwebtoken');
  const admin = await Admin.findOne();
  const forged = jwt.sign({ sub: String(admin._id), tv: 0 }, 'some-other-secret');
  const res = await request(app).get('/api/admin/stats').set('Cookie', `ce_admin=${forged}`);
  assert.equal(res.status, 401);
});

test('changing the password signs out other sessions but keeps this one', async () => {
  await createAdmin();
  const laptop = await loginAgent();
  const phone = await loginAgent();

  const bad = await laptop.post('/api/auth/change-password').send({ currentPassword: 'nope', newPassword: 'new-password-123' });
  assert.equal(bad.status, 400);

  const ok = await laptop
    .post('/api/auth/change-password')
    .send({ currentPassword: ADMIN.password, newPassword: 'new-password-123' });
  assert.equal(ok.status, 200);

  assert.equal((await laptop.get('/api/auth/me')).body.admin?.email, ADMIN.email, 'this session continues');
  assert.equal((await phone.get('/api/auth/me')).body.admin, null, 'other sessions end');
  assert.equal((await phone.get('/api/admin/stats')).status, 401);

  const oldPw = await request(app).post('/api/auth/login').set(...H).send(ADMIN);
  assert.equal(oldPw.status, 401);
  const newPw = await request(app).post('/api/auth/login').set(...H).send({ email: ADMIN.email, password: 'new-password-123' });
  assert.equal(newPw.status, 200);
});

test('admin users: add, list, cannot remove self or the last admin', async () => {
  const me = await createAdmin();
  const agent = await loginAgent();

  const added = await agent.post('/api/admin/users').send({ email: 'second@example.com', password: 'second-password', name: 'Second' });
  assert.equal(added.status, 201);

  const dup = await agent.post('/api/admin/users').send({ email: 'second@example.com', password: 'second-password' });
  assert.equal(dup.status, 409);

  const list = await agent.get('/api/admin/users');
  assert.equal(list.body.users.length, 2);
  assert.equal(list.body.users.find((u) => u.isYou).email, ADMIN.email);

  assert.equal((await agent.delete(`/api/admin/users/${me._id}`)).status, 400);
  assert.equal((await agent.delete(`/api/admin/users/${added.body.user.id}`)).status, 200);
  assert.equal((await agent.get('/api/admin/users')).body.users.length, 1);
});
