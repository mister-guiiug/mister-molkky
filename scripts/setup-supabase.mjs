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
 *  4. Applies every file of supabase/migrations/, in order, one query per
 *     file. They are all replayable (see supabase/README.md), so a second
 *     run changes nothing — and an error is a real error, not a re-run.
 *  5. Fetches the anon key and prints the values to drop in .env.local
 *     and GitHub repository secrets — no secret is written to disk.
 *
 * Until 30/09/2026, step 4 read a ```sql block from docs/live-supabase.md.
 * That block moved to supabase/migrations/0002 on 13/09 and the page no
 * longer carries any SQL: the script stopped right there, before applying
 * anything.
 */

import { readdir, readFile } from 'node:fs/promises';
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

const MIGRATIONS_DIR = new URL('../supabase/migrations/', import.meta.url);

/** The migration files, in the order `supabase db push` would apply them. */
async function loadMigrations() {
  const names = (await readdir(MIGRATIONS_DIR))
    .filter(name => /^\d+_.+\.sql$/.test(name))
    .sort();
  if (names.length === 0) throw new Error('No file in supabase/migrations/');
  return Promise.all(
    names.map(async name => ({
      name,
      sql: await readFile(new URL(name, MIGRATIONS_DIR), 'utf-8'),
    }))
  );
}

async function runMigrations(projectRef) {
  for (const { name, sql } of await loadMigrations()) {
    console.log(`  → ${name}`);
    await api(`/projects/${projectRef}/database/query`, {
      method: 'POST',
      body: JSON.stringify({ query: sql }),
    });
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

  console.log('Applying SQL migrations...');
  await runMigrations(projectRef);
  console.log('  ✓ migrations applied');

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
