/** 绿色详情黑底湖蓝经验条的真实画布验收。 */
import { readFileSync } from 'node:fs'

const DEBUG_BASE = 'http://127.0.0.1:9222'
function fail(message) { throw new Error(message) }

async function main() {
  const [file] = process.argv.slice(2)
  if (!file) fail('用法：node scripts/ui_asset_pipeline/validate_card_detail_green_xp_canvas.mjs <绿色候选.uiw>')
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
  const row = await evaluate(`(() => { const item=[...document.querySelectorAll('.page-row.popup-row')].find((element)=>element.textContent.includes('卡面细节展示（绿色）')); if(!item)return null; item.scrollIntoView({block:'center'}); const rect=item.getBoundingClientRect(); return {x:rect.x+rect.width/2,y:rect.y+rect.height/2} })()`)
  if (!row) fail('画布中未找到绿色详情弹窗入口')
  await click(row.x, row.y)
  await sleep(300)
  const result = await evaluate(`(() => {
    const state=window.__uiw.getState(), canvas=document.querySelector('.canvas-svg')
    const popup=state.doc.popups.find((item)=>item.id==='ppmtv84xe0zm19')
    const xp=popup?.nodes.find((item)=>item.id==='detail-green-xp-bar')
    const xpDom=canvas.querySelector('[data-id="detail-green-xp-bar"]')
    const imageCount=(id)=>canvas.querySelector('[data-id="'+id+'"]')?.querySelectorAll('image[href^="data:image/png;base64,"]').length??0
    return {
      activePopup:state.doc.popups.find((item)=>item.id===state.editingPopupId)?.name??'',
      nodeCount:popup?.nodes.length??0,
      xpProps:xp?.props??{},
      xpImages:xpDom?.querySelectorAll('image[href^="data:image/png;base64,"]').length??0,
      xpClipWidth:xpDom?.querySelector('clipPath rect')?.getAttribute('width')??'',
      shell:imageCount('detail-green-shell'), power:imageCount('detail-green-power-bar'), portrait:imageCount('detail-green-portrait'),
      visibleImages:[...canvas.querySelectorAll('image[href^="data:image/png;base64,"]')].filter((image)=>{const rect=image.getBoundingClientRect();return rect.width>1&&rect.height>1&&rect.right>0&&rect.bottom>0}).length
    }
  })()`)
  const checks = [
    ['切入绿色详情弹窗页', result.activePopup === '卡面细节展示（绿色）', `active=${result.activePopup}`],
    ['保留绿色 v29 的 49 节点层级', result.nodeCount === 49, `count=${result.nodeCount}`],
    ['黑底与湖蓝填充均由进度控件渲染', result.xpImages === 2 && !!result.xpProps.assetSrc && !!result.xpProps.assetFillSrc, `images=${result.xpImages}`],
    ['35% 进度真实裁切湖蓝填充', result.xpProps.progress === 35 && Number(result.xpClipWidth) === 207.2, `progress=${result.xpProps.progress}, clip=${result.xpClipWidth}`],
    ['既有外壳、战力板与大卡面保持原样', result.shell === 9 && result.power === 9 && result.portrait === 1, `shell=${result.shell}, power=${result.power}, portrait=${result.portrait}`],
    ['黑底湖蓝条加入后素材全部可见', result.visibleImages === 179, `visible=${result.visibleImages}`]
  ]
  for (const [name, passed, detail] of checks) { console.log(`${passed ? '✓' : '✗'} ${name}：${detail}`); if (!passed) process.exitCode = 1 }
  ws.close()
}
main().catch((error) => { console.error(`✗ ${error.message}`); process.exitCode = 1 })
