// scripts/capture_ui_eval.js
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');

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
  const artifactScreenshotsDir = 'C:\\Users\\vituk\\.gemini\\antigravity\\brain\\61613859-c72d-4b69-831c-cb8ecbced246\\screenshots';
  
  if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });
  if (!fs.existsSync(artifactScreenshotsDir)) fs.mkdirSync(artifactScreenshotsDir, { recursive: true });

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
  console.log(`Server running at http://127.0.0.1:${port}`);

  const bravePath = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const browserPath = fs.existsSync(bravePath) ? bravePath : edgePath;
  console.log(`Using browser: ${browserPath}`);

  const userDataDir = path.join(os.tmpdir(), 'eval_shots_' + Date.now());
  const cdpPort = 9440 + Math.floor(Math.random() * 400);

  const proc = spawn(browserPath, [
    '--headless=new',
    `--remote-debugging-port=${cdpPort}`,
    '--disable-gpu',
    `--user-data-dir=${userDataDir}`,
    '--window-size=1440,900'
  ]);

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
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 200));
    try {
      targets = await cdpRequest('/json/list');
      if (targets && targets.length > 0) break;
    } catch (e) {}
  }

  if (!targets || targets.length === 0) throw new Error('Could not connect to CDP targets');

  const target = targets[0];
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  let msgId = 1;
  const pending = new Map();
  ws.onmessage = evt => {
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
        reject(new Error(`CDP command ${method} timed out`));
      }, timeoutMs);
      pending.set(id, {
        resolve: val => { clearTimeout(timer); resolve(val); },
        reject: err => { clearTimeout(timer); reject(err); }
      });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await sendCommand('Page.enable');
  await sendCommand('Runtime.enable');
  await sendCommand('Page.navigate', { url: `http://127.0.0.1:${port}/index.html` });
  await new Promise(r => setTimeout(r, 1500));

  async function evaluate(expression) {
    const res = await sendCommand('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    return res.result ? res.result.value : null;
  }

  async function setViewport(width, height) {
    await sendCommand('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false
    });
    await new Promise(r => setTimeout(r, 400));
  }

  async function capture(filename) {
    const res = await sendCommand('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const localPath = path.join(screenshotsDir, filename);
    const artifactPath = path.join(artifactScreenshotsDir, filename);
    fs.writeFileSync(localPath, buffer);
    fs.writeFileSync(artifactPath, buffer);
    const hash = crypto.createHash('md5').update(buffer).digest('hex');
    console.log(`Captured ${filename}: ${buffer.length} bytes, md5: ${hash}`);
    return { filename, bytes: buffer.length, hash };
  }

  // 1. Capture 1440x900 in Generator mode
  await setViewport(1440, 900);
  await evaluate(`(() => {
    StudioState.seed = 2048;
    regenerateMosaic(true);
    StudioState.seed = 3072;
    regenerateMosaic(true);
    StudioState.seed = 4096;
    regenerateMosaic(true);
  })()`);
  await new Promise(r => setTimeout(r, 800));
  await capture('ui_eval_1440x900_generator.png');

  // 2. Capture 1440x900 in Editor mode
  await evaluate(`(() => {
    const toolPaint = document.getElementById('toolPaint');
    if (toolPaint) toolPaint.click();
  })()`);
  await new Promise(r => setTimeout(r, 800));
  await capture('ui_eval_1440x900_editor.png');

  // 3. Capture 1280x800 in Editor mode
  await setViewport(1280, 800);
  await new Promise(r => setTimeout(r, 800));
  await capture('ui_eval_1280x800_editor.png');

  ws.close();
  proc.kill();
  server.close();
  try {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  } catch (e) {}

  console.log('--- UI Evaluation Capture Finished ---');
}

main().catch(err => {
  console.error('Capture error:', err);
  process.exit(1);
});
