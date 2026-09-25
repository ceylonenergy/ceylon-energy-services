/**
 * Shared test setup. Each test file gets its own throwaway database on a
 * real MongoDB server (local, Docker, or Atlas), so tests exercise the
 * same queries production runs. Files go to GridFS; email goes nowhere.
 *
 *   MONGODB_URI_TEST=mongodb://127.0.0.1:27017 npm test
 */
const crypto = require('crypto');
const path = require('path');

process.env.CE_SKIP_DOTENV = '1';
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017';
process.env.MONGODB_DB_NAME = `ceylon_test_${path.basename(require.main?.filename || 'x', '.test.js')}_${crypto
  .randomBytes(3)
  .toString('hex')}`;
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.STORAGE_DRIVER = 'gridfs';
process.env.MAIL_TRANSPORT = 'json';
process.env.ADMIN_SETUP_TOKEN = 'test-setup-token';
process.env.UPLOAD_TMP_DIR = path.join(require('os').tmpdir(), 'ceylon-test-uploads');

const mongoose = require('mongoose');
const request = require('supertest');
const { connectDB, disconnectDB } = require('../src/config/db');
const { createApp } = require('../src/app');
const Admin = require('../src/models/Admin');

const app = createApp();
const ADMIN = { email: 'owner@example.com', password: 'correct-horse-battery', name: 'Owner' };

async function setup() {
  await connectDB();
}

async function teardown() {
  await mongoose.connection.db.dropDatabase();
  await disconnectDB();
}

async function createAdmin(overrides = {}) {
  const data = { ...ADMIN, ...overrides };
  const admin = new Admin({ email: data.email, name: data.name });
  await admin.setPassword(data.password);
  await admin.save();
  return admin;
}

/** A supertest agent (keeps cookies) already logged in, with the admin header on every call. */
async function loginAgent(creds = ADMIN) {
  const agent = request.agent(app);
  const res = await agent
    .post('/api/auth/login')
    .set('X-Requested-With', 'ceylon-admin')
    .send({ email: creds.email, password: creds.password });
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return withHeader(agent);
}

/** Wrap an agent so every verb sends the admin header. */
function withHeader(agent) {
  const wrap = (verb) => (url) => agent[verb](url).set('X-Requested-With', 'ceylon-admin');
  return { get: wrap('get'), post: wrap('post'), put: wrap('put'), patch: wrap('patch'), delete: wrap('delete'), raw: agent };
}

/* ---- tiny but valid files -------------------------------------------- */

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

// A 2x3 baseline JPEG.
const JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAADAAIBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==',
  'base64'
);

const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n'
);

const NOT_AN_IMAGE = Buffer.from('<html><script>alert(1)</script></html>');

module.exports = { app, request, setup, teardown, createAdmin, loginAgent, withHeader, ADMIN, PNG, JPEG, PDF, NOT_AN_IMAGE };
