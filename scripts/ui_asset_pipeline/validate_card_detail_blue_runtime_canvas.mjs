/** 蓝色卡牌详情运行时合同的真实画布验收。 */
import { readFileSync } from 'node:fs'

const DEBUG_BASE = 'http://127.0.0.1:9222'
const POPUP_NAME = '卡面细节展示（蓝色）'
const POPUP_ID = 'ppmtwmxwlmjjf1'

function fail(message) { throw new Error(message) }

async function main() {
  const [file] = process.argv.slice(2)
  if (!file) fail('用法：node scripts/ui_asset_pipeline/validate_card_detail_blue_runtime_canvas.mjs <蓝色候选.uiw>')
  const content = readFileSync(file, 'utf8')
  const targets = await (await fetch(`${DEBUG_BASE}/json`)).json()
  const page = targets.find((item) => item.type === 'page' && item.url.includes('localhost:5173'))
  if (!page) fail('未找到带 9222 调试端口的设计器页面；请先启动 UIW_DEBUG_PORT=9222 npm run dev')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })
  let sequence = 0
  const pending = new Map()
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data)
    if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id) }
  }
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence
    pending.set(id, (message) => message.error ? reject(new Error(`${method}: ${message.error.message}`)) : resolve(message.result))
    ws.send(JSON.stringify({ id, method, params }))
  })
  const evaluate = async (expression) => {
    const result = await call('Runtime.evaluate', { expression, returnByValue: true })
    if (result.exceptionDetails) fail(`画布执行失败：${expression.slice(0, 100)}`)
    return result.result.value
  }
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
  const click = async (x, y) => {
    await call('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 })
    await call('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 1, clickCount: 1 })
  }

  await evaluate(`(() => window.__uiw.getState().loadProject(JSON.parse(${JSON.stringify(content)}), ${JSON.stringify(file)}))()`)
  await sleep(350)
  const row = await evaluate(`(() => {
    const item = [...document.querySelectorAll('.page-row.popup-row')].find((element) => element.textContent.includes(${JSON.stringify(POPUP_NAME)}))
    if (!item) return null
    item.scrollIntoView({ block: 'center' })
    const rect = item.getBoundingClientRect()
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
  })()`)
  if (!row) fail('画布中未找到蓝色卡面细节弹窗入口')
  await click(row.x, row.y)
  await sleep(300)

  const result = await evaluate(`(() => {
    const state = window.__uiw.getState()
    const canvas = document.querySelector('.canvas-svg')
    const popup = state.doc.popups.find((item) => item.id === ${JSON.stringify(POPUP_ID)})
    const byId = (id) => canvas.querySelector('[data-id="' + id + '"]')
    const pngCount = (id) => byId(id)?.querySelectorAll('image[href^="data:image/png;base64,"]').length ?? 0
    const text = (id) => byId(id)?.textContent?.trim() ?? ''
    const dynamic = popup?.nodes.filter((node) => node.props?.runtimeBinding) ?? []
    const blueIds = popup?.nodes.map((node) => node.id) ?? []
    return {
      activePopup: state.doc.popups.find((item) => item.id === state.editingPopupId)?.name ?? '',
      nodeCount: popup?.nodes.length ?? 0,
      dynamicCount: dynamic.length,
      greenIds: blueIds.filter((id) => id.includes('green')),
      shell: pngCount('detail-blue-shell'),
      power: pngCount('detail-blue-power-bar'),
      close: pngCount('detail-blue-close'),
      tray: pngCount('detail-blue-skills-tray'),
      reset: pngCount('detail-blue-reset'),
      share: pngCount('detail-blue-share'),
      rarityFrame: pngCount('detail-blue-rarity-card-frame'),
      rarityTitleAccent: pngCount('detail-blue-rarity-title-accent'),
      rarityXpFrame: pngCount('detail-blue-rarity-xp-frame'),
      propertyTiles: [1,2,3,4,5,6].map((index) => pngCount('detail-blue-prop-' + index + '-bg')),
      dynamicText: ['detail-blue-title','detail-blue-power','detail-blue-level','detail-blue-rarity','detail-blue-xp','detail-blue-prop-1-text','detail-blue-prop-6-text','detail-blue-upgrade-cost'].map((id) => text(id)),
      dynamicImagePngCounts: ['detail-blue-portrait','detail-blue-type-icon','detail-blue-race-icon','detail-blue-prop-1-icon','detail-blue-prop-6-icon'].map(pngCount),
      dialogBinding: popup?.nodes.find((node) => node.type === 'dialog')?.props?.runtimeBinding ?? null,
      xpBinding: popup?.nodes.find((node) => node.id === 'detail-blue-xp-bar')?.props?.runtimeBinding ?? null
    }
  })()`)
  const checks = [
    ['切入蓝色详情弹窗页', result.activePopup === POPUP_NAME, `active=${result.activePopup}`],
    ['复用 49 个结构节点并新增三处稀有度色层', result.nodeCount === 52, `count=${result.nodeCount}`],
    ['运行时绑定节点齐全', result.dynamicCount === 32, `count=${result.dynamicCount}`],
    ['无绿色节点标识残留', result.greenIds.length === 0, `ids=${result.greenIds.join(',')}`],
    ['通用外壳保持九宫格', result.shell === 9, `slice=${result.shell}`],
    ['战力板、关闭、托盘与重制素材复用', result.power === 9 && result.close === 9 && result.tray === 9 && result.reset === 9, `power=${result.power}, close=${result.close}, tray=${result.tray}, reset=${result.reset}`],
    ['分享透明图标复用', result.share === 1, `image=${result.share}`],
    ['蓝色稀有度主框与两处辅助色层', result.rarityFrame === 1 && result.rarityTitleAccent === 1 && result.rarityXpFrame === 1,
      `frame=${result.rarityFrame}, title=${result.rarityTitleAccent}, xp=${result.rarityXpFrame}`],
    ['六个属性格均复用九宫格', result.propertyTiles.every((count) => count === 9), `slices=${result.propertyTiles.join(',')}`],
    ['运行时文字显示为绑定令牌', result.dynamicText.every((value) => value.startsWith('{{') && value.endsWith('}}')), `text=${result.dynamicText.join('|')}`],
    ['运行时卡牌图片未误用绿色样例素材', result.dynamicImagePngCounts.every((count) => count === 0), `image=${result.dynamicImagePngCounts.join(',')}`],
    ['蓝色稀有度守卫存在', result.dialogBinding?.guard === 'selectedCard.rarity === "blue"', `binding=${JSON.stringify(result.dialogBinding)}`],
    ['经验条由运行时进度驱动', result.xpBinding?.path === 'xp.progressPercent', `binding=${JSON.stringify(result.xpBinding)}`]
  ]
  for (const [name, passed, detail] of checks) {
    console.log(`${passed ? '✓' : '✗'} ${name}：${detail}`)
    if (!passed) process.exitCode = 1
  }
  ws.close()
}

main().catch((error) => { console.error(`✗ ${error.message}`); process.exitCode = 1 })
