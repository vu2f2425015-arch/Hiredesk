import fs from 'fs';
import path from 'path';

const artifactsDir = `C:/Users/Pankaj's Laptop/.gemini/antigravity/brain/5f5d7170-221f-49a6-8f1c-1478e056a8d5`;

async function verifyCareerUI() {
  const tabsRes = await fetch('http://127.0.0.1:9222/json/list');
  const tabs = await tabsRes.json();
  let pageTab = tabs.find(t => t.type === 'page');

  if (!pageTab) {
    const newTabRes = await fetch('http://127.0.0.1:9222/json/new?http://localhost:5173/career/hvhgv-1/JOB-1030', { method: 'PUT' });
    pageTab = await newTabRes.json();
  }

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
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false
  });

  // Navigate to career page
  console.log('Navigating to http://localhost:5173/career/hvhgv-1/JOB-1030...');
  await send('Page.navigate', { url: 'http://localhost:5173/career/hvhgv-1/JOB-1030' });

  // Wait 2.5s for React render and data fetch
  await new Promise(r => setTimeout(r, 2500));

  // Ensure light mode first
  await send('Runtime.evaluate', {
    expression: `
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
    `
  });
  await new Promise(r => setTimeout(r, 500));

  // Capture top hero & job details in Light Mode
  const heroShot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(path.join(artifactsDir, 'screenshot_career_light_top.png'), Buffer.from(heroShot.data, 'base64'));
  console.log('Captured screenshot_career_light_top.png');

  // Scroll to apply form
  await send('Runtime.evaluate', {
    expression: `document.getElementById('apply-section')?.scrollIntoView({ behavior: 'instant', block: 'center' });`
  });
  await new Promise(r => setTimeout(r, 500));

  const applyShot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(path.join(artifactsDir, 'screenshot_career_light_apply.png'), Buffer.from(applyShot.data, 'base64'));
  console.log('Captured screenshot_career_light_apply.png');

  // Now test Dark Mode
  await send('Runtime.evaluate', {
    expression: `
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    `
  });
  await new Promise(r => setTimeout(r, 500));

  const darkApplyShot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(path.join(artifactsDir, 'screenshot_career_dark_apply.png'), Buffer.from(darkApplyShot.data, 'base64'));
  console.log('Captured screenshot_career_dark_apply.png');

  // Scroll back to top for dark hero
  await send('Runtime.evaluate', {
    expression: `window.scrollTo({ top: 0, behavior: 'instant' });`
  });
  await new Promise(r => setTimeout(r, 500));

  const darkHeroShot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(path.join(artifactsDir, 'screenshot_career_dark_top.png'), Buffer.from(darkHeroShot.data, 'base64'));
  console.log('Captured screenshot_career_dark_top.png');

  ws.close();
  console.log('Verification screenshots captured successfully!');
}

verifyCareerUI().catch(err => {
  console.error('Error during verification:', err);
  process.exit(1);
});

