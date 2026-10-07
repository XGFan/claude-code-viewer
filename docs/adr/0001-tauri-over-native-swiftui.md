# 用 Tauri 而不是 SwiftUI 原生壳

对话渲染（markdown、代码高亮、diff）是体验核心，而这在 Web 生态最成熟；Tauri 在 macOS 上同样使用系统 WKWebView，渲染效果与"SwiftUI + WKWebView"方案一致，却只需维护一套 UI 和一层 IPC 桥。因此选择 Tauri（Rust 后端负责解析与索引，Web 前端负责全部 UI）。

## Considered Options

- **纯 SwiftUI**：长对话中大量变高富文本在 `List` 中性能难调，markdown/高亮/diff 需自行拼装。
- **SwiftUI 外壳 + WKWebView 渲染对话**：原生感最好，且 Spotlight、Quick Look、原生多标签页接入成本低；但需维护两套 UI、两套状态与手写 JS 桥。我们判定这些深度集成不是刚需，不值得这份成本。

## Consequences

- 若将来要做 Spotlight 索引或 Quick Look 预览，需通过 `objc2`/Swift 插件桥接，属于逆框架方向的工作。
- `tauri-driver` 不支持 macOS，E2E 走"Playwright 驱动前端 + mock IPC"，Rust 后端单独测试。
