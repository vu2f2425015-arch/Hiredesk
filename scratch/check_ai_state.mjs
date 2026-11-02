async function checkAiState() {
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

  const evalRes = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const text = document.querySelector('[role="dialog"]') ? document.querySelector('[role="dialog"]').innerText : 'No dialog';
        return {
          dialogText: text.slice(0, 1200),
          evalBtnText: Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Evaluate') || b.textContent.includes('Fit'))?.textContent
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Dialog state:', evalRes.result.value);

  ws.close();
}
checkAiState().catch(console.error);

