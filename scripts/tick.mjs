// Dev escape hatch: fire one tick against the local dev server.
// Reads WMP_CRON_SECRET from .dev.vars so you don't have to construct the
// curl incantation on Windows.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

function readDevVars(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
}

function parseKV(text) {
  const result = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    result[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return result;
}

const devVars = parseKV(readDevVars(resolve(root, '.dev.vars')));
const secret = process.env.WMP_CRON_SECRET ?? devVars['WMP_CRON_SECRET'];

if (!secret) {
  console.error('WMP_CRON_SECRET not found in .dev.vars or environment');
  process.exit(1);
}

const url = process.env.WMP_TICK_URL ?? 'http://localhost:5173/api/cron/tick';

console.log(`POST ${url}`);
let res;
try {
  res = await fetch(url, {
    method: 'POST',
    headers: { 'x-wmp-cron-secret': secret, 'content-length': '0' }
  });
} catch (err) {
  console.error(`Request failed: ${err.message}`);
  process.exit(1);
}

const body = await res.text();
console.log(`status: ${res.status}`);
console.log(body);

if (res.status !== 200) process.exit(1);
