import { useEditor } from '../store/editorStore'
import { doOpen } from '../fileOps'

/** 未打开工程时的欢迎页 */
export default function Welcome() {
  const setShowNewModal = useEditor((s) => s.setShowNewModal)
  return (
    <div className="welcome">
      <div className="welcome-card">
        <div className="welcome-mark">▢◫</div>
        <h1>手游 UI 雏形设计工具</h1>
        <p className="welcome-sub">线框图 + 交互原型 · 当前未打开工程</p>
        <div className="welcome-actions">
          <button className="btn primary btn-lg" onClick={() => setShowNewModal(true)}>
            新建工程
          </button>
          <button className="btn btn-lg" onClick={() => void doOpen()}>
            打开工程…
          </button>
        </div>
        <p className="welcome-hint">
          新建时选择横竖屏与设计尺寸（1334×750、1170×2532 等预设）；工程保存为 .uiw 文件
        </p>
      </div>
    </div>
  )
}
