import fs from 'fs';
import path from 'path';

const artifactsDir = `C:/Users/Pankaj's Laptop/.gemini/antigravity/brain/5f5d7170-221f-49a6-8f1c-1478e056a8d5`;

async function captureLoadedViews() {
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

  // 1. Dashboard View
  console.log('Navigating to Dashboard and waiting for loaded data...');
  await send('Page.navigate', { url: 'http://localhost:5173/' });
  
  // Wait up to 5s for skeleton to disappear
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 250));
    const loading = await send('Runtime.evaluate', {
      expression: `!!document.querySelector('.dashboard-skeleton, .skeleton')`,
      returnByValue: true
    });
    if (!loading.result.value) break;
  }
  await new Promise(r => setTimeout(r, 500));

  const dashShot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(path.join(artifactsDir, 'screenshot_1_dashboard_with_applicant.png'), Buffer.from(dashShot.data, 'base64'));
  console.log('Saved dashboard screenshot');

  // 2. Jobs View
  console.log('Navigating to Jobs view...');
  await send('Page.navigate', { url: 'http://localhost:5173/jobs' });
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 250));
    const loading = await send('Runtime.evaluate', {
      expression: `!!document.querySelector('.skeleton')`,
      returnByValue: true
    });
    if (!loading.result.value) break;
  }
  await new Promise(r => setTimeout(r, 500));

  const jobsShot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(path.join(artifactsDir, 'screenshot_2_jobs_list.png'), Buffer.from(jobsShot.data, 'base64'));
  console.log('Saved jobs list screenshot');

  // Click on "Pipeline" or "wckl" to open the pipeline
  await send('Runtime.evaluate', {
    expression: `(() => {
      const pipelineBtn = Array.from(document.querySelectorAll('button, a')).find(el => el.innerText.includes('Pipeline') || el.innerText.includes('wckl'));
      if (pipelineBtn) pipelineBtn.click();
    })()`
  });
  await new Promise(r => setTimeout(r, 1000));

  const pipelineShot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(path.join(artifactsDir, 'screenshot_3_job_pipeline.png'), Buffer.from(pipelineShot.data, 'base64'));
  console.log('Saved job pipeline screenshot');

  // 3. Talent Pool View
  console.log('Navigating to Talent Pool...');
  await send('Page.navigate', { url: 'http://localhost:5173/talent-pool' });
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 250));
    const loading = await send('Runtime.evaluate', {
      expression: `!!document.querySelector('.skeleton')`,
      returnByValue: true
    });
    if (!loading.result.value) break;
  }
  await new Promise(r => setTimeout(r, 500));

  const talentShot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(path.join(artifactsDir, 'screenshot_4_talent_pool_applicant.png'), Buffer.from(talentShot.data, 'base64'));
  console.log('Saved talent pool screenshot');

  ws.close();
}

captureLoadedViews().catch(console.error);

