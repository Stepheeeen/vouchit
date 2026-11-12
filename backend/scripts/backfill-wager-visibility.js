#!/usr/bin/env node
/**
 * Give existing wagers an explicit visibility and an invite token.
 *
 * `visibility` is nullable and the code reads null as PUBLIC, so nothing
 * breaks without this — it exists so the data says what it means rather than
 * relying on a convention, and so older wagers get an invite token like every
 * new one.
 *
 * Existing wagers are set to PUBLIC, not PRIVATE. They were already listed on
 * Explore and visible to everyone, so marking them private would retroactively
 * hide wagers whose creators can currently see them. New wagers default to
 * PRIVATE; that change applies going forward, not backwards.
 *
 * Usage:
 *   node scripts/backfill-wager-visibility.js            # report, change nothing
 *   node scripts/backfill-wager-visibility.js --apply
 */
require('dotenv').config({ quiet: true });
const { MongoClient } = require('mongodb');
const { randomBytes } = require('crypto');

async function main() {
  const apply = process.argv.includes('--apply');
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
  const wagers = client.db(dbName).collection('Wager');

  const total = await wagers.countDocuments();
  const missingVisibility = await wagers.countDocuments({
    $or: [{ visibility: { $exists: false } }, { visibility: null }],
  });
  const missingToken = await wagers.countDocuments({
    $or: [{ inviteToken: { $exists: false } }, { inviteToken: null }],
  });

  console.log(`Database:            ${dbName}`);
  console.log(`Wagers:              ${total}`);
  console.log(`Without visibility:  ${missingVisibility}  -> PUBLIC`);
  console.log(`Without inviteToken: ${missingToken}  -> generated`);

  if (!apply) {
    console.log('\nDry run. Re-run with --apply to make the change.');
    await client.close();
    return;
  }

  if (missingVisibility > 0) {
    const res = await wagers.updateMany(
      { $or: [{ visibility: { $exists: false } }, { visibility: null }] },
      { $set: { visibility: 'PUBLIC' } },
    );
    console.log(`\nSet visibility on ${res.modifiedCount} wager(s).`);
  }

  // One token per document, so they cannot be generated in a single
  // updateMany — every wager needs its own secret.
  let tokened = 0;
  const cursor = wagers.find(
    { $or: [{ inviteToken: { $exists: false } }, { inviteToken: null }] },
    { projection: { _id: 1 } },
  );
  for await (const doc of cursor) {
    await wagers.updateOne(
      { _id: doc._id },
      { $set: { inviteToken: randomBytes(32).toString('base64url') } },
    );
    tokened += 1;
  }
  if (tokened) console.log(`Generated an invite token for ${tokened} wager(s).`);

  console.log('\nDone.');
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
