// 通过界面操作搭建「卡牌」工程（对照卡牌收集页参考截图）
// 结构：公共层 = 顶部状态栏（所有页面公用，含资源条 / 定位 / 更多 / 录制）
//   页面 卡牌页 = 底部导航 TabView（商店/卡牌/战斗/城堡/成就，除卡牌外页签留白，默认选中卡牌）
//     牌组 = 筛选器（牌组 1-5，选中 1）
//     牌组下方 = 8 张「游戏卡牌」定制控件实例 + 战力/兵种统计条
//     下部 = TabView（所有卡牌/神器/宝箱/表情，除所有卡牌外页签留白）
//       所有卡牌页签 = 滚动区（可滑动）内 16 张「游戏卡牌」实例
//   「游戏卡牌」定制控件：卡框 + 配型角标（⛏资源矿 / ⚔战士 / 🏰防御塔）+ 卡面占位图 + 等级 + 碎片进度（进度条 + 文字）+ 可升级标识（⬆）
// 全程仅界面操作：控件库点击入画布 → 属性面板录入 → 图层树多选 → 菜单存为定制控件 → 暴露属性绑定 → 实例属性覆盖。
import { connect, makeUI } from '../gui-arena/driver.mjs'
import { writeFileSync, mkdirSync } from 'fs'

const { call, evalJs, sleep, dialogLog } = await connect(9222)
const ui = makeUI({ call, evalJs, sleep })
const { clickLib, fillField, fillDom, clickSeg, checkRow, clickLayer, clickPage, clickAnyBtn, clickMenu, readSel, readOverview } = ui
const t0 = Date.now()
let idx = 0
const log = (msg) => console.log(`[${String(idx).padStart(3, '0')} ${Math.round((Date.now() - t0) / 1000)}s] ${msg}`)

const TYPE_OF = { 矩形: 'rect', 圆角矩形: 'rect', 椭圆: 'ellipse', 线段: 'line', 占位图: 'placeholder', 九宫格: 'nine', 文本: 'text', 按钮: 'button', 复选框: 'checkbox', 进度条: 'progress', 输入框: 'input', 筛选器: 'filter', 面板: 'panel', 弹窗: 'dialog', 滚动区: 'scroll', 列表: 'list', 网格: 'grid', 'Tab 页签': 'tab' }
const failures = []

