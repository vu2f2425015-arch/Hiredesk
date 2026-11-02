import fs from 'fs';
import path from 'path';

const artifactsDir = 'C:/Users/Pankaj\'s Laptop/.gemini/antigravity/brain/5f5d7170-221f-49a6-8f1c-1478e056a8d5';

async function main() {
  const tabsRes = await fetch('http://127.0.0.1:9222/json/list');
  const tabs = await tabsRes.json();
  const pageTab = tabs.find(t => t.type === 'page');
  const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
  let id = 1;
  const send = (method, params = {}) => new Promise((resolve) => {
    const curId = id++;
    const handler = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === curId) {
        ws.removeEventListener('message', handler);
        resolve(msg.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id: curId, method, params }));
  });
  await new Promise(r => ws.onopen = r);

  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1200,
    deviceScaleFactor: 1,
    mobile: false
  });

  // Scroll modal body down so Current Stage & AI Recruiter are fully visible
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const modal = document.querySelector('[role="dialog"]') || document.querySelector('.modal-content') || document.body;
        const scrollable = Array.from(document.querySelectorAll('*')).find(el => el.scrollHeight > el.clientHeight && el.clientHeight > 300);
        if (scrollable) {
          scrollable.scrollTop = 250;
        }
      })()
    `
  });
  await new Promise(r => setTimeout(r, 600));

  // Screenshot 1: Clean Candidate Modal UI (Current stage clean box + footer)
  const shot1 = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(path.join(artifactsDir, 'screenshot_candidate_modal_verified_clean.png'), Buffer.from(shot1.data, 'base64'));
  console.log('Saved screenshot_candidate_modal_verified_clean.png');

  // Find and click Evaluate Job Fit
  const evalBtn = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const btn = btns.find(b => b.textContent.includes('Evaluate') || b.textContent.includes('Re-Evaluate'));
        if (btn) {
          btn.scrollIntoView({ block: 'center' });
          btn.click();
          return 'Clicked: ' + btn.textContent.trim();
        }
        return 'Not found among: ' + btns.map(b => b.textContent.trim()).filter(Boolean).join(', ');
      })()
    `,
    returnByValue: true
  });
  console.log('Eval button click:', evalBtn.result.value);

  // Wait 3.5s for AI evaluation
  await new Promise(r => setTimeout(r, 3500));

  // Screenshot 2: Active AI Decision Support Card
  const shot2 = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(path.join(artifactsDir, 'screenshot_ai_recruiter_decision_active.png'), Buffer.from(shot2.data, 'base64'));
  console.log('Saved screenshot_ai_recruiter_decision_active.png');

  // Test Download Resume
  const dlRes = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const dl = btns.find(b => b.textContent.includes('Download Resume'));
        if (dl) {
          dl.click();
          return 'Download Resume clicked';
        }
        return 'Not found';
      })()
    `,
    returnByValue: true
  });
  console.log('Download test:', dlRes.result.value);

  ws.close();
  console.log('Done!');
}

main().catch(console.error);

