async function checkConsole() {
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

  const res = await send('Runtime.evaluate', {
    expression: `(() => {
      const input = document.querySelector('#create-folder-name');
      const submitBtn = document.querySelector('.modal-content button[type=\"submit\"]');
      return {
        inputValue: input ? input.value : null,
        submitDisabled: submitBtn ? submitBtn.disabled : null
      };
    })()`,
    returnByValue: true
  });
  console.log('Form status:', res.result.value);
  ws.close();
}

checkConsole().catch(console.error);

