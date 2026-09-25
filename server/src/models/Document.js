/**
 * A PDF shown on the site with its own page-by-page viewer.
 *
 *   kind "profile"    — the main Company Profile (at most one)
 *   kind "attachment" — an additional document ("More documents")
 *   kind "archived"   — a previous Company Profile, kept so it can be
 *                       restored. The newest few are kept; older ones are
 *                       deleted along with their files.
 *
 * The PDF itself always lives in GridFS: the profile is 26MB and
 * Cloudinary's free plan refuses raw files over 10MB. The page images
 * (rendered from the PDF in the admin's browser) go to the normal image
 * storage.
 */
const mongoose = require('mongoose');
const { assetSchema } = require('./schemas/asset');

const documentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    kind: { type: String, enum: ['profile', 'attachment', 'archived'], required: true },
    pdf: { type: assetSchema, required: true },
    pages: { type: [assetSchema], default: [] },
    originalName: { type: String, default: '' },
    published: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
    archivedAt: { type: Date, default: null },
    // Set by the seed script so it can tell it already imported a file.
    seedKey: { type: String, default: null },
  },
  { timestamps: true }
);

documentSchema.index({ kind: 1, order: 1, createdAt: -1 });

documentSchema.virtual('pageCount').get(function pageCount() {
  return this.pages.length;
});

module.exports = mongoose.model('Document', documentSchema);
