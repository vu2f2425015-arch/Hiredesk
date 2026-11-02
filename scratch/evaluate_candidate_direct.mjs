import fs from 'fs';
import path from 'path';

const artifactsDir = `C:/Users/Pankaj's Laptop/.gemini/antigravity/brain/5f5d7170-221f-49a6-8f1c-1478e056a8d5`;

async function main() {
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

  // Navigate to Jobs
  await send('Page.navigate', { url: 'http://localhost:5173/jobs' });
  await new Promise(r => setTimeout(r, 2000));

  // Click Details button on JOB-1030
  await send('Runtime.evaluate', {
    expression: `
      const dBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Details');
      if (dBtn) dBtn.click();
    `
  });
  await new Promise(r => setTimeout(r, 800));

  // In Job Details Modal, click Applicants tab
  await send('Runtime.evaluate', {
    expression: `
      const appTab = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Applicants'));
      if (appTab) appTab.click();
    `
  });
  await new Promise(r => setTimeout(r, 1000));

  // Click Alex Mercer from Applicants list to open CandidateProfileModal
  const clickApp = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const rows = Array.from(document.querySelectorAll('*'));
        const alex = rows.find(el => el.textContent.includes('Alex Mercer') && el.children.length === 0);
        if (alex) {
          alex.click();
          return 'Clicked Alex Mercer in Applicants tab';
        }
        return 'Not found in applicants';
      })()
    `
  });
  console.log('Applicant click:', clickApp.result.value);
  await new Promise(r => setTimeout(r, 1500));

  // Capture screenshot of Candidate Profile modal
  const modalShot1 = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(path.join(artifactsDir, 'screenshot_candidate_modal_clean_ui.png'), Buffer.from(modalShot1.data, 'base64'));
  console.log('Captured screenshot_candidate_modal_clean_ui.png');

  // Click Evaluate Job Fit
  const evalClick = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const evalBtn = btns.find(b => b.textContent.includes('Evaluate') || b.textContent.includes('Job Fit'));
        if (evalBtn) {
          evalBtn.click();
          return 'Triggered ' + evalBtn.textContent.trim();
        }
        return 'Evaluate button not found';
      })()
    `
  });
  console.log('Evaluation trigger:', evalClick.result.value);

  // Wait 3.5s for AI evaluation response
  await new Promise(r => setTimeout(r, 3500));

  // Capture screenshot of active AI Recruiter Decision Support
  const modalShot2 = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(path.join(artifactsDir, 'screenshot_ai_recruiter_active_fit.png'), Buffer.from(modalShot2.data, 'base64'));
  console.log('Captured screenshot_ai_recruiter_active_fit.png');

  // Test Download Resume click
  const dlClick = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const dl = btns.find(b => b.textContent.includes('Download Resume'));
        if (dl) {
          dl.click();
          return 'Triggered Download Resume successfully';
        }
        return 'Download button not found';
      })()
    `
  });
  console.log('Download resume click result:', dlClick.result.value);

  await new Promise(r => setTimeout(r, 1500));
  ws.close();
}

main().catch(console.error);

