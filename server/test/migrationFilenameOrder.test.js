// Guards against the bug class node-pg-migrate's own checkOrder option
// (scripts/migrate.js) exists to catch, but at lint time instead of migrate
// time: node-pg-migrate's getTimestamp() (node_modules/node-pg-migrate/dist/
// migration.js) only does real calendar-date parsing for a prefix of EXACTLY
// 13 or 17 digits -- anything else, including a plain 8-digit YYYYMMDD
// prefix, falls through to a raw `Number(prefix) || 0` with a suppressed
// error log. Sort order is then pure integer magnitude, not calendar
// awareness, so an 8-digit-prefixed file always sorts before every
// 14-digit-prefixed one regardless of true date -- and two files that
// happen to share an identical prefix sort by filename (localeCompare),
// which may or may not match the order they were actually run in.
//
// This actually happened: 16 migrations used a bare 8-digit prefix (plus one
// exact-duplicate-timestamp pair among otherwise-correct 14-digit files),
// so file-sort order silently diverged from true execution order the whole
// time -- undetected only because checkOrder was never enabled. See
// docs/MIGRATIONS_ROLLBACK.md and the 2026-09-11 migration renames for the
// incident this test is the mechanism to catch before it recurs.
//
// No DB connection: this only reads migration filenames on disk.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../migrations');

// The two original bootstrap migrations predate the timestamp-prefix
// convention entirely and are allowed to keep their tiny numeric prefixes --
// magnitude 0/1 always sorts first, which is correct by construction and
// doesn't need a real calendar timestamp.
const LEGACY_BOOTSTRAP_NAMES = new Set(['000_initial_schema', '001_add_password_reset_fields']);

function migrationFiles() {
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

describe('migrations/ filenames — timestamp-prefix format stays sortable in true chronological order', () => {
  test('every non-legacy migration uses a real 14-digit YYYYMMDDHHMMSS prefix (the only format node-pg-migrate sorts by real timestamp magnitude consistently with itself)', () => {
    const badFormat = [];
    for (const file of migrationFiles()) {
      const name = file.slice(0, -'.sql'.length);
      if (LEGACY_BOOTSTRAP_NAMES.has(name)) continue;
      const prefix = name.split('_')[0];
      if (!/^\d{14}$/.test(prefix)) {
        badFormat.push(file);
      }
    }
    assert.deepEqual(
      badFormat,
      [],
      `These migration filenames don't use the required 14-digit YYYYMMDDHHMMSS timestamp prefix: ${badFormat.join(', ')}. ` +
      `node-pg-migrate's getTimestamp() only real-parses exactly-13 or exactly-17 digit prefixes -- any other length ` +
      `(8-digit YYYYMMDD included) falls back to raw numeric magnitude, silently breaking sort order relative to ` +
      `14-digit-prefixed migrations regardless of true date. Rename to <YYYYMMDDHHMMSS>_<description>.sql.`
    );
  });

  test('no two migrations share an identical timestamp prefix (an exact tie silently falls back to alphabetical filename order, which may not match the order they actually ran in)', () => {
    const prefixToFiles = new Map();
    for (const file of migrationFiles()) {
      const name = file.slice(0, -'.sql'.length);
      if (LEGACY_BOOTSTRAP_NAMES.has(name)) continue;
      const prefix = name.split('_')[0];
      if (!prefixToFiles.has(prefix)) prefixToFiles.set(prefix, []);
      prefixToFiles.get(prefix).push(file);
    }

    const duplicates = [...prefixToFiles.entries()].filter(([, files]) => files.length > 1);
    assert.deepEqual(
      duplicates,
      [],
      duplicates.length === 0
        ? ''
        : `These migrations share an identical timestamp prefix: ${duplicates.map(([prefix, files]) => `${prefix} (${files.join(', ')})`).join('; ')}. ` +
          `Give each a distinct prefix (e.g. bump by one second) so file order can't silently diverge from run order.`
    );
  });
});
