/**
 * Files stored inside MongoDB itself, in the "uploads" GridFS bucket.
 * GridFS splits a file into 255KB chunks, so it has no 16MB document
 * limit — the 26MB company profile PDF fits fine.
 */
const fs = require('fs');
const { pipeline } = require('stream/promises');
const mongoose = require('mongoose');
const { getBucket } = require('../../config/db');

/** Stream a file from disk into GridFS. Returns its new ObjectId and size. */
async function put(filePath, { filename, contentType, metadata = {} }) {
  const bucket = getBucket();
  const upload = bucket.openUploadStream(filename, { metadata: { ...metadata, contentType } });
  await pipeline(fs.createReadStream(filePath), upload);
  const stat = await fs.promises.stat(filePath);
  return { fileId: upload.id, bytes: stat.size };
}

/** Delete a file; a file that is already gone is not an error. */
async function remove(fileId) {
  try {
    await getBucket().delete(new mongoose.Types.ObjectId(String(fileId)));
  } catch (err) {
    if (!/FileNotFound|File not found/i.test(err.message)) throw err;
  }
}

async function find(fileId) {
  const files = await getBucket()
    .find({ _id: new mongoose.Types.ObjectId(String(fileId)) })
    .limit(1)
    .toArray();
  return files[0] || null;
}

/** `end` is inclusive, as in an HTTP Range header. */
function openStream(fileId, { start, end } = {}) {
  const options = {};
  if (start !== undefined) options.start = start;
  if (end !== undefined) options.end = end + 1; // GridFS treats end as exclusive
  return getBucket().openDownloadStream(new mongoose.Types.ObjectId(String(fileId)), options);
}

module.exports = { put, remove, find, openStream };
