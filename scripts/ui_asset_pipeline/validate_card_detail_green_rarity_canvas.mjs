/** 绿色稀有度色层候选的真实画布验收。 */
import { readFileSync } from 'node:fs'

const DEBUG_BASE = 'http://127.0.0.1:9222'
const POPUP_NAME = '卡面细节展示（绿色）'
const POPUP_ID = 'ppmtv84xe0zm19'
function fail(message) { throw new Error(message) }

async function main() {
  const [file] = process.argv.slice(2)
  if (!file) fail('用法：node scripts/ui_asset_pipeline/validate_card_detail_green_rarity_canvas.mjs <绿色候选.uiw>')
  const content = readFileSync(file, 'utf8')
  const targets = await (await fetch(`${DEBUG_BASE}/json`)).json()
  const page = targets.find((item) => item.type === 'page' && item.url.includes('localhost:5173'))
  if (!page) fail('未找到带 9222 调试端口的设计器页面；请先启动 UIW_DEBUG_PORT=9222 npm run dev')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })
  let sequence = 0
  const pending = new Map()
  ws.onmessage = (event) => { const message = JSON.parse(event.data); if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id) } }
  const call = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, (message) => message.error ? reject(new Error(`${method}: ${message.error.message}`)) : resolve(message.result)); ws.send(JSON.stringify({ id, method, params })) })
  const evaluate = async (expression) => { const result = await call('Runtime.evaluate', { expression, returnByValue: true }); if (result.exceptionDetails) fail(`画布执行失败：${expression.slice(0, 100)}`); return result.result.value }
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
  const click = async (x, y) => { await call('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 }); await call('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 1, clickCount: 1 }) }
  await evaluate(`(() => window.__uiw.getState().loadProject(JSON.parse(${JSON.stringify(content)}), ${JSON.stringify(file)}))()`)
  await sleep(350)
  const row = await evaluate(`(() => { const item = [...document.querySelectorAll('.page-row.popup-row')].find((element) => element.textContent.includes(${JSON.stringify(POPUP_NAME)})); if (!item) return null; item.scrollIntoView({block:'center'}); const rect=item.getBoundingClientRect(); return {x:rect.x+rect.width/2,y:rect.y+rect.height/2} })()`)
  if (!row) fail('画布中未找到绿色卡面细节弹窗入口')
  await click(row.x, row.y)
  await sleep(300)
  const result = await evaluate(`(() => {
    const state=window.__uiw.getState(), canvas=document.querySelector('.canvas-svg')
    const popup=state.doc.popups.find((item)=>item.id===${JSON.stringify(POPUP_ID)})
    const imageCount=(id)=>canvas.querySelector('[data-id="'+id+'"]')?.querySelectorAll('image[href^="data:image/png;base64,"]').length??0
    const text=(id)=>canvas.querySelector('[data-id="'+id+'"]')?.textContent?.trim()??''
    return {
      activePopup:state.doc.popups.find((item)=>item.id===state.editingPopupId)?.name??'',
      nodeCount:popup?.nodes.length??0,
      blueIds:(popup?.nodes??[]).filter((node)=>node.id.includes('blue')).map((node)=>node.id),
      frame:imageCount('detail-green-rarity-card-frame'),
      titleAccent:imageCount('detail-green-rarity-title-accent'),
      xpFrame:imageCount('detail-green-rarity-xp-frame'),
      shell:imageCount('detail-green-shell'), power:imageCount('detail-green-power-bar'), close:imageCount('detail-green-close'), tray:imageCount('detail-green-skills-tray'), reset:imageCount('detail-green-reset'),
      portrait:imageCount('detail-green-portrait'),
      text:[text('detail-green-title'),text('detail-green-power'),text('detail-green-level'),text('detail-green-rarity'),text('detail-green-xp')],
      visibleImages:[...canvas.querySelectorAll('image[href^="data:image/png;base64,"]')].filter((image)=>{const rect=image.getBoundingClientRect();return rect.width>1&&rect.height>1&&rect.right>0&&rect.bottom>0}).length
    }
  })()`)
  const checks = [
    ['切入绿色详情弹窗页', result.activePopup === POPUP_NAME, `active=${result.activePopup}`],
    ['保留原 49 节点并新增三处色层', result.nodeCount === 52, `count=${result.nodeCount}`],
    ['无蓝色节点标识残留', result.blueIds.length === 0, `ids=${result.blueIds.join(',')}`],
    ['绿色卡框与两处辅助色层', result.frame === 1 && result.titleAccent === 1 && result.xpFrame === 1, `frame=${result.frame}, title=${result.titleAccent}, xp=${result.xpFrame}`],
    ['原九宫格与大卡面均未被替换', result.shell === 9 && result.power === 9 && result.close === 9 && result.tray === 9 && result.reset === 9 && result.portrait === 1, `shell=${result.shell}, power=${result.power}, close=${result.close}, tray=${result.tray}, reset=${result.reset}, portrait=${result.portrait}`],
    ['原运行时示例文本保持可审查', result.text.join('|') === '矿工|战力：46|等级 1|普通卡牌|175/490', `text=${result.text.join('|')}`],
    ['新增色层后全部素材仍可见', result.visibleImages === 180, `visible=${result.visibleImages}`]
  ]
  for (const [name, passed, detail] of checks) { console.log(`${passed ? '✓' : '✗'} ${name}：${detail}`); if (!passed) process.exitCode = 1 }
  ws.close()
}
main().catch((error) => { console.error(`✗ ${error.message}`); process.exitCode = 1 })
