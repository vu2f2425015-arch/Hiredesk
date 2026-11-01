import fs from 'fs';
import path from 'path';

const artifactsDir = `C:/Users/Pankaj's Laptop/.gemini/antigravity/brain/5f5d7170-221f-49a6-8f1c-1478e056a8d5`;

async function captureTalentPool() {
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

  console.log('Navigating to http://localhost:5173/talent-pool ...');
  await send('Page.navigate', { url: 'http://localhost:5173/talent-pool' });

  // Wait for Alex Mercer to appear
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 300));
    const found = await send('Runtime.evaluate', {
      expression: `document.body.innerText.includes('Alex Mercer')`,
      returnByValue: true
    });
    if (found.result.value) {
      console.log('Found Alex Mercer in Talent Pool!');
      break;
    }
  }
  await new Promise(r => setTimeout(r, 500));

  const shot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(path.join(artifactsDir, 'screenshot_talent_pool_alex_mercer.png'), Buffer.from(shot.data, 'base64'));
  console.log('Saved screenshot_talent_pool_alex_mercer.png');

  ws.close();
}

captureTalentPool().catch(console.error);

