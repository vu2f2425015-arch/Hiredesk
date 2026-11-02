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

  // Click Pipeline
  await send('Runtime.evaluate', {
    expression: `
      const pBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Pipeline'));
      if (pBtn) pBtn.click();
    `
  });

  // Wait 2s for pipeline to fetch and render
  await new Promise(r => setTimeout(r, 2000));

  // Click Alex Mercer card
  const cRes = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const els = Array.from(document.querySelectorAll('*'));
        const alex = els.find(el => el.textContent.includes('Alex Mercer') && el.children.length === 0);
        if (alex) {
          alex.click();
          return 'Clicked Alex Mercer';
        }
        return 'Not found';
      })()
    `
  });
  console.log('Alex Mercer click:', cRes.result.value);

  // Wait 1.5s for CandidateProfileModal to open
  await new Promise(r => setTimeout(r, 1500));

  // Capture Screenshot 1: Cleaned up UI (Current Stage box, no muddy dark box, clean footer)
  const modalShot1 = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(path.join(artifactsDir, 'screenshot_candidate_modal_clean_ui.png'), Buffer.from(modalShot1.data, 'base64'));
  console.log('Captured screenshot_candidate_modal_clean_ui.png');

  // Click Evaluate Job Fit or Re-Evaluate Fit
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

  // Wait 3.5s for match calculation and render
  await new Promise(r => setTimeout(r, 3500));

  // Capture Screenshot 2: Active AI Decision Support (No warning banner, Hiredesk AI Engine badge, 100% match)
  const modalShot2 = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(path.join(artifactsDir, 'screenshot_ai_recruiter_active_fit.png'), Buffer.from(modalShot2.data, 'base64'));
  console.log('Captured screenshot_ai_recruiter_active_fit.png');

  // Test Download Resume button
  const dlTest = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const dl = btns.find(b => b.textContent.includes('Download Resume'));
        if (dl) {
          dl.click();
          return 'Download Resume clicked';
        }
        return 'Download button not found';
      })()
    `
  });
  console.log('Download resume click result:', dlTest.result.value);

  await new Promise(r => setTimeout(r, 1500));
  ws.close();
}

main().catch(console.error);

