import { useEffect } from 'react'
import { useEditor } from './store/editorStore'
import { doSave, doOpen } from './fileOps'
import Header from './components/Header'
import LibraryPanel from './components/LibraryPanel'
import PagePanel from './components/PagePanel'
import LayerPanel from './components/LayerPanel'
import Canvas from './components/Canvas'
import PropsPanel from './components/PropsPanel'
import StatusBar from './components/StatusBar'
import NewProjectModal from './components/NewProjectModal'

export default function App() {
  const showNewModal = useEditor((s) => s.showNewModal)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      const st = useEditor.getState()
      const mod = e.metaKey || e.ctrlKey
      const key = e.key.toLowerCase()
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
      } else if (mod && key === 'o') {
        e.preventDefault()
        void doOpen()
      } else if (mod && key === 'n') {
        e.preventDefault()
        st.setShowNewModal(true)
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
        st.setSelection([])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="app">
      <Header />
      <div className="body">
        <div className="left">
          <LibraryPanel />
          <PagePanel />
        </div>
        <div className="center">
          <Canvas />
          <LayerPanel />
        </div>
        <PropsPanel />
      </div>
      <StatusBar />
      {showNewModal && <NewProjectModal />}
    </div>
  )
}
