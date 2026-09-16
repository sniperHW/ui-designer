/** Read-only CDP diagnostics for the rendered green-card power-bar slices. */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const [screenshotPath] = process.argv.slice(2)
const targets = await (await fetch('http://127.0.0.1:9222/json')).json()
const target = targets.find((item) => item.type === 'page' && item.url.includes('localhost:5173'))
if (!target) throw new Error('未找到带 9222 调试端口的设计器页面')
const socket = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject })
let sequence = 0
const pending = new Map()
socket.onmessage = (event) => {
  const message = JSON.parse(event.data)
  if (pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id) }
}
const call = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence
  pending.set(id, (message) => message.error ? reject(new Error(message.error.message)) : resolve(message.result))
  socket.send(JSON.stringify({ id, method, params }))
})
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const rowResult = await call('Runtime.evaluate', {
  expression: `(() => {
    const item = [...document.querySelectorAll('.page-row.popup-row')]
      .find((element) => element.textContent.includes('卡面细节展示（绿色）'))
    if (!item) return null
    item.scrollIntoView({ block: 'center' })
    const rect = item.getBoundingClientRect()
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
  })()`, returnByValue: true
})
const row = rowResult.result.value
if (!row) throw new Error('未找到绿色详情弹窗页入口')
await call('Input.dispatchMouseEvent', { type: 'mousePressed', x: row.x, y: row.y, button: 'left', buttons: 1, clickCount: 1 })
await call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: row.x, y: row.y, button: 'left', buttons: 1, clickCount: 1 })
await sleep(250)
const expression = `(() => {
  const canvas = document.querySelector('.canvas-svg')
  const bar = canvas?.querySelector('[data-id="detail-green-power-bar"]')
  const rect = (element) => element?.getBoundingClientRect().toJSON()
  return {
    meta: window.__uiw.getState().doc.meta.name,
    canvasRect: rect(canvas),
    canvasTransform: getComputedStyle(canvas).transform,
    barRect: rect(bar),
    textColors: ['detail-green-title', 'detail-green-power', 'detail-green-level', 'detail-green-rarity', 'detail-green-xp']
      .map((id) => {
        const group = canvas?.querySelector('[data-id="' + id + '"]')
        const text = group?.querySelector('text')
        return { id, fill: text?.getAttribute('fill'), styleFill: text ? getComputedStyle(text).fill : null }
      }),
    slices: [...bar?.querySelectorAll('image') ?? []].map((image) => ({
      rect: rect(image), x: image.getAttribute('x'), y: image.getAttribute('y'),
      width: image.getAttribute('width'), height: image.getAttribute('height')
    }))
  }
})()`
const result = await call('Runtime.evaluate', { expression, returnByValue: true })
console.log(JSON.stringify(result.result.value, null, 2))
if (screenshotPath) {
  const captured = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  const output = resolve(screenshotPath)
  mkdirSync(dirname(output), { recursive: true })
  writeFileSync(output, Buffer.from(captured.data, 'base64'))
  console.log(`已输出真实画布截图：${screenshotPath}`)
}
socket.close()
