#!/usr/bin/env node
// Run SQL against the Supabase Postgres DB.
// Usage:
//   node scripts/run-sql.mjs "alter table students add column if not exists x text;"
//   node scripts/run-sql.mjs path/to/file.sql
// Reads SUPABASE_DB_URL from .env.local (the Postgres connection string/URI).
import { readFileSync, existsSync } from "node:fs";
import pg from "pg";

// Minimal .env.local loader (no extra deps).
function loadEnv() {
  const p = new URL("../.env.local", import.meta.url);
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv();

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("Missing SUPABASE_DB_URL in .env.local");
  process.exit(1);
}

const arg = process.argv[2];
if (!arg) {
  console.error('Provide SQL or a .sql file path.');
  process.exit(1);
}
const sql = arg.endsWith(".sql") && existsSync(arg) ? readFileSync(arg, "utf8") : arg;

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
try {
  await client.connect();
  const res = await client.query(sql);
  const results = Array.isArray(res) ? res : [res];
  for (const r of results) {
    if (r.rows?.length) console.table(r.rows);
    else console.log(`OK: ${r.command ?? "done"}${r.rowCount != null ? ` (${r.rowCount} rows)` : ""}`);
  }
} catch (e) {
  console.error("SQL error:", e.message);
  process.exit(1);
} finally {
  await client.end();
}
