/**
 * Multipart uploads.
 *
 * Files are written to a private temp folder (never the web root, unlike
 * the PHP panel), checked by their actual bytes, handed to storage, and
 * deleted as soon as the response is sent — whether the request
 * succeeded or failed.
 */
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const { env } = require('../config/env');
const { inspectFile, IMAGE_KINDS } = require('../utils/fileType');
const { badRequest, tooLarge } = require('../utils/httpError');

const MB = 1024 * 1024;
const LIMITS = {
  imageBytes: 10 * MB,
  pdfBytes: 60 * MB,
  photosPerUpload: 20,
  pagesPerDocument: 200,
};

fs.mkdirSync(env.uploadTmpDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, env.uploadTmpDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`),
});

function allFiles(req) {
  if (!req.files) return req.file ? [req.file] : [];
  return Array.isArray(req.files) ? req.files : Object.values(req.files).flat();
}

/** Delete this request's temp files once the response is finished. */
function cleanupAfterResponse(req, res, next) {
  let done = false;
  const cleanup = () => {
    if (done) return;
    done = true;
    for (const file of allFiles(req)) fs.promises.unlink(file.path).catch(() => {});
  };
  res.on('finish', cleanup);
  res.on('close', cleanup);
  next();
}

/**
 * Build the middleware for a route. `fields` is multer's
 * [{ name, maxCount }] list; `maxFileSize` is the largest single file.
 */
function acceptFiles(fields, { maxFileSize = LIMITS.imageBytes } = {}) {
  const parser = multer({
    storage,
    limits: {
      fileSize: maxFileSize,
      files: fields.reduce((sum, f) => sum + f.maxCount, 0),
      fields: 20,
    },
  }).fields(fields);
  return [cleanupAfterResponse, parser];
}

/**
 * Validate uploaded images by content. Returns
 * [{ path, info, originalName }] ready for storage.saveImage().
 */
async function checkImages(files, { label = 'image' } = {}) {
  const out = [];
  for (const file of files) {
    const info = await inspectFile(file.path);
    if (!info || !IMAGE_KINDS.includes(info.kind)) {
      throw badRequest(`"${file.originalname}" is not a JPG, PNG or WebP ${label}.`);
    }
    if (file.size > LIMITS.imageBytes) {
      throw tooLarge(`"${file.originalname}" is larger than the 10MB per-${label} limit.`);
    }
    out.push({ path: file.path, info, originalName: file.originalname });
  }
  return out;
}

async function checkPdf(file) {
  if (!file) throw badRequest('Please choose a PDF file.');
  const info = await inspectFile(file.path);
  if (!info || info.kind !== 'pdf') throw badRequest(`"${file.originalname}" is not a PDF.`);
  return { path: file.path, info, originalName: file.originalname };
}

module.exports = { acceptFiles, checkImages, checkPdf, LIMITS };
