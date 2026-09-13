import { BrowserView, BrowserWindow } from "electron"
import type { Rectangle } from "electron"

export type BrowserState = {
  open: boolean
  url: string
  title: string
  loading: boolean
  canGoBack: boolean
  canGoForward: boolean
}

const views = new WeakMap<BrowserWindow, BrowserView>()

function validURL(value: string) {
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`)
    return url.protocol === "http:" || url.protocol === "https:" ? url : undefined
  } catch {
    return undefined
  }
}

function state(win: BrowserWindow): BrowserState {
  const view = views.get(win)
  if (!view) return { open: false, url: "", title: "", loading: false, canGoBack: false, canGoForward: false }
  const contents = view.webContents
  return {
    open: true,
    url: contents.getURL(),
    title: contents.getTitle(),
    loading: contents.isLoading(),
    canGoBack: contents.navigationHistory.canGoBack(),
    canGoForward: contents.navigationHistory.canGoForward(),
  }
}

function emit(win: BrowserWindow) {
  if (win.isDestroyed()) return
  win.webContents.send("integrated-browser-state", state(win))
}

function view(win: BrowserWindow) {
  const existing = views.get(win)
  if (existing) return existing

  const browser = new BrowserView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      partition: "persist:opencode-browser",
    },
  })
  const contents = browser.webContents
  contents.setWindowOpenHandler(({ url }) => {
    void navigate(win, url)
    return { action: "deny" }
  })
  contents.on("did-navigate", () => emit(win))
  contents.on("did-navigate-in-page", () => emit(win))
  contents.on("did-start-loading", () => emit(win))
  contents.on("did-stop-loading", () => emit(win))
  contents.on("page-title-updated", () => emit(win))
  contents.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false))
  contents.session.on("will-download", (_event, item) => item.cancel())
  win.addBrowserView(browser)
  views.set(win, browser)
  win.once("closed", () => views.delete(win))
  return browser
}

export function open(win: BrowserWindow, url?: string) {
  const browser = view(win)
  browser.setBounds({ x: 0, y: 0, width: 0, height: 0 })
  if (url) void navigate(win, url)
  emit(win)
}

export async function navigate(win: BrowserWindow, value: string) {
  const url = validURL(value)
  if (!url) return
  const browser = view(win)
  await browser.webContents.loadURL(url.toString()).catch(() => undefined)
  emit(win)
}

export function bounds(win: BrowserWindow, value: Rectangle) {
  const browser = views.get(win)
  if (!browser) return
  browser.setBounds(value)
}

export function close(win: BrowserWindow) {
  const browser = views.get(win)
  if (!browser) return
  win.removeBrowserView(browser)
  browser.webContents.close()
  views.delete(win)
  emit(win)
}

export function back(win: BrowserWindow) {
  const browser = views.get(win)
  if (browser?.webContents.navigationHistory.canGoBack()) browser.webContents.navigationHistory.goBack()
}

export function forward(win: BrowserWindow) {
  const browser = views.get(win)
  if (browser?.webContents.navigationHistory.canGoForward()) browser.webContents.navigationHistory.goForward()
}

export function reload(win: BrowserWindow) {
  views.get(win)?.webContents.reload()
}

export function current(win: BrowserWindow) {
  return state(win)
}
