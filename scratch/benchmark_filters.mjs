async function benchmark() {
  const tabs = await fetch('http://127.0.0.1:9222/json/list').then(r=>r.json());
  const t = tabs.find(x => x.type === 'page');
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  const getStorage = () => new Promise(res => {
    ws.send(JSON.stringify({id: 1, method: 'Runtime.evaluate', params: {
      expression: 'localStorage.getItem("sb-osrbdzeyqbresvineakk-auth-token")',
      returnByValue: true
    }}));
    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (d.id === 1) res(JSON.parse(d.result.result.value));
    };
  });

  const session = await getStorage();
  const token = session.access_token;

  console.log('--- 1. FIRST CALL (Database query) ---');
  let t0 = performance.now();
  await fetch('http://localhost:4000/api/jobs', { headers: { Authorization: `Bearer ${token}` } }).then(r=>r.json());
  console.log(`Jobs (cold) took: ${(performance.now() - t0).toFixed(1)} ms`);

  t0 = performance.now();
  await fetch('http://localhost:4000/api/talent-pool/candidates?page=1&limit=15', { headers: { Authorization: `Bearer ${token}` } }).then(r=>r.json());
  console.log(`Talent Pool (cold) took: ${(performance.now() - t0).toFixed(1)} ms`);

  console.log('\n--- 2. CACHED CALL (In-memory cached response) ---');
  t0 = performance.now();
  await fetch('http://localhost:4000/api/jobs', { headers: { Authorization: `Bearer ${token}` } }).then(r=>r.json());
  console.log(`Jobs (cached) took: ${(performance.now() - t0).toFixed(1)} ms`);

  t0 = performance.now();
  await fetch('http://localhost:4000/api/talent-pool/candidates?page=1&limit=15', { headers: { Authorization: `Bearer ${token}` } }).then(r=>r.json());
  console.log(`Talent Pool (cached) took: ${(performance.now() - t0).toFixed(1)} ms`);

  ws.close();
}

benchmark().catch(console.error);
