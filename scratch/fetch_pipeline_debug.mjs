async function test() {
  const tabs = await fetch('http://127.0.0.1:9222/json/list').then(r=>r.json());
  const t = tabs.find(x => x.type === 'page');
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  ws.send(JSON.stringify({id: 1, method: 'Runtime.evaluate', params: {
    expression: 'localStorage.getItem("sb-osrbdzeyqbresvineakk-auth-token")',
    returnByValue: true
  }}));
  ws.onmessage = async (e) => {
    const d = JSON.parse(e.data);
    if (d.id === 1) {
      const sess = JSON.parse(d.result.result.value);
      const res = await fetch('http://localhost:4000/api/jobs/0fa45e19-762b-423d-b52f-6e9a2b627ca5/pipeline', {
        headers: { Authorization: 'Bearer ' + sess.access_token }
      }).then(r=>r.json());
      console.log('Pipeline data:', JSON.stringify(res, null, 2));
      process.exit(0);
    }
  };
}
test().catch(console.error);