/** 通过控件库添加控件并录入属性（画布中心落点决定容器归属）；单件失败记录后继续 */
async function W(lib, geo, opts = {}) {
  idx++
  const desc = `${lib}·${opts.name ?? opts.text ?? ''}`
  try {
    let added = null
    for (let i = 0; i < 3 && !added; i++) {
      await clickLib(lib)
      await sleep(60)
      const n = await readSel()
      if (n && n.type === TYPE_OF[lib]) added = n
      else console.log(`  ⚠️ ${desc} 第 ${i + 1} 次入库未选中${n ? '（类型 ' + n?.type + '）' : '（无选中）'}，重试`)
    }
    if (!added) throw new Error('入库失败')
    if (geo) {
      if (geo.w != null) await fillField('宽', geo.w)
      if (geo.h != null) await fillField('高', geo.h)
      if (geo.x != null) await fillField('X', geo.x)
      if (geo.y != null) await fillField('Y', geo.y)
      if (geo.r != null) await fillField('圆角', geo.r)
      if (opts.progress != null) await fillField('百分比', opts.progress)
    }
    if (opts.count != null) await fillField('项数', opts.count)
    if (opts.cols != null) await fillField('列数', opts.cols)
    if (opts.text != null) await fillField('内容', opts.text)
    if (opts.tabs != null) await fillField('页签列表', opts.tabs.join('\n'))
    if (opts.bar) await clickSeg('页签栏', opts.bar === 'bottom' ? '下' : '上')
    if (opts.fs != null) await fillField('字号', opts.fs)
    if (opts.bold) await checkRow('加粗')
    if (opts.align) await clickSeg('对齐', opts.align)
    if (opts.options != null) await fillField('标签列表', opts.options.join('\n'))
    if (opts.sel != null) await clickSeg('选中项', String(opts.sel))
    if (opts.name) await fillField('名称', opts.name)
    // 校验（只读）
    const n = await readSel()
    if (!n) throw new Error('添加后无选中节点')
    if (geo) {
      for (const k of ['x', 'y', 'w', 'h']) {
        if (geo[k] != null && n[k] !== geo[k]) throw new Error(`${k}=${n[k]} 期望 ${geo[k]}`)
      }
    }
    if (opts.text != null && n.props.text !== opts.text) throw new Error(`文本不符: ${JSON.stringify(n.props.text)}`)
    if (opts.tabs && JSON.stringify(n.props.tabs) !== JSON.stringify(opts.tabs)) throw new Error('页签列表不符')
    if (opts.options && JSON.stringify(n.props.options) !== JSON.stringify(opts.options)) throw new Error('标签列表不符')
    log(`${lib} ✓ ${opts.name ?? opts.text ?? ''} (${geo ? `${geo.x},${geo.y},${geo.w}×${geo.h}` : ''})`)
  } catch (e) {
    failures.push(`${desc}: ${e.message}`)
    console.log(`  ✗ ${desc} 失败：${e.message}`)
    // 恢复：点画布空白处清除无效选择，继续下一件
    const pt = await evalJs(`(() => { const r = document.querySelector('.canvas-svg').getBoundingClientRect(); const v = window.__uiw.getState().viewport; return { x: r.x + v.panX - 60 * v.zoom, y: r.y + v.panY - 60 * v.zoom } })()`).catch(() => null)
    if (pt) { await ui.click(pt.x, pt.y).catch(() => {}); await sleep(80) }
  }
}

