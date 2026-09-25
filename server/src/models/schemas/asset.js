/**
 * One stored file — the shape every model uses to point at an image or
 * PDF, wherever it physically lives:
 *
 *   provider "cloudinary" -> publicId is Cloudinary's id, url is its CDN URL
 *   provider "gridfs"     -> fileId is the GridFS id, url is /api/files/<id>
 *
 * `provider` is absent on photos written by the previous gallery API,
 * which only ever used Cloudinary; readers treat a missing provider as
 * "cloudinary", so data already in Atlas keeps working unchanged.
 */
const mongoose = require('mongoose');

const assetFields = {
  provider: { type: String, enum: ['cloudinary', 'gridfs'], default: 'cloudinary' },
  publicId: { type: String },
  fileId: { type: mongoose.Schema.Types.ObjectId },
  url: { type: String, required: true },
  width: Number,
  height: Number,
  format: String,
  bytes: Number,
  mimeType: String,
  originalName: String,
};

const assetSchema = new mongoose.Schema(assetFields, { _id: false });

module.exports = { assetFields, assetSchema };
