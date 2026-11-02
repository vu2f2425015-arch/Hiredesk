import fs from 'fs';
import path from 'path';

const artifactsDir = `C:/Users/Pankaj's Laptop/.gemini/antigravity/brain/5f5d7170-221f-49a6-8f1c-1478e056a8d5`;

async function captureJobsViewFeatures() {
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

  // Navigate to jobs page
  console.log('Navigating to http://localhost:5173/jobs...');
  await send('Page.navigate', { url: 'http://localhost:5173/jobs' });
  await new Promise(r => setTimeout(r, 2000));

  // Capture jobs view showing "Apply Page" button
  const jobsShot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(path.join(artifactsDir, 'screenshot_jobs_view_with_apply_page_btn.png'), Buffer.from(jobsShot.data, 'base64'));
  console.log('Saved screenshot_jobs_view_with_apply_page_btn.png');

  // Click Details button on the first card
  await send('Runtime.evaluate', {
    expression: `
      const btns = Array.from(document.querySelectorAll('button'));
      const detailsBtn = btns.find(b => b.textContent.trim() === 'Details');
      if (detailsBtn) detailsBtn.click();
    `
  });
  await new Promise(r => setTimeout(r, 800));

  // Capture modal with Candidate Application Link
  const modalShot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(path.join(artifactsDir, 'screenshot_job_details_candidate_link.png'), Buffer.from(modalShot.data, 'base64'));
  console.log('Saved screenshot_job_details_candidate_link.png');

  ws.close();
}

captureJobsViewFeatures().catch(console.error);

