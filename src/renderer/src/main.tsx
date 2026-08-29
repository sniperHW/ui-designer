import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { useEditor } from './store/editorStore'
import { WIDGET_DEFS } from './widgets/registry'
import './styles.css'

// 开发模式暴露测试钩子（CDP 自动化用）
if (import.meta.env.DEV) {
  const w = window as unknown as Record<string, unknown>
  w.__uiw = useEditor
  w.__uiwDefs = WIDGET_DEFS
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
