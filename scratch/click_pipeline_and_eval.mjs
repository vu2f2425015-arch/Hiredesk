import fs from 'fs';
import path from 'path';

const artifactsDir = `C:/Users/Pankaj's Laptop/.gemini/antigravity/brain/5f5d7170-221f-49a6-8f1c-1478e056a8d5`;

async function clickPipelineAndEvaluate() {
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

  // 1. Click Pipeline button
  const pRes = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const pBtn = btns.find(b => b.textContent.includes('Pipeline'));
        if (pBtn) {
          pBtn.click();
          return 'Clicked Pipeline';
        }
        return 'Not found';
      })()
    `
  });
  console.log('Pipeline click:', pRes.result.value);
  await new Promise(r => setTimeout(r, 1500));

  // 2. Click on Alex Mercer in Pipeline
  const cRes = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const elements = Array.from(document.querySelectorAll('*'));
        const alex = elements.find(el => el.textContent.includes('Alex Mercer') && el.children.length === 0);
        if (alex) {
          alex.click();
          return 'Clicked Alex Mercer';
        }
        return 'Alex Mercer not found';
      })()
    `
  });
  console.log('Candidate click:', cRes.result.value);
  await new Promise(r => setTimeout(r, 1500));

  // 3. Capture modal before evaluation
  const modalShot1 = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(path.join(artifactsDir, 'screenshot_candidate_modal_verified_clean.png'), Buffer.from(modalShot1.data, 'base64'));
  console.log('Saved screenshot_candidate_modal_verified_clean.png');

  // 4. Click Evaluate Job Fit or Re-Evaluate Fit
  const evalRes = await send('Runtime.evaluate', {
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
  console.log('Eval click:', evalRes.result.value);
  await new Promise(r => setTimeout(r, 3500));

  // 5. Capture active AI evaluation result
  const modalShot2 = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(path.join(artifactsDir, 'screenshot_ai_recruiter_decision_active.png'), Buffer.from(modalShot2.data, 'base64'));
  console.log('Saved screenshot_ai_recruiter_decision_active.png');

  // 6. Test Download Resume
  const dlRes = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const dlBtn = btns.find(b => b.textContent.includes('Download Resume'));
        if (dlBtn) {
          dlBtn.click();
          return 'Triggered Download Resume click successfully';
        }
        return 'Download button not found';
      })()
    `
  });
  console.log('Download test:', dlRes.result.value);
  await new Promise(r => setTimeout(r, 1500));

  ws.close();
}

clickPipelineAndEvaluate().catch(console.error);

