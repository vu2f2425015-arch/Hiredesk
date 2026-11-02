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

  const cardHtml = await send('Runtime.evaluate', {
    expression: 'Array.from(document.querySelectorAll("button, a")).map(b => ({ tag: b.tagName, text: b.textContent.trim(), href: b.getAttribute("href") }))',
    returnByValue: true
  });
  console.log('Action elements:', cardHtml.result.value);
  ws.close();
}
main().catch(console.error);
