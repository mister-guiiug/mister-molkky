#!/usr/bin/env node
/**
 * Idempotent Supabase project bootstrapper for Mister Mölkky.
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/setup-supabase.mjs
 *
 * What it does (each step is a no-op if already satisfied):
 *  1. List organisations → picks the first one (override with SUPABASE_ORG_ID)
 *  2. Looks for an existing project named "mister-molkky"
 *  3. If absent, creates it (region=eu-west-3 Paris, free tier) and waits
 *     for status ACTIVE_HEALTHY (provisioning ≈ 90s)
 *  4. Runs the SQL migration from docs/live-supabase.md (live_matches
 *     table, trigger, RLS policies, realtime publication)
 *  5. Fetches the anon key and prints the values to drop in .env.local
 *     and GitHub repository secrets — no secret is written to disk.
 */

import { readFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const PROJECT_NAME = 'mister-molkky';
const REGION = process.env.SUPABASE_REGION ?? 'eu-west-3';
const PLAN = 'free';

if (!TOKEN) {
  console.error(
    'Missing SUPABASE_ACCESS_TOKEN. Set it before running this script.'
  );
  process.exit(1);
}

const API = 'https://api.supabase.com/v1';

async function api(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `${init.method ?? 'GET'} ${path} → ${res.status}: ${text || res.statusText}`
    );
  }
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

function generatePassword() {
  const alphabet =
    'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%^&*';
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let pw = '';
  for (const b of bytes) pw += alphabet[b % alphabet.length];
  return pw;
}

async function pickOrg() {
  if (process.env.SUPABASE_ORG_ID) {
    return { id: process.env.SUPABASE_ORG_ID, name: '(from env)' };
  }
  const orgs = await api('/organizations');
  if (!Array.isArray(orgs) || orgs.length === 0) {
    throw new Error('No organisation found for this token.');
  }
  return orgs[0];
}

async function findProject() {
  const projects = await api('/projects');
  if (!Array.isArray(projects)) return null;
  return projects.find(p => p.name === PROJECT_NAME) ?? null;
}

async function createProject(orgId) {
  const dbPass = generatePassword();
  console.log('  → creating project (this takes ~90s)...');
  const created = await api('/projects', {
    method: 'POST',
    body: JSON.stringify({
      name: PROJECT_NAME,
      organization_id: orgId,
      db_pass: dbPass,
      region: REGION,
      plan: PLAN,
    }),
  });
  console.log(`  → project ref: ${created.id ?? created.ref ?? '(unknown)'}`);
  return { ...created, db_pass: dbPass };
}

async function waitHealthy(projectRef) {
  const deadline = Date.now() + 5 * 60 * 1000;
  while (Date.now() < deadline) {
    const proj = await api(`/projects/${projectRef}`);
    const status = proj.status ?? proj.state ?? 'UNKNOWN';
    process.stdout.write(`\r  → status: ${status}      `);
    if (status === 'ACTIVE_HEALTHY') {
      process.stdout.write('\n');
      return proj;
    }
    await sleep(5000);
  }
  throw new Error('Project did not become healthy within 5 minutes');
}

async function loadSql() {
  const md = await readFile(
    new URL('../docs/live-supabase.md', import.meta.url),
    'utf-8'
  );
  const match = md.match(/```sql\n([\s\S]*?)```/);
  if (!match) throw new Error('Could not find ```sql block in docs');
  return match[1].trim();
}

function splitSqlStatements(sql) {
  // Naïve but correct enough for our migration: scans char-by-char and
  // splits on top-level semicolons, ignoring those inside $$...$$
  // dollar-quoted blocks and single-line comments.
  const out = [];
  let buf = '';
  let inDollar = false;
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i];
    if (!inDollar && ch === '-' && sql[i + 1] === '-') {
      while (i < sql.length && sql[i] !== '\n') i += 1;
      continue;
    }
    if (sql.startsWith('$$', i)) {
      buf += '$$';
      inDollar = !inDollar;
      i += 2;
      continue;
    }
    if (ch === ';' && !inDollar) {
      const stmt = buf.trim();
      if (stmt) out.push(stmt);
      buf = '';
      i += 1;
      continue;
    }
    buf += ch;
    i += 1;
  }
  const tail = buf.trim();
  if (tail) out.push(tail);
  return out;
}

async function runSql(projectRef, sql) {
  const statements = splitSqlStatements(sql);
  for (const stmt of statements) {
    try {
      await api(`/projects/${projectRef}/database/query`, {
        method: 'POST',
        body: JSON.stringify({ query: stmt + ';' }),
      });
    } catch (err) {
      const msg = String(err.message);
      // Tolerate idempotent re-runs: "already exists" on table/policy/etc.
      if (
        /already exists|duplicate|is already member of publication/i.test(msg)
      ) {
        console.log(`    ↳ skipped (already exists)`);
        continue;
      }
      throw err;
    }
  }
}

async function getAnonKey(projectRef) {
  const keys = await api(`/projects/${projectRef}/api-keys`);
  const anon = Array.isArray(keys)
    ? keys.find(k => k.name === 'anon' || k.name === 'anon_key')
    : null;
  if (!anon) throw new Error('Could not find anon key in response');
  return anon.api_key ?? anon.key;
}

async function main() {
  console.log('Mister Mölkky — Supabase bootstrapper');
  console.log('─────────────────────────────────────');

  const org = await pickOrg();
  console.log(`Organisation: ${org.name} (${org.id})`);

  let project = await findProject();
  if (project) {
    console.log(`Found existing project: ${project.name} (${project.id})`);
  } else {
    project = await createProject(org.id);
  }

  const projectRef = project.id ?? project.ref;
  await waitHealthy(projectRef);

  console.log('Applying SQL migration...');
  const sql = await loadSql();
  await runSql(projectRef, sql);
  console.log('  ✓ migration applied');

  const url = `https://${projectRef}.supabase.co`;
  const anonKey = await getAnonKey(projectRef);

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('Done. Add the following to your .env.local:\n');
  console.log(`VITE_SUPABASE_URL=${url}`);
  console.log(`VITE_SUPABASE_ANON_KEY=${anonKey}`);
  console.log('\nAlso add them as GitHub repository secrets so the deployed');
  console.log('Pages build can enable the live feature:');
  console.log('  gh secret set VITE_SUPABASE_URL --body "..."');
  console.log('  gh secret set VITE_SUPABASE_ANON_KEY --body "..."');
  console.log('═══════════════════════════════════════════════════════');
}

main().catch(err => {
  console.error('\n✗', err.message);
  process.exit(1);
});
