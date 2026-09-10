/** Load a UIW into the local design renderer and save a real renderer screenshot.
 *
 * This is deliberately a generic visual gate: it lets a stage validate the
 * same UIW tree that the desktop tool presents, instead of relying on a raw
 * PNG or a structural JSON check alone.
 */
import fs from 'node:fs'
import path from 'node:path'

const [uiwPath, outputPath, endpoint = 'ws://127.0.0.1:9222'] = process.argv.slice(2)
if (!uiwPath || !outputPath) {
  throw new Error('Usage: node debug_render_uiw.mjs <uiw-path> <png-output> [debug-endpoint]')
}

const targets = await (await fetch(`${endpoint.replace('ws://', 'http://')}/json/list`)).json()
const target = targets.find(item => item.type === 'page' && item.webSocketDebuggerUrl)
if (!target) throw new Error('No debug-renderer page found')

const socket = new WebSocket(target.webSocketDebuggerUrl)
const pending = new Map()
let sequence = 0
socket.onmessage = event => {
  const message = JSON.parse(event.data)
  const resolve = pending.get(message.id)
  if (resolve) {
    pending.delete(message.id)
    resolve(message)
  }
}
await new Promise((resolve, reject) => {
  socket.onopen = resolve
  socket.onerror = reject
})
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence
  pending.set(id, message => message.error ? reject(new Error(message.error.message)) : resolve(message.result))
  socket.send(JSON.stringify({ id, method, params }))
})

const absolutePath = path.resolve(uiwPath)
const source = fs.readFileSync(absolutePath, 'utf8')
const expression = `(async () => {
  const module = await import('/src/store/editorStore.ts')
  module.useEditor.getState().loadProject(${source}, ${JSON.stringify(absolutePath)})
  await new Promise(resolve => setTimeout(resolve, 120))
  return module.useEditor.getState().doc.meta.name
})()`
const loaded = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
if (loaded.exceptionDetails) throw new Error(loaded.exceptionDetails.text)
await new Promise(resolve => setTimeout(resolve, 350))
const captured = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true })
fs.writeFileSync(outputPath, Buffer.from(captured.data, 'base64'))
socket.close()
console.log(`Rendered ${loaded.result?.value ?? path.basename(uiwPath)} -> ${outputPath}`)
