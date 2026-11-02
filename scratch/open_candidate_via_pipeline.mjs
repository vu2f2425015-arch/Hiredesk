import fs from 'fs';
import path from 'path';

const artifactsDir = `C:/Users/Pankaj's Laptop/.gemini/antigravity/brain/5f5d7170-221f-49a6-8f1c-1478e056a8d5`;

async function openCandidateViaPipeline() {
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

  // Navigate to Jobs
  console.log('Navigating to http://localhost:5173/jobs...');
  await send('Page.navigate', { url: 'http://localhost:5173/jobs' });
  await new Promise(r => setTimeout(r, 2000));

  // Click Pipeline on JOB-1030
  const clickPipeline = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const pBtn = btns.find(b => b.textContent.includes('Pipeline'));
        if (pBtn) {
          pBtn.click();
          return 'Clicked Pipeline';
        }
        return 'Pipeline button not found';
      })()
    `
  });
  console.log(clickPipeline.result.value);
  await new Promise(r => setTimeout(r, 1500));

  // Click on the candidate card in Pipeline
  const clickCard = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const card = document.querySelector('.candidate-card, div[draggable="true"]');
        if (card) {
          card.click();
          return 'Clicked candidate card: ' + card.innerText.slice(0, 50);
        }
        const anyMercer = Array.from(document.querySelectorAll('*')).find(el => el.textContent.includes('Alex Mercer') && el.children.length === 0);
        if (anyMercer) {
          anyMercer.click();
          return 'Clicked Alex Mercer text element';
        }
        return 'No candidate card found in pipeline';
      })()
    `
  });
  console.log(clickCard.result.value);
  await new Promise(r => setTimeout(r, 1500));

  // Capture candidate modal with clean stage UI
  const modalShot1 = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(path.join(artifactsDir, 'screenshot_candidate_modal_verified_clean.png'), Buffer.from(modalShot1.data, 'base64'));
  console.log('Saved screenshot_candidate_modal_verified_clean.png');

  // Click Evaluate Job Fit or Re-Evaluate Fit
  const aiClick = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const aiBtn = btns.find(b => b.textContent.includes('Evaluate Job Fit') || b.textContent.includes('Re-Evaluate Fit'));
        if (aiBtn) {
          aiBtn.click();
          return 'Clicked ' + aiBtn.textContent.trim();
        }
        return 'AI evaluate button not found in modal';
      })()
    `
  });
  console.log('AI evaluation trigger:', aiClick.result.value);

  // Wait 3.5s for AI evaluation computation and rendering
  await new Promise(r => setTimeout(r, 3500));

  // Capture screenshot of AI evaluation result
  const modalShot2 = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(path.join(artifactsDir, 'screenshot_ai_recruiter_decision_active.png'), Buffer.from(modalShot2.data, 'base64'));
  console.log('Saved screenshot_ai_recruiter_decision_active.png');

  // Test Download Resume button
  const dlClick = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const dl = btns.find(b => b.textContent.includes('Download Resume'));
        if (dl) {
          dl.click();
          return 'Clicked Download Resume successfully';
        }
        return 'Download button not found';
      })()
    `
  });
  console.log('Download resume click:', dlClick.result.value);

  await new Promise(r => setTimeout(r, 1500));
  ws.close();
}

openCandidateViaPipeline().catch(console.error);

