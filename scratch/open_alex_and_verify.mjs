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

  // Check if candidate card is present; if not wait or reload
  let found = false;
  for (let i = 0; i < 10; i++) {
    const res = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const els = Array.from(document.querySelectorAll('*'));
          const alex = els.find(el => el.textContent.includes('Alex Mercer') && el.children.length === 0);
          if (alex) {
            alex.click();
            return true;
          }
          return false;
        })()
      `,
      returnByValue: true
    });
    if (res.result.value) {
      found = true;
      console.log('Successfully clicked Alex Mercer card!');
      break;
    }
    console.log('Waiting for candidate card...', i);
    await new Promise(r => setTimeout(r, 1000));
  }

  if (!found) {
    console.log('Could not find candidate card automatically. Checking page text:');
    const dump = await send('Runtime.evaluate', {
      expression: 'document.body.innerText.slice(0, 600)',
      returnByValue: true
    });
    console.log(dump.result.value);
    ws.close();
    return;
  }

  // CandidateProfileModal is now open!
  await new Promise(r => setTimeout(r, 1500));

  // Screenshot 1: Clean Candidate Modal UI
  const shot1 = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(path.join(artifactsDir, 'screenshot_candidate_modal_verified_clean.png'), Buffer.from(shot1.data, 'base64'));
  console.log('Saved screenshot_candidate_modal_verified_clean.png');

  // Click Evaluate Job Fit
  const evalBtn = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const btn = btns.find(b => b.textContent.includes('Evaluate') || b.textContent.includes('Re-Evaluate'));
        if (btn) {
          btn.click();
          return 'Clicked: ' + btn.textContent.trim();
        }
        return 'Not found';
      })()
    `,
    returnByValue: true
  });
  console.log('Eval button click:', evalBtn.result.value);

  // Wait 3.5s for AI Recruiter to complete
  await new Promise(r => setTimeout(r, 3500));

  // Screenshot 2: AI Recruiter Result (Hiredesk AI Engine, 100% overlap, no missing skills, no error banner)
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

