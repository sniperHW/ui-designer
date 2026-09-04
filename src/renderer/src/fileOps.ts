import { useEditor } from './store/editorStore'
import { renderTreeSVG } from './widgets/registry'

/** 工程有未保存修改时确认丢弃；返回 false = 用户取消 */
export function confirmDiscard(): boolean {
  const s = useEditor.getState()
  if (s.dirty && !window.confirm('当前工程有未保存的修改，确定丢弃吗？')) return false
  return true
}

/** 保存工程；as=true 强制弹另存为对话框 */
export async function doSave(as = false): Promise<void> {
  const s = useEditor.getState()
  if (!s.hasProject) return
  const content = JSON.stringify(s.doc, null, 2)
  const path = as
    ? await window.api.saveProject({ content, defaultName: s.doc.meta.name + '.uiw' })
    : s.filePath
      ? await window.api.saveProject({ content, knownPath: s.filePath })
      : await window.api.saveProject({ content, defaultName: s.doc.meta.name + '.uiw' })
  if (path) useEditor.getState().markSaved(path)
}

export async function doOpen(): Promise<void> {
  if (!confirmDiscard()) return
  const r = await window.api.openProject()
  if (!r) return
  try {
    const doc = JSON.parse(r.content)
    if (doc?.version !== 1 || !Array.isArray(doc.pages) || !doc.meta?.designWidth) {
      throw new Error('文件格式不正确')
    }
    // 兼容旧工程文件：无 commonLayer / customWidgets 时补默认值
    if (!doc.commonLayer) {
      doc.commonLayer = { id: 'common', name: '公共层', nodes: [] }
    }
    if (!doc.customWidgets) doc.customWidgets = []
    useEditor.getState().loadProject(doc, r.path)
  } catch (e) {
    alert('无法打开工程文件：' + (e as Error).message)
  }
}

/** 导出当前页面为 PNG（2x 光栅化，白底；页面导出时包含公共层；编辑弹窗 / 轻提示时导出对应页） */
export async function doExportPng(): Promise<void> {
  const s = useEditor.getState()
  if (!s.hasProject) return
  const editingPopup = s.editingPopupId ? s.doc.popups.find((p) => p.id === s.editingPopupId) : null
  const editingTip = !editingPopup && s.editingTipId ? s.doc.tips.find((p) => p.id === s.editingTipId) : null
  const isCommon = !editingPopup && !editingTip && s.currentPageIndex < 0
  const page = editingPopup ?? editingTip ?? (isCommon ? s.doc.commonLayer : s.doc.pages[s.currentPageIndex])
  if (!page) return
  const { designWidth: dw, designHeight: dh } = s.doc.meta
  const scale = 2
  const commonBody =
    isCommon || editingPopup || editingTip
      ? ''
      : s.doc.commonLayer.nodes
          .filter((n) => n.visible)
          .map((n) => renderTreeSVG(n, s.doc.customWidgets))
          .join('')
  const body =
    commonBody +
    page.nodes
      .filter((n) => n.visible)
      .map((n) => renderTreeSVG(n, s.doc.customWidgets))
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
