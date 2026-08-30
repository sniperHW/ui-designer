// 修复 examples/卡牌.uiw：「存为定制控件」落在画布根的临时实例（卡牌1）不在底部导航卡牌页签内
// 原因：存为定制控件后替换实例固定挂到画布根（同 gui-arena/customize.mjs 的「删除画布根上的临时实例」），
//       而此时画布中央已被「卡牌分类」TabView/滚动区占据，直接点控件库会挂进滚动区。
// 修复（幂等）：界面操作删除画布根上的 卡牌1（导航页签内的保留）→ 若页签内缺失则
//       滚轮平移画布（纯输入事件）使画布中央的文档坐标落在 战力条(685-755) 与 卡牌分类(775起)
//       之间的空隙 (375,765) → 控件库实例化 → 录入坐标/名称 → 平移复原 → 保存。
import { connect, makeUI } from '../gui-arena/driver.mjs'
import { readFileSync, writeFileSync } from 'fs'

const FILE = '/Users/huangwei/ui-designer/examples/卡牌.uiw'
const { call, evalJs, sleep } = await connect(9222)
const ui = makeUI({ call, evalJs, sleep })
const t0 = Date.now()
let idx = 0
const log = (m) => console.log(`[${String(++idx).padStart(3, '0')} ${Math.round((Date.now() - t0) / 1000)}s] ${m}`)
const failures = []
const tryStep = async (desc, fn) => {
  try { await fn(); log('✓ ' + desc) } catch (e) { failures.push(desc + ': ' + e.message); console.log(`  ✗ ${desc}: ${e.message}`) }
}

/** 画布中央的文档坐标 + 画布中心屏幕坐标 */
const centerDoc = () => evalJs(`(() => { const el = document.querySelector('.canvas-wrap'); const r = el.getBoundingClientRect(); const v = window.__uiw.getState().viewport; return { x: (r.width / 2 - v.panX) / v.zoom, y: (r.height / 2 - v.panY) / v.zoom, sx: r.x + r.width / 2, sy: r.y + r.height / 2, zoom: v.zoom } })()`)
/** 滚轮平移（Canvas：普通滚轮 → panBy(-dx,-dy)），把画布中央的文档坐标移到 (tx,ty)。Δcenter = delta/zoom */
const panCenterTo = async (tx, ty) => {
  for (let i = 0; i < 12; i++) {
    const c = await centerDoc()
    const ddx = tx - c.x, ddy = ty - c.y
    if (Math.abs(ddx) < 0.5 && Math.abs(ddy) < 0.5) return
    await call('Input.dispatchMouseEvent', { type: 'mouseWheel', x: Math.round(c.sx), y: Math.round(c.sy), deltaX: ddx * c.zoom, deltaY: ddy * c.zoom })
    await sleep(120)
  }
  const c = await centerDoc()
  throw new Error(`平移未到位 (${c.x.toFixed(1)},${c.y.toFixed(1)})`)
}
/** 节点 id 所在容器（只读） */
const parentOfNode = (id) => evalJs(`(() => { const s = window.__uiw.getState(); const nav = s.doc.pages[0].nodes[0]; const id = ${JSON.stringify(id)}
  const inArr = (arr) => arr && arr.some(n => n.id === id)
  if (inArr(s.doc.pages[0].nodes)) return 'page-root'
  for (let p = 0; p < 5; p++) if (nav.pages[p] && inArr(nav.pages[p])) return 'nav-tab' + (p + 1)
  const tab = nav.pages[1].find(n => n.name === '卡牌分类')
  if (tab) for (let p = 0; p < 4; p++) { const pg = tab.pages[p] ?? []; if (inArr(pg)) return 'tab-page' + (p + 1)
    for (const n of pg) if (n.children && inArr(n.children)) return 'scroll' }
  return 'unknown' })()`)
/** 点击图层树中第 occ 个同名行，返回选中的节点（带重试与校验） */
const clickLayerNode = async (name, occ = 1) => {
  for (let a = 0; a < 3; a++) {
    const r = await evalJs(`(() => { const m = [...document.querySelectorAll('.layer-row')].filter(x => x.querySelector('.layer-name')?.textContent?.trim() === ${JSON.stringify(name)}); const el = m[${occ - 1}]; if (!el) return null; el.scrollIntoView({ block: 'center' }); const rr = el.getBoundingClientRect(); return { x: rr.x + rr.width / 2, y: rr.y + rr.height / 2 } })()`)
    if (!r) return null
    await ui.click(r.x, r.y)
    await sleep(80)
    const n = await ui.readSel()
    if (n && n.name === name) return n
  }
  throw new Error('图层选中失败 ' + name + '#' + occ)
}

// ---------- 0. 载入工程（应用自身 loadProject 流程） ----------
{
  const content = readFileSync(FILE, 'utf8')
  await evalJs(`(() => { window.__uiw.getState().loadProject(JSON.parse(${JSON.stringify(content)}), ${JSON.stringify(FILE)}); return true })()`)
  await sleep(400)
  const ov = await ui.readOverview()
  if (!ov.hasProject || ov.meta.name !== '卡牌') throw new Error('工程载入失败: ' + JSON.stringify(ov))
  log(`工程已载入：公共层 ${ov.common}，定制控件 ${ov.customs}`)
}

