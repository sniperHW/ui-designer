import { useEffect } from 'react'
import { useEditor } from '../store/editorStore'
import { doOpen, doOpenPath } from '../fileOps'

/** 未打开工程时的欢迎页（含最近打开列表） */
export default function Welcome() {
  const setShowNewModal = useEditor((s) => s.setShowNewModal)
  const recentFiles = useEditor((s) => s.recentFiles)
  const clearRecent = useEditor((s) => s.clearRecent)
  const refreshRecent = useEditor((s) => s.refreshRecent)

  // 每次进入欢迎页刷新一次最近列表（文件可能已被外部移动/删除）
  useEffect(() => {
    refreshRecent()
  }, [refreshRecent])

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
        {recentFiles.length > 0 && (
          <div className="welcome-recent">
            <div className="welcome-recent-title">
              <span>最近打开</span>
              <button className="link-btn" title="清空最近打开记录" onClick={() => clearRecent()}>
                清除记录
              </button>
            </div>
            <div className="welcome-recent-list">
              {recentFiles.map((f) => (
                <div
                  key={f.path}
                  className="welcome-recent-item"
                  title={f.path}
                  onClick={() => void doOpenPath(f.path)}
                >
                  <span className="welcome-recent-name">{f.name}</span>
                  <span className="welcome-recent-path">{f.path}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <p className="welcome-hint">
          新建时选择横竖屏与设计尺寸（1334×750、1170×2532 等预设）；工程保存为 .uiw 文件
        </p>
      </div>
    </div>
  )
}
