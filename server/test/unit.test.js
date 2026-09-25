/** Pure functions — no database needed. */
const { test } = require('node:test');
const assert = require('node:assert/strict');

process.env.CE_SKIP_DOTENV = '1';
process.env.NODE_ENV = 'test';

const { slugify, uniqueSlug } = require('../src/utils/slugify');
const { withoutBaseUri } = require('../src/app');
const { parseRange } = require('../src/routes/public');
const { variant, downloadUrl, SIZES } = require('../src/services/storage');
const v = require('../src/utils/validate');

test('slugify and uniqueSlug', () => {
  assert.equal(slugify('Belihuloya Site #2'), 'belihuloya-site-2');
  assert.equal(slugify("G.S. Indika Perera's site"), 'g-s-indika-perera-s-site');
  assert.equal(slugify('Café  Négombo'), 'cafe-negombo');
  assert.equal(slugify('!!!'), 'item');
  assert.equal(uniqueSlug('loc-', 'Colombo', ['loc-colombo', 'loc-colombo-2']), 'loc-colombo-3');
  assert.equal(uniqueSlug('proj-', 'New', []), 'proj-new');
});

test('Passenger base-URI trimming', () => {
  assert.equal(withoutBaseUri('/nodeapi/api/health?x=1', '/nodeapi'), '/api/health?x=1');
  assert.equal(withoutBaseUri('/nodeapi', '/nodeapi'), '/');
  assert.equal(withoutBaseUri('/nodeapixyz/api', '/nodeapi'), '/nodeapixyz/api');
  assert.equal(withoutBaseUri('/api/health', ''), '/api/health');
});

test('Range header parsing', () => {
  assert.deepEqual(parseRange('bytes=0-99', 1000), { start: 0, end: 99 });
  assert.deepEqual(parseRange('bytes=900-', 1000), { start: 900, end: 999 });
  assert.deepEqual(parseRange('bytes=-100', 1000), { start: 900, end: 999 });
  assert.deepEqual(parseRange('bytes=0-5000', 1000), { start: 0, end: 999 });
  assert.equal(parseRange('bytes=2000-', 1000), 'unsatisfiable');
  assert.equal(parseRange('bytes=0-1,5-6', 1000), null);
  assert.equal(parseRange('items=0-1', 1000), null);
});

test('Cloudinary variant and download URLs', () => {
  const asset = { provider: 'cloudinary', url: 'https://res.cloudinary.com/demo/image/upload/v1/a/b/c.jpg' };
  assert.equal(variant(asset, SIZES.medium), 'https://res.cloudinary.com/demo/image/upload/c_limit,f_auto,q_auto,w_900/v1/a/b/c.jpg');
  assert.equal(variant({ url: asset.url }, SIZES.medium), variant(asset, SIZES.medium), 'missing provider means Cloudinary');
  assert.equal(downloadUrl(asset, 'Company Profile page 01'), 'https://res.cloudinary.com/demo/image/upload/fl_attachment:Company-Profile-page-01/v1/a/b/c.jpg');

  const grid = { provider: 'gridfs', url: '/api/files/abc' };
  assert.equal(variant(grid, SIZES.thumb), '/api/files/abc');
  assert.equal(downloadUrl(grid, 'x'), '/api/files/abc?download=1');
  assert.equal(variant(null, SIZES.thumb), null);
});

test('validators', () => {
  assert.equal(v.text('  a   b  ', { label: 'X' }), 'a b');
  assert.equal(v.text(' a\r\n b ', { label: 'X', multiline: true }), 'a\n b');
  assert.throws(() => v.text('', { label: 'Name', required: true }), /Name is required/);
  assert.equal(v.email(' A@B.CO '), 'a@b.co');
  assert.throws(() => v.email('a@b'), /valid email/);
  assert.equal(v.year(''), null);
  assert.equal(v.year('2024'), '2024');
  assert.throws(() => v.year('1800'));
  assert.equal(v.bool('false'), false);
  assert.equal(v.bool(undefined), undefined);
  assert.throws(() => v.objectId('123'), /not found/);
  assert.throws(() => v.password('short'), /at least 8/);
});

/* ---- DNS fallback for mongodb+srv:// (querySrv ECONNREFUSED on Windows) ---- */

const dns = require('dns');
const { connectWithDnsFallback, isSrvLookupError, PUBLIC_DNS } = require('../src/config/db');

/** A genuine c-ares error: ask a DNS "server" on a port where nothing listens. */
async function realSrvRefusal() {
  const resolver = new dns.promises.Resolver({ timeout: 2000, tries: 1 });
  resolver.setServers(['127.0.0.1:5399']);
  return resolver.resolve('_mongodb._tcp.cluster0.example.mongodb.net', 'SRV').catch((err) => err);
}

function harness(outcomes, opts = {}) {
  const calls = { connect: 0, servers: [], log: [] };
  return {
    calls,
    run: (uri = 'mongodb+srv://u:p@cluster0.example.mongodb.net/') =>
      connectWithDnsFallback(uri, {
        connect: async () => {
          const next = outcomes[calls.connect++];
          if (next instanceof Error) throw next;
          return next;
        },
        setServers: (s) => calls.servers.push(s),
        log: (line) => calls.log.push(line),
        dnsServers: [],
        ...opts,
      }),
  };
}

test('recognises the querySrv / queryTxt failures', async () => {
  const refused = await realSrvRefusal();
  assert.match(refused.message, /^querySrv ECONNREFUSED _mongodb\._tcp\./, 'reproduces the Windows error text');
  assert.equal(isSrvLookupError(refused), true);
  assert.equal(isSrvLookupError(new Error('queryTxt ETIMEOUT cluster0.example.mongodb.net')), true);
  assert.equal(isSrvLookupError(new Error('bad auth : authentication failed')), false);
  assert.equal(isSrvLookupError(new Error('connect ECONNREFUSED 127.0.0.1:27017')), false);
});

test('a refused SRV lookup is retried once through public DNS', async () => {
  const h = harness([await realSrvRefusal(), 'connected']);
  assert.equal(await h.run(), 'connected');
  assert.equal(h.calls.connect, 2);
  assert.deepEqual(h.calls.servers, [PUBLIC_DNS]);
  assert.match(h.calls.log.join('\n'), /retrying through public DNS/);
});

test('if public DNS fails too, that error is reported', async () => {
  const second = new Error('querySrv ETIMEOUT _mongodb._tcp.cluster0.example.mongodb.net');
  const h = harness([await realSrvRefusal(), second]);
  await assert.rejects(h.run(), second);
  assert.equal(h.calls.connect, 2);
});

test('no DNS retry for other errors, for mongodb:// addresses, or when DNS_SERVERS is set', async () => {
  const auth = new Error('bad auth : authentication failed');
  const a = harness([auth]);
  await assert.rejects(a.run(), auth);
  assert.equal(a.calls.connect, 1);
  assert.deepEqual(a.calls.servers, []);

  const b = harness([await realSrvRefusal()]);
  await assert.rejects(b.run('mongodb://host-a:27017,host-b:27017/?replicaSet=rs0'));
  assert.equal(b.calls.connect, 1);

  const c = harness([await realSrvRefusal()], { dnsServers: ['9.9.9.9'] });
  await assert.rejects(c.run());
  assert.deepEqual(c.calls.servers, [['9.9.9.9']], 'DNS_SERVERS is applied up front and not overridden');
  assert.equal(c.calls.connect, 1);
});
