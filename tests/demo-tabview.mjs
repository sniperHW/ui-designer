// 在运行中的应用里搭建 3 页签 TabView 示例（背包/装备/商城）
const BASE = 'http://localhost:9222'
async function main() {
  const targets = await (await fetch(BASE + '/json')).json()
  const page = targets.find((t) => t.type === 'page' && t.url.includes('localhost:5173'))
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let seq = 0
  const pending = new Map()
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id) }
  }
  const call = (method, params = {}) => new Promise((res, rej) => {
    const id = ++seq
    pending.set(id, (m) => (m.error ? rej(new Error(method)) : res(m.result)))
    ws.send(JSON.stringify({ id, method, params }))
  })
  const evalJs = async (expression) => {
    const r = await call('Runtime.evaluate', { expression, returnByValue: true })
    if (r.exceptionDetails) throw new Error('eval 失败: ' + expression.slice(0, 120))
    return r.result.value
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const def = (type, label) => `window.__uiwDefs.find(d => d.type === '${type}' && d.label === '${label}')`

  // 清空页面 1
  await evalJs(`(() => { const st = window.__uiw.getState(); st.setCurrentPage(0); st.setSelection([]); return true })()`)
  await evalJs("window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', metaKey: true }))")
  await evalJs("window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }))")
  await sleep(200)

  // 1. 添加 Tab（画布中央偏左），改名"背包分区"，页签 = 背包/装备/商城
  await evalJs(`(() => { const st = window.__uiw.getState(); st.addWidget(${def('tab', 'Tab 页签')}, 660, 390); return true })()`)
  await sleep(150)
  await evalJs(`(() => {
    const st = window.__uiw.getState()
    const t = st.currentPage().nodes[0]
    st.updateNodes([t.id], n => {
      n.name = '背包分区'
      n.props.tabs = ['背包', '装备', '商城']
      const pages = n.pages ?? []
      n.pages = ['背包', '装备', '商城'].map((_, i) => pages[i] ?? [])
    })
    return true
  })()`)
  await sleep(150)
  const tab = await evalJs(`window.__uiw.getState().currentPage().nodes[0]`)
  console.log('Tab:', tab.x, tab.y, tab.w, tab.h, tab.props.tabs)

  // 2. 页签 1（背包）：两个占位图 + 一个按钮
  await evalJs(`(() => { const st = window.__uiw.getState(); const t = st.currentPage().nodes[0]
    st.addWidget(${def('placeholder', '占位图')}, t.x + 110, t.y + 130)
    st.addWidget(${def('placeholder', '占位图')}, t.x + 290, t.y + 130)
    st.addWidget(${def('button', '按钮')}, t.x + 200, t.y + 265)
    return true })()`)
  await sleep(150)

  // 3. 切到页签 2（装备）：进度条 + 复选框 + 文本
  await evalJs(`(() => { const st = window.__uiw.getState(); const t = st.currentPage().nodes[0]
    st.updateNodes([t.id], n => { n.activeTab = 1 }, true)
    st.addWidget(${def('progress', '进度条')}, t.x + 200, t.y + 120)
    st.addWidget(${def('checkbox', '复选框')}, t.x + 130, t.y + 200)
    st.addWidget(${def('text', '文本')}, t.x + 200, t.y + 270)
    return true })()`)
  await sleep(150)

  // 4. 切到页签 3（商城）：输入框 + 按钮；然后回到页签 1
  await evalJs(`(() => { const st = window.__uiw.getState(); const t = st.currentPage().nodes[0]
    st.updateNodes([t.id], n => { n.activeTab = 2 }, true)
    st.addWidget(${def('input', '输入框')}, t.x + 200, t.y + 120)
    st.addWidget(${def('button', '按钮')}, t.x + 200, t.y + 250)
    st.updateNodes([t.id], n => { n.activeTab = 0 }, true)
    st.setSelection([])
    st.mutate(() => {}, true) // no-op
    return true })()`)
  await sleep(200)

  // 5. 恢复干净的历史栈并适配视图
  await evalJs(`(() => { const st = window.__uiw.getState(); st.past = []; st.future = []; st.dirty = false; st.fitView(); return true })()`)

  const final = await evalJs(`(() => {
    const st = window.__uiw.getState()
    const t = st.currentPage().nodes[0]
    return { name: t.name, tabs: t.props.tabs, active: t.activeTab, pages: t.pages.map(p => p.map(c => c.type)) }
  })()`)
  console.log('最终状态:', JSON.stringify(final, null, 2))
  ws.close()
}
main().catch((e) => { console.error('失败:', e.message); process.exit(1) })
