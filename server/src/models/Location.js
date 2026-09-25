/**
 * The project gallery:
 *
 *   Location ("Rathnapura")
 *     └── Project ("Belihuloya project 01")
 *           └── Photo (one image in Cloudinary or GridFS)
 *
 * Projects and photos are embedded: the gallery is always read as one
 * tree, so this is one query instead of three, and a document stays far
 * below MongoDB's 16MB limit because it only holds file references.
 *
 * This is the same "locations" collection and shape the previous gallery
 * API wrote, extended with optional fields — existing data needs no
 * migration.
 */
const mongoose = require('mongoose');
const { assetFields } = require('./schemas/asset');

const photoSchema = new mongoose.Schema({
  ...assetFields,
  caption: { type: String, default: '', maxlength: 200 },
  order: { type: Number, default: 0 },
  // Repo-relative path a photo was imported from. Lets the seed script
  // recognise files it already handled, so re-running it never duplicates.
  sourcePath: { type: String, default: null },
  uploadedAt: { type: Date, default: Date.now },
});

const projectSchema = new mongoose.Schema({
  slug: { type: String, required: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, default: '', maxlength: 2000 },
  photos: { type: [photoSchema], default: [] },
  order: { type: Number, default: 0 },
  published: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

const locationSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    projects: { type: [projectSchema], default: [] },
    order: { type: Number, default: 0 },
    // Hide a location from the live site without deleting its photos.
    published: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Location', locationSchema);
