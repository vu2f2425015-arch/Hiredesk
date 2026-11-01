async function inspectTalentPool() {
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

  await send('Page.navigate', { url: 'http://localhost:5173/talent-pool' });
  await new Promise(r => setTimeout(r, 2000));

  const pageInfo = await send('Runtime.evaluate', {
    expression: `({
      url: window.location.href,
      newFolderBtn: !!Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('New Folder')),
      foldersCount: document.querySelectorAll('.glass-card').length
    })`,
    returnByValue: true
  });

  console.log('Talent pool status:', pageInfo.result.value);
  ws.close();
}

inspectTalentPool().catch(console.error);

