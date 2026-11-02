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
    height: 1100,
    deviceScaleFactor: 1,
    mobile: false
  });

  // Click Pipeline button
  const pClick = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const p = btns.find(b => b.textContent.includes('Pipeline'));
        if (p) { p.click(); return 'Clicked Pipeline'; }
        return 'Not found';
      })()
    `,
    returnByValue: true
  });
  console.log('Pipeline click:', pClick.result.value);

  // Wait for Alex Mercer to appear
  let clicked = false;
  for (let i = 0; i < 15; i++) {
    const res = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const els = Array.from(document.querySelectorAll('*'));
          const alex = els.find(el => el.textContent.includes('Alex Mercer') && el.children.length === 0);
          if (alex) { alex.click(); return true; }
          return false;
        })()
      `,
      returnByValue: true
    });
    if (res.result.value) {
      clicked = true;
      console.log('Clicked Alex Mercer card!');
      break;
    }
    await new Promise(r => setTimeout(r, 800));
  }
  console.log('Alex click result:', clicked);

  await new Promise(r => setTimeout(r, 1500));

  // Scroll modal
  await send('Runtime.evaluate', {
    expression: `
      const scrollable = Array.from(document.querySelectorAll('*')).find(el => el.scrollHeight > el.clientHeight && el.clientHeight > 300);
      if (scrollable) scrollable.scrollTop = 220;
    `
  });
  await new Promise(r => setTimeout(r, 500));

  const modalShot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(path.join(artifactsDir, 'screenshot_refined_candidate_modal.png'), Buffer.from(modalShot.data, 'base64'));
  console.log('Saved screenshot_refined_candidate_modal.png');

  ws.close();
}

main().catch(console.error);
