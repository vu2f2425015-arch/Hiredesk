import fs from 'fs';
import path from 'path';

const artifactsDir = `C:/Users/Pankaj's Laptop/.gemini/antigravity/brain/5f5d7170-221f-49a6-8f1c-1478e056a8d5`;

async function verifyLightAndDarkMode() {
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

  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false
  });

  // Switch to light mode explicitly
  await send('Runtime.evaluate', {
    expression: `
      localStorage.setItem('hiredesk-theme', 'light');
      document.documentElement.setAttribute('data-theme', 'light');
    `
  });

  // Reload to ensure all components and CSS variables re-render with light theme
  console.log('Reloading page in LIGHT mode...');
  await send('Page.reload');
  await new Promise(r => setTimeout(r, 2000));

  // Double check light mode is applied
  await send('Runtime.evaluate', {
    expression: `document.documentElement.setAttribute('data-theme', 'light');`
  });
  await new Promise(r => setTimeout(r, 500));

  // Top hero in light mode
  const lightHeroShot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(path.join(artifactsDir, 'screenshot_career_light_top_verified.png'), Buffer.from(lightHeroShot.data, 'base64'));
  console.log('Saved screenshot_career_light_top_verified.png');

  // Scroll to apply form
  await send('Runtime.evaluate', {
    expression: `document.getElementById('apply-section')?.scrollIntoView({ behavior: 'instant', block: 'center' });`
  });
  await new Promise(r => setTimeout(r, 600));

  const lightApplyShot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(path.join(artifactsDir, 'screenshot_career_light_apply_verified.png'), Buffer.from(lightApplyShot.data, 'base64'));
  console.log('Saved screenshot_career_light_apply_verified.png');

  ws.close();
}

verifyLightAndDarkMode().catch(console.error);

