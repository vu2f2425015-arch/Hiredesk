import fs from 'fs';
import path from 'path';

const artifactsDir = `C:/Users/Pankaj's Laptop/.gemini/antigravity/brain/5f5d7170-221f-49a6-8f1c-1478e056a8d5`;

async function clickDetails() {
  const tabsRes = await fetch('http://127.0.0.1:9222/json/list');
  const tabs = await tabsRes.json();
  let pageTab = tabs.find(t => t.type === 'page');

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

  // Click the Details button
  const res = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const target = btns.find(b => b.textContent.includes('Details'));
        if (target) {
          target.click();
          return 'Clicked Details button: ' + target.outerHTML;
        }
        return 'Details button not found';
      })()
    `
  });
  console.log(res.result.value);

  await new Promise(r => setTimeout(r, 800));

  const modalShot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(path.join(artifactsDir, 'screenshot_job_details_open_modal.png'), Buffer.from(modalShot.data, 'base64'));
  console.log('Saved screenshot_job_details_open_modal.png');

  ws.close();
}

clickDetails().catch(console.error);

