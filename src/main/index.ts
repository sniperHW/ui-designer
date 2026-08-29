import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { writeFile, readFile } from 'fs/promises'

// 自动化测试用：UIW_DEBUG_PORT=9222 npm run dev 开启 CDP 远程调试
if (process.env.UIW_DEBUG_PORT) {
  app.commandLine.appendSwitch('remote-debugging-port', process.env.UIW_DEBUG_PORT)
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
    return { path: res.filePaths[0], content }
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