// ---------- 1. 删除画布根上的 卡牌1（幂等：导航页签内的保留） ----------
await tryStep('删除画布根上的 卡牌1', async () => {
  let removed = 0
  for (let occ = 1; occ <= 3; occ++) {
    const n = await clickLayerNode('卡牌1', occ)
    if (!n) break
    const where = await parentOfNode(n.id)
    if (where !== 'page-root') continue
    await ui.key('Backspace')
    await sleep(120)
    removed++
    occ--
  }
  const dup = await evalJs(`(() => { const s = window.__uiw.getState(); return s.doc.pages[0].nodes.some(n => n.name === '卡牌1') })()`)
  if (dup) throw new Error('根上仍有 卡牌1')
  log(`  已删除根实例 ${removed} 个`)
})

// ---------- 2. 若导航页签内缺 卡牌1：平移画布 → 实例化 → 录入 ----------
const hasDeck1 = await evalJs(`(() => { const s = window.__uiw.getState(); const p1 = s.doc.pages[0].nodes[0].pages[1]; return p1.some(n => n.type === 'custom' && n.name === '卡牌1') })()`)
if (hasDeck1) {
  log('导航卡牌页签内已有 卡牌1，跳过实例化')
} else {
  const SAFE = { x: 375, y: 765 }
  let origin = null
  await tryStep('滚轮平移画布中央 → (375,765) 空隙', async () => {
    origin = await centerDoc()
    await panCenterTo(SAFE.x, SAFE.y)
  })
  await tryStep('控件库实例化 游戏卡牌（挂入底部导航卡牌页签）', async () => {
    await ui.clickLib('游戏卡牌')
    await sleep(80)
    const n = await ui.readSel()
    if (!n || n.type !== 'custom') throw new Error('实例化失败')
    const where = await parentOfNode(n.id)
    if (where !== 'nav-tab2') throw new Error('落点容器 ' + where + '（期望 nav-tab2）')
  })
  await tryStep('录入 卡牌1 坐标/名称（默认属性 ⛏ 等级1 0/4）', async () => {
    await ui.fillField('X', 30)
    await ui.fillField('Y', 210)
    await ui.fillField('名称', '卡牌1')
    const n = await ui.readSel()
    if (n.x !== 30 || n.y !== 210 || n.name !== '卡牌1') throw new Error(`结果 ${n.name}@${n.x},${n.y}`)
    if (await parentOfNode(n.id) !== 'nav-tab2') throw new Error('移动后容器变为 ' + await parentOfNode(n.id))
  })
  await tryStep('平移复原画布', async () => { if (origin) await panCenterTo(origin.x, origin.y) })
}

// ---------- 3. 保存 + 结构校验（只读） ----------
await tryStep('保存工程', async () => {
  await evalJs(`(async () => { const s = window.__uiw.getState(); const path = await window.api.saveProject({ content: JSON.stringify(s.doc, null, 2), knownPath: ${JSON.stringify(FILE)} }); if (path) s.markSaved(path); return true })()`)
  await sleep(700)
  const st = await evalJs(`(() => { const s = window.__uiw.getState(); return { dirty: s.dirty, fp: s.filePath } })()`)
  if (st.dirty || !st.fp) throw new Error('保存状态 ' + JSON.stringify(st))
})
{
  const st = await evalJs(`(() => { const s = window.__uiw.getState(); const nav = s.doc.pages[0].nodes[0]; const p1 = nav.pages[1]
    return {
      roots: s.doc.pages[0].nodes.map(n => n.name),
      navPages: nav.pages.map(p => p.length),
      deck: p1.filter(n => n.type === 'custom' && /^卡牌\\d+$/.test(n.name)).map(n => n.name + '@' + n.x + ',' + n.y + JSON.stringify(n.overrides ?? {}))
    } })()`)
  console.log(JSON.stringify(st, null, 1))
  const ok = st.roots.length === 1 && st.navPages.join() === '0,13,0,0,0' && st.deck.length === 8
    && st.deck.some(d => d.startsWith('卡牌1@30,210{}')) && new Set(st.deck.map(d => d.split('@')[0])).size === 8
  if (!ok) failures.push('结构校验不符')
}

// ---------- 4. 截图 ----------
const shot = async (file) => {
  const pt = await evalJs(`(() => { const r = document.querySelector('.canvas-svg').getBoundingClientRect(); const v = window.__uiw.getState().viewport; return { x: r.x + v.panX - 60 * v.zoom, y: r.y + v.panY - 60 * v.zoom } })()`)
  await ui.click(pt.x, pt.y); await sleep(100)
  const rect = await evalJs(`(() => { const r = document.querySelector('.canvas-wrap').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height } })()`)
  const s = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { ...rect, scale: 2 } })
  writeFileSync(file, Buffer.from(s.data, 'base64'))
  log('📸 ' + file)
}
await tryStep('截图 卡牌页', async () => { await shot('/tmp/card-shots/cards-page-fixed.png') })

console.log(failures.length ? 'FIX-FAILED:\n' + failures.map(f => '  ✗ ' + f).join('\n') : 'FIX-OK')
process.exit(failures.length ? 1 : 0)
