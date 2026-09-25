const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { app, request, setup, teardown, createAdmin, loginAgent } = require('./helpers');
const Message = require('../src/models/Message');
const { buildContactEmail } = require('../src/services/mailer');

let agent;
const valid = {
  name: 'Nimal Perera',
  email: 'Nimal@Example.com',
  tel: '0771234567',
  subject: 'Rooftop solar',
  message: 'Hello,\nI would like a quote for a 5kW system.',
};

before(async () => {
  await setup();
  await createAdmin();
  agent = await loginAgent();
});
after(teardown);
beforeEach(() => Message.deleteMany({}));

test('a valid enquiry is saved first, then emailed', async () => {
  const res = await request(app).post('/api/contact').send(valid);
  assert.equal(res.status, 201);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.emailed, true);

  const saved = await Message.findById(res.body.id);
  assert.equal(saved.email, 'nimal@example.com');
  assert.equal(saved.phone, '0771234567', 'the site form calls it "tel"');
  assert.equal(saved.message, valid.message, 'line breaks kept');
  assert.equal(saved.status, 'new');
  assert.equal(saved.delivery.status, 'sent');
});

test('missing fields and bad emails are explained', async () => {
  const noName = await request(app).post('/api/contact').send({ ...valid, name: ' ' });
  assert.equal(noName.status, 400);
  assert.match(noName.body.error, /Your name is required/);

  const badEmail = await request(app).post('/api/contact').send({ ...valid, email: 'not-an-email' });
  assert.equal(badEmail.status, 400);
  assert.match(badEmail.body.error, /valid email/);

  const huge = await request(app).post('/api/contact').send({ ...valid, message: 'x'.repeat(5001) });
  assert.equal(huge.status, 400);
  assert.equal(await Message.countDocuments(), 0);
});

test('the honeypot silently drops bots', async () => {
  const res = await request(app).post('/api/contact').send({ ...valid, website: 'http://spam.example' });
  assert.equal(res.status, 201);
  assert.equal(await Message.countDocuments(), 0);
});

test('the notification email cannot be header-injected and escapes HTML', () => {
  const mail = buildContactEmail({
    name: 'Evil\r\nBcc: victim@example.com',
    email: 'a@example.com',
    phone: '',
    subject: '',
    message: '<script>alert(1)</script>',
  });
  assert.ok(!/[\r\n]/.test(mail.subject));
  assert.ok(!mail.html.includes('<script>'));
  assert.ok(mail.html.includes('&lt;script&gt;'));
});

test('inbox: list, counts, mark read, archive, delete', async () => {
  const ids = [];
  for (const name of ['One', 'Two', 'Three']) {
    ids.push((await request(app).post('/api/contact').send({ ...valid, name })).body.id);
  }

  let inbox = (await agent.get('/api/admin/messages')).body;
  assert.equal(inbox.total, 3);
  assert.equal(inbox.counts.new, 3);
  assert.equal(inbox.messages[0].name, 'Three', 'newest first');

  await agent.patch(`/api/admin/messages/${ids[0]}`).send({ status: 'read' });
  await agent.patch(`/api/admin/messages/${ids[1]}`).send({ status: 'archived' });
  assert.equal((await agent.patch(`/api/admin/messages/${ids[2]}`).send({ status: 'bogus' })).status, 400);

  inbox = (await agent.get('/api/admin/messages')).body;
  assert.equal(inbox.total, 2, 'archived leaves the inbox');
  assert.deepEqual(inbox.counts, { new: 1, read: 1, archived: 1 });
  assert.equal((await agent.get('/api/admin/messages?status=archived')).body.messages[0].name, 'Two');

  const paged = (await agent.get('/api/admin/messages?status=all&limit=2&page=2')).body;
  assert.equal(paged.messages.length, 1);
  assert.equal(paged.pages, 2);

  assert.equal((await agent.delete(`/api/admin/messages/${ids[0]}`)).status, 200);
  assert.equal((await agent.delete(`/api/admin/messages/${ids[0]}`)).status, 404);
  assert.equal((await agent.get('/api/admin/stats')).body.counts.newMessages, 1);
});

test('the contact form is rate-limited per visitor', async () => {
  process.env.CE_TEST_RATE_LIMITS = '1';
  try {
    const statuses = [];
    for (let i = 0; i < 6; i++) statuses.push((await request(app).post('/api/contact').send(valid)).status);
    assert.deepEqual(statuses, [201, 201, 201, 201, 201, 429]);
  } finally {
    delete process.env.CE_TEST_RATE_LIMITS;
  }
});
