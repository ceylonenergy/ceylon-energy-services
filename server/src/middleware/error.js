/**
 * The one place errors become responses. Every error the user can do
 * something about gets a specific, readable sentence; anything
 * unexpected is logged in full and answered with a generic message in
 * production (so internals never leak to strangers).
 */
const multer = require('multer');
const mongoose = require('mongoose');
const { env } = require('../config/env');

const MULTER_MESSAGES = {
  LIMIT_FILE_SIZE: 'That file is larger than the upload limit.',
  LIMIT_FILE_COUNT: 'Too many files in one upload.',
  LIMIT_UNEXPECTED_FILE: 'Unexpected file field — or too many files for that field.',
  LIMIT_PART_COUNT: 'Too many parts in this upload.',
  LIMIT_FIELD_COUNT: 'Too many form fields.',
};

function notFoundApi(req, res) {
  res.status(404).json({ ok: false, error: `No route for ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (res.headersSent) return;

  if (err instanceof multer.MulterError) {
    const status = err.code === 'LIMIT_FILE_SIZE' || err.code === 'LIMIT_FILE_COUNT' ? 413 : 400;
    return res.status(status).json({ ok: false, error: MULTER_MESSAGES[err.code] || err.message });
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ ok: false, error: 'The request body is not valid JSON.' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ ok: false, error: 'The request body is too large.' });
  }

  if (err instanceof mongoose.Error.ValidationError) {
    const first = Object.values(err.errors)[0];
    return res.status(400).json({ ok: false, error: first?.message || 'Invalid data.' });
  }
  if (err instanceof mongoose.Error.CastError) {
    return res.status(404).json({ ok: false, error: 'Not found.' });
  }
  if (err.code === 11000) {
    return res.status(409).json({ ok: false, error: 'That already exists.' });
  }

  if (err.expose && err.status) {
    return res.status(err.status).json({ ok: false, error: err.message, ...(err.details ? { details: err.details } : {}) });
  }

  console.error('  Unhandled error:', err);
  res.status(500).json({
    ok: false,
    error: env.isProd ? 'Something went wrong on the server. Please try again.' : err.message,
  });
}

module.exports = { errorHandler, notFoundApi };
