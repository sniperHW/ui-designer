/**
 * 卡面细节外壳的真实画布验收。
 *
 * Electron 的“打开工程”是原生文件选择器，CDP 无法为其填路径；因此仅以
 * 应用自身的 loadProject 流程装入候选，随后通过真实鼠标事件切入弹窗页，
 * 检查画布中外壳、属性格九宫格及其上层大卡面。此脚本不改写任何工程文件或素材。
 */
import { readFileSync } from 'node:fs'

const DEBUG_BASE = 'http://127.0.0.1:9222'

function fail(message) {
  throw new Error(message)
}

async function main() {
  const [file] = process.argv.slice(2)
  if (!file) fail('用法：node scripts/ui_asset_pipeline/validate_card_detail_shell_canvas.mjs <候选.uiw>')
  const content = readFileSync(file, 'utf8')
  const targets = await (await fetch(`${DEBUG_BASE}/json`)).json()
  const page = targets.find((item) => item.type === 'page' && item.url.includes('localhost:5173'))
  if (!page) fail('未找到带 9222 调试端口的设计器页面；请先启动 UIW_DEBUG_PORT=9222 npm run dev')

  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.onopen = resolve
    ws.onerror = reject
  })
  let seq = 0
  const pending = new Map()
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data)
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message)
      pending.delete(message.id)
    }
  }
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq
    pending.set(id, (message) => (message.error ? reject(new Error(`${method}: ${message.error.message}`)) : resolve(message.result)))
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

  // 仅执行应用既有的装载动作；之后切换弹窗页走真实鼠标输入。
  await evaluate(`(() => window.__uiw.getState().loadProject(JSON.parse(${JSON.stringify(content)}), ${JSON.stringify(file)}))()`)
  await sleep(350)
  const row = await evaluate(`(() => {
    const item = [...document.querySelectorAll('.page-row.popup-row')]
      .find((element) => element.textContent.includes('卡面细节展示（绿色）'))
    if (!item) return null
    item.scrollIntoView({ block: 'center' })
    const rect = item.getBoundingClientRect()
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
  })()`)
  if (!row) fail('画布中未找到绿色卡面细节弹窗入口')
  await click(row.x, row.y)
  await sleep(300)

  const result = await evaluate(`(() => {
    const state = window.__uiw.getState()
    const title = document.querySelector('.statusbar')?.textContent ?? ''
    const canvas = document.querySelector('.canvas-svg')
    const shell = canvas.querySelector('[data-id="detail-green-shell"]')
    const portrait = canvas.querySelector('[data-id="detail-green-portrait"]')
    const skillsTray = canvas.querySelector('[data-id="detail-green-skills-tray"]')
    const powerBar = canvas.querySelector('[data-id="detail-green-power-bar"]')
    const close = canvas.querySelector('[data-id="detail-green-close"]')
    const share = canvas.querySelector('[data-id="detail-green-share"]')
    const reset = canvas.querySelector('[data-id="detail-green-reset"]')
    const box = (element) => {
      if (!element) return null
      const { x, y, width, height } = element.getBBox()
      return { x, y, width, height }
    }
    const contrastTextIds = ['detail-green-title', 'detail-green-power', 'detail-green-level', 'detail-green-rarity', 'detail-green-xp']
    const contrastTextColors = contrastTextIds.map((id) => canvas.querySelector('[data-id="' + id + '"] text')?.getAttribute('fill') ?? '')
    const skillSlots = [1, 2, 3, 4, 5].map((index) => canvas.querySelector('[data-id="detail-green-skill-' + index + '"]'))
    const skillLocks = [4, 5].map((index) => canvas.querySelector('[data-id="detail-green-skill-' + index + '-lock"]'))
    const upgrade = canvas.querySelector('[data-id="detail-green-upgrade"]')
    const equip = canvas.querySelector('[data-id="detail-green-equip"]')
    const typeBadge = canvas.querySelector('[data-id="detail-green-type-badge"]')
    const raceBadge = canvas.querySelector('[data-id="detail-green-race-badge"]')
    const identityIcons = ['detail-green-type-icon', 'detail-green-race-icon', 'detail-green-upgrade-cost-icon']
      .map((id) => canvas.querySelector('[data-id="' + id + '"]'))
    const propertyIconNodes = [...canvas.querySelectorAll('[data-id^="detail-green-prop-"][data-id$="-icon"]')]
    const propertyTiles = [...canvas.querySelectorAll('[data-id^="detail-green-prop-"][data-id$="-bg"]')]
    const shellImages = [...shell?.querySelectorAll('image[href^="data:image/png;base64,"]') ?? []]
    const portraitImages = [...portrait?.querySelectorAll('image[href^="data:image/png;base64,"]') ?? []]
    const skillsTrayImages = [...skillsTray?.querySelectorAll('image[href^="data:image/png;base64,"]') ?? []]
    const powerBarImages = [...powerBar?.querySelectorAll('image[href^="data:image/png;base64,"]') ?? []]
    const closeImages = [...close?.querySelectorAll('image[href^="data:image/png;base64,"]') ?? []]
    const shareImages = [...share?.querySelectorAll('image[href^="data:image/png;base64,"]') ?? []]
    const resetImages = [...reset?.querySelectorAll('image[href^="data:image/png;base64,"]') ?? []]
    const skillSlotImages = skillSlots.flatMap((slot) => [...slot?.querySelectorAll('image[href^="data:image/png;base64,"]') ?? []])
    const skillLockImages = skillLocks.flatMap((lock) => [...lock?.querySelectorAll('image[href^="data:image/png;base64,"]') ?? []])
    const upgradeImages = [...upgrade?.querySelectorAll('image[href^="data:image/png;base64,"]') ?? []]
    const equipImages = [...equip?.querySelectorAll('image[href^="data:image/png;base64,"]') ?? []]
    const identityBadgeImages = [typeBadge, raceBadge].flatMap((badge) => [...badge?.querySelectorAll('image[href^="data:image/png;base64,"]') ?? []])
    const identityIconImages = identityIcons.flatMap((icon) => [...icon?.querySelectorAll('image[href^="data:image/png;base64,"]') ?? []])
    const propertyIconImages = propertyIconNodes.flatMap((icon) => [...icon.querySelectorAll('image[href^="data:image/png;base64,"]')])
    const propertyImages = propertyTiles.flatMap((tile) => [...tile.querySelectorAll('image[href^="data:image/png;base64,"]')])
    const dataImages = [...canvas.querySelectorAll('image[href^="data:image/png;base64,"]')]
    const visibleImages = dataImages.filter((image) => {
      const rect = image.getBoundingClientRect()
      return rect.width > 1 && rect.height > 1 && rect.right > 0 && rect.bottom > 0
    })
    const nestedSlices = [...shell?.querySelectorAll('svg') ?? []]
      .filter((svg) => svg.querySelector('image[href^="data:image/png;base64,"]')).length
    const propertySlices = propertyTiles.flatMap((tile) => [...tile.querySelectorAll('svg')])
      .filter((svg) => svg.querySelector('image[href^="data:image/png;base64,"]')).length
    const skillsTraySlices = [...skillsTray?.querySelectorAll('svg') ?? []]
      .filter((svg) => svg.querySelector('image[href^="data:image/png;base64,"]')).length
    return {
      editingPopupId: state.editingPopupId,
      activePopup: state.doc.popups.find((popup) => popup.id === state.editingPopupId)?.name ?? '',
      status: title,
      dataImages: dataImages.length,
      visibleImages: visibleImages.length,
      shellImages: shellImages.length,
      portraitImages: portraitImages.length,
      skillsTrayImages: skillsTrayImages.length,
      powerBarImages: powerBarImages.length,
      closeImages: closeImages.length,
      shareImages: shareImages.length,
      resetImages: resetImages.length,
      shellBox: box(shell),
      powerBarBox: box(powerBar),
      contrastTextColors,
      skillSlotImages: skillSlotImages.length,
      skillLockImages: skillLockImages.length,
      upgradeImages: upgradeImages.length,
      upgradeText: upgrade?.textContent?.trim() ?? '',
      equipImages: equipImages.length,
      equipText: equip?.textContent?.trim() ?? '',
      identityBadgeImages: identityBadgeImages.length,
      identityIconImages: identityIconImages.length,
      propertyIconImages: propertyIconImages.length,
      propertyTiles: propertyTiles.length,
      propertyImages: propertyImages.length,
      nestedSlices,
      propertySlices,
      skillsTraySlices
    }
  })()`)
  const checks = [
    ['切入绿色详情弹窗页', result.activePopup === '卡面细节展示（绿色）', `active=${result.activePopup}`],
    ['九宫格切片数量', result.shellImages === 9 && result.nestedSlices === 9, `image=${result.shellImages}, slice=${result.nestedSlices}`],
    ['属性格复用同一底座', result.propertyTiles === 6 && result.propertyImages === 54 && result.propertySlices === 54,
      `tile=${result.propertyTiles}, image=${result.propertyImages}, slice=${result.propertySlices}`],
    ['技能托盘九宫格', result.skillsTrayImages === 9 && result.skillsTraySlices === 9,
      `image=${result.skillsTrayImages}, slice=${result.skillsTraySlices}`],
    ['战力横条九宫格', result.powerBarImages === 9, `image=${result.powerBarImages}`],
    ['外伸卡扣覆盖外壳竖向边框', result.shellBox?.x === result.powerBarBox?.x && result.shellBox?.width === result.powerBarBox?.width,
      `shell=${JSON.stringify(result.shellBox)}, power=${JSON.stringify(result.powerBarBox)}`],
    ['关闭按钮九宫格', result.closeImages === 9, `image=${result.closeImages}`],
    ['分享透明图标', result.shareImages === 1, `image=${result.shareImages}`],
    ['等级重制按钮九宫格', result.resetImages === 9, `image=${result.resetImages}`],
    ['五项相邻运行时文字高对比', result.contrastTextColors.length === 5 && result.contrastTextColors.every((fill) => fill === '#ffffff'), `fill=${result.contrastTextColors.join(',')}`],
    ['五个技能槽状态底框', result.skillSlotImages === 45, `image=${result.skillSlotImages}`],
    ['两个锁定状态图标', result.skillLockImages === 2, `image=${result.skillLockImages}`],
    ['升级按钮皮肤与运行时文字', result.upgradeImages === 1 && result.upgradeText.includes('升级'),
      `skin=${result.upgradeImages}, text=${result.upgradeText}`],
    ['装备按钮皮肤与运行时文字', result.equipImages === 1 && result.equipText.includes('装备'),
      `skin=${result.equipImages}, text=${result.equipText}`],
    ['身份徽章与透明图标', result.identityBadgeImages === 18 && result.identityIconImages === 3,
      `badge=${result.identityBadgeImages}, icon=${result.identityIconImages}`],
    ['六项属性透明图标', result.propertyIconImages === 6, `icon=${result.propertyIconImages}`],
    ['九宫格与卡面画布可见', result.visibleImages === 177, `visible=${result.visibleImages}`],
    ['大卡面画布可见', result.portraitImages === 1, `portrait=${result.portraitImages}`]
  ]
  for (const [name, passed, detail] of checks) {
    console.log(`${passed ? '✓' : '✗'} ${name}：${detail}`)
    if (!passed) process.exitCode = 1
  }
  ws.close()
}

main().catch((error) => {
  console.error(`✗ ${error.message}`)
  process.exitCode = 1
})
