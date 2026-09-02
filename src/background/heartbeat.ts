import browser from 'webextension-polyfill'
import {
  getActiveWindowTab,
  getBrowser,
  getTab,
  getTabs,
  setBadge,
} from './helpers'
import config from '../config'
import { PimClient, sendHeartbeat } from './client'
import {
  appendLog,
  getEnabled,
  getInstanceId,
  setHeartbeatData,
  updateHeartbeatStats,
} from '../storage'
import * as punycode from 'punycode.js'

function decodeURL(url: string): string {
  try {
    const parsed = new URL(url)
    if (!parsed.hostname.includes('xn--')) {
      return url
    }

    // Do not assign parsed.hostname — the setter converts Unicode back to
    // punycode. Rebuild from parsed parts so userinfo is never mistaken
    // for the hostname.
    const decodedHost = punycode.toUnicode(parsed.hostname)
    const userinfo =
      parsed.username === ''
        ? ''
        : `${parsed.username}${
            parsed.password === '' ? '' : `:${parsed.password}`
          }@`
    const port = parsed.port === '' ? '' : `:${parsed.port}`
    return `${parsed.protocol}//${userinfo}${decodedHost}${port}${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch (e) {
    console.error('Error decoding URL:', e)
    return url
  }
}

// 上报协议与 PIM 守护进程 BrowserBridgeService 的 JSON 契约保持一致：
// { url, title, audible, incognito, tabCount, timestamp, browser, instanceId }
async function heartbeat(
  client: PimClient,
  tab: browser.Tabs.Tab | undefined,
  tabCount: number,
) {
  const enabled = await getEnabled()
  if (!enabled) {
    console.warn('Ignoring heartbeat because client has not been enabled')
    setBadge('off')
    return
  }

  if (!tab) {
    console.warn('Ignoring heartbeat because no active tab was found')
    return
  }

  if (!tab.url || !tab.title) {
    console.warn('Ignoring heartbeat because tab is missing URL or title')
    return
  }

  // 只保留需要的字段，避免持有完整 Tab 对象（favIconUrl 可能是很大的
  // base64 data URI），长期驻留会导致内存无限增长（上游 #222）。
  const { url, title, audible, incognito } = tab
  const [browserName, instanceId] = await Promise.all([
    getBrowser(),
    getInstanceId(),
  ])
  const heartbeatData = {
    url: decodeURL(url),
    title,
    audible: audible ?? false,
    incognito,
    tabCount,
    browser: browserName,
    instanceId,
    timestamp: new Date().toISOString(),
  }

  console.debug(`Sending heartbeat: ${heartbeatData.url}`)
  // 无论数据是否变化都要发送：守护进程依赖心跳判活（120s 静默即断连），
  // 长时间停留在同一页面时绝不能静默。
  const ok = await sendHeartbeat(client, heartbeatData)
  if (ok) {
    setBadge('ok')
    await setHeartbeatData({
      url: heartbeatData.url,
      title: heartbeatData.title,
      audible: heartbeatData.audible,
      incognito: heartbeatData.incognito,
      tabCount: heartbeatData.tabCount,
    })
    await updateHeartbeatStats({ increment: true, resetError: true })
  } else {
    setBadge('error')
    await updateHeartbeatStats({
      lastErrorAt: new Date().toISOString(),
      lastErrorMessage: '心跳上报失败，PIM 客户端可能未运行',
    })
    await appendLog('error', '心跳上报失败，PIM 客户端可能未运行')
  }
}

export const sendInitialHeartbeat = async (client: PimClient) => {
  const activeWindowTab = await getActiveWindowTab()
  const tabs = await getTabs()
  console.debug('Sending initial heartbeat', activeWindowTab?.url)
  await heartbeat(client, activeWindowTab, tabs.length)
}

export const heartbeatAlarmListener =
  (client: PimClient) => async (alarm: browser.Alarms.Alarm) => {
    if (alarm.name !== config.heartbeat.alarmName) return
    const activeWindowTab = await getActiveWindowTab()
    if (!activeWindowTab) return
    const tabs = await getTabs()
    console.debug('Sending heartbeat for alarm', activeWindowTab.url)
    await heartbeat(client, activeWindowTab, tabs.length)
  }

export const tabActivatedListener =
  (client: PimClient) =>
  async (activeInfo: browser.Tabs.OnActivatedActiveInfoType) => {
    const tab = await getTab(activeInfo.tabId)
    const tabs = await getTabs()
    console.debug('Sending heartbeat for tab activation', tab?.url)
    await heartbeat(client, tab, tabs.length)
  }
