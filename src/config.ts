const config = {
  isDevelopment: import.meta.env.DEV,
  heartbeat: {
    alarmName: 'heartbeat',
    intervalInSeconds: 60,
  },
  daemon: {
    // PIM 守护进程本地桥接地址，可在设置页覆盖
    defaultBaseUrl: 'http://localhost:15601',
    pingPath: '/browser/ping',
    heartbeatPath: '/browser/heartbeat',
  },
  logs: {
    // popup 内可见的环形日志上限
    maxEntries: 100,
  },
}

export default config
