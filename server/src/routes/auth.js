/**
 * Login, logout, first-run setup and password changes.
 */
const crypto = require('crypto');
const express = require('express');

const Admin = require('../models/Admin');
const { env } = require('../config/env');
const { startSession, endSession, currentAdmin, requireAuth, requireAdminHeader } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimit');
const v = require('../utils/validate');
const { HttpError, badRequest, forbidden, unauthorized } = require('../utils/httpError');

const router = express.Router();

router.use(requireAdminHeader);

/** Constant-time comparison for the setup token. */
function tokensMatch(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

router.get('/setup-status', async (req, res) => {
  const count = await Admin.estimatedDocumentCount();
  res.set('Cache-Control', 'no-store');
  res.json({ ok: true, needsSetup: count === 0, setupEnabled: Boolean(env.adminSetupToken) });
});

/**
 * Create the very first admin from the browser.
 *
 * Only possible while no admin exists AND with ADMIN_SETUP_TOKEN from
 * the server's environment — otherwise whoever found a freshly deployed
 * site first could claim it. (The PHP setup page had exactly that hole.)
 */
router.post('/setup', loginLimiter, async (req, res) => {
  if (!env.adminSetupToken) {
    throw forbidden('Web setup is turned off. Run "npm run create-admin" on the server, or set ADMIN_SETUP_TOKEN.');
  }
  if ((await Admin.estimatedDocumentCount()) > 0) {
    throw forbidden('Setup is already complete. Log in instead.');
  }
  if (!tokensMatch(req.body?.setupToken || '', env.adminSetupToken)) {
    throw unauthorized('That setup token is not correct.');
  }

  const admin = new Admin({
    email: v.email(req.body.email),
    name: v.text(req.body.name, { label: 'Name', max: 100 }),
  });
  await admin.setPassword(v.password(req.body.password));
  await admin.save();

  startSession(res, admin);
  res.status(201).json({ ok: true, admin: admin.toPublic() });
});

router.post('/login', loginLimiter, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!email || !password) throw badRequest('Enter your email and password.');

  const admin = await Admin.findOne({ email });
  if (!admin) {
    await Admin.burnPasswordCheck(password);
    throw unauthorized('Incorrect email or password.');
  }

  if (admin.isLocked()) {
    const minutes = Math.ceil((admin.lockUntil - Date.now()) / 60000);
    throw new HttpError(423, `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`);
  }

  if (!(await admin.checkPassword(password))) {
    await admin.registerFailedLogin();
    if (admin.isLocked()) {
      throw new HttpError(423, 'Too many failed attempts. This account is locked for 5 minutes.');
    }
    throw unauthorized('Incorrect email or password.');
  }

  await admin.registerSuccessfulLogin();
  startSession(res, admin);
  res.json({ ok: true, admin: admin.toPublic() });
});

router.post('/logout', (req, res) => {
  endSession(res);
  res.json({ ok: true });
});

/** "Who am I?" — answers `admin: null` rather than an error when nobody is logged in. */
router.get('/me', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const admin = await currentAdmin(req);
  if (!admin && req.cookies?.[env.cookieName]) endSession(res); // drop a stale cookie
  res.json({ ok: true, admin: admin ? admin.toPublic() : null });
});

router.post('/change-password', requireAuth, async (req, res) => {
  const { admin } = req;
  if (!(await admin.checkPassword(req.body?.currentPassword || ''))) {
    throw badRequest('Your current password is incorrect.');
  }
  const next = v.password(req.body?.newPassword, { label: 'New password' });
  if (next === req.body.currentPassword) throw badRequest('Choose a password different from the current one.');

  await admin.setPassword(next);
  admin.tokenVersion += 1; // signs out every other browser
  await admin.save();

  startSession(res, admin); // ...but keeps this one logged in
  res.json({ ok: true });
});

module.exports = router;
