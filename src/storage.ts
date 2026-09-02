import browser from 'webextension-polyfill'
import config from './config'

function watchKey<T>(key: string, cb: (value: T) => void | Promise<void>) {
  const listener = (
    changes: browser.Storage.StorageAreaOnChangedChangesType,
  ) => {
    if (!(key in changes)) return
    cb(changes[key].newValue as T)
  }
  browser.storage.local.onChanged.addListener(listener)
  return () => browser.storage.local.onChanged.removeListener(listener)
}

async function waitForKey<T>(key: string, desiredValue: T) {
  const value = await browser.storage.local.get(key).then((_) => _[key])
  if (value === desiredValue) return
  return new Promise<void>((resolve) => {
    const unsubscribe = watchKey<T>(key, (value) => {
      if (value !== desiredValue) return
      resolve()
      unsubscribe()
    })
  })
}

type StorageData = { [key: string]: any }

type SyncStatus = { success?: boolean; date?: string }
export const getSyncStatus = (): Promise<SyncStatus> =>
  browser.storage.local
    .get(['lastSyncSuccess', 'lastSync'])
    .then(({ lastSyncSuccess, lastSync }) => ({
      success:
        lastSyncSuccess === undefined
          ? lastSyncSuccess
          : Boolean(lastSyncSuccess),
      date: lastSync === undefined ? lastSync : String(lastSync),
    }))
export const setSyncStatus = (lastSyncSuccess: boolean) =>
  browser.storage.local.set({
    lastSyncSuccess,
    lastSync: new Date().toISOString(),
  })
export const watchSyncSuccess = (
  cb: (success: boolean | undefined) => void | Promise<void>,
) => watchKey('lastSyncSuccess', cb)
export const watchSyncDate = (
  cb: (date: string | undefined) => void | Promise<void>,
) => watchKey('lastSync', cb)

type Enabled = boolean
export const waitForEnabled = () => waitForKey('enabled', true)
export const getEnabled = (): Promise<Enabled> =>
  browser.storage.local.get('enabled').then((_) => Boolean(_.enabled))
export const setEnabled = (enabled: Enabled) =>
  browser.storage.local.set({ enabled })

type BaseUrl = string
export const getBaseUrl = (): Promise<BaseUrl | undefined> =>
  browser.storage.local
    .get('baseUrl')
    .then((_) => _.baseUrl as BaseUrl | undefined)
export const setBaseUrl = (baseUrl: BaseUrl) =>
  browser.storage.local.set({ baseUrl })

// popup「打开 PIM」按钮指向的 PIM 服务端网页地址
export const getWebUrl = (): Promise<string | undefined> =>
  browser.storage.local
    .get('webUrl')
    .then((_) => _.webUrl as string | undefined)
export const setWebUrl = (webUrl: string) =>
  browser.storage.local.set({ webUrl })

export type HeartbeatData = {
  url: string
  title: string
  audible: boolean
  incognito: boolean
  tabCount: number
}
export const getHeartbeatData = (): Promise<HeartbeatData | undefined> =>
  browser.storage.local
    .get('heartbeatData')
    .then((_) => _.heartbeatData as HeartbeatData | undefined)
export const setHeartbeatData = (heartbeatData: HeartbeatData) =>
  browser.storage.local.set({ heartbeatData })

type BrowserName = string
export const getBrowserName = (): Promise<BrowserName | undefined> =>
  browser.storage.local
    .get('browserName')
    .then((data: StorageData) => data.browserName as BrowserName | undefined)
export const setBrowserName = (browserName: BrowserName) =>
  browser.storage.local.set({ browserName })

// 本浏览器实例的稳定标识，守护进程据此区分多个窗口/Profile
export const getInstanceId = async (): Promise<string> => {
  const data = await browser.storage.local.get('instanceId')
  let instanceId = data.instanceId as string | undefined
  if (!instanceId) {
    instanceId = crypto.randomUUID()
    await browser.storage.local.set({ instanceId })
  }
  return instanceId
}

// —— 运行统计（popup 展示） ——
export type HeartbeatStats = {
  date: string
  count: number
  lastSuccessAt?: string
  lastErrorAt?: string
  lastErrorMessage?: string
}
const today = () => new Date().toISOString().slice(0, 10)
export const getHeartbeatStats = (): Promise<HeartbeatStats> =>
  browser.storage.local.get('heartbeatStats').then((_) => {
    const stats = (_.heartbeatStats ?? {}) as Partial<HeartbeatStats>
    if (stats.date !== today()) {
      return { date: today(), count: 0 }
    }
    return {
      date: stats.date,
      count: stats.count ?? 0,
      lastSuccessAt: stats.lastSuccessAt,
      lastErrorAt: stats.lastErrorAt,
      lastErrorMessage: stats.lastErrorMessage,
    }
  })
export const updateHeartbeatStats = async (
  patch: Partial<Omit<HeartbeatStats, 'date' | 'count'>> & {
    increment?: boolean
    resetError?: boolean
  },
) => {
  const stats = await getHeartbeatStats()
  const next: HeartbeatStats = {
    date: stats.date,
    count: stats.count + (patch.increment ? 1 : 0),
    lastSuccessAt: patch.resetError
      ? new Date().toISOString()
      : (patch.lastSuccessAt ?? stats.lastSuccessAt),
  }
  if (!patch.resetError) {
    next.lastErrorAt = patch.lastErrorAt ?? stats.lastErrorAt
    next.lastErrorMessage = patch.lastErrorMessage ?? stats.lastErrorMessage
  }
  await browser.storage.local.set({ heartbeatStats: next })
}

// —— 环形日志（MV3 service worker 没有 persistent console，popup 内展示最近事件） ——
export type LogEntry = {
  ts: string
  level: 'info' | 'warn' | 'error'
  message: string
}
export const getLogs = (): Promise<LogEntry[]> =>
  browser.storage.local.get('logs').then((_) => (_.logs ?? []) as LogEntry[])
export const appendLog = async (level: LogEntry['level'], message: string) => {
  const logs = await getLogs()
  logs.push({ ts: new Date().toISOString(), level, message })
  while (logs.length > config.logs.maxEntries) logs.shift()
  await browser.storage.local.set({ logs })
}
export const clearLogs = () => browser.storage.local.set({ logs: [] })
export const watchLogs = (cb: (logs: LogEntry[]) => void | Promise<void>) =>
  watchKey('logs', cb as (value: unknown) => void | Promise<void>)
