# Claude Viewer

只读的 macOS 桌面应用，用来搜索和阅读 Claude Code 留在本机 `~/.claude` 下的历史 Session。

- **找得到**：⌘K 全局搜索（中英文子串匹配、`"短语"`、`-排除词`，可按 Project / 时间 / 角色 / 进行中过滤），可选扫描工具输出；命中直接跳到对应消息，包括 Subagent 内部和已回退的分支。
- **读得舒服**：工具调用折叠成摘要，Bash 终端输出、Edit diff、代码高亮按需展开；Subagent 在右侧面板查看完整过程；Branch 切换、Fork 折叠、compact 分隔；⌘F 会话内查找、`j`/`k` 按轮次跳转、轮次大纲。
- **实时**：监听文件变化，新 Session 自动出现；正在进行的 Session 实时追随。
- **统计**：按模型的每日 token、活跃热力图、Project 排行、工具调用与失败率、Subagent 使用，图表可下钻到 Session 列表。

术语见 [CONTEXT.md](CONTEXT.md)，完整规格见 [docs/spec.md](docs/spec.md)，关键取舍见 [docs/adr/](docs/adr/)。

## 只读保证

应用从不写入、移动或删除数据目录（默认 `~/.claude`）下的任何文件（[ADR-0002](docs/adr/0002-read-only.md)）。应用自己的状态只放在：

| 内容 | 位置 |
|---|---|
| 索引（可丢弃，随时重建） | `~/Library/Caches/dev.joy.claude-viewer/index.sqlite` |
| 设置（数据目录覆盖） | `~/Library/Application Support/dev.joy.claude-viewer/settings.json` |

索引只镜像数据目录当前内容：源文件被删，对应 Session 也随之消失；升级后索引格式变化会自动重建（[ADR-0003](docs/adr/0003-index-is-disposable-mirror.md)）。索引放在 Caches 中，不进入 Time Machine 备份。

## 数据目录

按以下顺序确定：设置中的覆盖 → 环境变量 `CLAUDE_CONFIG_DIR` → `~/.claude`。

从 Finder / Dock 启动的应用读不到 shell 里的环境变量，如果使用了 `CLAUDE_CONFIG_DIR`，请在「设置 → 数据」（⌘,）中填写路径。

## 环境要求

- macOS 14+，Apple Silicon
- Rust 1.90+（`rustup`）、Xcode Command Line Tools
- Node 22+ 与 pnpm

## 开发

```sh
pnpm install
pnpm tauri dev          # 启动应用（读取真实数据目录）
pnpm dev:mock           # 只启动前端，使用内置 mock 数据（浏览器打开 http://localhost:1420）
```

Rust 侧的 IPC 类型是唯一来源，修改 `crates/cv-core/src/model/*` 后重新生成前端绑定：

```sh
pnpm bindings           # 写入 src/ipc/bindings.ts（勿手改）
```

## 测试

```sh
cargo test --workspace                                  # 解析、组装、索引、搜索、统计、诊断（基于脱敏 fixture）
cargo clippy --workspace --all-targets -- -D warnings
pnpm typecheck && pnpm test                             # 前端类型检查与单元测试
pnpm exec playwright install webkit && pnpm test:e2e    # E2E（mock 模式，WebKit）
```

`crates/cv-core/tests/fixtures/` 是从真实 Session 精简、脱敏得到的结构样本（见其中的 README），由 `crates/cv-core/examples/sanitize.rs` 生成。

## 构建

```sh
pnpm tauri build --bundles app --target aarch64-apple-darwin
```

产物在 `target/aarch64-apple-darwin/release/bundle/macos/Claude Viewer.app`，使用 ad-hoc 签名、未公证；首次打开如被 Gatekeeper 拦截，右键选择「打开」。

## 结构

```
crates/cv-core/   纯 Rust 核心：扫描、容错解析、对话组装、SQLite 索引（FTS5 trigram）、搜索、统计、诊断
src-tauri/        Tauri 外壳：命令与事件、后台 worker、FSEvents 监听、Live 轮询、设置
src/              React 前端：features/* 各功能模块，ipc/ 为 IPC 层（real / mock 双实现）
e2e/              Playwright 用例
```
