import fs from 'fs';
import path from 'path';

const artifactsDir = `C:/Users/Pankaj's Laptop/.gemini/antigravity/brain/5f5d7170-221f-49a6-8f1c-1478e056a8d5`;

async function captureLoadedDetails() {
  const tabsRes = await fetch('http://127.0.0.1:9222/json/list');
  const tabs = await tabsRes.json();
  const pageTab = tabs.find(t => t.type === 'page');

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

  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 960,
    deviceScaleFactor: 1,
    mobile: false
  });

  // 1. Jobs Pipeline
  console.log('Opening Jobs view...');
  await send('Page.navigate', { url: 'http://localhost:5173/jobs' });
  await new Promise(r => setTimeout(r, 2000));

  // Click on "Pipeline" button
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Pipeline'));
      if (btn) btn.click();
    })()`
  });
  console.log('Waiting for pipeline columns to load...');
  await new Promise(r => setTimeout(r, 3000));

  const pipelineShot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(path.join(artifactsDir, 'screenshot_pipeline_alex_mercer.png'), Buffer.from(pipelineShot.data, 'base64'));
  console.log('Saved screenshot_pipeline_alex_mercer.png');

  // 2. Talent Pool
  console.log('Opening Talent Pool...');
  await send('Page.navigate', { url: 'http://localhost:5173/talent-pool' });
  console.log('Waiting for talent pool to load...');
  await new Promise(r => setTimeout(r, 3000));

  const talentShot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(path.join(artifactsDir, 'screenshot_talent_pool_alex_mercer.png'), Buffer.from(talentShot.data, 'base64'));
  console.log('Saved screenshot_talent_pool_alex_mercer.png');

  ws.close();
}

captureLoadedDetails().catch(console.error);

