/**
 * Start the server:  npm start   (or npm run dev to restart on changes)
 *
 * Connects to MongoDB Atlas first and only then accepts traffic, so a
 * wrong connection string fails loudly at startup instead of on the
 * first visitor's request.
 */
const { env, assertRequiredEnv } = require('./config/env');
const { connectDB, disconnectDB } = require('./config/db');
const { createApp } = require('./app');

async function start() {
  assertRequiredEnv();
  await connectDB();

  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`\n  Ceylon Energy running on http://localhost:${env.port}`);
    console.log(`   Storage: ${env.storageDriver}   Mail: ${env.mail.transport}   Mode: ${env.nodeEnv}\n`);
  });

  // A 26MB PDF plus its page images can take a while on a slow uplink.
  server.requestTimeout = 10 * 60 * 1000;
  server.headersTimeout = 65 * 1000;

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n  Port ${env.port} is already in use by another program.`);
      console.error(`   See what holds it:  lsof -i :${env.port}    or set a different PORT in .env\n`);
      process.exit(1);
    }
    throw err;
  });

  // Close cleanly so Atlas is not left with stale connections on redeploy.
  const shutdown = (signal) => {
    console.log(`\n  ${signal} received — shutting down.`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

if (require.main === module) {
  start().catch((err) => {
    console.error('  Failed to start:', err.message);
    process.exit(1);
  });
}

module.exports = { start };
