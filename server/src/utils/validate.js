/**
 * Small input helpers. Every value from a request is untrusted: these
 * coerce it to the expected type, collapse whitespace, enforce limits,
 * and throw a 400 with a sentence the admin can act on.
 */
const mongoose = require('mongoose');
const { badRequest, notFound } = require('./httpError');

/**
 * A trimmed single-line string.
 * `required` rejects blanks; `max` rejects anything longer.
 */
function text(value, { label, max = 200, required = false, multiline = false } = {}) {
  let out = value === undefined || value === null ? '' : String(value);
  out = multiline ? out.replace(/\r\n/g, '\n').trim() : out.replace(/\s+/g, ' ').trim();
  if (required && !out) throw badRequest(`${label} is required.`);
  if (out.length > max) throw badRequest(`${label} must be ${max} characters or fewer.`);
  return out;
}

const EMAIL_RE = /^[^\s@<>()[\],;:"]+@[^\s@<>()[\],;:"]+\.[^\s@<>()[\],;:"]{2,}$/;

function email(value, { label = 'Email', required = true } = {}) {
  const out = text(value, { label, max: 200, required }).toLowerCase();
  if (out && !EMAIL_RE.test(out)) throw badRequest(`${label} does not look like a valid email address.`);
  return out;
}

/** An optional 4-digit year, e.g. "2025". Returns null when blank. */
function year(value) {
  const out = text(value, { label: 'Year', max: 4 });
  if (!out) return null;
  if (!/^\d{4}$/.test(out)) throw badRequest('Year must be a 4-digit number, e.g. 2025.');
  const n = Number(out);
  if (n < 1950 || n > new Date().getFullYear() + 1) throw badRequest('That year looks wrong.');
  return out;
}

/** "true"/"false"/true/false/"1"/"0" -> boolean; undefined stays undefined. */
function bool(value) {
  if (value === undefined) return undefined;
  if (typeof value === 'boolean') return value;
  return /^(1|true|yes|on)$/i.test(String(value));
}

function password(value, { label = 'Password' } = {}) {
  const out = value === undefined || value === null ? '' : String(value);
  if (out.length < 8) throw badRequest(`${label} must be at least 8 characters.`);
  if (out.length > 200) throw badRequest(`${label} is too long.`);
  return out;
}

/** Throws 404 for anything that is not a valid ObjectId, so bad ids never reach MongoDB. */
function objectId(value, what = 'Item') {
  if (!mongoose.isValidObjectId(value) || String(value).length !== 24) {
    throw notFound(`${what} not found.`);
  }
  return String(value);
}

/** An array of ObjectId strings, for reorder requests. */
function idList(value, label = 'ids') {
  if (!Array.isArray(value) || !value.length) throw badRequest(`${label} must be a non-empty list.`);
  if (value.length > 1000) throw badRequest(`Too many ${label}.`);
  return value.map((id) => {
    if (!mongoose.isValidObjectId(id)) throw badRequest(`"${id}" is not a valid id.`);
    return String(id);
  });
}

module.exports = { text, email, year, bool, password, objectId, idList };
