import browser from 'webextension-polyfill'
import config from '../config'
import {
  clearLogs,
  getBaseUrl,
  getBrowserName,
  getEnabled,
  getHeartbeatData,
  getHeartbeatStats,
  getLogs,
  getInstanceId,
  getSyncStatus,
  getWebUrl,
  setEnabled,
  watchLogs,
  watchSyncDate,
  watchSyncSuccess,
} from '../storage'
import { checkConnection } from '../background/client'

function setConnected(connected: boolean | undefined) {
  const connectedColor = connected ? '#1A9C5B' : '#D93025'
  const connectedText = connected ? '✔ 已连接' : '✖ 未连接'
  const connectedIcon = document.getElementById('status-connected-icon')
  if (!connectedIcon) throw Error('Connected icon is not defined')
  connectedIcon.innerHTML = connectedText
  connectedIcon.style.setProperty('color', connectedColor)
}

function setSyncDate(date: string | undefined) {
  const lastSyncString = date ? new Date(date).toLocaleString() : '从未'
  const statusLastSync = document.getElementById('status-last-sync')
  if (!statusLastSync) throw Error('Status last sync is not defined')
  statusLastSync.innerHTML = lastSyncString
}

async function renderStatus() {
  const webUrl = await getWebUrl()
  const enabled = await getEnabled()
  const syncStatus = await getSyncStatus()
  const browserName = await getBrowserName()
  const stats = await getHeartbeatStats()
  const heartbeatData = await getHeartbeatData()
  const instanceId = await getInstanceId()

  // Enabled checkbox
  const enabledCheckbox = document.getElementById('status-enabled-checkbox')
  if (!(enabledCheckbox instanceof HTMLInputElement))
    throw Error('Enable checkbox is not an input')
  enabledCheckbox.checked = enabled

  // Connected
  setConnected(syncStatus.success)
  watchSyncSuccess(setConnected)

  // Last sync
  setSyncDate(syncStatus.date)
  watchSyncDate(setSyncDate)

  // Stats
  const todayCount = document.getElementById('status-today-count')
  if (todayCount) todayCount.innerText = String(stats.count)
  const lastError = document.getElementById('status-last-error')
  if (lastError) {
    lastError.innerText = stats.lastErrorMessage ?? ''
    lastError.title = stats.lastErrorAt
      ? `最近失败时间：${new Date(stats.lastErrorAt).toLocaleString()}`
      : ''
  }

  // Current tab（仅存储可跟踪页面；内部页面心跳不上屏）
  const titleEl = document.getElementById('current-title')
  const urlEl = document.getElementById('current-url')
  if (titleEl && urlEl) {
    const currentUrl = heartbeatData?.url ?? ''
    titleEl.innerText = heartbeatData?.title ?? '暂无记录'
    urlEl.innerText = currentUrl
    titleEl.title = heartbeatData?.title ?? ''
    urlEl.title = currentUrl
  }

  // Testing
  if (config.isDevelopment) {
    const element = document.getElementById('testing-notice')!
    element.innerHTML = '扩展正处于开发模式'
    element.style.setProperty('color', '#F60')
    element.style.setProperty('font-size', '1.2em')
  }

  // Set webUI button link
  const webuiLink = document.getElementById('webui-link')
  if (!(webuiLink instanceof HTMLAnchorElement))
    throw Error('Web UI link is not an anchor')
  webuiLink.href = webUrl ?? '#'
  if (!webUrl) {
    webuiLink.style.setProperty('display', 'none')
  }

  // Browser name
  const browserNameElement = document.getElementById('status-browser')
  if (!(browserNameElement instanceof HTMLElement))
    throw Error('Browser name element is not defined')
  browserNameElement.innerText = browserName ?? 'unknown'

  // Instance id (short)
  const instanceElement = document.getElementById('status-instance')
  if (instanceElement) {
    instanceElement.innerText = `实例 ${instanceId.slice(-4)}`
  }

  // Daemon address tooltip
  const baseUrl = await getBaseUrl()
  const connectedRow = document.getElementById('status-connected-icon')
  if (connectedRow) {
    connectedRow.title = baseUrl ?? 'http://localhost:15601'
  }
}

async function renderLogs() {
  const logs = await getLogs()
  const list = document.getElementById('log-list')
  if (!list) return
  list.innerHTML = ''
  // 最新的排在最上面
  for (const entry of [...logs].reverse()) {
    const li = document.createElement('li')
    li.className = entry.level
    const time = new Date(entry.ts).toLocaleTimeString()
    li.innerText = `[${time}] ${entry.message}`
    list.appendChild(li)
  }
}

function switchTab(target: 'status' | 'logs') {
  const statusPanel = document.getElementById('panel-status')
  const logsPanel = document.getElementById('panel-logs')
  const statusTab = document.getElementById('tab-status')
  const logsTab = document.getElementById('tab-logs')
  if (!statusPanel || !logsPanel || !statusTab || !logsTab) return
  statusPanel.style.display = target === 'status' ? 'block' : 'none'
  logsPanel.style.display = target === 'logs' ? 'block' : 'none'
  statusTab.classList.toggle('active', target === 'status')
  logsTab.classList.toggle('active', target === 'logs')
  if (target === 'logs') {
    void renderLogs()
    watchLogs(renderLogs)
  }
}

function domListeners() {
  const enabledCheckbox = document.getElementById('status-enabled-checkbox')
  if (!(enabledCheckbox instanceof HTMLInputElement))
    throw Error('Enable checkbox is not an input')
  enabledCheckbox.addEventListener('change', async () => {
    const enabled = enabledCheckbox.checked
    await setEnabled(enabled)
  })

  const settingsButton = document.getElementById('settings-btn')
  if (!(settingsButton instanceof HTMLAnchorElement))
    throw Error('Settings button is not a link')
  settingsButton.addEventListener('click', (e) => {
    e.preventDefault()
    browser.runtime.openOptionsPage()
  })

  const checkNowBtn = document.getElementById('check-now-btn')
  checkNowBtn?.addEventListener('click', async () => {
    checkNowBtn.setAttribute('disabled', 'true')
    checkNowBtn.textContent = '检测中…'
    try {
      const client = await import('../background/client').then((m) =>
        m.getClient(),
      )
      await checkConnection(await client)
    } finally {
      checkNowBtn.removeAttribute('disabled')
      checkNowBtn.textContent = '立即检测'
      void renderStatus()
    }
  })

  const clearLogsBtn = document.getElementById('clear-logs-btn')
  clearLogsBtn?.addEventListener('click', async () => {
    await clearLogs()
    await renderLogs()
  })

  const tabStatus = document.getElementById('tab-status')
  const tabLogs = document.getElementById('tab-logs')
  tabStatus?.addEventListener('click', () => switchTab('status'))
  tabLogs?.addEventListener('click', () => switchTab('logs'))
}

renderStatus()
domListeners()
