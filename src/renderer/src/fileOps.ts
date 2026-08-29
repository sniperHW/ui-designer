import { useEditor } from './store/editorStore'
import { renderTreeSVG } from './widgets/registry'

/** 保存工程；as=true 强制弹另存为对话框 */
export async function doSave(as = false): Promise<void> {
  const s = useEditor.getState()
  const content = JSON.stringify(s.doc, null, 2)
  const path = as
    ? await window.api.saveProject({ content, defaultName: s.doc.meta.name + '.uiw' })
    : s.filePath
      ? await window.api.saveProject({ content, knownPath: s.filePath })
      : await window.api.saveProject({ content, defaultName: s.doc.meta.name + '.uiw' })
  if (path) useEditor.getState().markSaved(path)
}

export async function doOpen(): Promise<void> {
  const r = await window.api.openProject()
  if (!r) return
  try {
    const doc = JSON.parse(r.content)
    if (doc?.version !== 1 || !Array.isArray(doc.pages) || !doc.meta?.designWidth) {
      throw new Error('文件格式不正确')
    }
    useEditor.getState().loadProject(doc, r.path)
  } catch (e) {
    alert('无法打开工程文件：' + (e as Error).message)
  }
}

/** 导出当前页面为 PNG（2x 光栅化，白底） */
export async function doExportPng(): Promise<void> {
  const s = useEditor.getState()
  const page = s.doc.pages[s.currentPageIndex]
  if (!page) return
  const { designWidth: dw, designHeight: dh } = s.doc.meta
  const scale = 2
  const body = page.nodes
    .filter((n) => n.visible)
    .map((n) => renderTreeSVG(n))
    .join('')
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${dw * scale}" height="${dh * scale}" viewBox="0 0 ${dw} ${dh}">` +
    `<rect width="${dw}" height="${dh}" fill="#ffffff"/>${body}</svg>`
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('SVG 光栅化失败'))
    img.src = url
  })
  const canvas = document.createElement('canvas')
  canvas.width = dw * scale
  canvas.height = dh * scale
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  const dataURL = canvas.toDataURL('image/png')
  await window.api.exportPng({ defaultName: page.name + '.png', dataURL })
}
