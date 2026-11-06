import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const seed = JSON.parse(readFileSync(resolve(root, 'src/lib/data/airports.seed.json'), 'utf8'));

const outPath = resolve(root, 'db/seeds/airports.sql');
mkdirSync(dirname(outPath), { recursive: true });

const rows = seed
  .map(
    (a) =>
      `  (${sql(a.iata)}, ${sql(a.icao)}, ${sql(a.name)}, ${a.lat}, ${a.lon}, ${sql(a.tz)}, ${sql(a.country)})`
  )
  .join(',\n');

const body = `-- Auto-generated from src/lib/data/airports.seed.json. Do not edit.
INSERT OR IGNORE INTO airports (iata, icao, name, lat, lon, tz, country) VALUES
${rows};
`;

writeFileSync(outPath, body, 'utf8');
console.log(`Wrote ${seed.length} rows to ${outPath}`);

const target = process.argv[2] === '--remote' ? '--remote' : '--local';
execSync(`npx wrangler d1 execute wmp-db ${target} --file db/seeds/airports.sql`, {
  stdio: 'inherit',
  cwd: root
});

function sql(v) {
  if (v === null || v === undefined) return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}
