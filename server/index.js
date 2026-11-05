/**
 * Entry point for Vercel (and other serverless hosts).
 *
 * Vercel never runs `npm start`. Its Express preset loads the first of
 * app.js, index.js, server.js, src/app.js, src/index.js, src/server.js
 * that mentions express, and calls that module's export for every
 * request, so the export must be the app itself. This file comes before
 * src/app.js in that list; without it Vercel used src/app.js, whose
 * export is the createApp() factory, and every request failed with
 * "500 FUNCTION_INVOCATION_FAILED".
 *
 * There is also no startup step to connect to MongoDB before the first
 * visitor arrives, as src/server.js does. The first request opens the
 * connection and later requests on the same instance reuse it.
 */
const express = require('express');
const { assertRequiredEnv } = require('./src/config/env');
const { connectDB } = require('./src/config/db');
const { createApp } = require('./src/app');

// A missing setting must not crash the function (that only shows a bare
// FUNCTION_INVOCATION_FAILED page), so it is reported on every request.
const problems = assertRequiredEnv({ exit: false });
if (problems.length) {
  console.error('  The server is missing required settings:');
  problems.forEach((p) => console.error(`   - ${p}`));
}

const app = express();
app.disable('x-powered-by');

app.use(async (req, res, next) => {
  if (problems.length) {
    return res.status(500).json({
      ok: false,
      error: 'The server is missing required settings. Add them to the environment variables of the deployment, then redeploy.',
      problems,
    });
  }
  try {
    await connectDB();
  } catch {
    // connectDB() has already logged the reason and a hint.
    return res.status(503).json({ ok: false, error: 'The server could not connect to the database. The reason is in the server logs.' });
  }
  next();
});

app.use(createApp());

module.exports = app;
