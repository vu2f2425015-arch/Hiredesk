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

  // Navigate to Jobs
  await send('Page.navigate', { url: 'http://localhost:5173/jobs' });
  await new Promise(r => setTimeout(r, 2000));

  // Find and click Pipeline on JOB-1030
  const clickPipe = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const p = btns.find(b => b.textContent.includes('Pipeline'));
        if (p) {
          p.click();
          return 'Clicked Pipeline';
        }
        return 'Pipeline button not found. Available buttons: ' + btns.map(b => b.textContent.trim()).join(', ');
      })()
    `
  });
  console.log('Pipe result:', clickPipe.result.value);

  await new Promise(r => setTimeout(r, 2500));

  // What is on the page now?
  const pageText = await send('Runtime.evaluate', {
    expression: `(() => {
      return {
        text: document.body.innerText.slice(0, 800),
        cards: Array.from(document.querySelectorAll('.candidate-card, .kanban-card, tr, [role="button"]')).map(el => el.textContent.trim().slice(0, 80))
      };
    })()`
  });
  console.log('Pipeline page:', pageText.result.value);

  const shot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(path.join(artifactsDir, 'screenshot_inspect_pipeline.png'), Buffer.from(shot.data, 'base64'));
  console.log('Saved screenshot_inspect_pipeline.png');
  ws.close();
}

main().catch(console.error);

