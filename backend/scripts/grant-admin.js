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
 *   node scripts/grant-admin.js                            # list who has it
 *   node scripts/grant-admin.js you@example.com            # report, change nothing
 *   node scripts/grant-admin.js a@x.com b@y.com --apply    # several at once
 *   node scripts/grant-admin.js you@example.com --revoke --apply
 *
 *   DATABASE_URL=... node scripts/grant-admin.js ... --apply
 *
 * IMPORTANT: the role lives in the database, so this acts on whichever
 * database DATABASE_URL points at. A local .env and the deployed service can
 * easily point at different ones — granting against the wrong database looks
 * like it worked and changes nothing the live app can see. The database name
 * is printed on every run; check it is the one you meant.
 *
 * The raw MongoDB driver is used rather than Prisma on purpose. Prisma
 * refuses to read a document that is missing a non-nullable column, which is
 * a state this database has been in before — and a repair script that cannot
 * run when the data is broken is no use at all.
 *
 * The role is read from the database on every authenticated request, not
 * from the token, so a change takes effect immediately — the person does not
 * need to sign out and back in, and revoking is instant.
 */
require('dotenv').config({ quiet: true });
const { MongoClient } = require('mongodb');
const { requireDatabaseTarget } = require('./db-target');

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const revoke = args.includes('--revoke');
  const emails = args
    .filter((a) => !a.startsWith('--'))
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean);

  const uri = process.env.DATABASE_URL;
  const dbName = requireDatabaseTarget();

  const client = new MongoClient(uri);
  await client.connect();
  const users = client.db(dbName).collection('User');

  const admins = await users
    .find({ role: 'ADMIN' }, { projection: { email: 1 } })
    .toArray();

  console.log(
    `Admins:   ${admins.length ? admins.map((a) => a.email).join(', ') : 'none'}`,
  );

  if (emails.length === 0) {
    console.log('\nPass one or more email addresses to grant or revoke the role.');
    if (admins.length === 0) {
      console.log(
        'WARNING: with no admin, nobody can resolve a dispute, and a disputed\n' +
          '         wager keeps both stakes locked in the escrow contract.',
      );
    }
    await client.close();
    return;
  }

  const target = revoke ? 'USER' : 'ADMIN';
  const planned = [];
  let missing = 0;

  for (const email of emails) {
    const user = await users.findOne(
      { email },
      { projection: { email: 1, role: 1, emailVerified: 1 } },
    );
    if (!user) {
      console.error(`\n${email}: no account with that address in ${dbName}.`);
      missing += 1;
      continue;
    }

    const current = user.role || 'USER';
    console.log(`\n${user.email}`);
    console.log(`  verified: ${user.emailVerified ? 'yes' : 'no'}`);
    console.log(`  role:     ${current}  ->  ${target}${current === target ? '  (no change)' : ''}`);
    if (current !== target) planned.push(user);
  }

  // Removing the last admin leaves disputes unresolvable, which is the exact
  // state this script exists to get out of. Say so rather than doing it
  // quietly.
  if (revoke && admins.length - planned.length <= 0) {
    console.log(
      '\nWARNING: this would remove the last admin. No dispute could then be\n' +
        '         resolved until another account is promoted.',
    );
  }

  if (planned.length === 0) {
    console.log(missing ? '\nNothing to change.' : '\nAlready set. Nothing to do.');
    await client.close();
    process.exit(missing ? 1 : 0);
  }

  if (!apply) {
    console.log(`\nDry run. Re-run with --apply to change ${planned.length} account(s).`);
    await client.close();
    return;
  }

  const res = await users.updateMany(
    { _id: { $in: planned.map((u) => u._id) } },
    { $set: { role: target } },
  );
  console.log(`\nDone. ${res.modifiedCount} account(s) are now ${target}.`);
  console.log('Takes effect immediately — no need to sign out and back in.');
  await client.close();
  if (missing) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
