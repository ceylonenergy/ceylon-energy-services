/**
 * MongoDB Atlas connection, plus the GridFS bucket used for PDFs (and
 * for images when Cloudinary is not configured).
 *
 * Opened once and reused: Mongoose keeps its own connection pool, so a
 * second connectDB() call returns the same promise rather than opening
 * another set of sockets to Atlas.
 */
const dns = require('dns');
const mongoose = require('mongoose');
const { env } = require('./env');

let connectionPromise = null;
let bucket = null;
let bucketDb = null;

/*
 * Why DNS gets special treatment
 *
 * A "mongodb+srv://" address is not a server: before connecting, the
 * driver asks DNS for its SRV record (the list of real servers) and TXT
 * record (replica-set name). It does that through Node's own DNS client,
 * not the operating system's — and on many Windows PCs and home/office
 * routers that client ends up talking to a DNS server that refuses SRV
 * queries. The result is "querySrv ECONNREFUSED _mongodb._tcp.<cluster>"
 * even though the browser, and every normal hostname, works fine.
 *
 * So when that specific lookup fails, we point Node's DNS client at
 * public resolvers and try once more. This only changes SRV/TXT lookups
 * (dns.resolve*); connecting to the servers themselves still uses the
 * operating system's resolver. DNS_SERVERS in .env chooses the servers
 * explicitly and turns the automatic retry off.
 */
const PUBLIC_DNS = ['1.1.1.1', '8.8.8.8'];

/** The DNS lookup behind a mongodb+srv:// address failed (as opposed to a login or network error). */
function isSrvLookupError(err) {
  return /\bquery(Srv|Txt) [A-Z]+\b/.test(err?.message || '');
}

function explainFailure(err, uri) {
  console.error('  MongoDB connection failed:', err.message);
  const msg = err.message || '';

  if (isSrvLookupError(err)) {
    const host = (/^mongodb(?:\+srv)?:\/\/(?:[^@/]*@)?([^/?]+)/.exec(uri) || [])[1] || 'your-cluster.mongodb.net';
    if (/ENOTFOUND|ENODATA/.test(msg)) {
      console.error('   Hint: DNS says that cluster address does not exist. Copy the connection string');
      console.error('   again from Atlas -> Connect -> Drivers and check the part after "@".');
    } else {
      console.error("   Hint: this computer's network refuses the DNS lookup that a mongodb+srv:// address");
      console.error('   needs, even through public DNS. Either:');
      console.error('    - set your network adapter\'s DNS servers to 1.1.1.1 and 8.8.8.8, or');
      console.error('    - use the standard (non-SRV) connection string instead. List the servers with');
      console.error(`        nslookup -type=SRV _mongodb._tcp.${host}`);
      console.error('      and the replica set with  nslookup -type=TXT ' + host + '  — see README "When');
      console.error('      something is wrong" for the exact format.');
    }
  } else if (/bad auth|authentication failed/i.test(msg)) {
    console.error('   Hint: wrong database username or password in MONGODB_URI (Atlas -> Database Access).');
    console.error('   Characters like @ : / ? # in the password must be percent-encoded (p@ss -> p%40ss).');
  } else if (/whitelist|allowlist|Server selection timed out|ETIMEDOUT|ECONNREFUSED|ReplicaSetNoPrimary/i.test(msg)) {
    console.error('   Hint: Atlas did not answer. In Atlas -> Network Access, allow the IP address of this');
    console.error('   computer or server. Some office and public Wi-Fi networks also block port 27017.');
    if (process.env.VERCEL) {
      console.error('   Vercel has no fixed IP address to allow: add 0.0.0.0/0 (access from anywhere) instead.');
    }
  }
}

/**
 * Connect, retrying once through public DNS when the SRV lookup fails.
 * The collaborators are parameters so the retry logic can be tested
 * without a broken network.
 */
async function connectWithDnsFallback(
  uri,
  {
    connect,
    dnsServers = env.dnsServers,
    fallbackServers = PUBLIC_DNS,
    setServers = (servers) => dns.setServers(servers),
    log = (line) => console.warn(line),
  }
) {
  if (dnsServers.length) setServers(dnsServers);

  try {
    return await connect();
  } catch (err) {
    const canRetry = !dnsServers.length && uri.startsWith('mongodb+srv://') && isSrvLookupError(err);
    if (!canRetry) throw err;

    log(`  The DNS lookup for your Atlas cluster failed (${err.message.split(' ').slice(0, 2).join(' ')}).`);
    log(`  This network's DNS server refuses SRV queries — retrying through public DNS (${fallbackServers.join(', ')})…`);
    setServers(fallbackServers);
    const conn = await connect();
    log(`  Connected via public DNS. To skip this retry, add  DNS_SERVERS=${fallbackServers.join(',')}  to .env`);
    return conn;
  }
}

async function connectDB(uri = env.mongoUri, dbName = env.dbName) {
  if (connectionPromise) return connectionPromise;

  mongoose.set('strictQuery', true);

  const connect = () =>
    mongoose.connect(uri, {
      dbName,
      // Fail fast with a clear error instead of hanging for 30s when Atlas
      // is unreachable — almost always the IP allowlist or a bad password.
      serverSelectionTimeoutMS: 10000,
    });

  connectionPromise = connectWithDnsFallback(uri, { connect })
    .then((conn) => {
      if (!env.isTest) console.log(`  MongoDB connected — database "${conn.connection.name}"`);
      return conn;
    })
    .catch((err) => {
      connectionPromise = null;
      explainFailure(err, uri);
      throw err;
    });

  return connectionPromise;
}

async function disconnectDB() {
  if (!connectionPromise) return;
  await mongoose.disconnect();
  connectionPromise = null;
  bucket = null;
  bucketDb = null;
}

/** The GridFS bucket ("uploads.files" / "uploads.chunks"). */
function getBucket() {
  if (!mongoose.connection.db) throw new Error('MongoDB is not connected yet.');
  // Rebuilt if the connection was replaced (tests reconnect between files).
  if (!bucket || bucketDb !== mongoose.connection.db) {
    bucketDb = mongoose.connection.db;
    bucket = new mongoose.mongo.GridFSBucket(bucketDb, { bucketName: 'uploads' });
  }
  return bucket;
}

const READY_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];
function dbState() {
  return READY_STATES[mongoose.connection.readyState] || 'unknown';
}

module.exports = { connectDB, disconnectDB, getBucket, dbState, connectWithDnsFallback, isSrvLookupError, PUBLIC_DNS };
