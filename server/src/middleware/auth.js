/**
 * Admin sessions.
 *
 * A signed JWT lives in an httpOnly cookie: page JavaScript can never
 * read it (so an XSS bug cannot steal it), and the browser sends it
 * automatically. The token carries the account's `tokenVersion`, so
 * changing a password invalidates every other session at once.
 */
const jwt = require('jsonwebtoken');
const { env } = require('../config/env');
const Admin = require('../models/Admin');
const { unauthorized, forbidden } = require('../utils/httpError');

/** The header the admin app adds to every write. See requireAdminHeader(). */
const ADMIN_HEADER = 'x-requested-with';
const ADMIN_HEADER_VALUE = 'ceylon-admin';

function cookieOptions() {
  return {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: env.cookieSameSite,
    path: '/',
    maxAge: env.sessionHours * 60 * 60 * 1000,
  };
}

function startSession(res, admin) {
  const token = jwt.sign({ sub: String(admin._id), tv: admin.tokenVersion }, env.jwtSecret, {
    expiresIn: `${env.sessionHours}h`,
    algorithm: 'HS256',
  });
  res.cookie(env.cookieName, token, cookieOptions());
}

function endSession(res) {
  const { maxAge, ...opts } = cookieOptions();
  res.clearCookie(env.cookieName, opts);
}

/** Resolve the logged-in admin, or null. Never throws. */
async function currentAdmin(req) {
  const token = req.cookies?.[env.cookieName];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
    const admin = await Admin.findById(payload.sub);
    if (!admin || admin.tokenVersion !== payload.tv) return null;
    return admin;
  } catch {
    return null;
  }
}

async function requireAuth(req, res, next) {
  const admin = await currentAdmin(req);
  if (!admin) {
    endSession(res);
    throw unauthorized('Your session has ended — please log in again.');
  }
  req.admin = admin;
  next();
}

/**
 * Cross-site request forgery guard for every state-changing admin call.
 *
 * The SameSite cookie already stops most cross-site requests. As a
 * second, independent layer, writes must carry a custom header: a form
 * or image on another website cannot add one, and a script there can
 * only add one after passing this server's CORS allowlist.
 */
function requireAdminHeader(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get(ADMIN_HEADER) !== ADMIN_HEADER_VALUE) {
    throw forbidden('Request blocked: missing the admin request header.');
  }
  next();
}

module.exports = {
  startSession,
  endSession,
  currentAdmin,
  requireAuth,
  requireAdminHeader,
  ADMIN_HEADER,
  ADMIN_HEADER_VALUE,
};
