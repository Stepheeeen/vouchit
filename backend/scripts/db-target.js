/**
 * Say which database a script is about to act on — out loud, before it acts.
 *
 * Three maintenance scripts read DATABASE_URL and print only the database
 * NAME. That is not enough to tell two deployments apart: a local .env and a
 * deployed service can both point at a database called "vouchit" on entirely
 * different clusters. Running a backfill or an admin grant against the wrong
 * one succeeds, prints "Done", and changes nothing the live app can see —
 * which is exactly what happened here, twice.
 *
 * The host is printed alongside the name. Credentials never are: the
 * username and password are stripped before anything is logged.
 */
function describeDatabaseUrl(uri) {
  if (!uri) return null;
  const host = (uri.match(/@([^/?]+)/) || [])[1] || null;
  const name = (uri.match(/\/([^/?]+)\?/) || [])[1] || null;
  return { host, name };
}

/**
 * Print the target and return the database name, or exit with an explanation.
 * `label` names the script so the line reads as its own.
 */
function requireDatabaseTarget() {
  const uri = process.env.DATABASE_URL;
  if (!uri) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }
  const target = describeDatabaseUrl(uri);
  if (!target?.name) {
    console.error('Could not read a database name out of DATABASE_URL.');
    process.exit(1);
  }

  console.log(`Server:   ${target.host ?? 'unknown'}`);
  console.log(`Database: ${target.name}`);
  // Said every run, not only when something looks wrong: the failure mode is
  // a script that works perfectly against the wrong data.
  console.log('          (check this is the deployment you meant)');
  return target.name;
}

module.exports = { describeDatabaseUrl, requireDatabaseTarget };
