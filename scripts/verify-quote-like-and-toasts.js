import http from 'http';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

function getPageWebSocketUrl(port) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://127.0.0.1:${port}/json/list`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const list = JSON.parse(data);
          const page = list.find(p => p.type === 'page') || list[0];
          resolve(page.webSocketDebuggerUrl);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
  });
}

function sendCDP(ws, method, params = {}, id = 1) {
  return new Promise((resolve, reject) => {
    const msg = JSON.stringify({ id, method, params });
    const handler = (data) => {
      try {
        const res = JSON.parse(data.toString());
        if (res.id === id) {
          ws.off('message', handler);
          if (res.error) reject(res.error);
          else resolve(res.result);
        }
      } catch (e) {}
    };
    ws.on('message', handler);
    ws.send(msg);
  });
}

async function run() {
  const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
  const port = 9260;
  const userDataDir = path.join(process.env.TEMP, `edge_test_${Date.now()}`);

  const edgeProcess = spawn(edgePath, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--headless=new',
    '--disable-gpu',
    '--window-size=1280,800',
    'http://localhost:5500/?guest=1'
  ], { stdio: 'ignore' });

  console.log('⏳ Waiting for Edge to start...');
  await new Promise(r => setTimeout(r, 2500));

  try {
    const wsUrl = await getPageWebSocketUrl(port);
    const wsModule = await import('file:///D:/Sach-tri-thuc/server/node_modules/ws/index.js');
    const WebSocket = wsModule.default || wsModule.WebSocket;
    const ws = new WebSocket(wsUrl);

    await new Promise((resolve) => ws.on('open', resolve));
    console.log('🔗 Connected to Edge Page target via CDP!');

    let msgId = 1;
    const call = (method, params) => sendCDP(ws, method, params, msgId++);

    await call('Page.enable');
    await call('Runtime.enable');

    console.log('⏳ Waiting for page to initialize (5s)...');
    await new Promise(r => setTimeout(r, 5000));

    // 1. Initial State Check
    const initialCheck = await call('Runtime.evaluate', {
      expression: `(() => {
        const toasts = document.querySelectorAll('.tree-level-up-toast');
        return {
          levelUpToastsCount: toasts.length,
          activeTeamId: window.activeTeam ? window.activeTeam.id : null,
          isReady: window.__CAOSACH_READY__
        };
      })()`,
      returnByValue: true
    });
    console.log('📊 Initial check:', initialCheck.result.value);

    // 2. Click Heart (Like Quote)
    console.log('💖 Clicking Quote Heart (Like) button...');
    const likeResult = await call('Runtime.evaluate', {
      expression: `(async () => {
        const likeBtn = document.querySelector('#aside-like-btn') || document.querySelector('.aside-quote-like-btn');
        if (!likeBtn) return { error: 'Like button not found' };
        likeBtn.click();
        await new Promise(r => setTimeout(r, 1200));
        
        const levelUpToasts = document.querySelectorAll('.tree-level-up-toast');
        const bookToast = document.querySelector('#book-toast-popup');
        const bookToastText = document.querySelector('#book-toast-text');
        
        return {
          clicked: true,
          levelUpToastsCount: levelUpToasts.length,
          bookToastShown: bookToast ? bookToast.classList.contains('show') : false,
          bookToastMessage: bookToastText ? bookToastText.textContent : null
        };
      })()`,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('📊 Post-Like Verification:', likeResult.result.value);

    // 3. Inspect another team (Đội 3)
    console.log('🌳 Inspecting Team 3...');
    const inspectResult = await call('Runtime.evaluate', {
      expression: `(async () => {
        const plot3 = document.querySelectorAll('.team-root-plot')[2];
        if (plot3) plot3.click();
        await new Promise(r => setTimeout(r, 1200));

        const levelUpToasts = document.querySelectorAll('.tree-level-up-toast');
        const bookToast = document.querySelector('#book-toast-popup');
        const bookToastText = document.querySelector('#book-toast-text');

        return {
          levelUpToastsCount: levelUpToasts.length,
          activeTeamId: window.activeTeam ? window.activeTeam.id : null,
          bookToastShown: bookToast ? bookToast.classList.contains('show') : false,
          bookToastMessage: bookToastText ? bookToastText.textContent : null
        };
      })()`,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('📊 Post-Inspect Team 3 Verification:', inspectResult.result.value);

    // 4. Capture screenshot
    const screenshot = await call('Page.captureScreenshot', { format: 'png' });
    const screenshotPath = "C:\\Users\\Admin\\.gemini\\antigravity\\brain\\ba4da3f2-c1f4-41f5-9817-213ef2100c36\\verify_toast_fix.png";
    fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));
    console.log(`📸 Screenshot saved to: ${screenshotPath}`);

    ws.close();
  } finally {
    edgeProcess.kill();
  }
}

run().catch(console.error);
