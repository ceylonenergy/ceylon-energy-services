const mongoose = require('mongoose');
const { assetSchema } = require('./schemas/asset');

const awardSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    year: { type: String, default: null, match: /^\d{4}$/ },
    image: { type: assetSchema, required: true },
    // Lower shows first. New awards get the lowest number, so the newest
    // appears first — the order the old admin panel used.
    order: { type: Number, default: 0 },
    published: { type: Boolean, default: true },
  },
  { timestamps: true }
);

awardSchema.index({ order: 1, createdAt: -1 });

module.exports = mongoose.model('Award', awardSchema);
