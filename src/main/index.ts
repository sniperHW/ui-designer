import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join, basename } from 'path'
import { writeFile, readFile } from 'fs/promises'
import { existsSync } from 'fs'

// 自动化测试用：UIW_DEBUG_PORT=9222 npm run dev 开启 CDP 远程调试
if (process.env.UIW_DEBUG_PORT) {
  app.commandLine.appendSwitch('remote-debugging-port', process.env.UIW_DEBUG_PORT)
}

// ---------- 最近打开文件（持久化到用户数据目录，上限 10 条） ----------

const RECENT_LIMIT = 10
const recentFile = () => join(app.getPath('userData'), 'recent-files.json')

async function loadRecent(): Promise<string[]> {
  try {
    const data = JSON.parse(await readFile(recentFile(), 'utf-8'))
    return Array.isArray(data) ? data.filter((p) => typeof p === 'string') : []
  } catch {
    return []
  }
}

async function saveRecent(list: string[]): Promise<void> {
  await writeFile(recentFile(), JSON.stringify(list, null, 2), 'utf-8')
}

/** 记录一次打开/保存：去重置顶、超限截断，并同步系统级最近文档（macOS Dock / Windows 任务栏） */
async function touchRecent(path: string): Promise<void> {
  const list = (await loadRecent()).filter((p) => p !== path)
  list.unshift(path)
  await saveRecent(list.slice(0, RECENT_LIMIT))
  app.addRecentDocument(path)
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 1100,
    minHeight: 720,
    title: '手游 UI 雏形设计工具',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  ipcMain.handle('project:save', async (_e, args: { content: string; knownPath?: string; defaultName?: string }) => {
    let filePath = args.knownPath ?? null
    if (!filePath) {
      const res = await dialog.showSaveDialog({
        title: '保存工程',
        defaultPath: args.defaultName || '未命名工程.uiw',
        filters: [{ name: 'UI 工程', extensions: ['uiw'] }]
      })
      if (res.canceled || !res.filePath) return null
      filePath = res.filePath
    }
    await writeFile(filePath, args.content, 'utf-8')
    await touchRecent(filePath)
    return filePath
  })

  ipcMain.handle('project:open', async () => {
    const res = await dialog.showOpenDialog({
      title: '打开工程',
      properties: ['openFile'],
      filters: [
        { name: 'UI 工程', extensions: ['uiw'] },
        { name: 'JSON', extensions: ['json'] }
      ]
    })
    if (res.canceled || !res.filePaths[0]) return null
    const content = await readFile(res.filePaths[0], 'utf-8')
    await touchRecent(res.filePaths[0])
    return { path: res.filePaths[0], content }
  })

  // 最近打开列表（已过滤磁盘上不存在的文件；name = 文件名去 .uiw 扩展）
  ipcMain.handle('recent:list', async () => {
    const list = await loadRecent()
    return list
      .filter((p) => existsSync(p))
      .map((p) => ({ path: p, name: basename(p).replace(/\.uiw$/i, '') }))
  })

  // 从最近记录直接打开（不经对话框）；文件已被移动/删除时返回 null 并顺带清理该条记录
  ipcMain.handle('recent:open', async (_e, path: string) => {
    if (typeof path !== 'string' || !existsSync(path)) {
      await saveRecent((await loadRecent()).filter((p) => p !== path))
      return null
    }
    try {
      const content = await readFile(path, 'utf-8')
      await touchRecent(path)
      return { path, content }
    } catch {
      return null
    }
  })

  ipcMain.handle('recent:clear', async () => {
    await saveRecent([])
    app.clearRecentDocuments()
  })

  ipcMain.handle('png:export', async (_e, args: { defaultName: string; dataURL: string }) => {
    const res = await dialog.showSaveDialog({
      title: '导出 PNG',
      defaultPath: args.defaultName,
      filters: [{ name: 'PNG 图片', extensions: ['png'] }]
    })
    if (res.canceled || !res.filePath) return null
    const base64 = args.dataURL.replace(/^data:image\/png;base64,/, '')
    await writeFile(res.filePath, Buffer.from(base64, 'base64'))
    return res.filePath
  })

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
