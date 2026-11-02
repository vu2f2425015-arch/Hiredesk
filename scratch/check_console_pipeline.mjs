import fs from 'fs';

async function checkConsole() {
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

  const evalRes = await send('Runtime.evaluate', {
    expression: `
      (() => {
        return {
          session: localStorage.getItem('hiredesk-session') || Object.keys(localStorage),
          token: localStorage.getItem('supabase.auth.token') || 'none',
          error: window.__lastError || 'none'
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Console state:', evalRes.result.value);

  // Let's test calling fetch('/api/jobs/0fa45e19-762b-423d-b52f-6e9a2b627ca5/pipeline') in page context
  const testPipelineFetch = await send('Runtime.evaluate', {
    expression: `
      (async () => {
        // Find auth token in localStorage or supabase keys
        let token = '';
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.includes('auth-token')) {
            try {
              const parsed = JSON.parse(localStorage.getItem(k));
              token = parsed.access_token || parsed?.currentSession?.access_token || '';
            } catch {}
          }
        }
        if (!token) {
          return { error: 'No token found in localStorage keys: ' + Object.keys(localStorage).join(', ') };
        }
        const res = await fetch('/api/jobs/0fa45e19-762b-423d-b52f-6e9a2b627ca5/pipeline', {
          headers: { Authorization: 'Bearer ' + token }
        });
        const json = await res.json();
        return { status: res.status, json };
      })()
    `,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Pipeline fetch in browser:', JSON.stringify(testPipelineFetch.result.value, null, 2));

  ws.close();
}

checkConsole().catch(console.error);

