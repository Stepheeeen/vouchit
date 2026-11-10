/**
 * Boots a throwaway single-node MongoDB replica set for integration tests.
 *
 * mongodb-memory-server's managed instance aborts (SIGABRT) on this platform,
 * but the same mongod binary runs fine when launched directly — so we launch it
 * ourselves and initiate the replica set over the driver. Prisma needs a replica
 * set because it uses transactions.
 *
 * Set MONGO_TEST_URI to point the suite at an existing server instead.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { MongoClient } from 'mongodb';

const REPL_SET = 'vouchittest';

/**
 * Locate a mongod binary from wherever mongodb-memory-server cached it, falling
 * back to PATH. It has used both of these locations across versions, so check
 * both rather than assuming one.
 */
function findMongod(): string {
  const candidates = [
    join(__dirname, '..', 'node_modules', '.cache', 'mongodb-memory-server'),
    join(homedir(), '.cache', 'mongodb-binaries'),
  ];
  for (const dir of candidates) {
    if (!existsSync(dir)) continue;
    const binary = readdirSync(dir).find((f) => f.startsWith('mongod'));
    if (binary) return join(dir, binary);
  }
  return 'mongod';
}

export interface MongoHarness {
  uri: string;
  stop: () => Promise<void>;
}

export async function startMongo(port = 27077): Promise<MongoHarness> {
  if (process.env.MONGO_TEST_URI) {
    return { uri: process.env.MONGO_TEST_URI, stop: async () => {} };
  }

  const dbPath = mkdtempSync(join(tmpdir(), 'vouchit-mongo-'));
  const proc: ChildProcess = spawn(
    findMongod(),
    ['--dbpath', dbPath, '--port', String(port), '--replSet', REPL_SET, '--bind_ip', '127.0.0.1'],
    { stdio: 'ignore' },
  );

  const directUri = `mongodb://127.0.0.1:${port}/?directConnection=true`;

  // Wait for the server to accept connections, then initiate the replica set.
  //
  // The budget is generous on purpose. A cold mongod on a spinning-disk or
  // otherwise loaded macOS machine measured 23s to accept its first connection
  // and 32s to elect a primary — just past the 30s this used to allow, so the
  // suite failed with "mongod did not become ready" on a server that was in
  // fact starting normally. A warm page cache does the same work in 9s, which
  // is why it looked fine until it wasn't. Override with MONGO_START_TIMEOUT_MS.
  const startBudgetMs = Number(process.env.MONGO_START_TIMEOUT_MS) || 120_000;
  const deadline = Date.now() + startBudgetMs;
  for (;;) {
    if (Date.now() > deadline) {
      proc.kill('SIGKILL');
      throw new Error(
        `mongod did not become ready within ${Math.round(startBudgetMs / 1000)}s ` +
          `(dbPath ${dbPath}). Raise MONGO_START_TIMEOUT_MS if this machine is just slow.`,
      );
    }
    try {
      const client = new MongoClient(directUri, { serverSelectionTimeoutMS: 500 });
      await client.connect();
      try {
        await client
          .db('admin')
          .command({ replSetInitiate: { _id: REPL_SET, members: [{ _id: 0, host: `127.0.0.1:${port}` }] } });
      } catch (err: any) {
        // "already initialized" is fine; anything else is not.
        if (!/already initialized/i.test(err?.message ?? '')) throw err;
      }

      // Wait for the node to actually become primary before handing back a URI.
      for (;;) {
        const status: any = await client.db('admin').command({ hello: 1 });
        if (status.isWritablePrimary) break;
        // Rethrown through the outer catch, which retries until the shared
        // deadline — so surface the distinct cause rather than letting it be
        // reported as a plain startup timeout.
        if (Date.now() > deadline) {
          proc.kill('SIGKILL');
          throw Object.assign(
            new Error('mongod accepted connections but never elected a primary'),
            { fatal: true },
          );
        }
        await new Promise((r) => setTimeout(r, 250));
      }
      await client.close();
      break;
    } catch (err: any) {
      // The retry loop exists for "not listening yet", which looks like a
      // connection error. A failed primary election is a different animal: it
      // means the server IS up, so retrying only burns the budget and then
      // misreports the cause as a startup timeout. Let it out.
      if (err?.fatal) throw err;
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  return {
    uri: `mongodb://127.0.0.1:${port}/vouchit_test?replicaSet=${REPL_SET}&directConnection=false`,
    stop: async () => {
      proc.kill('SIGTERM');
      await new Promise((r) => setTimeout(r, 500));
      try {
        rmSync(dbPath, { recursive: true, force: true });
      } catch {
        /* best effort */
      }
    },
  };
}
