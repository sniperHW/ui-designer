import { useEffect, useState } from 'react'
import { useEditor } from './store/editorStore'
import { doSave, doOpen, confirmDiscard } from './fileOps'
import Header from './components/Header'
import LibraryPanel from './components/LibraryPanel'
import PagePanel from './components/PagePanel'
import LayerPanel from './components/LayerPanel'
import Canvas from './components/Canvas'
import PropsPanel from './components/PropsPanel'
import StatusBar from './components/StatusBar'
import EditTargetBar from './components/EditTargetBar'
import NewProjectModal from './components/NewProjectModal'
import Welcome from './components/Welcome'
import Resizer from './components/Resizer'
import Preview from './components/Preview'

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

export default function App() {
  const showNewModal = useEditor((s) => s.showNewModal)
  const hasProject = useEditor((s) => s.hasProject)
  // 各功能区尺寸（会话内记忆，不入文档）
  const [leftW, setLeftW] = useState(232)
  const [pagesH, setPagesH] = useState(212)
  const [layersH, setLayersH] = useState(198)
  const [rightW, setRightW] = useState(440)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      const st = useEditor.getState()
      const mod = e.metaKey || e.ctrlKey
      const key = e.key.toLowerCase()
      // 新建 / 打开在任何状态下可用（未保存时先确认）
      if (mod && key === 'n') {
        e.preventDefault()
        if (confirmDiscard()) st.setShowNewModal(true)
        return
      }
      if (mod && key === 'o') {
        e.preventDefault()
        void doOpen()
        return
      }
      if (!st.hasProject) return
      if (mod && key === 'z') {
        e.preventDefault()
        if (e.shiftKey) st.redo()
        else st.undo()
      } else if (mod && key === 'y') {
        e.preventDefault()
        st.redo()
      } else if (mod && key === 'c') {
        st.copySelected()
      } else if (mod && key === 'v') {
        st.paste()
      } else if (mod && key === 'd') {
        e.preventDefault()
        st.duplicateSelected()
      } else if (mod && key === 'a') {
        e.preventDefault()
        st.selectAll()
      } else if (mod && key === 's') {
        e.preventDefault()
        void doSave(false)
      } else if (mod && (key === '=' || key === '+')) {
        e.preventDefault()
        st.zoomByCenter(1.2)
      } else if (mod && key === '-') {
        e.preventDefault()
        st.zoomByCenter(1 / 1.2)
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        st.deleteSelected()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        st.nudge(e.shiftKey ? -10 : -1, 0)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        st.nudge(e.shiftKey ? 10 : 1, 0)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        st.nudge(0, e.shiftKey ? -10 : -1)
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        st.nudge(0, e.shiftKey ? 10 : 1)
      } else if (e.key === 'Escape') {
        // 优先收起弹窗 / 轻提示演示 / 右键菜单，其次退出原型预览，最后才清空选择
        if (st.tip) st.closeTip()
        else if (st.popupId) st.closePopup()
        else if (st.ctxMenu) st.closeCtxMenu()
        else if (st.previewing) st.stopPreview()
        else st.setSelection([])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="app">
      <Header />
      {hasProject ? (
        <div className="body">
          <div className="left" style={{ width: leftW }}>
            <LibraryPanel />
            <Resizer dir="h" onResize={(d) => setPagesH((h) => clamp(h - d, 110, 520))} />
            <PagePanel height={pagesH} />
          </div>
          <Resizer dir="v" onResize={(d) => setLeftW((w) => clamp(w + d, 160, 440))} />
          <div className="center">
            <EditTargetBar />
            <Canvas />
            <Resizer dir="h" onResize={(d) => setLayersH((h) => clamp(h - d, 100, 560))} />
            <LayerPanel height={layersH} />
          </div>
          <Resizer dir="v" onResize={(d) => setRightW((w) => clamp(w - d, 200, 440))} />
          <PropsPanel width={rightW} />
        </div>
      ) : (
        <Welcome />
      )}
      <StatusBar />
      {showNewModal && <NewProjectModal />}
      {useEditor((s) => s.previewing) && <Preview />}
    </div>
  )
}
