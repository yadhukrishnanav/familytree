#!/usr/bin/env node
// Family Tree — Supabase SQL runner
// Usage: node scripts/supa-sql.mjs "<SQL>"
//   or:  node scripts/supa-sql.mjs --file=path/to/sql
//   or:  node scripts/supa-sql.mjs --interactive
//
// Reads connection string from SUPABASE_DB_URL env var or .env.local.
// Get it from Supabase Dashboard → Project Settings → Database → Connection string (URI).

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try to load .env.local or .env
function loadEnv() {
  const candidates = [
    path.join(__dirname, '..', '.env.local'),
    path.join(__dirname, '..', '.env'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf8');
      for (const line of content.split('\n')) {
        const m = line.match(/^([A-Z_]+)=(.*)$/);
        if (m) {
          const val = m[2].replace(/^["']|["']$/g, '');
          if (!process.env[m[1]]) process.env[m[1]] = val;
        }
      }
    }
  }
}
loadEnv();

const DB_URL = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!DB_URL) {
  console.error('❌ No database URL found.');
  console.error('');
  console.error('Set SUPABASE_DB_URL in one of these places:');
  console.error('  1. Environment variable: export SUPABASE_DB_URL="postgresql://..."');
  console.error('  2. .env.local file: SUPABASE_DB_URL=postgresql://...');
  console.error('');
  console.error('Get the URL from:');
  console.error('  Supabase Dashboard → Project Settings → Database → Connection string');
  console.error('  (use the "URI" tab, format: postgresql://postgres.[ref]:[password]@...)');
  process.exit(1);
}

async function runSql(sql) {
  const client = new pg.Client({
    connectionString: DB_URL,
    // Supabase uses a connection pooler that requires these
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });
  try {
    await client.connect();
    const result = await client.query(sql);
    return result;
  } finally {
    await client.end();
  }
}

function formatResult(result) {
  if (result.rows.length === 0) {
    return '✓ Query OK — no rows returned';
  }
  const cols = Object.keys(result.rows[0]);
  const widths = cols.map(c => Math.max(c.length, ...result.rows.map(r => String(r[c] ?? '').length)));
  const sep = widths.map(w => '-'.repeat(w)).join(' | ');
  const header = cols.map((c, i) => c.padEnd(widths[i])).join(' | ');
  const rows = result.rows.map(r => cols.map((c, i) => String(r[c] ?? '').padEnd(widths[i])).join(' | ')).join('\n');
  return `${header}\n${sep}\n${rows}\n\n(${result.rows.length} rows)`;
}

async function main() {
  const args = process.argv.slice(2);

  // Mode 1: --file=path
  const fileArg = args.find(a => a.startsWith('--file='));
  if (fileArg) {
    const filePath = fileArg.slice(7);
    const sql = fs.readFileSync(filePath, 'utf8');
    const result = await runSql(sql);
    console.log(formatResult(result));
    return;
  }

  // Mode 2: --interactive
  if (args.includes('--interactive') || args.includes('-i')) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log('Supabase SQL interactive. Type SQL and end with ";". Type "exit" to quit.\n');
    let buffer = '';
    const prompt = () => rl.question(buffer ? '... ' : 'sql> ', async (line) => {
      if (line.trim().toLowerCase() === 'exit') { rl.close(); return; }
      buffer += ' ' + line;
      if (line.includes(';')) {
        try {
          const result = await runSql(buffer.trim());
          console.log(formatResult(result));
        } catch (e) {
          console.error('❌', e.message);
        }
        buffer = '';
      }
      prompt();
    });
    prompt();
    return;
  }

  // Mode 3: inline SQL
  const sql = args.join(' ').trim();
  if (!sql) {
    console.error('Usage:');
    console.error('  node scripts/supa-sql.mjs "SELECT * FROM persons LIMIT 5"');
    console.error('  node scripts/supa-sql.mjs --file=./supabase/schema.sql');
    console.error('  node scripts/supa-sql.mjs --interactive');
    process.exit(1);
  }
  try {
    const result = await runSql(sql);
    console.log(formatResult(result));
  } catch (e) {
    console.error('❌', e.message);
    process.exit(2);
  }
}

main();
