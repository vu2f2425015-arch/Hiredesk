import http from 'http';
import fs from 'fs';

const ARTIFACT_DIR = "C:/Users/Pankaj's Laptop/.gemini/antigravity/brain/5f5d7170-221f-49a6-8f1c-1478e056a8d5";

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('Connecting to Chrome CDP on 9222...');
  const targets = await getJson('http://127.0.0.1:9222/json');
  console.log('Found targets:', targets.length);
  const target = targets.find((t) => t.type === 'page') || targets[0];
  if (!target) throw new Error('No page target found');

  const wsUrl = target.webSocketDebuggerUrl;
  console.log('Target WebSocket:', wsUrl);

  const ws = new WebSocket(wsUrl);

  let msgId = 1;
  const pending = new Map();

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
    }
  });

  await new Promise((res) => ws.addEventListener('open', res));

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  // 1. Navigate to /login
  console.log('Navigating to http://localhost:5173/login...');
  await send('Page.navigate', { url: 'http://localhost:5173/login' });
  await new Promise((r) => setTimeout(r, 2000));

  // Take screenshot of login page
  const snap1 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`${ARTIFACT_DIR}/screenshot_login_fixed.png`, Buffer.from(snap1.data, 'base64'));
  console.log('Saved screenshot_login_fixed.png');

  // Fill credentials and click sign in
  console.log('Signing in with recruiter@agency.com...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const inputs = document.querySelectorAll('input');
        const emailInput = Array.from(inputs).find(i => i.type === 'email');
        const passwordInput = Array.from(inputs).find(i => i.type === 'password');
        if (emailInput) {
          emailInput.value = 'recruiter@agency.com';
          emailInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (passwordInput) {
          passwordInput.value = 'Password123!';
          passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        const submitBtn = document.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.click();
      })()
    `
  });

  // Wait for auth & profile loading
  console.log('Waiting for login redirection and dashboard load...');
  await new Promise((r) => setTimeout(r, 5000));

  const urlRes = await send('Runtime.evaluate', { expression: 'window.location.href' });
  console.log('Current URL after login:', urlRes.result.value);

  // Take screenshot of dashboard after login
  const snap2 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`${ARTIFACT_DIR}/screenshot_dashboard_dataset_loaded.png`, Buffer.from(snap2.data, 'base64'));
  console.log('Saved screenshot_dashboard_dataset_loaded.png');

  // Now open Command Palette
  console.log('Opening Command Palette via topbar-search-button...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const btn = document.querySelector('.topbar-search-button') || document.querySelector('button[title*="⌘K"]');
        if (btn) btn.click();
        else {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
        }
      })()
    `
  });
  await new Promise((r) => setTimeout(r, 1200));

  // Screenshot command palette in light theme
  const snap3 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`${ARTIFACT_DIR}/screenshot_command_palette_light.png`, Buffer.from(snap3.data, 'base64'));
  console.log('Saved screenshot_command_palette_light.png');

  // Switch to dark theme
  console.log('Switching to dark theme...');
  await send('Runtime.evaluate', {
    expression: `
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('hd_theme', 'dark');
    `
  });
  await new Promise((r) => setTimeout(r, 1000));

  const snap4 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`${ARTIFACT_DIR}/screenshot_command_palette_dark.png`, Buffer.from(snap4.data, 'base64'));
  console.log('Saved screenshot_command_palette_dark.png');

  ws.close();
  console.log('Verification completed successfully!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Error during verification:', err);
  process.exit(1);
});
