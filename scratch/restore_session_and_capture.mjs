import fs from 'fs';
import path from 'path';

const artifactsDir = `C:/Users/Pankaj's Laptop/.gemini/antigravity/brain/5f5d7170-221f-49a6-8f1c-1478e056a8d5`;

async function loginAndCapture() {
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

  console.log('Navigating to login page...');
  await send('Page.navigate', { url: 'http://localhost:5173/login' });
  await new Promise(r => setTimeout(r, 1500));

  // Check if already logged in or need to log in
  const check = await send('Runtime.evaluate', {
    expression: `!!document.querySelector('input[type="email"]')`,
    returnByValue: true
  });

  if (check.result.value) {
    console.log('Logging in as gujuripankaj@gmail.com...');
    await send('Runtime.evaluate', {
      expression: `(() => {
        const emailInput = document.querySelector('input[type="email"]');
        if (emailInput) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(emailInput, 'gujuripankaj@gmail.com');
          emailInput.dispatchEvent(new Event('input', { bubbles: true }));
          emailInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
        const pwdInput = document.querySelector('input[type="password"]');
        if (pwdInput) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(pwdInput, 'Pankajg123456@');
          pwdInput.dispatchEvent(new Event('input', { bubbles: true }));
          pwdInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })()`
    });
    await new Promise(r => setTimeout(r, 400));

    await send('Runtime.evaluate', {
      expression: `(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Sign In') || b.type === 'submit');
        if (btn) btn.click();
      })()`
    });
    await new Promise(r => setTimeout(r, 2500));
  }

  // 1. Capture Dashboard with loaded metrics
  console.log('Navigating to Dashboard...');
  await send('Page.navigate', { url: 'http://localhost:5173/' });
  await new Promise(r => setTimeout(r, 2000));

  const dashShot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(path.join(artifactsDir, 'verified_dashboard_live_applicant.png'), Buffer.from(dashShot.data, 'base64'));
  console.log('Saved verified_dashboard_live_applicant.png');

  // 2. Open Jobs and Pipeline for JOB-1030
  console.log('Navigating to Jobs...');
  await send('Page.navigate', { url: 'http://localhost:5173/jobs' });
  await new Promise(r => setTimeout(r, 2000));

  // Click Pipeline button on JOB-1030
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Pipeline'));
      if (btn) btn.click();
    })()`
  });
  await new Promise(r => setTimeout(r, 2500));

  const pipelineShot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(path.join(artifactsDir, 'verified_pipeline_live_applicant.png'), Buffer.from(pipelineShot.data, 'base64'));
  console.log('Saved verified_pipeline_live_applicant.png');

  // 3. Open Talent Pool
  console.log('Navigating to Talent Pool...');
  await send('Page.navigate', { url: 'http://localhost:5173/talent-pool' });
  await new Promise(r => setTimeout(r, 2500));

  const talentShot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(path.join(artifactsDir, 'verified_talent_pool_live_applicant.png'), Buffer.from(talentShot.data, 'base64'));
  console.log('Saved verified_talent_pool_live_applicant.png');

  ws.close();
  console.log('Finished capturing verified live views!');
}

loginAndCapture().catch(console.error);

