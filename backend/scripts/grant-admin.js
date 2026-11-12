#!/usr/bin/env node
/**
 * Grant or revoke the ADMIN role on an account.
 *
 * Nothing in the codebase could do this. There is no seed, no promote route
 * and no UI, yet `AdminGuard` refuses every request without the role — so
 * with zero admins, `POST /disputes/:id/resolve` is unreachable by anyone.
 * A disputed wager stays DISPUTED, and both stakes stay in the escrow
 * contract with nobody able to release them. That is a live trap the moment
 * one person disagrees with another.
 *
 * There is no separate admin password: an admin signs in with their ordinary
 * account. That is deliberate — a second set of credentials is a second thing
 * to leak, and this way the role can be removed without anyone changing how
 * they log in.
 *
 * Usage:
 *   node scripts/grant-admin.js                       # list who has it
 *   node scripts/grant-admin.js you@example.com       # report, change nothing
 *   node scripts/grant-admin.js you@example.com --apply
 *   node scripts/grant-admin.js you@example.com --revoke --apply
 *
 *   DATABASE_URL=... node scripts/grant-admin.js ... --apply
 *
 * The role is read from the database on every authenticated request, not
 * from the token, so a change takes effect immediately — the person does not
 * need to sign out and back in, and revoking is instant.
 */
require('dotenv').config({ quiet: true });
const { MongoClient } = require('mongodb');

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const revoke = args.includes('--revoke');
  const email = args.find((a) => !a.startsWith('--'))?.trim().toLowerCase();

  const uri = process.env.DATABASE_URL;
  if (!uri) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }
  const dbName = (uri.match(/\/([^/?]+)\?/) || [])[1];
  if (!dbName) {
    console.error('Could not read a database name out of DATABASE_URL.');
    process.exit(1);
  }

  const client = new MongoClient(uri);
  await client.connect();
  const users = client.db(dbName).collection('User');

  const admins = await users
    .find({ role: 'ADMIN' }, { projection: { email: 1 } })
    .toArray();

  console.log(`Database: ${dbName}`);
  console.log(
    `Admins:   ${admins.length ? admins.map((a) => a.email).join(', ') : 'none'}`,
  );

  if (!email) {
    console.log('\nPass an email address to grant or revoke the role.');
    if (admins.length === 0) {
      console.log(
        'WARNING: with no admin, nobody can resolve a dispute, and a disputed\n' +
          '         wager keeps both stakes locked in the escrow contract.',
      );
    }
    await client.close();
    return;
  }

  const user = await users.findOne(
    { email },
    { projection: { email: 1, role: 1, emailVerified: 1 } },
  );
  if (!user) {
    console.error(`\nNo account with the address ${email} in ${dbName}.`);
    await client.close();
    process.exit(1);
  }

  const target = revoke ? 'USER' : 'ADMIN';
  console.log(`\nAccount:  ${user.email}`);
  console.log(`Verified: ${user.emailVerified ? 'yes' : 'no'}`);
  console.log(`Role:     ${user.role || 'USER'}  ->  ${target}`);

  if (user.role === target) {
    console.log('\nAlready set. Nothing to do.');
    await client.close();
    return;
  }

  // Removing the last admin leaves disputes unresolvable, which is the exact
  // state this script exists to get out of. Say so rather than doing it
  // quietly.
  if (revoke && admins.length <= 1 && user.role === 'ADMIN') {
    console.log(
      '\nWARNING: this is the only admin. Revoking it means no dispute can be\n' +
        '         resolved until another account is promoted.',
    );
  }

  if (!apply) {
    console.log('\nDry run. Re-run with --apply to make the change.');
    await client.close();
    return;
  }

  await users.updateOne({ _id: user._id }, { $set: { role: target } });
  console.log(`\nDone. ${user.email} is now ${target}.`);
  console.log('Takes effect immediately — no need to sign out and back in.');
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
