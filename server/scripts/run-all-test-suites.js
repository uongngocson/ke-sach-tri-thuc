import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const suites = [
  'run-tests.js',
  'test-modal-keys.js',
  'test-content-settings.js',
  'test-unit-suite.js',
  'test-teams-and-users-fullkey.js',
  'test-admin-analytics-deepdive.js',
  'test-state-integrity.js',
  'test-admin-crud.js',
  'test-watering-and-likes-fullkey.js',
  'test-fruit-harvest-fullkey.js',
  'test-day-night-fullkey.js',
  'test-realtime-concurrency-fullkey.js',
  'test-security-fullkey.js',
  'test-288-users-seeding-and-ui-fullkey.js',
  'test-3-claims-per-day-fullkey.js',
  'test-team-exp-and-members-modal-fullkey.js',
  'test-single-row-user-directory.mjs',
  'test-e2e-multiday-fullkey.mjs',
  'test-e2e-team-full-journey.mjs',
  'test-exhaustive-multiday-limits.mjs',
  'test-ui-state-refresh-fullkey.mjs'
];

console.log(`\n🚀 Starting execution of all ${suites.length} test suites...\n`);

let passedCount = 0;

for (const suite of suites) {
  const scriptPath = path.join(__dirname, suite);
  console.log(`\n▶️ [RUNNING] ${suite}...`);
  const res = spawnSync(process.execPath, [scriptPath], {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });

  if (res.status === 0) {
    passedCount++;
    console.log(`✅ [SUITE PASSED] ${suite}`);
  } else {
    console.error(`❌ [SUITE FAILED] ${suite} (Exit code: ${res.status})`);
    process.exit(res.status || 1);
  }
}

console.log(`\n=================================================================`);
console.log(`🎉 ALL ${passedCount}/${suites.length} TEST SUITES PASSED 100%!`);
console.log(`=================================================================\n`);
process.exit(0);
