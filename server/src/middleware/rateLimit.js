const { rateLimit } = require('express-rate-limit');
const { env } = require('../config/env');

function limiter({ windowMinutes, limit, message }) {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    // Tests hammer these endpoints on purpose; they opt back in explicitly.
    skip: () => env.isTest && process.env.CE_TEST_RATE_LIMITS !== '1',
    handler: (req, res) => res.status(429).json({ ok: false, error: message }),
  });
}

/** Per IP, on top of the per-account lockout in the Admin model. */
const loginLimiter = limiter({
  windowMinutes: 15,
  limit: 20,
  message: 'Too many login attempts from this network. Please wait 15 minutes and try again.',
});

const contactLimiter = limiter({
  windowMinutes: 15,
  limit: 5,
  message: 'You have sent several messages in a short time. Please wait a few minutes, or email info@ceylonenergyservices.com.',
});

module.exports = { loginLimiter, contactLimiter };