// ---------- 通用界面操作（同 gui-arena） ----------
const clickLayerOcc = async (name, occ = 1, shift = false) => {
  for (let a = 0; a < 3; a++) {
    const r = await evalJs(`(() => { const m = [...document.querySelectorAll('.layer-row')].filter(x => x.querySelector('.layer-name')?.textContent?.trim() === ${JSON.stringify(name)}); const el = m[${occ - 1}]; if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
    if (!r) throw new Error(`图层未找到: ${name}#${occ}`)
    await ui.mouse('mousePressed', r.x, r.y, shift ? { modifiers: 8 } : {})
    await ui.mouse('mouseReleased', r.x, r.y, shift ? { modifiers: 8 } : {})
    await sleep(70)
    const n = await ui.readSel()
    if (!shift && n && n.name === name) return n
    if (shift) return await ui.readSel()
  }
  throw new Error('图层选中失败 ' + name)
}
const rowsByNames = async (names) => evalJs(`(() => { const set = new Set(${JSON.stringify(names)}); return [...document.querySelectorAll('.layer-row')].map((r, i) => ({ i, name: r.querySelector('.layer-name')?.textContent?.trim() })).filter(r => r.name && set.has(r.name)).map(r => r.i) })()`)
const selectRows = async (idxs, expected) => {
  for (let k = 0; k < idxs.length; k++) {
    const i = idxs[k]
    const r = await evalJs(`(() => { const el = document.querySelectorAll('.layer-row')[${i}]; if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
    if (!r) throw new Error('行不存在 #' + i)
    await ui.mouse('mousePressed', r.x, r.y, k > 0 ? { modifiers: 8 } : {})
    await ui.mouse('mouseReleased', r.x, r.y, k > 0 ? { modifiers: 8 } : {})
    await sleep(45)
  }
  const n = await evalJs(`window.__uiw.getState().selectedIds.length`)
  if (n !== expected) throw new Error(`多选 ${n} ≠ ${expected}`)
}
const switchTab = async (nodeName, btnNo) => {
  for (let i = 0; i < 3; i++) {
    await clickLayerOcc(nodeName)
    const b = await evalJs(`(() => { const row = [...document.querySelectorAll('.prop-row')].find(r => r.querySelector(':scope>span')?.textContent?.trim() === '当前页签'); const btn = row && [...row.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(String(btnNo))}); if (!btn) return null; const r = btn.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
    if (!b) throw new Error('当前页签按钮未找到')
    await ui.click(b.x, b.y); await sleep(110)
    const n = await ui.readSel()
    if (n && n.activeTab === btnNo - 1) return
  }
  throw new Error('切页签失败 ' + nodeName)
}
const saveSelectionAsCustom = async () => {
  await ui.clickMenu('控件', '存为定制控件')
  await sleep(150)
  const n = await ui.readSel()
  if (!n || n.type !== 'custom') throw new Error('存为定制控件后选中不是实例')
  return n
}
const enterDefEdit = async () => { await ui.clickAnyBtn('编辑定义（改一处全局生效）'); await sleep(150) }
const exitDefEdit = async (pageName) => { await ui.clickAnyBtn('📄 ' + pageName); await sleep(150) }
const bindProp = async (rowName, propName) => {
  await clickLayerOcc(rowName)
  await ui.fillField('新属性名', propName)
  await ui.clickAnyBtn('绑定')
  await sleep(90)
}
const addInstance = async (lib, x, y, name, overrides = {}) => {
  await ui.clickLib(lib)
  await sleep(70)
  const n0 = await ui.readSel()
  if (!n0 || n0.type !== 'custom') throw new Error(`${lib} 实例化失败`)
  await ui.fillField('X', x)
  await ui.fillField('Y', y)
  for (const [k, v] of Object.entries(overrides)) await ui.fillField(k, v)
  if (name) await ui.fillField('名称', name)
  const n = await ui.readSel()
  if (n.x !== x || n.y !== y) throw new Error(`实例位置 ${n.x},${y} ≠ ${x},${y}`)
  for (const [k, v] of Object.entries(overrides)) {
    if (JSON.stringify(n.overrides?.[k]) !== JSON.stringify(v)) throw new Error(`覆盖 ${k}=${JSON.stringify(n.overrides?.[k])} ≠ ${JSON.stringify(v)}`)
  }
  return n
}
const tryStep = async (desc, fn) => {
  idx++
  try { await fn(); log('✓ ' + desc) } catch (e) { failures.push(desc + ': ' + e.message); console.log(`  ✗ ${desc}: ${e.message}`) }
}

// ================= 0. 若已有打开工程则先关闭（确认弹窗自动接受） =================
{
  const ov = await readOverview()
  if (ov.hasProject) {
    log('检测到已打开工程，先通过菜单关闭')
    await clickMenu('文件', '关闭工程')
    await sleep(400)
  }
}

// ================= 1. 新建工程（欢迎页 → 弹窗） =================
idx++
log('新建工程：竖屏 750×1600「卡牌」')
await clickAnyBtn('新建工程')
await sleep(300)
{
  await fillDom(`document.querySelector('.modal .form-row input[type=text]')`, '卡牌', '工程名称')
  await sleep(60)
}
await clickAnyBtn('竖屏')
await sleep(100)
{
  await fillDom(`[...document.querySelectorAll('.modal input[type=number]')][0]`, 750, '自定义宽')
  await fillDom(`[...document.querySelectorAll('.modal input[type=number]')][1]`, 1600, '自定义高')
  await sleep(60)
}
await clickAnyBtn('创建')
await sleep(400)
{
  const ov = await readOverview()
  if (!ov.hasProject || ov.meta.designWidth !== 750 || ov.meta.designHeight !== 1600 || ov.meta.name !== '卡牌') {
    throw new Error('工程创建失败: ' + JSON.stringify(ov))
  }
  log(`工程已创建：${ov.meta.name} ${ov.meta.designWidth}×${ov.meta.designHeight}`)
}
// 重命名页面 1 → 卡牌页
{
  const p = await evalJs(`(() => { const el = [...document.querySelectorAll('.page-row')].find(r => r.querySelector('.page-name')?.textContent?.includes('页面 1')); if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
  if (!p) throw new Error('未找到页面 1 行')
  await ui.dblClick(p.x, p.y)
  await sleep(250)
  await fillDom(`document.querySelector('.page-row input')`, '卡牌页', '页面重命名', true)
  await sleep(100)
  log('页面 1 已重命名为「卡牌页」')
}

// ================= 2. 公共层：顶部状态栏（所有页面公用） =================
log('—— 公共层：顶部状态栏 ——')
await clickPage('公共层')
await sleep(150)
await W('占位图', { x: 500, y: 14, w: 46, h: 46 }, { name: '定位按钮' })
await W('按钮', { x: 556, y: 12, w: 80, h: 48 }, { text: '···', fs: 30, name: '更多按钮' })
await W('椭圆', { x: 648, y: 12, w: 56, h: 56 }, { name: '录制按钮' })
const pills = [['💎 6', 14], ['🪵 400', 190], ['🔮 139', 366], ['🪙 280', 542]]
for (const [val, x] of pills) {
  await W('圆角矩形', { x, y: 60, w: 160, h: 44, r: 22 }, { name: `资源条${val}` })
  await W('文本', { x, y: 66, w: 128, h: 32 }, { text: val, fs: 22, bold: true, align: '中', name: `资源值${val}` })
  await W('圆角矩形', { x: x + 134, y: 70, w: 20, h: 20, r: 7 }, { name: `资源加号${val}` })
  await W('文本', { x: x + 134, y: 71, w: 20, h: 18 }, { text: '＋', fs: 14, align: '中', name: `资源加号字${val}` })
}

// ================= 3. 卡牌页：底部导航 TabView（其余页签留白） =================
log('—— 卡牌页：底部导航 TabView ——')
await clickPage('卡牌页')
await sleep(150)
await W('Tab 页签', { x: 0, y: 110, w: 750, h: 1490 }, { name: '底部导航', tabs: ['商店', '卡牌', '战斗', '城堡', '成就'], bar: 'bottom' })
await switchTab('底部导航', 2)

// ================= 4. 牌组筛选器（先建，避免落点掉进后面的容器） =================
log('—— 牌组筛选器 ——')
await W('筛选器', { x: 25, y: 130, w: 700, h: 64 }, { name: '牌组选择', options: ['牌组', '1', '2', '3', '4', '5'], sel: 2 })

// ================= 5. 手摆第 1 张卡 → 存为定制控件「游戏卡牌」 =================
log('—— 手摆第 1 张卡 ——')
const CARD = { w: 160, h: 220 }
await W('圆角矩形', { x: 30, y: 210, w: CARD.w, h: CARD.h, r: 16 }, { name: '卡框' })
await W('椭圆', { x: 38, y: 218, w: 34, h: 34 }, { name: '配型底' })
await W('文本', { x: 38, y: 222, w: 34, h: 28 }, { text: '⛏', fs: 20, align: '中', name: '配型图标' })
await W('占位图', { x: 44, y: 256, w: 112, h: 96 }, { name: '卡面图片' })
await W('文本', { x: 30, y: 354, w: 160, h: 28 }, { text: '等级 1', fs: 22, align: '中', name: '等级文字' })
await W('进度条', { x: 42, y: 386, w: 136, h: 26 }, { progress: 0, name: '碎片进度条' })
await W('文本', { x: 42, y: 388, w: 136, h: 22 }, { text: '0/4', fs: 20, align: '中', name: '碎片文字' })
await W('文本', { x: 146, y: 216, w: 38, h: 26 }, { text: '·', fs: 22, align: '中', name: '可升级标识' })

let tempInst = null
await tryStep('存为定制控件（8 控件）', async () => {
  const idxs = await rowsByNames(['卡框', '配型底', '配型图标', '卡面图片', '等级文字', '碎片进度条', '碎片文字', '可升级标识'])
  if (idxs.length !== 8) throw new Error('选中行数 ' + idxs.length)
  await selectRows(idxs, 8)
  tempInst = await saveSelectionAsCustom()
  if (tempInst.w !== CARD.w || tempInst.h !== CARD.h) throw new Error(`实例尺寸 ${tempInst.w}×${tempInst.h}`)
})
await tryStep('定义改名「游戏卡牌」+ 暴露 配型/等级/进度/碎片/可升级', async () => {
  await enterDefEdit()
  await ui.fillField('名称', '游戏卡牌')
  await ui.clickAnyBtn('保存发布设置')
  await sleep(80)
  await bindProp('配型图标', '配型')
  await bindProp('等级文字', '等级')
  await bindProp('碎片进度条', '进度')
  await bindProp('碎片文字', '碎片')
  await bindProp('可升级标识', '可升级')
  const defs = await evalJs(`(() => { const d = window.__uiw.getState().doc.customWidgets; return d.map(w => ({ n: w.name, p: w.props.map(x => x.name + ':' + x.type + ':' + x.binds.length) })) })()`)
  const def = defs.find(w => w.n === '游戏卡牌')
  if (!def || def.p.join() !== '配型:string:1,等级:string:1,进度:number:1,碎片:string:1,可升级:string:1') throw new Error('定义属性 ' + JSON.stringify(defs))
  await exitDefEdit('卡牌页')
})
await tryStep('删除画布根上的临时实例（存为定制控件会挂到画布根）', async () => {
  if (!tempInst) throw new Error('无临时实例')
  await clickLayerOcc(tempInst.name)
  await ui.key('Backspace')
  await sleep(100)
  const gone = await evalJs(`(() => { const s = window.__uiw.getState(); return !s.doc.pages[0].nodes.some(x => x.id === ${JSON.stringify(tempInst.id)}) })()`)
  if (!gone) throw new Error('删除失败')
})

// ================= 6. 牌组 8 张实例（覆盖 配型/等级/碎片/进度/可升级） =================
log('—— 牌组 8 张卡 ——')
const deck = [
  // [x, y, 配型, 等级, 碎片, 进度, 可升级]
  [30, 210, '⛏', '等级 1', '0/4', 0, '·'],
  [206, 210, '⚔', '等级 1', '3/4', 75, '·'],
  [382, 210, '⚔', '等级 2', '8/9', 89, '·'],
  [558, 210, '⚔', '等级 1', '8/6', 100, '⬆'],
  [30, 445, '⚔', '等级 1', '3/6', 50, '·'],
  [206, 445, '⚔', '等级 1', '0/8', 0, '·'],
  [382, 445, '⚔', '等级 1', '0/10', 0, '·'],
  [558, 445, '🏰', '等级 1', '0/6', 0, '·']
]
for (let i = 0; i < deck.length; i++) {
  const [x, y, t, lv, frag, prog, up] = deck[i]
  const overrides = {}
  if (t !== '⛏') overrides['配型'] = t
  if (lv !== '等级 1') overrides['等级'] = lv
  if (frag !== '0/4') overrides['碎片'] = frag
  if (prog !== 0) overrides['进度'] = prog
  if (up !== '·') overrides['可升级'] = up
  await tryStep(`牌组实例 卡牌${i + 1} (${x},${y}) ${t} ${lv} ${frag}${up === '⬆' ? ' ⬆可升级' : ''}`, async () => {
    await addInstance('游戏卡牌', x, y, `卡牌${i + 1}`, overrides)
  })
}

// ================= 7. 战力 + 兵种统计条（牌组下方） =================
log('—— 战力条 ——')
await W('圆角矩形', { x: 25, y: 685, w: 700, h: 70, r: 12 }, { name: '战力条' })
await W('文本', { x: 45, y: 699, w: 250, h: 42 }, { text: '战力 9888', fs: 30, bold: true, name: '战力值' })
await W('文本', { x: 310, y: 699, w: 400, h: 42 }, { text: '💀1 🐺2 🛡3 ⚙1 ⚔4 🗡3', fs: 24, name: '兵种统计' })

// ================= 8. 下部 TabView：所有卡牌/神器/宝箱/表情（后三者留白） =================
log('—— 下部 TabView + 所有卡牌滚动区 ——')
await W('Tab 页签', { x: 25, y: 775, w: 700, h: 700 }, { name: '卡牌分类', tabs: ['所有卡牌', '神器', '宝箱', '表情'], bar: 'bottom' })
await W('滚动区', { x: 25, y: 775, w: 700, h: 636 }, { name: '全部卡牌滚动区' })
const album = [
  // [配型, 等级, 碎片, 进度, 可升级]
  ['⚔', '等级 1', '8/6', 100, '⬆'],
  ['⚔', '未解锁', '—', 0, '·'],
  ['⚔', '未解锁', '—', 0, '·'],
  ['⚔', '未解锁', '—', 0, '·'],
  ['⚔', '等级 1', '3/8', 38, '·'],
  ['🏰', '未解锁', '—', 0, '·'],
  ['⚔', '等级 2', '4/8', 50, '·'],
  ['⚔', '未解锁', '—', 0, '·'],
  ['⚔', '等级 1', '2/8', 25, '·'],
  ['⛏', '未解锁', '—', 0, '·'],
  ['⚔', '等级 1', '1/8', 13, '·'],
  ['⚔', '未解锁', '—', 0, '·'],
  ['⚔', '等级 1', '6/8', 75, '·'],
  ['⚔', '未解锁', '—', 0, '·'],
  ['⚔', '等级 2', '3/8', 38, '·'],
  ['⚔', '未解锁', '—', 0, '·']
]
for (let i = 0; i < album.length; i++) {
  const x = 31 + (i % 4) * 176
  const y = 795 + Math.floor(i / 4) * 240
  const [t, lv, frag, prog, up] = album[i]
  const overrides = {}
  if (t !== '⛏') overrides['配型'] = t
  if (lv !== '等级 1') overrides['等级'] = lv
  if (frag !== '0/4') overrides['碎片'] = frag
  if (prog !== 0) overrides['进度'] = prog
  if (up !== '·') overrides['可升级'] = up
  await tryStep(`图鉴卡${i + 1} (${x},${y}) ${t} ${lv} ${frag}`, async () => {
    await addInstance('游戏卡牌', x, y, `图鉴卡${i + 1}`, overrides)
  })
}

// ================= 9. 保存 + 结构校验（只读）+ 截图 =================
await tryStep('保存工程 examples/卡牌.uiw', async () => {
  const pt = await evalJs(`(() => { const r = document.querySelector('.canvas-svg').getBoundingClientRect(); const v = window.__uiw.getState().viewport; return { x: r.x + v.panX - 60 * v.zoom, y: r.y + v.panY - 60 * v.zoom } })()`)
  await ui.click(pt.x, pt.y); await sleep(120)
  await evalJs(`(async () => { const s = window.__uiw.getState(); const path = await window.api.saveProject({ content: JSON.stringify(s.doc, null, 2), knownPath: '/Users/huangwei/ui-designer/examples/卡牌.uiw' }); if (path) s.markSaved(path); return true })()`)
  await sleep(700)
  const st = await evalJs(`(() => { const s = window.__uiw.getState(); return { dirty: s.dirty, fp: s.filePath } })()`)
  if (st.dirty || !st.fp) throw new Error('保存状态 ' + JSON.stringify(st))
})
{
  const st = await evalJs(`(() => {
    const s = window.__uiw.getState(); const d = s.doc
    const nav = d.pages[0].nodes[0]
    const filter = nav.pages[1].find(n => n.type === 'filter')
    const tab = nav.pages[1].find(n => n.name === '卡牌分类')
    const scroll = tab?.pages[0].find(n => n.type === 'scroll')
    const deckCards = nav.pages[1].filter(n => n.type === 'custom' && /^卡牌\\d+$/.test(n.name))
    return {
      defs: d.customWidgets.map(w => w.name + '(' + w.props.map(p => p.name).join('/') + ')'),
      common: d.commonLayer.nodes.length,
      roots: d.pages[0].nodes.length,
      navTabs: nav.props.tabs, navActive: nav.activeTab, navPages: nav.pages.map(p => p.length),
      filter: filter ? { options: filter.props.options, selected: filter.props.selected } : null,
      deckCards: deckCards.length,
      power: nav.pages[1].filter(n => n.name === '战力条' || n.name === '战力值' || n.name === '兵种统计').length,
      tab: tab ? { tabs: tab.props.tabs, bar: tab.props.barPosition, active: tab.activeTab, pages: tab.pages.map(p => p.length) } : null,
      scrollKids: scroll ? scroll.children.length : 0,
      scrollKidsCustom: scroll ? scroll.children.filter(c => c.type === 'custom').length : 0,
      upArrow: nav.pages[1].concat(scroll?.children ?? []).filter(c => c.overrides?.['可升级'] === '⬆').length
    }
  })()`)
  console.log(JSON.stringify(st, null, 1))
  const assert = (cond, msg) => { if (!cond) failures.push('校验: ' + msg); }
  assert(st.defs[0] === '游戏卡牌(配型/等级/进度/碎片/可升级)', '定制控件定义')
  assert(st.roots === 1, '页面根仅 底部导航 一个节点')
  assert(st.navTabs?.join() === '商店,卡牌,战斗,城堡,成就' && st.navActive === 1, '底部导航')
  assert(st.navPages?.join() === '0,13,0,0,0', '底部导航页签内容(仅卡牌实现)')
  assert(st.filter?.options.join() === '牌组,1,2,3,4,5' && st.filter.selected === 1, '牌组筛选器')
  assert(st.deckCards === 8, '牌组 8 张定制控件卡')
  assert(st.power === 3, '战力/兵种统计 3 控件')
  assert(st.tab?.tabs.join() === '所有卡牌,神器,宝箱,表情' && st.tab.bar === 'bottom' && st.tab.active === 0, '卡牌分类 TabView')
  assert(st.tab?.pages.join() === '1,0,0,0', '卡牌分类页签(仅所有卡牌实现)')
  assert(st.scrollKidsCustom === 16, '滚动区 16 张定制控件卡')
  assert(st.upArrow === 2, '可升级标识 2 处')
}

mkdirSync('/tmp/card-shots', { recursive: true })
const shot = async (file) => {
  const pt = await evalJs(`(() => { const r = document.querySelector('.canvas-svg').getBoundingClientRect(); const v = window.__uiw.getState().viewport; return { x: r.x + v.panX - 60 * v.zoom, y: r.y + v.panY - 60 * v.zoom } })()`)
  await ui.click(pt.x, pt.y); await sleep(100)
  const rect = await evalJs(`(() => { const r = document.querySelector('.canvas-wrap').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height } })()`)
  const s = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { ...rect, scale: 2 } })
  writeFileSync(file, Buffer.from(s.data, 'base64'))
  log('📸 ' + file)
}
await tryStep('截图 卡牌页', async () => { await shot('/tmp/card-shots/cards-page.png') })
await tryStep('截图 公共层', async () => {
  await clickPage('公共层')
  await sleep(200)
  await shot('/tmp/card-shots/common.png')
  await clickPage('卡牌页')
  await sleep(150)
})

{
  const ov = await readOverview()
  log(`完成：公共层 ${ov.common} 控件；定制控件 ${ov.customs}；弹窗记录 ${JSON.stringify(dialogLog)}；累计界面操作 ${ui.ops.count} 次`)
}
console.log(failures.length ? 'BUILD-DONE-WITH-FAILURES:\n' + failures.map(f => '  ✗ ' + f).join('\n') : 'BUILD-OK')
process.exit(failures.length ? 1 : 0)
