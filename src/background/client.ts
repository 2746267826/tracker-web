import config from '../config'
import retry from 'p-retry'
import { emitNotification, logHttpError } from './helpers'
import { getBaseUrl, getSyncStatus, setSyncStatus, appendLog } from '../storage'

// PIM 守护进程本地桥接客户端。
// 协议：GET /browser/ping 探活；POST /browser/heartbeat 上报当前标签页。
export class PimClient {
  baseURL: string

  constructor(baseURL?: string) {
    this.baseURL = (baseURL ?? config.daemon.defaultBaseUrl).replace(/\/+$/, '')
  }

  async ping(): Promise<void> {
    const res = await fetch(`${this.baseURL}${config.daemon.pingPath}`)
    if (!res.ok) {
      throw new Error(`PIM daemon ping failed with status ${res.status}`)
    }
  }

  async sendHeartbeat(heartbeat: {
    url: string
    title: string
    audible: boolean
    incognito: boolean
    tabCount: number
    browser: string
    instanceId: string
    timestamp: string
  }): Promise<void> {
    const res = await fetch(`${this.baseURL}${config.daemon.heartbeatPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(heartbeat),
    })
    if (!res.ok && res.status !== 204) {
      throw new Error(`PIM daemon heartbeat failed with status ${res.status}`)
    }
  }
}

export const getClient = async (): Promise<PimClient> =>
  new PimClient(await getBaseUrl())

// 连接状态在成功/失败之间切换时给出系统通知，平时保持安静。
async function reportSyncResult(success: boolean, error?: unknown) {
  const syncStatus = await getSyncStatus()
  if (success) {
    if (syncStatus.success === false) {
      emitNotification('已重新连接 PIM', '浏览器记录恢复上报')
      await appendLog('info', '重新连接 PIM 守护进程')
    }
    await setSyncStatus(true)
  } else {
    if (syncStatus.success !== false) {
      emitNotification('无法连接 PIM 守护进程', '请确认 PIM 客户端正在运行')
      await appendLog(
        'error',
        `连接 PIM 守护进程失败，请确认 PIM 客户端正在运行：${String(error)}`,
      )
    }
    await setSyncStatus(false)
    await logHttpError(error)
  }
}

export async function checkConnection(client: PimClient): Promise<boolean> {
  try {
    await retry(() => client.ping(), { retries: 2, minTimeout: 500 })
    await reportSyncResult(true)
    return true
  } catch (err) {
    await reportSyncResult(false, err)
    return false
  }
}

export async function sendHeartbeat(
  client: PimClient,
  heartbeat: Parameters<PimClient['sendHeartbeat']>[0],
): Promise<boolean> {
  try {
    await retry(() => client.sendHeartbeat(heartbeat), {
      retries: 2,
      minTimeout: 500,
    })
    await reportSyncResult(true)
    return true
  } catch (err) {
    await reportSyncResult(false, err)
    return false
  }
}
