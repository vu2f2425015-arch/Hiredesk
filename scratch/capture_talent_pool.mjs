import fs from 'fs';
import path from 'path';

const artifactsDir = `C:/Users/Pankaj's Laptop/.gemini/antigravity/brain/5f5d7170-221f-49a6-8f1c-1478e056a8d5`;

async function capture() {
  const tabsRes = await fetch('http://127.0.0.1:9222/json/list');
  const tabs = await tabsRes.json();
  const pageTab = tabs.find(t => t.url.includes('5173') && t.type === 'page');

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
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = idCounter++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });

  await new Promise(r => ws.onopen = r);

  await send('Page.navigate', { url: 'http://localhost:5173/talent-pool' });
  await new Promise(r => setTimeout(r, 2000));

  await send('Runtime.evaluate', {
    expression: `document.documentElement.setAttribute('data-theme', 'dark'); localStorage.setItem('hd_theme', 'dark');`
  });
  await new Promise(r => setTimeout(r, 500));

  const darkShot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(path.join(artifactsDir, 'screenshot_talent_pool_folders_dark.png'), Buffer.from(darkShot.data, 'base64'));

  await send('Runtime.evaluate', {
    expression: `document.documentElement.setAttribute('data-theme', 'light'); localStorage.setItem('hd_theme', 'light');`
  });
  await new Promise(r => setTimeout(r, 500));

  const lightShot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(path.join(artifactsDir, 'screenshot_talent_pool_folders_light.png'), Buffer.from(lightShot.data, 'base64'));

  ws.close();
  console.log('Saved talent pool folders screenshots.');
}

capture().catch(console.error);
