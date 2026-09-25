/**
 * Every setting the server reads, in one place.
 *
 * Settings come from real environment variables first (what Render,
 * cPanel's "Setup Node.js App" and most hosts provide), then from a
 * `.env` file in the project root or in `server/`. A missing required
 * setting stops the server at startup with one message listing all of
 * them, instead of surfacing later as a confusing driver error in the
 * middle of a request.
 */
const os = require('os');
const path = require('path');
const dotenv = require('dotenv');

const SERVER_ROOT = path.resolve(__dirname, '../..');
const PROJECT_ROOT = path.resolve(SERVER_ROOT, '..');

// Tests set their own variables and must never pick up a developer's
// real .env (which would point them at the live database and Cloudinary).
if (process.env.CE_SKIP_DOTENV !== '1') {
  dotenv.config({
    path: [path.join(PROJECT_ROOT, '.env'), path.join(SERVER_ROOT, '.env')],
    quiet: true,
  });
}

/** Read a variable; blank counts as missing. */
function read(name, fallback = undefined) {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') return fallback;
  return value.trim();
}

function readBool(name, fallback) {
  const value = read(name);
  if (value === undefined) return fallback;
  return /^(1|true|yes|on)$/i.test(value);
}

function readList(name, fallback = '') {
  return read(name, fallback)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

/** "1", "2" -> hop count; "true"/"false" -> boolean; anything else -> as given (e.g. "loopback"). */
function readTrustProxy(fallback) {
  const value = read('TRUST_PROXY');
  if (value === undefined) return fallback;
  if (/^\d+$/.test(value)) return parseInt(value, 10);
  if (/^(true|false)$/i.test(value)) return value.toLowerCase() === 'true';
  return value;
}

const nodeEnv = read('NODE_ENV', 'development');
const isProd = nodeEnv === 'production';
const isTest = nodeEnv === 'test';

const cloudinary = {
  cloudName: read('CLOUDINARY_CLOUD_NAME'),
  apiKey: read('CLOUDINARY_API_KEY'),
  apiSecret: read('CLOUDINARY_API_SECRET'),
  baseFolder: read('CLOUDINARY_BASE_FOLDER', 'ceylon-energy'),
};
const cloudinaryConfigured = Boolean(cloudinary.cloudName && cloudinary.apiKey && cloudinary.apiSecret);

// "auto" uses Cloudinary when its three credentials are present and
// falls back to MongoDB GridFS otherwise, so the site runs on Atlas alone.
const requestedDriver = read('STORAGE_DRIVER', 'auto').toLowerCase();
const storageDriver =
  requestedDriver === 'auto' ? (cloudinaryConfigured ? 'cloudinary' : 'gridfs') : requestedDriver;

const env = {
  nodeEnv,
  isProd,
  isTest,
  // Not 5000: macOS's AirPlay Receiver answers 403 to everything on that port.
  port: parseInt(read('PORT', '5050'), 10),

  mongoUri: read('MONGODB_URI'),
  dbName: read('MONGODB_DB_NAME', 'ceylonenergy'),
  // DNS servers for the SRV lookup a mongodb+srv:// address needs. Empty =
  // the system's, falling back to public DNS if they refuse (see config/db.js).
  dnsServers: readList('DNS_SERVERS'),

  jwtSecret: read('JWT_SECRET'),
  sessionHours: parseInt(read('SESSION_HOURS', '12'), 10),
  cookieName: 'ce_admin',
  // "lax" suits the normal setup where Express serves the React app.
  // Use "none" only when the admin runs on a different site than the API.
  cookieSameSite: read('COOKIE_SAMESITE', 'lax').toLowerCase(),
  cookieSecure: readBool('COOKIE_SECURE', isProd),

  // Hosts like Render, cPanel/Passenger and Nginx sit one proxy in front
  // of Node. Without this, every visitor shares the proxy's IP and the
  // rate limits would lock everybody out at once.
  trustProxy: readTrustProxy(isProd ? 1 : false),

  // Only needed when the React app is served from a different origin
  // than this API. The dev server origin is always allowed outside production.
  allowedOrigins: [
    ...readList('ALLOWED_ORIGINS'),
    ...(isProd ? [] : ['http://localhost:5173', 'http://127.0.0.1:5173']),
  ],

  cloudinary,
  cloudinaryConfigured,
  storageDriver,

  mail: {
    // "smtp" sends real email; "console" prints it to the terminal (handy
    // in development); "json" is used by the tests.
    transport: read('MAIL_TRANSPORT', read('SMTP_HOST') ? 'smtp' : 'disabled').toLowerCase(),
    host: read('SMTP_HOST'),
    port: parseInt(read('SMTP_PORT', '587'), 10),
    secure: readBool('SMTP_SECURE', read('SMTP_PORT') === '465'),
    user: read('SMTP_USER'),
    pass: read('SMTP_PASS'),
    from: read('MAIL_FROM', read('SMTP_USER')),
    to: readList('CONTACT_TO', 'info@ceylonenergyservices.com,sales@ceylonenergyservices.com'),
  },

  adminSetupToken: read('ADMIN_SETUP_TOKEN'),

  clientDist: path.resolve(PROJECT_ROOT, read('CLIENT_DIST', 'client/dist')),
  uploadTmpDir: read('UPLOAD_TMP_DIR', path.join(os.tmpdir(), 'ceylon-energy-uploads')),

  paths: { SERVER_ROOT, PROJECT_ROOT },
};

const PLACEHOLDER_SECRETS = ['change_me', 'replace_with_a_long_random_string', 'changeme', 'secret'];

/**
 * Stop the process if anything required is missing, listing every
 * problem at once rather than one per restart.
 */
function assertRequiredEnv({ exit = true } = {}) {
  const problems = [];

  if (!env.mongoUri) problems.push('MONGODB_URI is missing — your MongoDB Atlas connection string.');
  if (!env.jwtSecret) {
    problems.push('JWT_SECRET is missing — a long random string that signs admin sessions.');
  } else if (PLACEHOLDER_SECRETS.some((p) => env.jwtSecret.toLowerCase().startsWith(p))) {
    problems.push('JWT_SECRET is still the example placeholder. Anyone could forge an admin session.');
  } else if (env.isProd && env.jwtSecret.length < 32) {
    problems.push('JWT_SECRET must be at least 32 characters in production.');
  }
  if (!['cloudinary', 'gridfs'].includes(env.storageDriver)) {
    problems.push(`STORAGE_DRIVER must be "auto", "cloudinary" or "gridfs" (got "${env.storageDriver}").`);
  }
  if (env.storageDriver === 'cloudinary' && !env.cloudinaryConfigured) {
    problems.push('STORAGE_DRIVER is "cloudinary" but CLOUDINARY_CLOUD_NAME / _API_KEY / _API_SECRET are not all set.');
  }
  if (!['lax', 'strict', 'none'].includes(env.cookieSameSite)) {
    problems.push('COOKIE_SAMESITE must be "lax", "strict" or "none".');
  }
  if (env.cookieSameSite === 'none' && !env.cookieSecure) {
    problems.push('COOKIE_SAMESITE=none requires COOKIE_SECURE=true (browsers reject it otherwise).');
  }
  if (env.mail.transport === 'smtp' && !env.mail.host) {
    problems.push('MAIL_TRANSPORT is "smtp" but SMTP_HOST is not set.');
  }

  if (problems.length && exit) {
    console.error('\n  The server cannot start:\n');
    problems.forEach((p) => console.error(`   - ${p}`));
    console.error('\n  Copy .env.example to .env and fill in the values.');
    console.error('  Generate secrets with:');
    console.error('    node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"\n');
    process.exit(1);
  }
  return problems;
}

module.exports = { env, assertRequiredEnv };
