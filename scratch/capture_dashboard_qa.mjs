import fs from 'fs';
import path from 'path';

const artifactsDir = `C:/Users/Pankaj's Laptop/.gemini/antigravity/brain/5f5d7170-221f-49a6-8f1c-1478e056a8d5`;

async function run() {
  const tabsRes = await fetch('http://127.0.0.1:9222/json/list');
  const tabs = await tabsRes.json();
  const pageTab = tabs.find(t => t.url.includes('5173') && t.type === 'page');

  if (!pageTab) {
    console.error('No 5173 page tab found:', tabs);
    process.exit(1);
  }

  console.log('Connecting to tab:', pageTab.id, pageTab.title, pageTab.webSocketDebuggerUrl);

  const ws = new WebSocket(pageTab.webSocketDebuggerUrl);

  let idCounter = 1;
  const pending = new Map();

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
    }
  };

  const send = (method, params = {}) => {
    return new Promise((resolve, reject) => {
      const id = idCounter++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  };

  await new Promise((resolve) => {
    ws.onopen = resolve;
  });

  console.log('WebSocket connected. Setting viewport...');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });

  console.log('Navigating to http://localhost:5173/ ...');
  await send('Page.navigate', { url: 'http://localhost:5173/' });
  await new Promise(r => setTimeout(r, 2000));

  // Ensure Light theme first
  await send('Runtime.evaluate', {
    expression: `document.documentElement.setAttribute('data-theme', 'light'); localStorage.setItem('hd_theme', 'light');`
  });
  await new Promise(r => setTimeout(r, 800));

  console.log('Taking screenshot for light theme...');
  const lightShot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  const lightPath = path.join(artifactsDir, 'screenshot_dashboard_v2_light.png');
  fs.writeFileSync(lightPath, Buffer.from(lightShot.data, 'base64'));
  console.log('Saved light screenshot:', lightPath);

  // Switch to Dark theme
  await send('Runtime.evaluate', {
    expression: `document.documentElement.setAttribute('data-theme', 'dark'); localStorage.setItem('hd_theme', 'dark');`
  });
  await new Promise(r => setTimeout(r, 800));

  console.log('Taking screenshot for dark theme...');
  const darkShot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  const darkPath = path.join(artifactsDir, 'screenshot_dashboard_v2_dark.png');
  fs.writeFileSync(darkPath, Buffer.from(darkShot.data, 'base64'));
  console.log('Saved dark screenshot:', darkPath);

  ws.close();
  console.log('Capture finished successfully!');
}

run().catch(err => {
  console.error('Error running capture:', err);
  process.exit(1);
});

