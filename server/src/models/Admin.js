/**
 * An admin-panel account. Replaces the single shared password the PHP
 * panel kept in admin/data/auth.php.
 */
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const BCRYPT_COST = 12;
const MAX_FAILED_LOGINS = 6; // same limits as the old PHP panel
const LOCKOUT_MS = 5 * 60 * 1000;

const adminSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 200 },
    name: { type: String, default: '', trim: true, maxlength: 100 },
    passwordHash: { type: String, required: true },
    // Part of every session token. Bumping it (on password change) makes
    // every existing session for this account invalid at once.
    tokenVersion: { type: Number, default: 0 },
    failedLoginCount: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true }
);

adminSchema.methods.setPassword = async function setPassword(plain) {
  this.passwordHash = await bcrypt.hash(plain, BCRYPT_COST);
};

adminSchema.methods.checkPassword = function checkPassword(plain) {
  return bcrypt.compare(String(plain), this.passwordHash);
};

adminSchema.methods.isLocked = function isLocked() {
  return Boolean(this.lockUntil && this.lockUntil > new Date());
};

/** Count a failed attempt; lock the account once the limit is reached. */
adminSchema.methods.registerFailedLogin = async function registerFailedLogin() {
  this.failedLoginCount += 1;
  if (this.failedLoginCount >= MAX_FAILED_LOGINS) {
    this.lockUntil = new Date(Date.now() + LOCKOUT_MS);
    this.failedLoginCount = 0;
  }
  await this.save();
};

adminSchema.methods.registerSuccessfulLogin = async function registerSuccessfulLogin() {
  this.failedLoginCount = 0;
  this.lockUntil = null;
  this.lastLoginAt = new Date();
  await this.save();
};

/** What the API is allowed to reveal about an account. */
adminSchema.methods.toPublic = function toPublic() {
  return {
    id: String(this._id),
    email: this.email,
    name: this.name,
    lastLoginAt: this.lastLoginAt,
    createdAt: this.createdAt,
  };
};

// Compare against a dummy hash when the email is unknown, so a login for
// a non-existent account takes as long as a real one and the timing does
// not reveal which emails have accounts. Built on first use.
let dummyHash = null;
adminSchema.statics.burnPasswordCheck = async function burnPasswordCheck(plain) {
  if (!dummyHash) dummyHash = await bcrypt.hash('not-a-real-password', BCRYPT_COST);
  await bcrypt.compare(String(plain), dummyHash);
  return false;
};

module.exports = mongoose.model('Admin', adminSchema);
module.exports.LOCKOUT_MS = LOCKOUT_MS;
module.exports.MAX_FAILED_LOGINS = MAX_FAILED_LOGINS;
