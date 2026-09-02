# PIM 浏览器记录 / PIM Browser Watcher

fork 自 [ActivityWatch/aw-watcher-web](https://github.com/ActivityWatch/aw-watcher-web)，
改造为 PIM 平台「电脑记录」模块的浏览器采集插件：不再连接 ActivityWatch server，
而是把 URL 级心跳直接发送到本机 **PIM Windows 客户端**的桥接端口。

Forked from [ActivityWatch/aw-watcher-web](https://github.com/ActivityWatch/aw-watcher-web).
Repurposed for the PIM platform: instead of talking to an ActivityWatch server,
it sends URL-level heartbeats straight to the local **PIM Windows client** bridge.

## 与上游的差异 / Differences from upstream

- **协议**：去掉 aw-client/bucket/REST，改为
  `POST {daemon}/browser/heartbeat`（JSON：`url/title/audible/incognito/tabCount/timestamp/browser/instanceId`）
  与 `GET {daemon}/browser/ping` 探活。守护进程地址默认 `http://localhost:15601`，可在设置页修改。
- **UI**：popup/设置页中文化；新增「日志」页（环形缓冲，展示最近 100 条事件）、
  「立即检测」按钮、工具栏角标（绿√ 正常 / 红× 上报失败 / 灰「停」已停用）。
- **心跳语义**：每次 alarm（60s）与标签页切换都会发送心跳——即使数据未变化。
  守护进程依赖心跳判活（120s 静默即断连），因此绝不能静默。
- **浏览器识别**：Edge 优先于 Chrome 判定；`instanceId` 为随机 UUID，持久化于 storage，
  用于区分同一浏览器的多个窗口/Profile。
- 移除了 ActivityWatch 的 consent 页面、hostname/bucket 概念与 `aw-client` 依赖。

## 构建 / Build

要求 Node.js ≥ 20。

```bash
npm ci
npm run compile        # 类型检查 / type check
npm run build          # Chrome 目标 → build/
VITE_TARGET_BROWSER=firefox npx vite build   # Firefox 目标（尽力支持）
```

Chrome/Edge 安装：打开 `chrome://extensions` → 开启「开发者模式」→
「加载已解压的扩展程序」→ 选择 `build/` 目录。

## 配置 / Configuration

打开扩展的「设置」页（popup → ⚙ 设置）：

- **守护进程地址**：默认 `http://localhost:15601`，即 PIM Windows 客户端桥接端口；
- **PIM 网页地址**：popup「打开 PIM」按钮的跳转地址（可选）；
- **浏览器名称**：默认自动检测，用于在 PIM 电脑记录中区分浏览器。

## 数据与隐私 / Data & privacy

仅采集当前活动标签页的 URL、标题、声音播放与无痕状态，且只发送到本机守护进程
（仅回环地址可访问）。不会发往任何第三方服务器。
