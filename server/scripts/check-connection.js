#!/usr/bin/env node
/**
 * Check every outside service the site depends on, and say which one is
 * unhappy and why:   npm run check
 */
const { env, assertRequiredEnv } = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/db');
const { cloudinary } = require('../src/config/cloudinary');
const { verifyMail } = require('../src/services/mailer');

const line = (label, ok, detail) => console.log(`  ${label.padEnd(16)} ${ok ? 'OK    ' : 'FAILED'}  ${detail}`);

async function main() {
  console.log('\n  Ceylon Energy — checking your setup\n');

  const problems = assertRequiredEnv({ exit: false });
  if (problems.length) {
    problems.forEach((p) => console.log(`  Settings         FAILED  ${p}`));
    console.log('');
  } else {
    line('Settings', true, '.env / environment looks complete');
  }

  let failed = problems.length > 0;

  if (env.mongoUri) {
    try {
      const conn = await connectDB();
      const db = conn.connection.db;
      const [locations, documents, admins] = await Promise.all([
        db.collection('locations').countDocuments(),
        db.collection('documents').countDocuments(),
        db.collection('admins').countDocuments(),
      ]);
      line('MongoDB Atlas', true, `database "${env.dbName}": ${locations} locations, ${documents} documents, ${admins} admins`);
      if (!admins) console.log('                          -> no admin yet: run  npm run create-admin');
      if (!locations) console.log('                          -> gallery is empty: run  npm run seed');
    } catch (err) {
      failed = true;
      line('MongoDB Atlas', false, err.message);
      console.log('                          -> Is this machine\'s IP allowed in Atlas -> Network Access? Is the password right?');
    }
  }

  if (env.cloudinaryConfigured) {
    try {
      await cloudinary.api.ping();
      line('Cloudinary', true, `cloud "${env.cloudinary.cloudName}"`);
    } catch (err) {
      failed = true;
      line('Cloudinary', false, err.message || String(err.error?.message || err));
    }
  } else {
    line('Cloudinary', true, 'not configured — images are stored in MongoDB GridFS instead');
  }
  console.log(`  ${'Image storage'.padEnd(16)} ${env.storageDriver}`);

  try {
    const mail = await verifyMail();
    if (mail.ok) line('Email (SMTP)', true, `${mail.detail} -> ${env.mail.to.join(', ')}`);
    else line('Email (SMTP)', true, 'not configured — enquiries are saved to Admin -> Messages only');
  } catch (err) {
    failed = true;
    line('Email (SMTP)', false, err.message);
  }

  console.log('');
  await disconnectDB();
  process.exitCode = failed ? 1 : 0;
}

main().catch(async (err) => {
  console.error('  Check failed:', err.message);
  await disconnectDB().catch(() => {});
  process.exitCode = 1;
});
