#!/usr/bin/env node
/**
 * Create an admin account — or reset a forgotten password.
 *
 *   npm run create-admin                                   asks for everything
 *   npm run create-admin -- --email you@example.com        asks for the password
 *   npm run create-admin -- --email you@example.com --reset
 *
 * Passwords typed at the prompt are not shown on screen. Passing
 * --password on the command line also works (handy for scripted hosts),
 * but it can end up in your shell history.
 */
const readline = require('readline');
const { assertRequiredEnv } = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/db');
const Admin = require('../src/models/Admin');
const v = require('../src/utils/validate');

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  if (i !== -1 && args[i + 1] && !args[i + 1].startsWith('--')) return args[i + 1];
  const eq = args.find((a) => a.startsWith(`--${name}=`));
  return eq ? eq.slice(name.length + 3) : undefined;
};
const RESET = args.includes('--reset');

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      // Echo nothing while the password is typed.
      rl._writeToOutput = (s) => {
        if (s.includes(question)) rl.output.write(s);
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer.trim());
    });
  });
}

async function main() {
  assertRequiredEnv();

  const email = v.email(flag('email') || (await ask('  Admin email: ')));
  await connectDB();

  const existing = await Admin.findOne({ email });
  if (existing && !RESET) {
    console.log(`\n  ${email} already has an account.`);
    console.log('  To set a new password for it, run the same command with --reset.\n');
    return;
  }

  const name = existing ? existing.name : flag('name') ?? (await ask('  Your name (optional): '));
  let password = flag('password');
  if (!password) {
    password = await ask('  Password (8+ characters): ', { hidden: true });
    const again = await ask('  Repeat password: ', { hidden: true });
    if (password !== again) throw new Error('The passwords do not match.');
  }
  v.password(password);

  const admin = existing || new Admin({ email, name: v.text(name, { label: 'Name', max: 100 }) });
  await admin.setPassword(password);
  if (existing) {
    admin.tokenVersion += 1; // log out every existing session
    admin.failedLoginCount = 0;
    admin.lockUntil = null;
  }
  await admin.save();

  console.log(`\n  ${existing ? 'Password reset' : 'Admin created'} for ${email}.`);
  console.log('  Log in at /admin on your website.\n');
}

main()
  .catch((err) => {
    console.error(`\n  ${err.message}\n`);
    process.exitCode = 1;
  })
  .finally(() => disconnectDB().catch(() => {}));
