async function test() {
  const tabs = await fetch('http://127.0.0.1:9222/json/list').then(r=>r.json());
  const t = tabs.find(x => x.url.includes('5173') && x.type === 'page');
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  ws.send(JSON.stringify({id: 1, method: 'Runtime.evaluate', params: {
    expression: '(() => { const el = document.querySelector(".modal-backdrop"); return el ? { html: el.outerHTML.substring(0, 300), rect: el.getBoundingClientRect() } : null; })()',
    returnByValue: true
  }}));
  ws.onmessage = (e) => {
    const d = JSON.parse(e.data);
    if (d.id === 1) {
      console.log('modal-backdrop in DOM:', JSON.stringify(d.result.result.value, null, 2));
      process.exit(0);
    }
  };
}
test().catch(console.error);

