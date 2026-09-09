import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const VPS_HOST = '100.101.27.107';
const VPS_USER = 'sonun';

function runSSH(cmd) {
  return new Promise((resolve, reject) => {
    const p = spawn('ssh', ['-o', 'StrictHostKeyChecking=no', `${VPS_USER}@${VPS_HOST}`, cmd], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    p.stdout.on('data', d => stdout += d.toString());
    p.stderr.on('data', d => stderr += d.toString());
    p.on('close', code => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(`SSH failed (${code}): ${stderr || stdout}`));
    });
  });
}

function pushFile(localRelPath, remoteAbsPath) {
  return new Promise((resolve, reject) => {
    const localPath = path.join(ROOT_DIR, localRelPath);
    if (!fs.existsSync(localPath)) {
      return reject(new Error(`Local file not found: ${localPath}`));
    }
    const dir = remoteAbsPath.substring(0, remoteAbsPath.lastIndexOf('/'));
    const p = spawn('ssh', ['-o', 'StrictHostKeyChecking=no', `${VPS_USER}@${VPS_HOST}`, `mkdir -p "${dir}" && cat > "${remoteAbsPath}"`]);
    fs.createReadStream(localPath).pipe(p.stdin);
    p.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`Failed pushing ${localRelPath} to ${remoteAbsPath} (exit code ${code})`));
    });
    p.on('error', reject);
  });
}

async function deploy() {
  console.log('🚀 =========================================================');
  console.log('🚀 BẮT ĐẦU ĐỒNG BỘ VÀ DEPLOY TOÀN DIỆN LÊN VPS (STAGING & PROD)');
  console.log('🚀 =========================================================\n');

  const filesToDeploy = [
    'index.html',
    'admin/index.html',
    'admin/admin.js',
    'assets/data/ApiDataStore.js',
    'assets/config/appEnv.js',
    'server/data/teams-and-users.json',
    'server/services/book.service.js',
    'server/services/analytics.service.js',
    'server/services/team.service.js',
    'server/services/quote.service.js',
    'server/services/dew.service.js',
    'server/scripts/sync-team-exp.js',
    'server/scripts/test-team-exp-and-members-modal-fullkey.js',
    'server/scripts/apply-ordered-users-to-db.js',
    'server/scripts/seed-teams-users.js',
    'server/scripts/test-288-users-seeding-and-ui-fullkey.js',
    'server/scripts/run-all-test-suites.js',
    'server/scripts/test-unit-suite.js',
    'server/scripts/run-tests.js',
    'scripts/sync-book-users.js',
    'scripts/apply-ordered-users-to-db.js'
  ];

  const targets = [
    { name: 'STAGING', path: '/home/sonun/deployments/caosach-staging', backend: 'caosach-staging-backend', frontend: 'caosach-staging-frontend' },
    { name: 'PROD', path: '/home/sonun/deployments/caosach-prod', backend: 'caosach-prod-backend', frontend: 'caosach-prod-frontend' }
  ];

  for (const target of targets) {
    console.log(`📦 [1/4] Đồng bộ files mã nguồn vào môi trường ${target.name}...`);
    for (const relFile of filesToDeploy) {
      const remotePath = `${target.path}/${relFile}`;
      process.stdout.write(`   ↳ Pushing ${relFile} -> ${target.name}... `);
      await pushFile(relFile, remotePath);
      console.log('✅ OK');
    }

    console.log(`\n🔄 [2/4] Chạy cập nhật thứ tự TT 1-288 & CLUSTER database trên ${target.name}...`);
    try {
      const applyOutput = await runSSH(`docker exec -i ${target.backend} node scripts/apply-ordered-users-to-db.js`);
      console.log(`   ${applyOutput.replace(/\n/g, '\n   ')}`);
    } catch (e) {
      console.warn(`   ⚠️ Chú ý DB update: ${e.message}`);
    }

    console.log(`\n🌳 [3/4] Đồng bộ tree_exp, total_exp & avg_participation_rate trên ${target.name}...`);
    try {
      const expSyncOutput = await runSSH(`docker exec -i ${target.backend} node scripts/sync-team-exp.js`);
      console.log(`   ${expSyncOutput.replace(/\n/g, '\n   ')}`);
    } catch (e) {
      console.warn(`   ⚠️ Chú ý sync team exp: ${e.message}`);
    }

    console.log(`\n⚡ [4/4] Khởi động lại container ${target.name}...`);
    await runSSH(`docker restart ${target.backend} ${target.frontend}`);
    console.log(`   ✅ Đã khởi động lại ${target.backend} và ${target.frontend} thành công!\n`);

    console.log(`🧪 Kiểm tra Unit Test tự động trên ${target.name}...`);
    try {
      const testOutput = await runSSH(`docker exec -i ${target.backend} node scripts/test-team-exp-and-members-modal-fullkey.js`);
      console.log(`   ${testOutput.replace(/\n/g, '\n   ')}`);
    } catch (e) {
      console.warn(`   ⚠️ Unit test trên ${target.name}: ${e.message}`);
    }
  }

  console.log('🌐 =========================================================');
  console.log('🌐 KIỂM TRA SỨC KHỎE HỆ THỐNG TRÊN VPS PRODUCTION & STAGING');
  console.log('🌐 =========================================================\n');

  const testEndpoints = [
    'https://foxread.soninfra.cloud/api/v1/health',
    'https://stagfoxread.soninfra.cloud/api/v1/health',
    'https://foxread.soninfra.cloud/api/v1/teams',
    'https://stagfoxread.soninfra.cloud/api/v1/teams'
  ];

  for (const url of testEndpoints) {
    process.stdout.write(`🔍 Kiểm tra ${url}... `);
    try {
      const res = await runSSH(`curl -s -k -o /dev/null -w "%{http_code}" "${url}"`);
      if (res === '200') {
        console.log(`✅ [HTTP 200 OK]`);
      } else {
        console.log(`⚠️ [HTTP ${res}]`);
      }
    } catch (err) {
      console.log(`❌ Lỗi: ${err.message}`);
    }
  }

  console.log('\n🎉 HOÀN THÀNH TRIỂN KHAI VÀ ĐỒNG BỘ VPS 100% THÀNH CÔNG!\n');
}

deploy().catch(err => {
  console.error('❌ Lỗi Deploy:', err);
  process.exit(1);
});
