import fs from 'fs';
import path from 'path';

const artifactsDir = `C:/Users/Pankaj's Laptop/.gemini/antigravity/brain/5f5d7170-221f-49a6-8f1c-1478e056a8d5`;

async function captureApplicantFlow() {
  const tabsRes = await fetch('http://127.0.0.1:9222/json/list');
  const tabs = await tabsRes.json();
  const pageTab = tabs.find(t => t.type === 'page');

  if (!pageTab) {
    console.error('No page tab found:', tabs);
    return;
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
    height: 960,
    deviceScaleFactor: 1,
    mobile: false
  });

  // 1. Dashboard View
  console.log('Navigating to Dashboard...');
  await send('Page.navigate', { url: 'http://localhost:5173/' });
  await new Promise(r => setTimeout(r, 2000));
  await send('Runtime.evaluate', {
    expression: `sessionStorage.clear()`
  });
  await send('Page.reload');
  await new Promise(r => setTimeout(r, 2500));

  const dashShot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(path.join(artifactsDir, 'screenshot_1_dashboard_with_applicant.png'), Buffer.from(dashShot.data, 'base64'));
  console.log('Saved dashboard screenshot');

  // 2. Job Pipeline Kanban View (/jobs/0fa45e19-762b-423d-b52f-6e9a2b627ca5)
  console.log('Navigating to Job Pipeline Board for JOB-1030...');
  await send('Page.navigate', { url: 'http://localhost:5173/jobs/0fa45e19-762b-423d-b52f-6e9a2b627ca5' });
  await new Promise(r => setTimeout(r, 2500));

  const pipelineShot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(path.join(artifactsDir, 'screenshot_2_job_pipeline_with_applicant.png'), Buffer.from(pipelineShot.data, 'base64'));
  console.log('Saved job pipeline screenshot');

  // 3. Talent Pool View (/talent-pool)
  console.log('Navigating to Talent Pool...');
  await send('Page.navigate', { url: 'http://localhost:5173/talent-pool' });
  await new Promise(r => setTimeout(r, 2500));

  const talentShot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(path.join(artifactsDir, 'screenshot_3_talent_pool_with_applicant.png'), Buffer.from(talentShot.data, 'base64'));
  console.log('Saved talent pool screenshot');

  ws.close();
  console.log('All applicant flow screenshots captured successfully!');
}

captureApplicantFlow().catch(console.error);
