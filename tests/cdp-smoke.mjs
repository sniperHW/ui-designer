// CDP 功能冒烟测试：通过 DevTools 协议模拟真实点击/键盘，验证编辑器核心链路
const BASE = 'http://localhost:9222'

async function main() {
  // 等 CDP 端口就绪
  let targets = null
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(BASE + '/json')
      targets = await res.json()
      break
    } catch {
      await new Promise((r) => setTimeout(r, 500))
    }
  }
  if (!targets) throw new Error('CDP 端口未就绪')
  const page = targets.find((t) => t.type === 'page' && t.url.includes('localhost:5173'))
  if (!page) throw new Error('未找到渲染页 target: ' + JSON.stringify(targets.map((t) => t.url)))

  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((res, rej) => {
    ws.onopen = res
    ws.onerror = (e) => rej(new Error('websocket 连接失败'))
  })
  let seq = 0
  const pending = new Map()
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg)
      pending.delete(msg.id)
    }
  }
  const call = (method, params = {}) =>
    new Promise((res, rej) => {
      const id = ++seq
      pending.set(id, (msg) => (msg.error ? rej(new Error(method + ': ' + JSON.stringify(msg.error))) : res(msg.result)))
      ws.send(JSON.stringify({ id, method, params }))
    })
  const evalJs = async (expression) => {
    const r = await call('Runtime.evaluate', { expression, returnByValue: true })
    if (r.exceptionDetails) throw new Error('页面脚本执行失败: ' + expression.slice(0, 80))
    return r.result.value
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const click = async (x, y, modifiers = 0) => {
    await call('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1, modifiers })
    await call('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 1, clickCount: 1, modifiers })
  }
  const center = (sel) =>
    evalJs(
      `(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`
    )
  const results = {}
  const check = (name, ok, detail) => {
    results[name] = ok ? '✓ ' + detail : '✗ ' + detail
    if (!ok) process.exitCode = 1
  }

  // 0. 启动默认未打开工程 → 欢迎页
  await evalJs('window.__uiw.getState().closeProject()')
  await sleep(300)
  const welcomeVisible = await evalJs('document.querySelector(".welcome") !== null')
  check('启动欢迎页', welcomeVisible === true, welcomeVisible ? '未打开工程时显示欢迎页' : '未显示欢迎页')
  const hp0 = await evalJs('window.__uiw.getState().hasProject')
  check('默认无工程', hp0 === false, `hasProject=${hp0}`)
  const noEditor = await evalJs('document.querySelector(".canvas-wrap") === null')
  check('编辑器隐藏', noEditor === true, noEditor ? '无工程时不渲染画布' : '画布仍在渲染')

  // 1. 新建工程 → 进入编辑器
  await evalJs(
    `window.__uiw.getState().newProject({ name: '冒烟测试', designWidth: 1334, designHeight: 750, orientation: 'landscape' })`
  )
  await sleep(300)
  const editorVisible = await evalJs('document.querySelector(".canvas-wrap") !== null')
  check('新建后进入编辑器', editorVisible === true, editorVisible ? '画布已渲染' : '画布未渲染')

  // 2. 基础界面
  results['标题'] = await evalJs('document.title')
  const libCount = await evalJs('document.querySelectorAll(".lib-item").length')
  check('控件库', libCount === 11, `内置控件 ${libCount}/11 项`)
  const menus = await evalJs('[...document.querySelectorAll(".menu > summary")].map(s => s.textContent).join("/")')
  check('菜单栏', menus === '文件/编辑/视图/帮助', menus)
  const pages0 = await evalJs('document.querySelectorAll(".page-row").length')
  check('初始页面', pages0 === 1, `页面数 ${pages0}`)

  // 2. 点击控件库第 1 项（矩形）→ 画布中央添加
  let c = await center('.lib-item:nth-child(1)')
  await click(c.x, c.y)
  await sleep(250)
  let nodeCount = await evalJs('document.querySelectorAll("g[data-id]").length')
  check('添加控件(点击)', nodeCount === 1, `画布控件 ${nodeCount}`)
  let selBoxes = await evalJs('document.querySelectorAll(".sel-box").length')
  check('自动选中', selBoxes === 1, `选择框 ${selBoxes}`)
  const handleCount = await evalJs('document.querySelectorAll(".sel-handle").length')
  check('缩放手柄', handleCount === 8, `手柄 ${handleCount}/8`)

  // 3. 属性面板出现名称输入框，改名
  const nameInput = await evalJs('document.querySelector(".right input[type=text]") !== null')
  check('属性面板', nameInput, '名称/属性输入框已出现')

  // 4. 再添加 2 个控件（按钮、进度条）
  for (const n of [6, 9]) {
    c = await evalJs(
      `(() => { const items = document.querySelectorAll('.lib-item'); const r = items[${n}].getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`
    )
    await click(c.x, c.y)
    await sleep(250)
  }
  nodeCount = await evalJs('document.querySelectorAll("g[data-id]").length')
  check('连续添加', nodeCount === 3, `画布控件 ${nodeCount}/3`)
  const layerRows = await evalJs('document.querySelectorAll(".layer-row").length')
  check('图层树', layerRows === 3, `图层行 ${layerRows}/3`)

  // 5. Shift 多选：先把第一个控件移到左上角避免与其他控件重叠，再 Shift 点击其中心
  //    （CDP 需在鼠标事件上传 modifiers: 8 = Shift；live=true 使移动不入撤销栈）
  await evalJs(
    `(() => { const st = window.__uiw.getState(); const n = st.currentPage().nodes[0]; st.updateNodes([n.id], m => { m.x = 60; m.y = 60 }, true); return true })()`
  )
  await sleep(200)
  const g0 = await evalJs(
    `(() => { const r = document.querySelectorAll('g[data-id]')[0].getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`
  )
  await click(g0.x, g0.y, 8)
  await sleep(200)
  selBoxes = await evalJs('document.querySelectorAll(".sel-box").length')
  check('Shift 多选', selBoxes === 2, `选择框 ${selBoxes}/2`)

  // 6. ⌘Z 撤销 3 次 → 画布清空
  for (let i = 0; i < 3; i++) {
    await evalJs("window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true }))")
    await sleep(150)
  }
  nodeCount = await evalJs('document.querySelectorAll("g[data-id]").length')
  check('撤销', nodeCount === 0, `撤销后控件 ${nodeCount}/0`)
  // 7. ⇧⌘Z 重做 3 次 → 恢复
  for (let i = 0; i < 3; i++) {
    await evalJs("window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true, shiftKey: true }))")
    await sleep(150)
  }
  nodeCount = await evalJs('document.querySelectorAll("g[data-id]").length')
  check('重做', nodeCount === 3, `重做后控件 ${nodeCount}/3`)

  // 8. 新建页面 → 页面数 2
  c = await center('.page-foot button')
  await click(c.x, c.y)
  await sleep(200)
  const pages1 = await evalJs('document.querySelectorAll(".page-row").length')
  check('新建页面', pages1 === 2, `页面数 ${pages1}/2`)
  const emptyHint = await evalJs('document.querySelector(".canvas-empty") !== null')
  check('空页提示', emptyHint, '空页面显示引导文案')

  // 9. 网格开关切换
  await evalJs("window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))")
  const gridOn1 = await evalJs('document.querySelectorAll("#gridpat").length')
  check('网格渲染', gridOn1 === 1, `网格图案 ${gridOn1}`)

  // 10. 状态栏内容
  const status = await evalJs('document.querySelector(".statusbar").textContent')
  check('状态栏', status.includes('设计') && status.includes('缩放'), status.slice(0, 60))

  console.log(JSON.stringify(results, null, 2))
  ws.close()
}

main().catch((e) => {
  console.error('测试失败:', e.message)
  process.exit(1)
})
