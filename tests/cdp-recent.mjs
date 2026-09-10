// CDP 黑盒测试：最近打开文件（主进程持久化 + 欢迎页列表 + 文件菜单 + 失效清理 + 清除记录）
// 说明：保存经 window.api.saveProject({ knownPath }) 走真实 IPC 写盘（系统另存对话框无法 CDP 驱动），
//       其余全部为真实点击 / 菜单操作，不直接改 store 文档数据。
import { unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

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
    ws.onerror = () => rej(new Error('websocket 连接失败'))
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
  // awaitPromise：页面内 top-level await 的异步表达式也能取回结果
  const evalJs = async (expression) => {
    const r = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (r.exceptionDetails) throw new Error('页面脚本执行失败: ' + expression.slice(0, 120))
    return r.result.value
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const click = async (x, y, modifiers = 0) => {
    await call('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1, modifiers })
    await call('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 1, clickCount: 1, modifiers })
  }
  const center = (sel) =>
    evalJs(
      `(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`
    )
  const clickAt = async (c) => {
    if (!c) throw new Error('目标不存在，无法点击')
    await click(c.x, c.y)
  }
  const results = {}
  const check = (name, ok, detail) => {
    results[name] = ok ? '✓ ' + detail : '✗ ' + detail
    if (!ok) process.exitCode = 1
  }
  /** 展开指定菜单（点 summary） */
  const openMenu = async (label) => {
    await clickAt(
      await evalJs(
        `(() => { const s = [...document.querySelectorAll('.menu > summary')].find(x => x.textContent === ${JSON.stringify(label)}); if (!s) return null; const r = s.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`
      )
    )
    await sleep(150)
  }
  /** 在已展开菜单中点击指定 label 的菜单项 */
  const clickMenuItem = async (label) => {
    await clickAt(
      await evalJs(
        `(() => { const el = [...document.querySelectorAll('details.menu[open] .menu-item')].find(i => i.querySelector('.menu-item-label')?.textContent === ${JSON.stringify(label)}); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`
      )
    )
    await sleep(200)
  }

  const fileA = join(tmpdir(), `uiw-cdp-recent-a-${Date.now()}.uiw`)
  const fileB = join(tmpdir(), `uiw-cdp-recent-b-${Date.now()}.uiw`)
  const nameA = fileA.replace(/.*\//, '').replace(/\.uiw$/, '')
  const nameB = fileB.replace(/.*\//, '').replace(/\.uiw$/, '')

  // 0. 准备：覆写 alert/confirm 防阻塞；清空最近记录；回欢迎页
  await evalJs(
    `window.__alerts = []; window.alert = (m) => { window.__alerts.push(String(m)) }; window.confirm = () => true; 'ok'`
  )
  await evalJs('(async () => { await window.api.clearRecent() })()')
  await evalJs('window.__uiw.getState().closeProject()')
  await sleep(400)
  check('空记录欢迎页', (await evalJs('document.querySelector(".welcome") !== null')) === true, '清空后回到欢迎页')
  check(
    '空记录无列表',
    (await evalJs('document.querySelector(".welcome-recent") === null')) === true,
    '无最近记录时不渲染最近区块'
  )

  // 1. 欢迎页真实点击「新建工程」→ 弹窗「创建」→ 进入编辑器
  await clickAt(await center('.welcome-actions .btn.primary'))
  await sleep(200)
  await clickAt(await center('.modal-foot .btn.primary'))
  await sleep(300)
  check(
    '新建进入编辑器',
    (await evalJs('window.__uiw.getState().hasProject')) === true,
    '真实点击新建工程后进入编辑器'
  )

  // 2. 经真实 IPC 保存到临时路径 A（免对话框）→ 主进程记录最近
  const savedPath = await evalJs(
    `window.api.saveProject({ content: JSON.stringify(window.__uiw.getState().doc), knownPath: ${JSON.stringify(fileA)} })`
  )
  check('保存记录最近', savedPath === fileA, `knownPath 保存返回 ${savedPath}`)

  // 3. 菜单「文件 → 关闭工程」→ 欢迎页出现最近条目（名字 = 文件名去扩展）
  await openMenu('文件')
  await clickMenuItem('关闭工程')
  await sleep(400)
  const itemCount = await evalJs('document.querySelectorAll(".welcome-recent-item").length')
  check('欢迎页最近列表', itemCount === 1, `最近条目 ${itemCount}/1`)
  const firstName = await evalJs('document.querySelector(".welcome-recent-name")?.textContent')
  check('条目显示文件名', firstName === nameA, `名字「${firstName}」= ${nameA}`)
  const firstTitle = await evalJs('document.querySelector(".welcome-recent-item")?.title')
  check('悬停完整路径', firstTitle === fileA, `title = ${firstTitle}`)

  // 4. 点击欢迎页条目 → 不经对话框直接打开
  await clickAt(await center('.welcome-recent-item'))
  await sleep(400)
  const st4 = await evalJs(
    `(() => { const s = window.__uiw.getState(); return { hp: s.hasProject, fp: s.filePath, pages: s.doc.pages.length, meta: s.doc.meta.name } })()`
  )
  check(
    '点击直接打开',
    st4.hp === true && st4.fp === fileA && st4.pages === 1,
    `hasProject=${st4.hp} filePath=${st4.fp} 页数=${st4.pages}`
  )

  // 5. 文件菜单最近区：另存到 B 后重新展开菜单 → B 置顶（菜单展开时刷新）
  const savedB = await evalJs(
    `window.api.saveProject({ content: JSON.stringify(window.__uiw.getState().doc), knownPath: ${JSON.stringify(fileB)} })`
  )
  check('另存记录最近', savedB === fileB, `knownPath 另存返回 ${savedB}`)
  await openMenu('文件')
  const groupOk = await evalJs(
    `(() => { const items = [...document.querySelectorAll('details.menu[open] .menu-group-title')]; return items.some(t => t.textContent === '最近打开') })()`
  )
  check('菜单最近分组', groupOk === true, '文件菜单显示「最近打开」分组')
  const menuNames = await evalJs(
    `[...document.querySelectorAll('details.menu[open] .menu-item .menu-item-label')].map(s => s.textContent)`
  )
  check(
    '菜单条目与置顶',
    menuNames.includes(nameA) && menuNames.includes(nameB) && menuNames.indexOf(nameB) < menuNames.indexOf(nameA),
    `菜单含 A/B 且 B 在前：${menuNames.join('、')}`
  )
  await clickMenuItem('关闭工程')

  // 6. 失效文件：删除 B 后点击其条目 → 提示不存在、条目自动清理、A 保留
  unlinkSync(fileB)
  await sleep(200)
  await clickAt(await center('.welcome-recent-item')) // B 置顶在第一位
  await sleep(400)
  const alerts = await evalJs('window.__alerts')
  check(
    '失效文件提示',
    Array.isArray(alerts) && alerts.some((m) => m.includes('文件不存在或已被移动') && m.includes(fileB)),
    `alert: ${alerts && alerts[0]}`
  )
  const names6 = await evalJs('[...document.querySelectorAll(".welcome-recent-name")].map(n => n.textContent)')
  check(
    '失效条目清理',
    names6.includes(nameA) && !names6.includes(nameB),
    `剩余条目：${names6.join('、')}`
  )

  // 7. 清除记录：欢迎页「清除记录」→ 区块消失 + 主进程列表为空
  await clickAt(await center('.welcome-recent .link-btn'))
  await sleep(300)
  check(
    '清除后区块消失',
    (await evalJs('document.querySelector(".welcome-recent") === null')) === true,
    '清除后欢迎页不再渲染最近区块'
  )
  const recentAfterClear = await evalJs('(async () => await window.api.recentList())()')
  check('主进程列表清空', Array.isArray(recentAfterClear) && recentAfterClear.length === 0, `recentList 长度 = ${recentAfterClear.length}`)

  // 收尾：清理临时文件、回欢迎页
  try {
    unlinkSync(fileA)
  } catch {}
  await evalJs('window.__uiw.getState().closeProject()')

  console.log('—— 最近打开文件 ——')
  for (const [name, detail] of Object.entries(results)) console.log(detail)
  const failed = Object.values(results).filter((d) => d.startsWith('✗')).length
  console.log(`${failed === 0 ? '✅ 全部通过' : '❌ ' + failed + ' 项失败'}（${Object.keys(results).length} 项）`)
  ws.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
