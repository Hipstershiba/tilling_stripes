const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');

// MIME types
const MIMES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

async function main() {
  const rootDir = path.resolve(__dirname, '..');
  const screenshotsDir = path.join(rootDir, 'tests', 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  // 1. Start HTTP Server
  const server = http.createServer((req, res) => {
    let cleanUrl = req.url.split('?')[0];
    if (cleanUrl === '/') cleanUrl = '/index.html';
    const filePath = path.join(rootDir, cleanUrl);
    if (!fs.existsSync(filePath)) {
      res.writeHead(404);
      return res.end('Not Found');
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIMES[ext] || 'text/plain' });
    fs.createReadStream(filePath).pipe(res);
  });

  const port = await new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
  console.log(`HTTP Server running at http://127.0.0.1:${port}`);

  // 2. Select Browser (Prefer Brave, fallback to Edge)
  const bravePath = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const browserPath = fs.existsSync(bravePath) ? bravePath : edgePath;
  console.log(`Using browser: ${browserPath}`);

  const userDataDir = path.join(os.tmpdir(), 'browser_shots_' + Date.now());
  const cdpPort = 9330 + Math.floor(Math.random() * 500);

  const proc = spawn(browserPath, [
    '--headless=new',
    `--remote-debugging-port=${cdpPort}`,
    '--disable-gpu',
    `--user-data-dir=${userDataDir}`,
    '--window-size=1440,900'
  ]);

  // Wait for CDP readiness
  async function cdpRequest(endpoint) {
    return new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${cdpPort}${endpoint}`, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
        });
      }).on('error', reject);
    });
  }

  let targets = null;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 200));
    try {
      targets = await cdpRequest('/json/list');
      if (targets && targets.length > 0) break;
    } catch (e) {}
  }

  if (!targets || targets.length === 0) {
    throw new Error('Failed to connect to browser CDP port ' + cdpPort);
  }

  const target = targets[0];
  console.log('Connecting to WebSocket:', target.webSocketDebuggerUrl);

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  let msgId = 1;
  const pending = new Map();
  ws.onmessage = (evt) => {
    const data = JSON.parse(evt.data);
    if (data.id && pending.has(data.id)) {
      const { resolve, reject } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) reject(data.error);
      else resolve(data.result);
    }
  };

  function sendCommand(method, params = {}, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`CDP command ${method} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      pending.set(id, {
        resolve: (val) => { clearTimeout(timer); resolve(val); },
        reject: (err) => { clearTimeout(timer); reject(err); }
      });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async function evaluate(expression) {
    const res = await sendCommand('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(JSON.stringify(res.exceptionDetails));
    }
    return res.result ? res.result.value : undefined;
  }

  async function captureScreenshot(outName) {
    const res = await sendCommand('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const outPath = path.join(screenshotsDir, outName);
    fs.writeFileSync(outPath, buffer);
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    console.log(`Saved: ${outName} (${buffer.length} bytes, sha256: ${hash})`);
    return { name: outName, bytes: buffer.length, hash };
  }

  await sendCommand('Page.enable');
  await sendCommand('DOM.enable');

  // Navigate to app
  console.log('Navigating to app...');
  await sendCommand('Page.navigate', { url: `http://127.0.0.1:${port}/index.html` });
  await new Promise(r => setTimeout(r, 2000));

  const results = [];

  // Capture 1: Freeze rail active in Editor workspace with Editor freeze options
  console.log('Setting up Freeze tool active in Editor workspace...');
  await evaluate(`(() => {
    const freezeTool = document.getElementById('toolFreeze');
    if (freezeTool) freezeTool.click();
    if (window.StudioState && StudioState.frozenCells) {
      StudioState.frozenCells.set('0,0,0,0', { baseTileId: 1, transform: 0, tileId: 1 });
      StudioState.frozenCells.set('0,0,0,1', { baseTileId: 1, transform: 0, tileId: 1 });
      StudioState.frozenCells.set('0,0,1,0', { baseTileId: 1, transform: 0, tileId: 1 });
      StudioState.frozenCells.set('0,0,1,1', { baseTileId: 1, transform: 0, tileId: 1 });
      syncFreezeUI();
      if (window.redraw) redraw();
    }
  })()`);
  await new Promise(r => setTimeout(r, 600));
  results.push(await captureScreenshot('freeze_editor_options_1440x900.png'));

  // Capture 2: Generator workspace with freeze status row visible
  console.log('Setting up Generator workspace with freeze status row...');
  await evaluate(`(() => {
    const inspectBtn = document.getElementById('toolInspect');
    if (inspectBtn) inspectBtn.click();
    syncFreezeUI();
    if (window.redraw) redraw();
  })()`);
  await new Promise(r => setTimeout(r, 600));
  results.push(await captureScreenshot('freeze_gerador_status_1440x900.png'));

  // Capture 3: Freeze rail active with Unfreeze (☀ Descongelar) mode selected in Editor
  console.log('Setting up Unfreeze mode in Editor...');
  await evaluate(`(() => {
    const freezeTool = document.getElementById('toolFreeze');
    if (freezeTool) freezeTool.click();
    const unfreezeBtn = document.querySelector('#freezeModeControl .seg-btn[data-freeze-mode="unfreeze"]');
    if (unfreezeBtn) unfreezeBtn.click();
    syncFreezeUI();
    if (window.redraw) redraw();
  })()`);
  await new Promise(r => setTimeout(r, 600));
  results.push(await captureScreenshot('freeze_rail_active_1440x900.png'));

  // Capture 4: Overlay asterisk closeup/view
  console.log('Setting up frozen cells overlay with mode Congelar...');
  await evaluate(`(() => {
    const freezeBtn = document.querySelector('#freezeModeControl .seg-btn[data-freeze-mode="freeze"]');
    if (freezeBtn) freezeBtn.click();
    StudioState.frozenCells.set('1,1,0,0', { baseTileId: 2, transform: 2, tileId: 2 });
    StudioState.frozenCells.set('1,1,0,1', { baseTileId: 2, transform: 2, tileId: 2 });
    StudioState.frozenCells.set('1,1,1,0', { baseTileId: 2, transform: 2, tileId: 2 });
    StudioState.frozenCells.set('1,1,1,1', { baseTileId: 2, transform: 2, tileId: 2 });
    syncFreezeUI();
    if (window.redraw) redraw();
  })()`);
  await new Promise(r => setTimeout(r, 600));
  results.push(await captureScreenshot('freeze_overlay_asterisk_1440x900.png'));

  // Cleanup
  ws.close();
  proc.kill();
  server.close();
  try {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  } catch (e) {}

  console.log('\n--- Screenshot Summary ---');
  const hashes = new Set();
  let distinct = true;
  for (const r of results) {
    if (hashes.has(r.hash)) distinct = false;
    hashes.add(r.hash);
    console.log(`${r.name}: ${r.bytes} bytes, hash: ${r.hash}`);
  }
  console.log('All hashes distinct?', distinct);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
