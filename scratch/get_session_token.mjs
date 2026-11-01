async function getSessionToken() {
  const tabsRes = await fetch('http://127.0.0.1:9222/json/list');
  const tabs = await tabsRes.json();
  const pageTab = tabs.find(t => t.url.includes('5173') && t.type === 'page');

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

  const storage = await send('Runtime.evaluate', {
    expression: `(() => {
      const keys = Object.keys(localStorage);
      const sbKey = keys.find(k => k.includes('auth-token') || k.startsWith('sb-'));
      return sbKey ? JSON.parse(localStorage.getItem(sbKey)) : null;
    })()`,
    returnByValue: true
  });

  const session = storage.result.value;
  ws.close();

  if (!session) {
    console.log('No session found in localStorage');
    return;
  }

  const token = session.access_token;
  console.log('Got session token! Fetching jobs from API...');

  const res = await fetch('http://localhost:4000/api/jobs', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  console.log('Agency jobs:', JSON.stringify(data, null, 2));
}

getSessionToken().catch(console.error);
