import browser from 'webextension-polyfill'
import config from '../config'
import {
  heartbeatAlarmListener,
  sendInitialHeartbeat,
  tabActivatedListener,
} from './heartbeat'
import { getClient } from './client'
import { getBrowser } from './helpers'
import {
  appendLog,
  getInstanceId,
  setEnabled,
  waitForEnabled,
} from '../storage'

/** Init */
console.info('Starting...')

console.debug('Creating client')
// getClient 需要读取用户配置的守护进程地址，异步构造
const clientReady = getClient()

browser.runtime.onInstalled.addListener(async () => {
  console.debug('Enabling the extension on install')
  await setEnabled(true)
  // 确保本实例拥有稳定的 instanceId（守护进程据此区分多浏览器/多窗口）
  await getInstanceId()
  const browserName = await getBrowser()
  await appendLog('info', `扩展已安装（${browserName}）`)
})

console.debug('Creating alarms and tab listeners')
browser.alarms.create(config.heartbeat.alarmName, {
  periodInMinutes: Math.max(
    1,
    Math.floor(config.heartbeat.intervalInSeconds / 60),
  ),
})
browser.alarms.onAlarm.addListener(async (alarm) => {
  const client = await clientReady
  return heartbeatAlarmListener(client)(alarm)
})
browser.tabs.onActivated.addListener(async (activeInfo) => {
  const client = await clientReady
  return tabActivatedListener(client)(activeInfo)
})

console.debug('Waiting for enable before sending initial heartbeat')
clientReady
  .then(() => waitForEnabled())
  .then(() => clientReady)
  .then((client) => sendInitialHeartbeat(client))
  .then(() => console.info('Started successfully'))
  .catch((err) => console.error('Failed to initialize extension:', err))

/**
 * Keep the service worker alive using Offscreen API to prevent Chrome's termination.
 */
async function setupOffscreen() {
  const _chrome = (globalThis as any).chrome
  if (typeof _chrome === 'undefined' || !_chrome.offscreen) return

  if (await _chrome.offscreen.hasDocument()) return

  try {
    await _chrome.offscreen.createDocument({
      url: 'src/offscreen.html',
      reasons: ['BLOBS'],
      justification: 'Keep service worker alive for heartbeat packets',
    })
  } catch (e) {
    console.error('Failed to create offscreen document:', e)
  }
}

browser.runtime.onMessage.addListener((message: any) => {
  if (message.type === 'KEEP_ALIVE') {
    return Promise.resolve({ status: 'ok' })
  }
  return undefined
})

// Initialize on startup and installation
browser.runtime.onStartup.addListener(setupOffscreen)
browser.runtime.onInstalled.addListener(setupOffscreen)

setupOffscreen()
