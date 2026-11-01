async function realTypingTest() {
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

  // Click 'New Folder'
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('New Folder'));
      if (btn) btn.click();
    })()`
  });
  await new Promise(r => setTimeout(r, 400));

  // Focus the input
  await send('Runtime.evaluate', {
    expression: `document.querySelector('#create-folder-name').focus()`
  });
  await new Promise(r => setTimeout(r, 100));

  // Type 'Frontend Engineers' with real input text
  await send('Input.insertText', { text: 'Frontend Engineers' });
  await new Promise(r => setTimeout(r, 200));

  // Focus the description
  await send('Runtime.evaluate', {
    expression: `document.querySelector('#create-folder-desc').focus()`
  });
  await new Promise(r => setTimeout(r, 100));

  // Type description
  await send('Input.insertText', { text: 'React & TypeScript specialists' });
  await new Promise(r => setTimeout(r, 300));

  // Check state before submit
  const preSubmit = await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = document.querySelector('.modal-content button[type=\"submit\"]');
      return {
        nameVal: document.querySelector('#create-folder-name').value,
        descVal: document.querySelector('#create-folder-desc').value,
        btnDisabled: btn ? btn.disabled : null,
        btnText: btn ? btn.innerText : null
      };
    })()`,
    returnByValue: true
  });
  console.log('Pre-submit state:', preSubmit.result.value);

  // Click submit
  await send('Runtime.evaluate', {
    expression: `document.querySelector('.modal-content button[type=\"submit\"]').click()`
  });
  await new Promise(r => setTimeout(r, 1500));

  // Check folders after submit
  const folders = await send('Runtime.evaluate', {
    expression: `Array.from(document.querySelectorAll('.glass-card button, .glass-card span')).map(el => el.innerText.trim()).filter(Boolean)`,
    returnByValue: true
  });
  console.log('Folders after submit:', folders.result.value);

  ws.close();
}

realTypingTest().catch(console.error);

