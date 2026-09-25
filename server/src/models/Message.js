/**
 * A contact-form enquiry. Saved before any email is attempted, so an
 * enquiry is never lost to a mail-server problem — the old PHP form
 * dropped every message this way.
 */
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, maxlength: 100 },
    email: { type: String, required: true, maxlength: 200 },
    phone: { type: String, default: '', maxlength: 40 },
    subject: { type: String, default: '', maxlength: 200 },
    message: { type: String, required: true, maxlength: 5000 },
    status: { type: String, enum: ['new', 'read', 'archived'], default: 'new' },
    delivery: {
      status: { type: String, enum: ['sent', 'failed', 'skipped', 'pending'], default: 'pending' },
      error: { type: String, default: '' },
      at: { type: Date, default: null },
    },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '', maxlength: 400 },
  },
  { timestamps: true }
);

messageSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);
