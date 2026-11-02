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
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false
  });

  // 1. Capture Refined Dashboard
  await send('Page.navigate', { url: 'http://localhost:5173/' });
  await new Promise(r => setTimeout(r, 2000));
  const dashShot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(path.join(artifactsDir, 'screenshot_refined_dashboard.png'), Buffer.from(dashShot.data, 'base64'));
  console.log('Saved screenshot_refined_dashboard.png');

  // 2. Open Candidate Profile Modal for Alex Mercer
  await send('Page.navigate', { url: 'http://localhost:5173/jobs' });
  await new Promise(r => setTimeout(r, 2000));

  // Click Details
  await send('Runtime.evaluate', {
    expression: `
      const d = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Details');
      if (d) d.click();
    `
  });
  await new Promise(r => setTimeout(r, 1000));

  // Click Applicants tab
  await send('Runtime.evaluate', {
    expression: `
      const t = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Applicants'));
      if (t) t.click();
    `
  });
  await new Promise(r => setTimeout(r, 1000));

  // Click Alex Mercer
  await send('Runtime.evaluate', {
    expression: `
      const rows = Array.from(document.querySelectorAll('*'));
      const alex = rows.find(el => el.textContent.includes('Alex Mercer') && el.children.length === 0);
      if (alex) alex.click();
    `
  });
  await new Promise(r => setTimeout(r, 1500));

  // Scroll candidate modal down
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

