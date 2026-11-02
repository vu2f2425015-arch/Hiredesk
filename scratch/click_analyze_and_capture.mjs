import fs from 'fs';
import path from 'path';

const artifactsDir = 'C:/Users/Pankaj\'s Laptop/.gemini/antigravity/brain/5f5d7170-221f-49a6-8f1c-1478e056a8d5';

async function main() {
  const tabsRes = await fetch('http://127.0.0.1:9222/json/list');
  const tabs = await tabsRes.json();
  const pageTab = tabs.find(t => t.type === 'page');
  const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
  let id = 1;
  const send = (method, params = {}) => new Promise((resolve) => {
    const curId = id++;
    const handler = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === curId) {
        ws.removeEventListener('message', handler);
        resolve(msg.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id: curId, method, params }));
  });
  await new Promise(r => ws.onopen = r);

  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1200,
    deviceScaleFactor: 1,
    mobile: false
  });

  // Click Analyze Match button
  const clickRes = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Analyze Match'));
        if (btn) {
          btn.click();
          return 'Clicked Analyze Match';
        }
        return 'Not found';
      })()
    `,
    returnByValue: true
  });
  console.log('Analyze Match click:', clickRes.result.value);

  // Wait 3.5s for match computation
  await new Promise(r => setTimeout(r, 3500));

  // Scroll candidate modal down
  await send('Runtime.evaluate', {
    expression: `(() => {
      const els = Array.from(document.querySelectorAll('*')).filter(el => el.scrollHeight > el.clientHeight && el.clientHeight > 300);
      els.forEach(el => el.scrollTop = 280);
    })()`
  });
  await new Promise(r => setTimeout(r, 500));

  const modalShot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(path.join(artifactsDir, 'screenshot_refined_candidate_modal_evaluated.png'), Buffer.from(modalShot.data, 'base64'));
  console.log('Saved screenshot_refined_candidate_modal_evaluated.png');
  ws.close();
}

main().catch(console.error);

