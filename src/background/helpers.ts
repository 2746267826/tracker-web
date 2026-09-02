import browser from 'webextension-polyfill'
import { appendLog, getBrowserName, setBrowserName } from '../storage'

export const getTab = (id: number) => browser.tabs.get(id)
export const getTabs = (query: browser.Tabs.QueryQueryInfoType = {}) =>
  browser.tabs.query(query)

export const getActiveWindowTab = async (): Promise<
  browser.Tabs.Tab | undefined
> => {
  const tabs = await getTabs({
    active: true,
    currentWindow: true,
  })

  if (tabs.length > 0) {
    return tabs[0]
  }

  console.debug('No active tab found in current window')

  const allTabs = await getTabs({
    active: true,
  })

  if (allTabs.length > 0) {
    return allTabs[0]
  }

  console.debug('No active tab found in any window')

  return undefined
}

export function emitNotification(title: string, message: string) {
  browser.notifications.create({
    type: 'basic',
    iconUrl: browser.runtime.getURL('media/logo/logo-128.png'),
    title,
    message,
  })
}

export const getBrowser = async (): Promise<string> => {
  const storedName = await getBrowserName()
  if (storedName) {
    return storedName
  }

  const browserName = detectBrowser()

  await setBrowserName(browserName)
  return browserName
}

export const detectBrowser = () => {
  // Edge 的 UA 同样包含 Chrome，必须先判断 Edg/
  if (navigator.userAgent.includes('Edg/')) {
    return 'edge'
  } else if ((navigator as any).brave?.isBrave?.()) {
    return 'brave'
  } else if (
    navigator.userAgent.includes('Opera') ||
    navigator.userAgent.includes('OPR')
  ) {
    return 'opera'
  } else if (navigator.userAgent.includes('Firefox')) {
    return 'firefox'
  } else if (navigator.userAgent.includes('Chrome')) {
    return 'chrome'
  } else if (navigator.userAgent.includes('Safari')) {
    return 'safari'
  } else {
    return 'other'
  }
}

export async function logHttpError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  console.error('HTTP error:', message)
  await appendLog('error', `HTTP 错误: ${message}`)
}

// 工具栏角标：ok=绿√（正常上报），error=红×（上报失败），off=灰「停」（已停用）
// Chrome MV3 使用 chrome.action，Firefox MV2 只有 browser.browserAction。
type BadgeState = 'ok' | 'error' | 'off'
function getActionApi(): any {
  const g = globalThis as any
  if (g.chrome?.action) return g.chrome.action
  if ((browser as any).browserAction) return (browser as any).browserAction
  return (browser as any).action
}
export function setBadge(state: BadgeState) {
  try {
    const action = getActionApi()
    if (!action) return
    if (state === 'ok') {
      action.setBadgeBackgroundColor({ color: '#1A9C5B' })
      action.setBadgeText({ text: '√' })
    } else if (state === 'error') {
      action.setBadgeBackgroundColor({ color: '#D93025' })
      action.setBadgeText({ text: '×' })
    } else {
      action.setBadgeBackgroundColor({ color: '#9AA0A6' })
      action.setBadgeText({ text: '停' })
    }
  } catch (e) {
    console.warn('Failed to update badge', e)
  }
}
