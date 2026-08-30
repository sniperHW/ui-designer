// 结构校验（只读）+ 逐页签截图：通过图层树/页签按钮切换，CDP 截图画布区域
import { connect, makeUI } from './driver.mjs'
import { writeFileSync, mkdirSync } from 'fs'

const { call, evalJs, sleep } = await connect(9222)
const ui = makeUI({ call, evalJs, sleep })

// ---------- 结构校验（只读） ----------
const tree = await evalJs(`(() => {
  const s = window.__uiw.getState()
  const d = s.doc
  const brief = (n) => ({ t: n.type, n: n.name, x: n.x, y: n.y, w: n.w, h: n.h, tabs: n.props.tabs, bar: n.props.barPosition, active: n.activeTab,
    kids: n.children?.length, pages: n.pages?.map(p => p.length),
    names: n.pages?.map(p => p.map(c => c.name).join('|')) })
  const nav = d.pages[0].nodes[0]
  const shop = nav.pages[0].find(n => n.name === '商店分类')
  const cards = nav.pages[1].find(n => n.name === '卡牌子页签')
  const tShop = shop.pages[0].find(n => n.name === '特卖滚动区')
  const base = shop.pages[1].find(n => n.name === '基础滚动区')
  const deck = cards.pages[0].find(n => n.name === '卡组滚动区')
  const rank = nav.pages[3].find(n => n.name === '榜单滚动区')
  return {
    common: d.commonLayer.nodes.length,
    nav: brief(nav), shop: brief(shop), cards: brief(cards),
    tSale: tShop?.children?.length, base: base?.children?.length,
    deck: deck?.children?.length, deckPage: cards.pages.slice(1).map(p => p.length),
    rank: rank?.children?.length, rankSelf: nav.pages[3].length
  }
})()`)
console.log(JSON.stringify(tree, null, 1))

// ---------- 截图 ----------
mkdirSync('/tmp/arena-shots', { recursive: true })
const switchTab = async (nodeName, btnNo) => {
  const r = await evalJs(`(() => { const el = [...document.querySelectorAll('.layer-row')].find(x => x.querySelector('.layer-name')?.textContent?.trim() === ${JSON.stringify(nodeName)}); if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
  if (!r) throw new Error('图层行未找到 ' + nodeName)
  await ui.click(r.x, r.y); await sleep(80)
  const b = await evalJs(`(() => { const row = [...document.querySelectorAll('.prop-row')].find(r => r.querySelector(':scope>span')?.textContent?.trim() === '当前页签'); const btn = row && [...row.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(String(btnNo))}); if (!btn) return null; const r = btn.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
  if (!b) throw new Error('当前页签按钮未找到')
  await ui.click(b.x, b.y); await sleep(120)
}
const shotCanvas = async (file) => {
  // 点画布空白取消选择，避免截图带选择框
  const pt = await evalJs(`(() => { const r = document.querySelector('.canvas-svg').getBoundingClientRect(); const v = window.__uiw.getState().viewport; return { x: r.x + v.panX - 60 * v.zoom, y: r.y + v.panY - 60 * v.zoom } })()`)
  await ui.click(pt.x, pt.y); await sleep(100)
  const rect = await evalJs(`(() => { const r = document.querySelector('.canvas-wrap').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height } })()`)
  const shot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { ...rect, scale: 2 } })
  writeFileSync(file, Buffer.from(shot.data, 'base64'))
  console.log('📸', file)
}
for (const [i, name] of [[1, 'shop'], [2, 'cards'], [3, 'battle'], [4, 'rank']]) {
  await switchTab('底部导航', i)
  await shotCanvas(`/tmp/arena-shots/tab-${name}.png`)
}
await switchTab('底部导航', 3)
// 公共层单独截一张（页面列表 → 公共层）
const cr = await evalJs(`(() => { const el = document.querySelector('.common-row'); el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
await ui.click(cr.x, cr.y); await sleep(200)
await shotCanvas('/tmp/arena-shots/common.png')
// 回到页面 1
const pr = await evalJs(`(() => { const el = [...document.querySelectorAll('.page-row')].find(r => r.querySelector('.page-name')?.textContent?.includes('主界面')); el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
await ui.click(pr.x, pr.y); await sleep(150)
console.log('SHOTS-OK')
