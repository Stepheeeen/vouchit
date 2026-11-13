#!/usr/bin/env node
/**
 * Add the columns Prisma now requires to User documents written before they
 * existed.
 *
 * Prisma applies `@default(...)` when it CREATES a document, not when it
 * reads one. A document saved before a field was added simply lacks that
 * field, and Prisma refuses to materialise the row at all:
 *
 *   Invalid `prisma.user.findUnique()` invocation
 *
 * So the whole account becomes unreadable — not just the missing value. For a
 * non-nullable scalar there is no "treat absent as the default" behaviour to
 * fall back on. Confirmed against a real document, not assumed.
 *
 * The staging database is empty, so this is not needed there. It is needed
 * for any database that already holds users, which includes the production
 * one if it is ever pointed at this build.
 *
 * Usage:
 *   node scripts/backfill-user-defaults.js            # report only
 *   node scripts/backfill-user-defaults.js --apply    # write the changes
 *
 *   DATABASE_URL=... node scripts/backfill-user-defaults.js --apply
 *
 * Safe to run more than once: every update is conditional on the field being
 * absent, so a second run touches nothing.
 */
require('dotenv').config({ quiet: true });
const { MongoClient } = require('mongodb');
const { requireDatabaseTarget } = require('./db-target');

/**
 * Field -> value, mirroring the @default() in prisma/schema.prisma.
 *
 * Keep this in step with the User model. A field added there without a line
 * here will break reads of older documents in exactly the way described above.
 */
const DEFAULTS = {
  otpAttempts: 0,
  twoFactorEnabled: false,
  // Matches the schema default. Someone who had notifications before should
  // keep getting them rather than be silently opted out by a migration.
  loginAlertsEnabled: true,
  notifyWager: true,
  notifyPayout: true,
  notifyDispute: true,
  notifyMarketing: false,
  notifyEmail: true,
  publicProfile: true,
  showOnLeaderboard: true,
};

/**
 * Optional fields need no backfill — Prisma reads an absent optional as null.
 * `username` is deliberately not listed for that reason.
 */

async function main() {
  const apply = process.argv.includes('--apply');
  const uri = process.env.DATABASE_URL;
  const dbName = requireDatabaseTarget();

  const client = new MongoClient(uri);
  await client.connect();
  const users = client.db(dbName).collection('User');

  const total = await users.countDocuments();
  console.log(`Users:    ${total}`);
  console.log(apply ? 'Mode:     APPLY\n' : 'Mode:     dry run (pass --apply to write)\n');

  let needWork = 0;
  for (const [field, value] of Object.entries(DEFAULTS)) {
    const missing = await users.countDocuments({ [field]: { $exists: false } });
    if (missing === 0) continue;
    needWork += missing;
    console.log(`  ${field.padEnd(20)} missing on ${missing} document(s) -> ${JSON.stringify(value)}`);
    if (apply) {
      const res = await users.updateMany(
        { [field]: { $exists: false } },
        { $set: { [field]: value } },
      );
      console.log(`  ${''.padEnd(20)} set on ${res.modifiedCount}`);
    }
  }

  // sessionsValidFrom is a timestamp, so it cannot share the constant map:
  // each document gets its own creation time, which keeps any token issued
  // before this migration valid rather than signing everyone out at once.
  const missingSessions = await users.countDocuments({ sessionsValidFrom: { $exists: false } });
  if (missingSessions > 0) {
    needWork += missingSessions;
    console.log(`  ${'sessionsValidFrom'.padEnd(20)} missing on ${missingSessions} document(s) -> createdAt`);
    if (apply) {
      let fixed = 0;
      const cursor = users.find({ sessionsValidFrom: { $exists: false } });
      while (await cursor.hasNext()) {
        const doc = await cursor.next();
        await users.updateOne(
          { _id: doc._id },
          { $set: { sessionsValidFrom: doc.createdAt ?? new Date(0) } },
        );
        fixed += 1;
      }
      console.log(`  ${''.padEnd(20)} set on ${fixed}`);
    }
  }

  if (needWork === 0) {
    console.log('  Nothing to do — every document already carries these fields.');
  } else if (!apply) {
    console.log('\nRe-run with --apply to write these changes.');
  } else {
    console.log('\nDone.');
  }

  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
